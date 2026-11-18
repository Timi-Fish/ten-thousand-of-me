"""估计歌曲的 BPM、首拍偏移和逐秒响度曲线（只用 numpy/scipy）。
用法：python3 analyze.py <音频> [输出.json]
"""
import json
import subprocess
import sys

import numpy as np
from scipy.signal import stft

SR = 22050
audio = sys.argv[1]
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", audio, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
    check=True, capture_output=True,
).stdout
x = np.frombuffer(raw, dtype=np.float32)
dur = len(x) / SR

HOP = 256
_, _, Z = stft(x, fs=SR, nperseg=1024, noverlap=1024 - HOP)
mag = np.log1p(40 * np.abs(Z))
flux = np.maximum(0, np.diff(mag, axis=1)).sum(axis=0)
flux = flux - np.convolve(flux, np.ones(43) / 43, mode="same")
flux = np.maximum(0, flux)
fps = SR / HOP

# 自相关找节拍周期，范围 70–200 BPM
ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
lags = np.arange(len(ac))
bpm_of = lambda lag: 60 * fps / lag
cand = [(ac[lag], lag) for lag in lags[1:] if 70 <= bpm_of(lag) <= 200]
cand.sort(reverse=True)
best_lag = cand[0][1]
# 抛物线插值细化
y0, y1, y2 = ac[best_lag - 1], ac[best_lag], ac[best_lag + 1]
lag_f = best_lag + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)
bpm = bpm_of(lag_f)

# 在候选 BPM 附近微调，使节拍梳状函数与起音能量相关最大，同时求相位
def score(b):
    period = 60 * fps / b
    best = (-1, 0)
    for ph in np.linspace(0, period, 48, endpoint=False):
        idx = np.round(np.arange(ph, len(flux), period)).astype(int)
        idx = idx[idx < len(flux)]
        s = flux[idx].mean()
        if s > best[0]:
            best = (s, ph)
    return best

fine = [(score(b), b) for b in np.arange(bpm - 1.5, bpm + 1.5, 0.02)]
(sc, ph), bpm = max(fine)
offset = ph / fps

sec = int(dur)
rms = [float(np.sqrt(np.mean(x[i * SR:(i + 1) * SR] ** 2))) for i in range(sec)]
top = [(round(float(a / cand[0][0]), 2), round(float(bpm_of(l)), 1)) for a, l in cand[:6]]
info = {"duration": dur, "bpm": round(float(bpm), 2), "beat_offset": round(float(offset), 3), "bpm_candidates": top, "rms_per_sec": [round(r, 3) for r in rms]}
print(json.dumps({k: v for k, v in info.items() if k != "rms_per_sec"}, ensure_ascii=False))
peak = max(rms)
print("响度(每秒, 0-9):")
print("".join(str(min(9, int(r / peak * 9.99))) for r in rms))
if len(sys.argv) > 2:
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=1)

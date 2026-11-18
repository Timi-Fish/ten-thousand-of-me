"""从成品歌曲导出 MV 用的逐帧音频数据（30fps）：人声频段包络 vox、低频冲击包络 kick，以及 BPM。
用法：python3 audiodata.py <音频> <analysis.json> <输出 audio-data.json>
另外打印指定时间窗内的起音时刻，方便手工对分镜。
"""
import json
import subprocess
import sys

import numpy as np
from scipy.signal import butter, sosfiltfilt

SR, FPS = 22050, 30
audio, analysis, out = sys.argv[1:4]
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", audio, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
    check=True, capture_output=True,
).stdout
x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
hop = SR // FPS


def band_env(lo, hi):
    sos = butter(4, [lo, hi], btype="band", fs=SR, output="sos")
    y = sosfiltfilt(sos, x)
    n = len(y) // hop
    return np.sqrt((y[: n * hop].reshape(n, hop) ** 2).mean(axis=1))


def norm(e):
    return np.clip(e / np.percentile(e, 97), 0, 1)


vox = norm(band_env(350, 3200))
vox = np.convolve(vox, np.ones(3) / 3, mode="same")          # 轻微平滑，避免口型抖动

low = band_env(35, 140)
onset = np.maximum(0, np.diff(low, prepend=low[0]))
onset = norm(onset)
kick = np.zeros_like(onset)                                    # 起音触发、指数衰减 → 画面"咚"一下
level = 0.0
for i, v in enumerate(onset):
    level = max(v, level * 0.78)
    kick[i] = level

info = json.load(open(analysis, encoding="utf-8"))
data = {
    "fps": FPS, "bpm": info["bpm"], "beat_offset": info["beat_offset"],
    "vox": [round(float(v), 3) for v in vox], "kick": [round(float(v), 3) for v in kick],
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f)
print(f"帧数 {len(vox)}，时长 {len(vox) / FPS:.2f}s")

# 全频段起音检测：打印若干时间窗内的重拍时刻
full = np.sqrt((x[: len(x) // hop * hop].reshape(-1, hop) ** 2).mean(axis=1))
rise = np.maximum(0, np.diff(full, prepend=full[0]))
thr = np.percentile(rise, 96)
for a, b in [(0, 16), (86, 92), (116, 123), (148, 176)]:
    hits = [i / FPS for i in range(int(a * FPS), min(len(rise), int(b * FPS))) if rise[i] > thr and rise[i] >= rise[max(0, i - 3): i + 4].max()]
    print(f"{a}-{b}s 重拍:", " ".join(f"{h:.2f}" for h in hits))
    print(f"   响度(每 0.5s):", " ".join(f"{full[int(s * FPS): int((s + .5) * FPS)].mean() / full.max():.2f}" for s in np.arange(a, min(b, len(full) / FPS - .5), .5)))

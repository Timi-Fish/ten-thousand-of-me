"""把一条歌曲音频转写成带词级时间戳的 JSON，用来核对咬字、给 MV 对歌词时间轴。
用法：uv run --python 3.12 --with mlx-whisper transcribe.py <音频> <输出.json>
"""
import json
import sys

import mlx_whisper

audio, out = sys.argv[1], sys.argv[2]
result = mlx_whisper.transcribe(
    audio,
    path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
    word_timestamps=True,
    language=sys.argv[3] if len(sys.argv) > 3 else "zh",        # 可选第三个参数：转写语言（核对日语短句时用 ja）
    initial_prompt="以下是一首中文歌曲，夹杂少量日语：光标一闪一闪，闪烁的光标是我的心跳，ドキドキ，ねえ、聞こえる？",
    condition_on_previous_text=False,
)
with open(out, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=1)
for seg in result["segments"]:
    print(f"{seg['start']:7.2f} {seg['end']:7.2f}  {seg['text']}")

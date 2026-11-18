"""按中文填词的几条硬规则体检歌词：每行字数、句尾字的声调（平/仄）与韵母开口度、每段收句是否落在「平声＋开口音」。
规则出处：jtydhr88/lyric-writing-skills 的 lw-mandarin §3.5、§4.1、§5.1。
用法：uv run --python 3.12 --with pypinyin lyric_check.py <歌词文件>
"""
import re
import sys

from pypinyin import Style, pinyin

HAN = re.compile(r"[一-鿿]")
EN_WORD = re.compile(r"[A-Za-z']+")
PING = {"1": "平", "2": "平", "3": "仄", "4": "仄", "5": "轻"}


def openness(final: str) -> str:
    """韵母开口度：含 a 最响，o/e 居中，以 i/u/ü 收的最闭。"""
    if "a" in final:
        return "开"
    if final.rstrip("ng").rstrip("n").endswith(("i", "u", "v", "ü")) or final in ("i", "u", "v", "in", "ing", "un"):
        return "闭"
    return "中"


def tail(line: str):
    """返回句尾信息：最后一个字是汉字则给出 (字, 拼音, 平仄, 开口度)，是英文则标 EN。"""
    stripped = re.sub(r"[\s，。！？、,.!?…「」\"]+$", "", line)
    last = stripped[-1]
    if not HAN.match(last):
        return (EN_WORD.findall(stripped)[-1], "", "EN", "")
    py = pinyin(last, style=Style.TONE3, neutral_tone_with_five=True)[0][0]
    final = pinyin(last, style=Style.FINALS, strict=False)[0][0]
    return (last, py, PING[py[-1]], openness(final))


section, rows = None, []
for raw in open(sys.argv[1], encoding="utf-8"):
    line = raw.strip()
    if not line:
        continue
    if line.startswith("["):
        section = line
        rows.append((section, None))
        continue
    rows.append((section, line))

print(f"{'字数':>4} {'英文词':>5}  句尾  平仄 开口  歌词")
i = 0
while i < len(rows):
    sec, line = rows[i]
    if line is None:
        print(f"\n{sec}")
        i += 1
        continue
    han, en = len(HAN.findall(line)), len(EN_WORD.findall(line))
    ch, py, pz, op = tail(line)
    last_in_section = i + 1 == len(rows) or rows[i + 1][1] is None
    flags = []
    if han + en > 10:
        flags.append("过长")
    if last_in_section and pz == "仄":
        flags.append("收句落在仄声：听着没唱完")
    if last_in_section and op == "闭":
        flags.append("收句是闭口音：拖不响")
    print(f"{han:>4} {en:>5}  {ch}{'(' + py + ')' if py else '':<8} {pz:<2} {op:<2}  {line}" + (f"   ← {'；'.join(flags)}" if flags else ""))
    i += 1

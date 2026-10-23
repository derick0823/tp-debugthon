"""Make the voice-over clips for the demo video from SCRIPT.md.

Purpose: read the 配音 column of a script's shot table (by column name, see script_table.py),
         split each segment into sentences (。？！), synthesize each sentence with edge-tts,
         measure its length.
Usage:   uv run --with edge-tts python -X utf8 research/issue-06/mvp-variants/video/tools/tts.py [--force]
         uv run --with edge-tts python -X utf8 research/issue-06/mvp-variants/video/tools/tts.py \
             --script research/outreach/nstc-ai-briefing/modules/L02-video.md \
             --out research/issue-06/mvp-variants/video/assets/vo/L02
Input:   --script, default research/issue-06/mvp-variants/video/SCRIPT.md (the demo video)
Output:  --out, default research/issue-06/mvp-variants/video/assets/vo
         <out>/<seg>-<n>.mp3 and <out>/vo.json  [{seg, n, text, file, seconds}]
Network: yes. edge-tts sends only the script sentences to Microsoft's online speech service.
         A clip that already exists with the same text is not sent again (use --force to redo).
"""

import argparse
import asyncio
import json
import re
import subprocess
from pathlib import Path

import edge_tts

from script_table import read_beats

VIDEO = Path(__file__).resolve().parents[1]
SCRIPT = VIDEO / "SCRIPT.md"
VO = VIDEO / "assets" / "vo"
VOICE = "zh-TW-HsiaoChenNeural"
RATE = "+0%"  # was -5%; debug-6f 2026-10-22: let the video follow the voice length
FFPROBE = Path.home() / ("AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/"
                         "ffmpeg-8.1.2-full_build/bin/ffprobe.exe")


def read_segments(script):
    """Return [(seg, narration)] from the shot table."""
    return [(b["beat"], b["voice"]) for b in read_beats(script) if b["voice"]]


def split_sentences(text):
    return [s for s in re.findall(r"[^。？！]+[。？！]?", text) if s.strip()]


def seconds(path):
    out = subprocess.run([str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", str(path)], capture_output=True, text=True, check=True,
                         creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return round(float(out.stdout.strip()), 3)


async def main(script, vo_dir, force):
    VO = vo_dir
    VO.mkdir(parents=True, exist_ok=True)
    old = {}
    if (VO / "vo.json").exists():
        old = {r["file"]: r["text"] for r in json.loads((VO / "vo.json").read_text(encoding="utf-8"))}
    rows = []
    for seg, narration in read_segments(script):
        for n, text in enumerate(split_sentences(narration), start=1):
            name = f"{seg}-{n}.mp3"
            path = VO / name
            if force or not path.exists() or old.get(name) != text:
                await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(path))
            rows.append({"seg": seg, "n": n, "text": text, "file": name, "seconds": seconds(path)})
            print(f"{name:8} {rows[-1]['seconds']:6.2f}s  {text}")
    # Drop clips left over from an older script
    keep = {r["file"] for r in rows}
    for p in VO.glob("*.mp3"):
        if p.name not in keep:
            p.unlink()
    (VO / "vo.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(r["seconds"] for r in rows)
    size = sum(p.stat().st_size for p in VO.glob("*.mp3"))
    print(f"sentences={len(rows)} total={total:.1f}s mp3={size / 1024:.0f} KB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", type=Path, default=SCRIPT)
    ap.add_argument("--out", type=Path, default=VO)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    asyncio.run(main(a.script, a.out, a.force))

"""Build the English voice-over, bilingual-caption version of the demo video timeline.

Purpose: speak each Chinese voice-over sentence in English (edge-tts), keep the Chinese line as the
         main caption and add the English line under it, then build public/demo-en/timeline.json
         with bilingual badges, title and outro. The Chinese demo (public/timeline.json) is untouched.
Usage:   uv run --with edge-tts python -X utf8 research/issue-06/mvp-variants/video/tools/build_en.py [--force]
         then: npx remotion render src/index.ts DemoEn out/mvp-demo-en.mp4 (from video/)
Input:   assets/vo/vo.json (Chinese sentences from tts.py), assets/vo/en/translations.json
Output:  assets/vo/en/<seg>-<n>.mp3, assets/vo/en/vo.json [{seg, n, text, text_en, file, seconds}],
         public/demo-en/timeline.json
Network: yes. edge-tts sends only the English sentences to Microsoft's online speech service.
         A clip that already exists with the same text is not sent again (use --force to redo).
"""

import argparse
import asyncio
import json
import subprocess
import sys
from pathlib import Path

import edge_tts

from tts import seconds

VIDEO = Path(__file__).resolve().parents[1]
VO_ZH = VIDEO / "assets" / "vo"
VO_EN = VO_ZH / "en"
OUT = VIDEO / "public" / "demo-en" / "timeline.json"


async def speak(tr, force):
    zh = json.loads((VO_ZH / "vo.json").read_text(encoding="utf-8"))
    old = {}
    if (VO_EN / "vo.json").exists():
        old = {r["file"]: r["text_en"] for r in json.loads((VO_EN / "vo.json").read_text(encoding="utf-8"))}
    rows = []
    for r in zh:
        key = f"{r['seg']}-{r['n']}"
        en = tr["sentences"][key]
        path = VO_EN / f"{key}.mp3"
        if force or not path.exists() or old.get(path.name) != en:
            await edge_tts.Communicate(en, tr["voice"]).save(str(path))
        rows.append({"seg": r["seg"], "n": r["n"], "text": r["text"], "text_en": en, "file": path.name, "seconds": seconds(path)})
        print(f"{path.name:8} {rows[-1]['seconds']:6.2f}s (zh {r['seconds']:5.2f}s)  {en}")
    (VO_EN / "vo.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"sentences={len(rows)} en={sum(x['seconds'] for x in rows):.1f}s zh={sum(x['seconds'] for x in zh):.1f}s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    tr = json.loads((VO_EN / "translations.json").read_text(encoding="utf-8"))
    asyncio.run(speak(tr, a.force))

    outro = VO_EN / "_outro.json"
    outro.write_text(json.dumps(tr["outro"], ensure_ascii=False), encoding="utf-8")
    subprocess.run([sys.executable, "-X", "utf8", str(VIDEO / "tools" / "build_timeline.py"), "--vo", str(VO_EN), "--out", str(OUT),
                    "--title", tr["title"]["title"], "--kicker", tr["title"]["kicker"], "--outro", str(outro)], check=True)
    outro.unlink()

    tl = json.loads(OUT.read_text(encoding="utf-8"))
    for s in tl["segments"]:
        if s.get("role"):
            s["role"] = f"{s['role']} · {tr['roles'].get(s['role'], '')}".rstrip(" ·")
        if s.get("label") in tr["labels"]:
            s["label"] = f"{s['label']} · {tr['labels'][s['label']]}"
    OUT.write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT.relative_to(VIDEO)}: {tl['totalFrames'] / tl['fps']:.1f}s")


if __name__ == "__main__":
    main()

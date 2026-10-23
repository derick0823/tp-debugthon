"""Build public/timeline.json for the Remotion composition from the recordings and the voice-over.

Inputs
  video/recordings/<name>.webm + .json   (from tools/record.py; one per beat)
  video/assets/vo/vo.json                (from tools/tts.py: [{beat, idx, text, file, seconds}])
  video/assets/music.wav                 (from tools/music.py)
Output
  video/public/timeline.json, and copies of the media under video/public/ (Remotion's staticFile()).

Rules
  * Beat order follows SCRIPT.md. A beat whose recording is missing is skipped (printed).
  * Captions = voice-over sentences of that beat, placed back to back with a 0.35 s gap.
  * Segment length = max(recording length, voice-over need + 0.6 s). If the recording is shorter,
    it plays at playbackRate = recording / segment (slow motion, never faster).
  * Title and outro are UI-only beats (no recording): length = voice-over need + 1 s, min 5 s.
  * With --script, beats come from the script's shot table ("#", "錄影名", "角色", "標籤" or "段落"
    columns, see script_table.py). The first beat is the title and the last is the outro when they
    have no recording; a middle beat without a recording becomes kind "card" (text-only).
    Without --script, the fixed BEATS list below is used (the demo video).
  * Script mode with a 秒 interval ("0–15"): the segment is the interval long, or longer when the
    voice needs it (the clip then plays slower). A recording used by several beats plays only the
    beat's interval: "clipStart" = interval start, in seconds into the recording. A recording used
    by one beat plays whole from 0 and is never cut.
  * Title and outro texts ("title": {title, kicker}, "outro": {lines, cards}) come from the script's
    front matter or key | value table (see script_table.read_meta); --title, --kicker, --outro
    override them. When none is given the keys are left out and Root uses its neutral default.

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/video/tools/build_timeline.py
         uv run python -X utf8 research/issue-06/mvp-variants/video/tools/build_timeline.py \
             --script research/outreach/nstc-ai-briefing/modules/L02-video.md \
             --vo research/issue-06/mvp-variants/video/assets/vo/L02 \
             --out research/issue-06/mvp-variants/video/public/L02/timeline.json \
             --title "描述：壞 prompt 改成好任務書" --kicker "公務 AI 減壓課・L02" [--outro outro.json]
Network: no
"""

import argparse
import json
from collections import Counter
import shutil
import subprocess
from pathlib import Path

from script_table import read_beats, read_meta

HERE = Path(__file__).resolve().parent
V = HERE.parent
REC, ASSETS, PUB = V / "recordings", V / "assets", V / "public"
FFPROBE = Path(r"C:\Users\abrahamdong\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffprobe.exe")
FPS = 30
GAP = 0.35

BEATS = [  # (beat no, recording name or None, role badge, step label)
    (0, None, "", "片頭"),
    (1, "priority-ranking", "健檢規劃員", "誰先健檢"),
    (2, "rescue-drill-map", "里長", "救得進去嗎"),
    (3, "renewal-calculator", "住戶", "我家划不划算"),
    (4, "bonus-translator", "住戶", "獎勵看得懂"),
    (5, "consent-tracker", "推動小組", "同意書收到哪"),
    (6, "consent-simulator", "市府協調員", "要幾戶點頭"),
    (7, "rules-map", "所有人", "法規與流程"),
    (8, "rooftop-vision", "設計參與", "屋頂願景"),
    (9, "index", "", "片尾"),
]


FFMPEG = FFPROBE.with_name("ffmpeg.exe")


def stage_recording(webm: Path) -> str:
    """Copy a recording into public/. Playwright's webm is variable frame rate with long gaps between
    frames on static screens, and Remotion's compositor then fails with "No frame found at position".
    When ffmpeg is available, transcode once to a constant-frame-rate H.264 mp4 (30 fps) and use that.
    Returns the path relative to public/."""
    out_dir = PUB / "recordings"
    out_dir.mkdir(parents=True, exist_ok=True)
    if FFMPEG.exists():
        mp4 = out_dir / (webm.stem + ".mp4")
        if not mp4.exists() or mp4.stat().st_mtime < webm.stat().st_mtime:
            r = subprocess.run([str(FFMPEG), "-v", "error", "-y", "-i", str(webm), "-vf", "fps=30,format=yuv420p",
                                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
                                "-an", "-movflags", "+faststart", str(mp4)],
                               capture_output=True, text=True)
            if r.returncode != 0:
                print(f"ffmpeg failed for {webm.name}: {r.stderr.strip()[:200]}; using webm")
                shutil.copy2(webm, out_dir / webm.name)
                return f"recordings/{webm.name}"
        return f"recordings/{mp4.name}"
    shutil.copy2(webm, out_dir / webm.name)
    return f"recordings/{webm.name}"


def cut_recording(rel_src: str, start: float, length: float, tag: str) -> str:
    """Cut [start, start+length] out of a staged recording into its own short mp4 (keyframe every
    second). Each beat then plays its file from frame 0, so the compositor never seeks deep into a
    long file (that failed with "No frame found at position" on 176-second recordings)."""
    src = PUB / rel_src
    out = src.with_name(f"{src.stem}-{tag}.mp4")
    if FFMPEG.exists() and (not out.exists() or out.stat().st_mtime < src.stat().st_mtime):
        r = subprocess.run([str(FFMPEG), "-v", "error", "-y", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{length:.3f}",
                            "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                            "-g", "30", "-keyint_min", "30", "-sc_threshold", "0", "-an", "-movflags", "+faststart", str(out)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print(f"ffmpeg cut failed for {out.name}: {r.stderr.strip()[:200]}; playing the whole file with clipStart")
            return rel_src
    return f"recordings/{out.name}" if out.exists() else rel_src


def media_seconds(p: Path) -> float:
    if FFPROBE.exists():
        out = subprocess.run([str(FFPROBE), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                             capture_output=True, text=True).stdout.strip()
        try:
            return float(out)
        except ValueError:
            pass
    j = p.with_suffix(".json")
    return json.loads(j.read_text(encoding="utf-8"))["duration_ms"] / 1000 if j.exists() else 10.0


def script_beats(script: Path):
    """Beats from a script table, with the UI kind decided by position (first, middle, last)."""
    rows = read_beats(script)
    out = []
    for i, b in enumerate(rows):
        pos = "first" if i == 0 else "last" if i == len(rows) - 1 else "mid"
        out.append((b["beat"], b["rec"], b["role"], b["label"], pos, b["span"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", type=Path, help="shot table to read beats from; default = fixed BEATS (demo video)")
    ap.add_argument("--vo", type=Path, default=ASSETS / "vo", help="folder with vo.json and the mp3 files")
    ap.add_argument("--out", type=Path, default=PUB / "timeline.json")
    ap.add_argument("--title", help='title card text, e.g. "描述：壞 prompt 改成好任務書"')
    ap.add_argument("--kicker", help='small line above the title, e.g. "公務 AI 減壓課・L02"')
    ap.add_argument("--outro", type=Path, help='JSON file {"lines": [...], "cards": [{"icon", "label"}]}')
    a = ap.parse_args()
    vo_dir = a.vo.resolve()
    vo_rel = vo_dir.relative_to(ASSETS).as_posix()  # "vo" for the demo, "vo/L02" for a lesson
    beats = script_beats(a.script) if a.script else [(*b, None, None) for b in BEATS]
    uses = Counter(b[1] for b in beats if b[1])  # a recording used by several beats is cut by the 秒 column

    (PUB / "recordings").mkdir(parents=True, exist_ok=True)
    (PUB / "assets" / vo_rel).mkdir(parents=True, exist_ok=True)
    vo_all = json.loads((vo_dir / "vo.json").read_text(encoding="utf-8")) if (vo_dir / "vo.json").exists() else []
    for item in vo_all:
        src = vo_dir / item["file"]
        if src.exists():
            shutil.copy2(src, PUB / "assets" / vo_rel / item["file"])
    music = ASSETS / "music.wav"
    if music.exists():
        shutil.copy2(music, PUB / "assets" / "music.wav")

    segments, t = [], 0.0
    for beat, name, role, label, pos, span in beats:
        vo = [x for x in vo_all if int(x.get("beat", x.get("seg"))) == beat]
        vo_need = sum(x["seconds"] for x in vo) + GAP * max(0, len(vo) - 1)
        if pos is None:  # demo video: the original fixed rules, kept as they were
            kind = "title" if beat == 0 else "outro" if beat == 9 and name is None else "clip"
        else:
            kind = {"first": "title", "last": "outro", "mid": "card"}[pos]
        rec_len = None
        rec_src = None
        if name:
            webm = REC / f"{name}.webm"
            if not webm.exists():
                if pos is None and beat == 9:
                    kind = "outro"
                elif pos in ("first", "last"):
                    print(f"beat {beat}: {webm.name} missing, using {kind}")
                else:
                    print(f"skip beat {beat}: {webm.name} missing"); continue
            else:
                rec_src = stage_recording(webm)
                rec_len = media_seconds(PUB / rec_src)
                last = beat == 9 if pos is None else pos == "last"
                kind = "clip" if not last else "outro-clip"
        if kind in ("title", "outro", "card"):
            seg_len = max(5.0, vo_need + 1.0)
        else:
            seg_len = max(rec_len, vo_need + 0.6)
        clip_start, play_len = None, rec_len
        if pos is not None and span:  # script mode with a planned interval
            span_len = span[1] - span[0]
            if rec_len is None:
                seg_len = max(span_len, vo_need + 1.0)
            elif uses[name] > 1:  # shared recording: play only this beat's interval
                clip_start = min(span[0], max(rec_len - 0.1, 0.0))
                play_len = max(0.1, min(span_len, rec_len - clip_start))
                seg_len = max(span_len, vo_need + 0.6)  # longer voice: stretch, clipStart unchanged
                cut = cut_recording(rec_src, clip_start, play_len, f"b{beat}")
                if cut != rec_src:
                    rec_src, clip_start = cut, 0.0
            else:  # own recording: play it whole, never cut it
                clip_start = 0.0
                seg_len = max(rec_len, span_len, vo_need + 0.6)
        elif pos is not None and rec_len is not None:
            clip_start = 0.0
        caps, ct = [], 0.4
        for x in vo:
            caps.append({"text": x["text"], "file": f"assets/{vo_rel}/{x['file']}", "from": round(ct * FPS), "frames": round(x["seconds"] * FPS)})
            if x.get("text_en"):  # bilingual version (tools/build_en.py): English line under the Chinese one
                caps[-1]["en"] = x["text_en"]
            ct += x["seconds"] + GAP
        seg = {
            "beat": beat, "kind": kind, "name": name, "role": role, "label": label,
            "from": round(t * FPS), "frames": round(seg_len * FPS),
            "src": rec_src if rec_len is not None else None,
            "playbackRate": round(play_len / seg_len, 4) if rec_len else 1.0,
            "captions": caps,
        }
        if clip_start is not None:  # script mode only; seconds into the recording (Remotion startFrom)
            seg["clipStart"] = round(clip_start, 3)
        segments.append(seg)
        t += seg_len
    tl = {"fps": FPS, "width": 1280, "height": 720, "totalFrames": round(t * FPS), "music": "assets/music.wav" if music.exists() else None, "segments": segments}
    # Optional card texts for Remotion: from the script (front matter or key | value table),
    # then the CLI options override. Left out when absent, so the demo timeline stays unchanged.
    meta = read_meta(a.script) if a.script else {}
    title = {**meta.get("title", {}), **{k: v for k, v in (("title", a.title), ("kicker", a.kicker)) if v}}
    if title:
        tl["title"] = title
    outro = json.loads(a.outro.read_text(encoding="utf-8")) if a.outro else meta.get("outro")
    if outro:
        tl["outro"] = outro
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"segments={len(segments)} total={t:.1f}s captions={sum(len(s['captions']) for s in segments)} music={'yes' if music.exists() else 'no'}")
    for s in segments:
        print(f"  beat {s['beat']} {s['kind']:<10} {s['name'] or '-':<20} {s['frames'] / FPS:5.1f}s rate={s['playbackRate']} caps={len(s['captions'])}")


if __name__ == "__main__":
    main()

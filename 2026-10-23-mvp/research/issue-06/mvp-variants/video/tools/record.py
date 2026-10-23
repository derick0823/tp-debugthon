"""Record a scripted walkthrough of one MVP page as a video, with Playwright driving the installed Edge.

Each variant owns a scenario file: <variant>/demo/scenario.json. Schema:
  {
    "url": "/mvp-variants/renewal-calculator/",     # path on the 8778 server
    "viewport": [1280, 720],                        # optional, default 1280x720
    "steps": [                                      # run in order; every step may carry "wait": ms (default 800)
      {"do": "wait", "ms": 1500},
      {"do": "click", "sel": "#btn"},               # CSS selector or text=... / role=...
      {"do": "fill", "sel": "#addr", "text": "信義路2段86巷40號"},
      {"do": "type", "sel": "#addr", "text": "...", "delay": 60},   # per-key delay for a typing feel
      {"do": "slider", "sel": "#bonus", "value": 40},   # sets a range input and fires input+change
      {"do": "slider_sweep", "sel": "#bonus", "from": 10, "to": 50, "steps": 20, "ms": 60},
      {"do": "scroll", "y": 600},                    # window scroll by y px (smooth)
      {"do": "scroll_to", "sel": ".find"},
      {"do": "hover", "sel": ".card"},
      {"do": "press", "key": "Enter"},
      {"do": "select", "sel": "#town", "value": "大安區"},
      {"do": "check", "sel": "#onlyS5"},
      {"do": "eval", "js": "document.querySelector('#x').click()"},
      {"do": "caption", "text": "..."}               # ignored here; Remotion reads it for subtitles
    ]
  }
Output: video/recordings/<name>.webm plus <name>.json (step timestamps in ms, for subtitles).

Usage:   uv run --with playwright python -X utf8 research/issue-06/mvp-variants/video/tools/record.py <name> <scenario.json> [--base http://127.0.0.1:8778]
Network: only the local 8778 server and OpenStreetMap tiles for the map pages.
"""

import argparse
import json
import shutil
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "recordings"


def run_step(page, st):
    do = st["do"]
    if do == "wait":
        page.wait_for_timeout(st.get("ms", 800)); return
    if do == "caption":
        return
    if do == "click":
        page.click(st["sel"], timeout=8000)
    elif do == "fill":
        page.fill(st["sel"], st["text"], timeout=8000)
    elif do == "type":
        page.click(st["sel"], timeout=8000); page.type(st["sel"], st["text"], delay=st.get("delay", 60))
    elif do == "slider":
        page.eval_on_selector(st["sel"], "(el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }", st["value"])
    elif do == "slider_sweep":
        a, b, n = st["from"], st["to"], st.get("steps", 20)
        for i in range(n + 1):
            v = a + (b - a) * i / n
            page.eval_on_selector(st["sel"], "(el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); }", v)
            page.wait_for_timeout(st.get("ms", 60))
        page.eval_on_selector(st["sel"], "el => el.dispatchEvent(new Event('change', {bubbles:true}))")
    elif do == "scroll":
        page.evaluate("y => window.scrollBy({top: y, behavior: 'smooth'})", st["y"])
    elif do == "scroll_to":
        page.eval_on_selector(st["sel"], "el => el.scrollIntoView({behavior:'smooth', block: 'center'})")
    elif do == "hover":
        page.hover(st["sel"], timeout=8000)
    elif do == "press":
        page.keyboard.press(st["key"])
    elif do == "select":
        page.select_option(st["sel"], st["value"], timeout=8000)
    elif do == "check":
        page.check(st["sel"], timeout=8000)
    elif do == "eval":
        page.evaluate(st["js"])
    else:
        raise ValueError(f"unknown step {do}")
    page.wait_for_timeout(st.get("wait", 800))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name"); ap.add_argument("scenario"); ap.add_argument("--base", default="http://127.0.0.1:8778")
    a = ap.parse_args()
    sc = json.loads(Path(a.scenario).read_text(encoding="utf-8"))
    w, h = sc.get("viewport", [1280, 720])
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / f"_{a.name}"
    shutil.rmtree(tmp, ignore_errors=True)
    marks = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", headless=True)
        ctx = b.new_context(viewport={"width": w, "height": h}, record_video_dir=str(tmp), record_video_size={"width": w, "height": h},
                            locale="zh-TW", device_scale_factor=1)
        page = ctx.new_page()
        t0 = time.time()
        page.goto(a.base + sc["url"], wait_until="networkidle")
        page.wait_for_timeout(sc.get("settle_ms", 1200))
        for st in sc["steps"]:
            marks.append({"t": round((time.time() - t0) * 1000), **st})
            try:
                run_step(page, st)
            except Exception as e:  # keep recording; note the failure
                marks[-1]["error"] = str(e).splitlines()[0][:200]
        total = round((time.time() - t0) * 1000)
        page.wait_for_timeout(sc.get("tail_ms", 1200))
        video = page.video
        ctx.close(); b.close()
        src = Path(video.path())
    dst = OUT / f"{a.name}.webm"
    if dst.exists():
        dst.unlink()
    shutil.move(str(src), dst)
    shutil.rmtree(tmp, ignore_errors=True)
    (OUT / f"{a.name}.json").write_text(json.dumps({"name": a.name, "url": sc["url"], "viewport": [w, h], "duration_ms": total, "marks": marks},
                                                   ensure_ascii=False, indent=1), encoding="utf-8")
    errs = [m for m in marks if "error" in m]
    print(f"{dst.name} {dst.stat().st_size / 1e6:.1f} MB, {total / 1000:.1f} s, steps={len(marks)}, errors={len(errs)}")
    for m in errs:
        print("  !", m["do"], m.get("sel", ""), m["error"])


if __name__ == "__main__":
    main()

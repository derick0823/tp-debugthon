"""Pack the MVP variants into one self-contained zip that teammates can run offline.

What it does:
  * copies research/issue-06/mvp-variants/ (pages, generated data/, screenshots, reports)
  * adds vendor/ (Leaflet from solutions/prototype/assets/vendor) and marts/ (two small CSVs)
  * rewrites the cross-folder references so everything resolves inside the bundle
  * adds start.bat / start.command / README-先讀我.txt
  * zips the result

The bundle contains no personal data: all pages read village aggregates, synthetic
households, or company names only (same as the repo).

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/scripts/make_bundle.py [--out <zip path>]
Input:   research/issue-06/mvp-variants/**  (run each variant's build script first so data/ exists)
         research/issue-06/solutions/prototype/assets/vendor/
         data/marts/village_indicators.csv, data/marts/village_rankings.csv
Output:  <out> (default: ~/Downloads/mvp-variants-<date>.zip) and a staging folder next to it
Network: no
"""

import argparse
import shutil
import zipfile
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
MVP = HERE.parent
ROOT = MVP.parents[2]
VENDOR = ROOT / "research" / "issue-06" / "solutions" / "prototype" / "assets" / "vendor"
MARTS = ROOT / "data" / "marts"

SKIP_DIRS = {"__pycache__", ".git", "test", "profile", "node_modules", "video", "recordings", "out"}
SKIP_FILES = {".gitignore", "HANDOFF-2026-10-22.md"}
SKIP_SUFFIX = {".pyc", ".jsonl"}  # personas.jsonl: raw API output, not needed by the pages

REWRITES = [
    ("../../solutions/prototype/assets/vendor/", "../vendor/"),
    ('const MARTS = "../../../../data/marts/";', 'const MARTS = "../marts/";'),
    ("../../solutions/prototype/index.html?t=", "../renewal-calculator/?t="),
    ("../../solutions/prototype/brief.html?v=", "../priority-ranking/?v="),
]

START_BAT = """@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:8778/
python -m http.server 8778 --bind 127.0.0.1
"""
START_CMD = """#!/bin/sh
cd "$(dirname "$0")"
(sleep 1; open http://127.0.0.1:8778/ 2>/dev/null || xdg-open http://127.0.0.1:8778/) &
python3 -m http.server 8778 --bind 127.0.0.1
"""
README = """老屋耐震 6 個 MVP（設計原型）— 先讀我

怎麼開
  Windows：雙擊 start.bat
  Mac／Linux：在終端機跑  sh start.command
  都需要電腦有 Python 3。開了之後瀏覽器會自動開 http://127.0.0.1:8778/ ，
  那一頁就是總覽，六個原型都從那裡點進去。關掉黑色視窗就停止。

  不想用 start：在這個資料夾開終端機，跑
    python -m http.server 8778 --bind 127.0.0.1
  然後開 http://127.0.0.1:8778/

注意
  * 全部是設計原型，數字是公開資料的彙總與推估，相對於臺北其他里，不是任何一棟的鑑定。
  * 逐棟屋齡與軟弱層是「推估」「候選」；已知案件只在輸入確切地址時顯示。
  * 沒有任何真實個資：住戶都是合成的，實施者只保留公司名。
  * 「老公寓要幾戶點頭」裡的「住戶在想什麼」分頁是 AI 扮演的虛構住戶，不是民調。
  * 這包只給隊友內部看，請不要公開上網。活動規則是 Day 1（10/23）後才有公開網址。

看什麼
  總覽 index.html 上方有建議順序。早上總結在 2026-10-22-morning-summary.md。
  466 個都更案的經濟數字在 uro-cases/out/uro-review-cases.csv，欄位說明在 uro-cases/report.md 第 2 節。
"""


def copy_tree(src: Path, dst: Path):
    for p in src.rglob("*"):
        rel = p.relative_to(src)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if p.is_dir():
            continue
        if p.name in SKIP_FILES or p.suffix in SKIP_SUFFIX:
            continue
        out = dst / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        if p.suffix in {".html", ".js", ".css"}:
            text = p.read_text(encoding="utf-8")
            for a, b in REWRITES:
                text = text.replace(a, b)
            out.write_text(text, encoding="utf-8", newline="\n")
        else:
            shutil.copy2(p, out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(Path.home() / "Downloads" / f"mvp-variants-{date.today().isoformat()}.zip"))
    args = ap.parse_args()
    out_zip = Path(args.out)
    base = out_zip.stem
    stage = out_zip.with_suffix("")
    try:
        if stage.exists():
            shutil.rmtree(stage)
        stage.mkdir(parents=True)
    except PermissionError:  # folder open in Explorer or served by a leftover http.server
        import tempfile
        stage = Path(tempfile.mkdtemp(prefix=base + "-")) / base
        stage.mkdir()
        print(f"staging folder busy; using {stage}")

    copy_tree(MVP, stage)
    (stage / "vendor").mkdir()
    for p in VENDOR.iterdir():
        if p.is_file():
            shutil.copy2(p, stage / "vendor" / p.name)
        else:
            shutil.copytree(p, stage / "vendor" / p.name)
    (stage / "marts").mkdir()
    for name in ("village_indicators.csv", "village_rankings.csv"):
        shutil.copy2(MARTS / name, stage / "marts" / name)
    (stage / "start.bat").write_text(START_BAT, encoding="utf-8", newline="\r\n")
    (stage / "start.command").write_text(START_CMD, encoding="utf-8", newline="\n")
    (stage / "README-先讀我.txt").write_text(README, encoding="utf-8-sig", newline="\r\n")

    missing = [v for v in ("priority-ranking", "renewal-calculator", "bonus-translator", "rescue-drill-map",
                           "consent-simulator") if not (stage / v / "data").exists()]
    if missing:
        raise SystemExit(f"data/ missing for {missing}; run their build scripts first")

    if out_zip.exists():
        out_zip.unlink()
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in sorted(stage.rglob("*")):
            if p.is_file():
                z.write(p, f"{base}/{p.relative_to(stage).as_posix()}")
    n = sum(1 for p in stage.rglob("*") if p.is_file())
    print(f"files={n} staged={stage} zip={out_zip} size_mb={out_zip.stat().st_size / 1e6:.1f}")


if __name__ == "__main__":
    main()

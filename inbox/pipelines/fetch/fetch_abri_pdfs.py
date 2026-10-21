"""Find and download ABRI (內政部建築研究所) report PDFs for GRB plans in the ranked list.

ABRI item pages have direct PDF links without a captcha (checked 2026-10-17).
GRB full text needs a captcha, so a person downloads that; this script never touches GRB full text.

Usage (from the repo root):
    uv run python -X utf8 -m pipelines.fetch.fetch_abri_pdfs                  # list links only
    uv run python -X utf8 -m pipelines.fetch.fetch_abri_pdfs --download       # list, then download
    uv run python -X utf8 -m pipelines.fetch.fetch_abri_pdfs --min-score 12   # change the cut
Which plans: rows of data/staged/grb/grb_list.csv that have 建研所免驗證碼網址 and
    排序分數 >= --min-score (default 10), or a non-empty 要下載 cell.
Input:  data/staged/grb/grb_list.csv (run pipelines.stage.stage_grb_list first). Network: yes.
Output:
    data/raw/extra/research/abri/item_pages/s<id>.html   raw item pages (reused when on disk)
    data/raw/extra/research/abri/pdf_links.csv           one row per PDF link
    data/raw/extra/research/fulltext/grb-<year>-<grb id>-abri<k>.pdf    (--download only)
    data/raw/extra/research/fulltext/MANIFEST.csv        file -> plan, size, sha256, time
One request at a time, 1 s pause. Files on disk are skipped. A file that does not start
with %PDF is deleted and logged as failed.
"""
import argparse
import csv
import hashlib
import html
import re
import subprocess
import sys
import time
from datetime import datetime

from pipelines.common import RAW, STAGED

ABRI = RAW / "extra" / "research" / "abri"
FULLTEXT = RAW / "extra" / "research" / "fulltext"
UA = "Mozilla/5.0 civic-debug-hackathon-research/1.0"
MANIFEST_COLS = ["file", "grb_id", "year", "plan_title", "source", "source_page", "file_title",
                 "bytes", "sha256", "retrieved"]

sys.stdout.reconfigure(encoding="utf-8")
ap = argparse.ArgumentParser()
ap.add_argument("--download", action="store_true")
ap.add_argument("--min-score", type=int, default=10)
args = ap.parse_args()


def curl(url, dest, timeout=60):
    p = subprocess.run(["curl", "-sS", "-m", str(timeout), "-A", UA, "-L", "-o", str(dest),
                        "-w", "%{http_code}", url], capture_output=True, text=True)
    return p.returncode == 0 and p.stdout.strip() == "200"


rows = [r for r in csv.DictReader(open(STAGED / "grb" / "grb_list.csv", encoding="utf-8-sig"))
        if r["建研所免驗證碼網址"] and (int(r["排序分數"]) >= args.min_score or r["要下載"].strip())]
print(f"plans selected: {len(rows)}")

# ---- step 1: item pages -> PDF links ---------------------------------------
pages = ABRI / "item_pages"
pages.mkdir(parents=True, exist_ok=True)
links = []
for r in rows:
    s_id = re.search(r"s=(\d+)", r["建研所免驗證碼網址"]).group(1)
    dest = pages / f"s{s_id}.html"
    if not dest.exists():
        ok = curl(r["建研所免驗證碼網址"], dest)
        time.sleep(1)
        if not ok:
            dest.unlink(missing_ok=True)
            print(f"item page failed: s={s_id} {r['計畫名稱']}")
            continue
    h = dest.read_text(encoding="utf-8", errors="replace")
    found = re.findall(r'href="(https://ws\.moi\.gov\.tw/Download\.ashx[^"]*)"[^>]*title="([^"]*)"', h)
    seen = set()
    k = 0
    for url, title in found:
        url = html.unescape(url)
        if url in seen:
            continue
        seen.add(url)
        k += 1
        links.append({"grb_id": r["GRB系統id"], "year": r["年度"], "plan_title": r["計畫名稱"],
                      "s_id": s_id, "k": k, "file_title": html.unescape(title).replace("[另開新視窗]", "").strip(),
                      "url": url, "source_page": r["建研所免驗證碼網址"]})
    if k == 0:
        print(f"no PDF link on item page: s={s_id} {r['計畫名稱']}")
with open(ABRI / "pdf_links.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(links[0].keys()) if links else ["grb_id"])
    w.writeheader()
    w.writerows(links)
print(f"PDF links: {len(links)} for {len({l['grb_id'] for l in links})} plans -> {ABRI / 'pdf_links.csv'}")
if not args.download:
    sys.exit(0)

# ---- step 2: download ------------------------------------------------------
FULLTEXT.mkdir(parents=True, exist_ok=True)
man_path = FULLTEXT / "MANIFEST.csv"
manifest = {}
if man_path.exists():
    manifest = {m["file"]: m for m in csv.DictReader(open(man_path, encoding="utf-8-sig"))}
fails = 0
for l in links:
    name = f"grb-{l['year']}-{l['grb_id']}-abri{l['k']}.pdf"
    dest = FULLTEXT / name
    if dest.exists() and name in manifest:
        continue
    tmp = dest.with_suffix(".part")
    ok = curl(l["url"], tmp, timeout=600)
    time.sleep(1)
    if not ok or tmp.read_bytes()[:4] != b"%PDF":
        tmp.unlink(missing_ok=True)
        fails += 1
        print(f"download failed: {name} {l['file_title']}")
        continue
    tmp.replace(dest)
    data = dest.read_bytes()
    manifest[name] = {"file": name, "grb_id": l["grb_id"], "year": l["year"], "plan_title": l["plan_title"],
                      "source": "abri", "source_page": l["source_page"], "file_title": l["file_title"],
                      "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                      "retrieved": datetime.now().astimezone().isoformat(timespec="seconds")}
    with open(man_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=MANIFEST_COLS)
        w.writeheader()
        w.writerows(manifest.values())
    print(f"ok {name} {len(data) / 1e6:.1f} MB")
total = sum(int(m["bytes"]) for m in manifest.values())
print(f"done: {len(manifest)} files, {total / 1e9:.2f} GB, failed this run: {fails}")

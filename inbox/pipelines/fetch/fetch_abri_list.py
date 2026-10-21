"""Fetch the title list of ABRI (內政部建築研究所) research results. No PDFs.

Usage (from the repo root):
    uv run python -X utf8 -m pipelines.fetch.fetch_abri_list
Input: none. Network: yes.
Source: https://www.abri.gov.tw/News.aspx?n=807&sms=9489 (研究成果, 2,859 items on 2026-10-17)
Each item page (News_Content_Table.aspx?n=807&s=<id>) has a direct PDF link without a captcha.
This script gets the list pages only. A person decides which PDFs to download.
Output (data/raw/extra/research/abri/):
    list_pages/page_NNN.html   raw list pages, 200 items each
    abri_list.csv              s_id, title, item_url
One request at a time, 1 s pause. Pages on disk are reused.
"""
import csv
import html
import re
import subprocess
import sys
import time
from pipelines.common import RAW

OUT = RAW / "extra" / "research" / "abri"
BASE = "https://www.abri.gov.tw"
UA = "Mozilla/5.0 civic-debug-hackathon-research/1.0"
SIZE = 200

sys.stdout.reconfigure(encoding="utf-8")
pages = OUT / "list_pages"
pages.mkdir(parents=True, exist_ok=True)


def get(page):
    dest = pages / f"page_{page:03d}.html"
    if not dest.exists():
        url = f"{BASE}/News.aspx?n=807&sms=9489&page={page}&PageSize={SIZE}"
        p = subprocess.run(["curl", "-sS", "-m", "60", "-A", UA, "-L", "-o", str(dest), "-w", "%{http_code}", url],
                           capture_output=True, text=True)
        time.sleep(1)
        if p.stdout.strip() != "200":
            dest.unlink(missing_ok=True)
            sys.exit(f"page {page} failed: {p.stdout} {p.stderr}")
    return dest.read_text(encoding="utf-8")


first = get(1)
total = int(re.search(r"go\s*/\s*(\d+)", re.sub(r"<[^>]+>", " ", first)).group(1))
n_pages = -(-total // SIZE)
print(f"total={total} pages={n_pages}")
items = {}
for page in range(1, n_pages + 1):
    h = first if page == 1 else get(page)
    for s_id, title in re.findall(r'href="News_Content_Table\.aspx\?n=807&(?:amp;)?s=(\d+)"[^>]*title="([^"]*)"', h):
        items.setdefault(s_id, html.unescape(title).strip())
with open(OUT / "abri_list.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["s_id", "title", "item_url"])
    for s_id, title in items.items():
        w.writerow([s_id, title, f"{BASE}/News_Content_Table.aspx?n=807&s={s_id}"])
print(f"items={len(items)} (site says {total})")

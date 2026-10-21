"""File GRB full-text PDFs that a person downloaded by hand (the site has a captcha).

Usage (from the repo root):
    uv run python -X utf8 -m pipelines.fetch.file_grb_fulltext <download_dir>            # dry run
    uv run python -X utf8 -m pipelines.fetch.file_grb_fulltext <download_dir> --move     # move and log
Input:
    <download_dir>                       for example C:/Users/<you>/Downloads
    data/manual/grb_picks.csv            which plans to look for (要下載 not empty)
    data/raw/extra/research/grb/details.jsonl   plan keys
Output:
    data/raw/extra/research/fulltext/grb-<year>-<grb id>-grb<k>.pdf
    data/raw/extra/research/fulltext/MANIFEST.csv (rows added; source = grb)
No network.

How a file is matched to a plan (the site uses two naming styles):
    RR<projkey without dashes>[A|B..].pdf     e.g. RRPG92030373A.pdf -> PG9203-0373, second file
    <planNo without letters and dashes>...    e.g. 1062116M244001(第1年).pdf -> MOST106-2116-M244-001
Files that match no picked plan are left where they are. A file whose bytes equal a file
already in MANIFEST.csv is reported as a duplicate and not moved.
"""
import csv
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

from pipelines.common import MANUAL, RAW

GRB = RAW / "extra" / "research" / "grb"
FULLTEXT = RAW / "extra" / "research" / "fulltext"
MANIFEST_COLS = ["file", "grb_id", "year", "plan_title", "source", "source_page", "file_title",
                 "bytes", "sha256", "retrieved"]

sys.stdout.reconfigure(encoding="utf-8")
if len(sys.argv) < 2:
    sys.exit(__doc__)
src_dir = Path(sys.argv[1])
move = "--move" in sys.argv


def key(s):
    return re.sub(r"[^0-9A-Z]", "", (s or "").upper())


picked = {int(r["GRB系統id"]) for r in csv.DictReader(open(MANUAL / "grb_picks.csv", encoding="utf-8-sig"))
          if r["要下載"].strip()}
plans = {}
for line in open(GRB / "details.jsonl", encoding="utf-8"):
    r = json.loads(line)
    if r["id"] in picked:
        plans[r["id"]] = r

man_path = FULLTEXT / "MANIFEST.csv"
manifest = {}
if man_path.exists():
    manifest = {m["file"]: m for m in csv.DictReader(open(man_path, encoding="utf-8-sig"))}
known_sha = {m["sha256"]: m["file"] for m in manifest.values()}


def match(name):
    stem = name.rsplit(".", 1)[0]
    rr = re.fullmatch(r"RR([A-Z]{2}\d+)([A-Z]?)", key(stem))
    for i, r in plans.items():
        if rr and rr.group(1) == key(r.get("projkey")):
            return i, (ord(rr.group(2)) - ord("A") + 2) if rr.group(2) else 1
        pn = re.sub(r"^[A-Z]+", "", key(r.get("planNo")))
        if pn and key(stem.split("(")[0]).startswith(pn):
            return i, 1
    return None, None


FULLTEXT.mkdir(parents=True, exist_ok=True)
found = {}
for f in sorted(src_dir.iterdir()):
    if not f.is_file() or f.suffix.lower() != ".pdf":
        continue
    i, k = match(f.name)
    if i is None:
        continue
    r = plans[i]
    data = f.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    name = f"grb-{r.get('planYear')}-{i}-grb{k}.pdf"
    found.setdefault(i, []).append(name)
    if sha in known_sha:
        print(f"duplicate of {known_sha[sha]}: {f.name}")
        continue
    if data[:4] != b"%PDF":
        print(f"not a PDF: {f.name}")
        continue
    print(f"{'move' if move else 'would move'} {f.name} -> {name}")
    if not move:
        continue
    shutil.move(str(f), FULLTEXT / name)
    known_sha[sha] = name
    manifest[name] = {"file": name, "grb_id": i, "year": r.get("planYear"), "plan_title": r.get("title"),
                      "source": "grb", "source_page": f"https://www.grb.gov.tw/search/planDetail?id={i}",
                      "file_title": f.name, "bytes": len(data), "sha256": sha,
                      "retrieved": datetime.fromtimestamp((FULLTEXT / name).stat().st_mtime).astimezone()
                      .isoformat(timespec="seconds")}
if move:
    with open(man_path, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=MANIFEST_COLS)
        w.writeheader()
        w.writerows(manifest.values())

filed = {int(m["grb_id"]) for m in manifest.values()}
missing = [i for i in plans if i not in filed and i not in found]
short = [i for i, r in plans.items()
         if len(r.get("fteDocIdList") or []) > len(found.get(i, [])) and i not in filed]
print(f"matched files: {sum(len(v) for v in found.values())} for {len(found)} plans")
print(f"picked plans with no file yet: {len(missing)}")
for i in missing:
    print(f"  {i} {plans[i].get('title')}")
if short:
    print(f"plans with fewer files than the site lists: {short}")

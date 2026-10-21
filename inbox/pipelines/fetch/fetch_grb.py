"""Fetch GRB (Government Research Bulletin) search results and plan details for many keywords.

Usage (from the repo root):
    uv run python -X utf8 -m pipelines.fetch.fetch_grb              # every term in data/manual/grb_keywords.csv
    uv run python -X utf8 -m pipelines.fetch.fetch_grb 耐震評估 危老  # only these terms (must be in the CSV)
Input:  data/manual/grb_keywords.csv (group, term, probe_hits_20261017). Network: yes.

Source: https://www.grb.gov.tw (front end) -> backend https://grbdef.stpi.niar.org.tw
The endpoints are the ones the public search page calls:
    POST /searcher        form-urlencoded search form  -> one result page
    POST /searcher/<id>   JSON body {}                  -> one plan detail
Adapted from 中企署數位生態/scripts/grb_fetch.py (runbook 2026-10-14). Same endpoints and pace.
Change: all terms share one details.jsonl, so a plan found by several terms is fetched once.

Output (data/raw/extra/research/grb/):
    search_pages/k<NN>_p<NNN>.json   raw search pages; k<NN> is the term's row in the CSV
    hits.json                        term -> list of GRB ids, in the site's relevance order
    details.jsonl                    one plan detail per line
    fetch_log.txt
Rules:
    1. Bibliographic records and abstracts only. Never the full text: the site puts a captcha
       before a full-text download, and a person downloads full text by hand.
    2. One request at a time, 0.5 s pause, stop after 5 failures in a row. Re-run to resume.
    3. Uses curl (keeps certificate checks), like the original script.
"""
import csv
import json
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime
from pipelines.common import MANUAL, RAW

TERMS_CSV = MANUAL / "grb_keywords.csv"
OUT = RAW / "extra" / "research" / "grb"
API = "https://grbdef.stpi.niar.org.tw"
UA = "Mozilla/5.0 civic-debug-hackathon-research/1.0"
ROWS = 200  # the backend returns HTTP 500 for some smaller page sizes (20 failed on 2026-10-17)
PAUSE = 0.5
MAX_FAILS = 5

sys.stdout.reconfigure(encoding="utf-8")
pages_dir = OUT / "search_pages"
pages_dir.mkdir(parents=True, exist_ok=True)
details_path = OUT / "details.jsonl"
log_path = OUT / "fetch_log.txt"


def log(msg):
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    print(line, flush=True)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def curl_post(url, dest, form_file=None):
    cmd = ["curl", "-sS", "-m", "60", "-A", UA,
           "-H", "Origin: https://www.grb.gov.tw", "-H", "Referer: https://www.grb.gov.tw/",
           "-o", str(dest), "-w", "%{http_code}"]
    if form_file is not None:
        cmd += ["-H", "Content-Type: application/x-www-form-urlencoded", "--data-binary", "@" + str(form_file)]
    else:
        cmd += ["-H", "Content-Type: application/json", "--data-binary", "{}"]
    cmd.append(url)
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode == 0 and p.stdout.strip() == "200"


def search_form(keyword, page):
    return {
        "keyword": keyword, "b": "", "queryType": "GRB05", "projNums": "",
        "planYearSt": "82", "planYearEn": "115", "actYearSt": "82", "actYearEn": "115",
        "planAmtSt": "", "planAmtEn": "", "memberKeywordScope": "0", "organKeywordScope": "0",
        "researchAttrs": "", "researchTypes": "", "researchFields": "", "researchFields2": "",
        "planOrgans": "", "excuOrgans": "", "opgrs": "", "edus": "",
        "grpPlanYear": "", "grpPlanAmt": "", "grpResearchField": "", "grpPlanOrgan": "",
        "grpExcuOrgan": "", "grpHostName": "", "nowPage": str(page), "rowsPerPage": str(ROWS),
        "orderType": "SIMILARITY",
    }


def search_term(n, term):
    """Return the ids for one term. Pages already on disk are reused."""
    body = OUT / "_form.txt"
    ids, total_pages, page, fails = [], None, 1, 0
    while total_pages is None or page <= total_pages:
        dest = pages_dir / f"k{n:02d}_p{page:03d}.json"
        if not dest.exists():
            body.write_text(urllib.parse.urlencode(search_form(term, page)), encoding="ascii")
            tmp = dest.with_suffix(".tmp")
            if not curl_post(API + "/searcher", tmp, form_file=body):
                fails += 1
                log(f"k{n:02d} {term} page {page} failed ({fails})")
                tmp.unlink(missing_ok=True)
                if fails >= MAX_FAILS:
                    log("too many failures in search phase; stop. Run again to resume.")
                    sys.exit(1)
                time.sleep(5)
                continue
            tmp.replace(dest)
            time.sleep(PAUSE)
        fails = 0
        data = json.loads(dest.read_text(encoding="utf-8"))
        if total_pages is None:
            total_pages = int(data["totalPages"])
            log(f"k{n:02d} {term}: totalRows={data['totalRows']} totalPages={total_pages}")
        ids.extend(int(o["id"]) for o in data["obj"])
        page += 1
    body.unlink(missing_ok=True)
    seen = set()
    return [i for i in ids if not (i in seen or seen.add(i))]


with open(TERMS_CSV, encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
wanted = set(sys.argv[1:])
unknown = wanted - {r["term"] for r in rows}
if unknown:
    sys.exit(f"terms not in {TERMS_CSV.name}: {sorted(unknown)}")

# ---- phase 1: search pages -------------------------------------------------
hits_path = OUT / "hits.json"
hits = json.loads(hits_path.read_text(encoding="utf-8")) if hits_path.exists() else {}
for n, r in enumerate(rows, 1):
    if wanted and r["term"] not in wanted:
        continue
    hits[r["term"]] = search_term(n, r["term"])
    hits_path.write_text(json.dumps(hits, ensure_ascii=False), encoding="utf-8")
all_ids = []
seen = set()
for term_ids in hits.values():
    for i in term_ids:
        if i not in seen:
            seen.add(i)
            all_ids.append(i)
log(f"search phase done: {len(hits)} terms, {len(all_ids)} unique ids")

# ---- phase 2: details ------------------------------------------------------
done = set()
if details_path.exists():
    with open(details_path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                done.add(int(json.loads(line)["id"]))
log(f"details already on disk: {len(done)}")
tmp = OUT / "_detail.tmp"
fails = n = 0
for i in all_ids:
    if i in done:
        continue
    rec = None
    if curl_post(f"{API}/searcher/{i}", tmp):
        try:
            rec = json.loads(tmp.read_text(encoding="utf-8"))
        except Exception:
            rec = None
    if not rec or int(rec.get("id", -1)) != i:
        fails += 1
        log(f"detail {i} failed ({fails})")
        if fails >= MAX_FAILS:
            log("too many failures in a row; stop. Run again to resume.")
            tmp.unlink(missing_ok=True)
            sys.exit(1)
        time.sleep(5)
        continue
    fails = 0
    with open(details_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    done.add(i)
    n += 1
    if n % 200 == 0:
        log(f"details fetched this run: {n}; on disk: {len(done)} / {len(all_ids)}")
    time.sleep(PAUSE)
tmp.unlink(missing_ok=True)
log(f"finished: {len(done)} / {len(all_ids)} details on disk")

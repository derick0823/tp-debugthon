"""Fetch per-case data from the Taipei urban renewal review platform (gis.uro.taipei).

Purpose: the public "168 project" list gives case_ids; each case's detail page
         loads its fields through ashx POSTs. We call those ashx endpoints
         directly and keep each raw response verbatim.
Usage:
  uv run python -X utf8 research/issue-06/mvp-variants/uro-cases/scripts/fetch_uro_cases.py list
  uv run python -X utf8 research/issue-06/mvp-variants/uro-cases/scripts/fetch_uro_cases.py cases --endpoints sixth [--ids 09608223,...] [--only-with-cost] [--limit N]
Input:   data/raw/extra/renewal/uro-review-cases/project168_list.json (written by `list`)
Output:  data/raw/extra/renewal/uro-review-cases/<case_id>.json
         {endpoint: raw response text}; resumable, an endpoint already stored is skipped
Network: yes, through uro_http (1 request at a time, >= 4 s gap, stop on non-200
         or on 3 empty responses in a row)
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import uro_http as h  # noqa: E402

LIST_FILE = h.RAW_DIR / "project168_list.json"
ENDPOINTS = {
    "First": "ashx/Get_project168_First.ashx",
    "top": "ashx/get_project168_top.ashx",
    "third": "ashx/Get_project168_third.ashx",
    "fourth": "ashx/Get_project168_fourth.ashx",
    "fifth": "ashx/Get_project168_fifth.ashx",
    "sixth": "ashx/Get_project168_sixth.ashx",
}
XHR = {"X-Requested-With": "XMLHttpRequest"}


def fetch_list():
    r = h.request("POST", "ashx/Get_project168.ashx",
                  data={"type": "project168", "pageIndex": 0, "pageSize": 3000},
                  headers={**XHR, "Referer": h.BASE + "/P_project168.aspx"}, note="168 list, all rows")
    LIST_FILE.write_bytes(r.content)
    print(len(json.loads(r.text)), "cases ->", LIST_FILE)


def case_file(cid):
    return h.RAW_DIR / f"{cid}.json"


def load_case(cid):
    f = case_file(cid)
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def has_cost(rec):
    """True when the sixth endpoint returned a non-empty unit price or cost."""
    try:
        obj = json.loads(rec["sixth"])
    except (KeyError, ValueError):
        return False
    obj = obj[0] if isinstance(obj, list) and obj else obj
    if not isinstance(obj, dict):
        return False
    keys = ["Renew_Mon1", "Renew_Mon2", "ChargeA", "ChargeC", "Urban_Renew_Fee"]
    return any(str(obj.get(k) or "").strip() not in ("", "0", "0.0", "0.00") for k in keys)


def is_empty(text):
    """An empty body, 'err' or an empty JSON value. A record full of zeros is not empty."""
    return text.strip().lower() in ("", "err", "[]", "{}", "null")


def fetch_cases(ids, endpoints, only_with_cost, limit):
    done, empty_run = 0, 0
    for cid in ids:
        rec = load_case(cid)
        if only_with_cost and not has_cost(rec):
            continue
        todo = [e for e in endpoints if e not in rec]
        if not todo:
            continue
        for e in todo:
            r = h.request("POST", ENDPOINTS[e], data={"case_id": cid},
                          headers={**XHR, "Referer": f"{h.BASE}/r_progress_detail.aspx?case_id={cid}"},
                          note=f"{cid} {e}")
            rec[e] = r.text
            case_file(cid).write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
            empty_run = empty_run + 1 if is_empty(r.text) else 0
            if empty_run >= 3:
                raise h.StopFetching(f"3 empty responses in a row, last {cid} {e}")
        done += 1
        print(cid, todo, "requests so far:", h.count(), flush=True)
        if limit and done >= limit:
            break


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["list", "cases"])
    ap.add_argument("--endpoints", default="sixth")
    ap.add_argument("--ids", default="")
    ap.add_argument("--only-with-cost", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    if a.cmd == "list":
        fetch_list()
        return
    ids = a.ids.split(",") if a.ids else [x["case_id"] for x in json.loads(LIST_FILE.read_text(encoding="utf-8"))]
    try:
        fetch_cases(ids, a.endpoints.split(","), a.only_with_cost, a.limit)
    except h.StopFetching as e:
        print("STOPPED:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()

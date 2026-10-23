"""Polite HTTP client for gis.uro.taipei (Taipei urban renewal review platform).

Purpose: one request at a time, >= 4 s apart (also across separate runs),
stop on any non-200, hard cap of 2,900 requests, log every request.
Usage:   imported by the other scripts in this folder; or for a one-off probe
         uv run python -X utf8 research/issue-06/mvp-variants/uro-cases/scripts/uro_http.py GET <url> [out_file]
Input:   none
Output:  data/raw/extra/renewal/uro-review-cases/_manifest.json (append-only log)
Network: yes
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))
from pipelines.common import RAW  # noqa: E402

BASE = "https://gis.uro.taipei"
RAW_DIR = RAW / "extra" / "renewal" / "uro-review-cases"
MANIFEST = RAW_DIR / "_manifest.json"
STOP_FILE = RAW_DIR / "_stop_at.txt"  # optional local time "YYYY-MM-DDTHH:MM"; no request after it
MIN_GAP = float(os.environ.get("URO_MIN_GAP", "4.2"))  # 6.0 after the 01:12 connection error
MAX_REQUESTS = 2900  # raised from 1,500 by debug-6f on 2026-10-22 so all 6 endpoints fit
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) taipei-debugathon-research (low-rate, 1 req/4s)"


class StopFetching(Exception):
    """Raised on a non-200 response or when the request cap is reached."""


def _load():
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {"source": BASE, "rules": "1 at a time, >=4s gap, stop on non-200, cap 1500", "requests": []}


def _save(m):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")


_session = requests.Session()
_session.headers["User-Agent"] = UA


def request(method, url, data=None, headers=None, note=""):
    """Send one request. Returns the Response. Raises StopFetching on non-200."""
    if STOP_FILE.exists():
        stop_at = datetime.fromisoformat(STOP_FILE.read_text(encoding="utf-8").strip())
        if datetime.now() >= stop_at:
            raise StopFetching(f"stop time {stop_at:%H:%M} reached ({STOP_FILE.name})")
    m = _load()
    reqs = m["requests"]
    if len(reqs) >= MAX_REQUESTS:
        raise StopFetching(f"request cap {MAX_REQUESTS} reached")
    if reqs:
        last = datetime.fromisoformat(reqs[-1]["at"]).timestamp()
        wait = MIN_GAP - (time.time() - last)
        if wait > 0:
            time.sleep(wait)
    if not url.startswith("http"):
        url = BASE + "/" + url.lstrip("/")
    at = datetime.now(timezone.utc).isoformat()
    try:
        r = _session.request(method, url, data=data, headers=headers, timeout=60)
        status, size = r.status_code, len(r.content)
    except requests.RequestException as e:
        r, status, size = None, f"error: {type(e).__name__}", 0
    reqs.append({"n": len(reqs) + 1, "at": at, "method": method, "url": url,
                 "data": data if isinstance(data, (dict, str, type(None))) else str(data),
                 "status": status, "bytes": size, "note": note})
    _save(m)
    if status != 200:
        raise StopFetching(f"{method} {url} -> {status}")
    return r


def count():
    return len(_load()["requests"])


if __name__ == "__main__":
    method, url = sys.argv[1], sys.argv[2]
    r = request(method, url, note="probe")
    if len(sys.argv) > 3:
        Path(sys.argv[3]).write_bytes(r.content)
    print(r.status_code, len(r.content), r.headers.get("content-type"), "requests so far:", count())

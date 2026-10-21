"""Download historical real-price registration (實價登錄) season files and keep only Taipei City.

Source: 內政部不動產交易實價查詢服務網, public season download, no login:
    https://plvr.land.moi.gov.tw//DownloadSeason?season=<SEASON>&type=zip&fileName=lvr_landcsv.zip
SEASON is ROC year + 'S' + quarter, e.g. 101S1. This script covers 101S1 .. 114S3 (55 seasons).
The newer seasons 114S4 .. 115S3 live in data/raw/extra/housing-stats/real-price-registration-lvr/
and are not touched here.

Usage (from the repo root):
    uv run python -X utf8 -m pipelines.fetch.fetch_lvr_history                   # all seasons, resumable
    uv run python -X utf8 -m pipelines.fetch.fetch_lvr_history --only 105S2      # one or more seasons
    uv run python -X utf8 -m pipelines.fetch.fetch_lvr_history --force           # refetch seasons marked ok
Input:  none (network only). Network: yes.
Output:
    data/raw/extra/housing-stats/lvr-history/<SEASON>/a_lvr_land_*.csv   Taipei files, contents as downloaded,
                                                                         file names lowercased
    data/raw/extra/housing-stats/lvr-history/<SEASON>/schema-*.csv, manifest.csv   when present in the zip
    data/raw/extra/housing-stats/lvr-history/_manifest.json             per season: url, fetched_at (+08:00),
                                                                         status ok/missing/error, zip_bytes,
                                                                         kept files with bytes and sha256
Politeness: one request at a time, at least 10 s between requests, normal User-Agent,
at most 2 retries per season with 30 s waits. The national zip is deleted after extraction.
A response that is not a zip (HTML error page) is recorded as missing (HTTP 200 or 404) or error.
A zip with no a_lvr_land_* member (101S1 is a header-only stub) is recorded as missing; nothing is kept.
Resumable: a season is skipped when its folder has a_lvr_land_a.csv and the manifest says ok,
or when the manifest says missing. Seasons marked error are retried. --force refetches everything.
"""
import argparse
import hashlib
import json
import subprocess
import sys
import time
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pipelines.common import RAW

OUT = RAW / "extra" / "housing-stats" / "lvr-history"
MANIFEST = OUT / "_manifest.json"
URL = "https://plvr.land.moi.gov.tw//DownloadSeason?season={season}&type=zip&fileName=lvr_landcsv.zip"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
TZ = timezone(timedelta(hours=8))
GAP_S = 10        # minimum wait between two requests
RETRY_WAIT_S = 30
MAX_RETRIES = 2

sys.stdout.reconfigure(encoding="utf-8")


def all_seasons(first=(101, 1), last=(114, 3)):
    out = []
    y, q = first
    while (y, q) <= last:
        out.append(f"{y}S{q}")
        y, q = (y, q + 1) if q < 4 else (y + 1, 1)
    return out


def keep_member(name):
    base = name.replace("\\", "/").rsplit("/", 1)[-1].lower()
    if not base.endswith(".csv"):
        return None
    if base.startswith("a_lvr_land_") or base.startswith("schema-") or base == "manifest.csv":
        return base
    return None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest():
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {"source": "https://plvr.land.moi.gov.tw/DownloadOpenData", "seasons": {}}


def save_manifest(m):
    m["seasons"] = dict(sorted(m["seasons"].items(),
                               key=lambda kv: (int(kv[0].split("S")[0]), int(kv[0].split("S")[1]))))
    m["updated_at"] = datetime.now(TZ).isoformat(timespec="seconds")
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")


_last_request = [0.0]


def polite_curl(url, dest):
    """Run one curl request, waiting so requests are at least GAP_S apart. Returns (http_code, err)."""
    wait = _last_request[0] + GAP_S - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    try:
        p = subprocess.run(["curl", "-sS", "-m", "600", "-A", UA, "-L", "-o", str(dest),
                            "-w", "%{http_code}", url], capture_output=True, text=True)
    finally:
        _last_request[0] = time.monotonic()
    code = p.stdout.strip()[-3:] if p.stdout.strip() else "000"
    return code, (p.stderr.strip() if p.returncode else "")


def fetch_season(season):
    url = URL.format(season=season)
    folder = OUT / season
    folder.mkdir(parents=True, exist_ok=True)
    tmp = folder / f"_lvr_landcsv-{season}.zip"
    rec = {"url": url}
    for attempt in range(MAX_RETRIES + 1):
        if attempt:
            print(f"  retry {attempt} after {RETRY_WAIT_S}s")
            time.sleep(RETRY_WAIT_S)
        rec["fetched_at"] = datetime.now(TZ).isoformat(timespec="seconds")
        code, err = polite_curl(url, tmp)
        rec["http_code"] = code
        size = tmp.stat().st_size if tmp.exists() else 0
        rec["zip_bytes"] = size
        head = tmp.read_bytes()[:4] if size else b""
        if code == "200" and head.startswith(b"PK"):
            break
        if code in ("200", "404") and size and not head.startswith(b"PK"):
            # server answered with a page instead of a zip: the season does not exist
            snippet = tmp.read_bytes()[:200].decode("utf-8", "replace").replace("\n", " ")
            rec.update(status="missing", note=f"not a zip; first bytes: {snippet[:120]}")
            tmp.unlink(missing_ok=True)
            return rec
        rec.update(status="error", note=err or f"http {code}, {size} bytes")
        tmp.unlink(missing_ok=True)
    else:
        return rec

    kept = []
    try:
        with zipfile.ZipFile(tmp) as z:
            names = z.namelist()
            rec["zip_members"] = len(names)
            for info in z.infolist():
                base = keep_member(info.filename)
                if not base or info.is_dir():
                    continue
                dest = folder / base           # basename only: no path traversal
                with z.open(info) as src, open(dest, "wb") as dst:
                    while chunk := src.read(1 << 20):
                        dst.write(chunk)
                kept.append({"file": base, "member": info.filename,
                             "bytes": dest.stat().st_size, "sha256": sha256(dest)})
    except zipfile.BadZipFile as e:
        rec.update(status="error", note=f"bad zip: {e}")
        tmp.unlink(missing_ok=True)
        return rec
    tmp.unlink(missing_ok=True)
    rec["kept"] = sorted(kept, key=lambda k: k["file"])
    if any(k["file"] == "a_lvr_land_a.csv" for k in kept):
        rec["status"] = "ok"
        return rec
    # empty season zip (e.g. 101S1 holds only a header-only manifest.csv): keep nothing on disk
    rec["zip_member_names"] = names
    for k in kept:
        (folder / k["file"]).unlink(missing_ok=True)
    rec["kept"] = []
    if not any(keep_member(n) and keep_member(n).startswith("a_lvr_land_") for n in names):
        rec.update(status="missing", note="zip holds no Taipei (a_lvr_land_*) file")
    else:
        rec.update(status="error", note="zip has Taipei files but no a_lvr_land_a.csv")
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="seasons to fetch, e.g. 101S1 105S2")
    ap.add_argument("--force", action="store_true", help="refetch seasons already ok")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    m = load_manifest()
    seasons = args.only or all_seasons()
    for i, season in enumerate(seasons, 1):
        prev = m["seasons"].get(season, {})
        if (not args.force and prev.get("status") == "ok"
                and (OUT / season / "a_lvr_land_a.csv").exists()):
            print(f"[{i}/{len(seasons)}] {season}: skip (ok)")
            continue
        if not args.force and prev.get("status") == "missing":
            print(f"[{i}/{len(seasons)}] {season}: skip (missing on server; --force to retry)")
            continue
        print(f"[{i}/{len(seasons)}] {season}: fetching", flush=True)
        rec = fetch_season(season)
        m["seasons"][season] = rec
        save_manifest(m)
        kept = len(rec.get("kept", []))
        print(f"  -> {rec['status']}, zip {rec.get('zip_bytes', 0):,} bytes, kept {kept} files"
              + (f", note: {rec['note']}" if rec.get("note") else ""), flush=True)
        if rec["status"] != "ok":
            folder = OUT / season
            if folder.exists() and not any(folder.iterdir()):
                folder.rmdir()
    counts = {}
    for r in m["seasons"].values():
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print("done:", counts)


if __name__ == "__main__":
    main()

"""Download every source listed in data/catalog.json into data/raw/<group>/<slug>/.

Usage (from the repo root):
    uv run python -X utf8 -m pipelines.fetch.fetch_raw              # all sources
    uv run python -X utf8 -m pipelines.fetch.fetch_raw parks bus-stops
    uv run python -X utf8 -m pipelines.fetch.fetch_raw --force      # re-download existing files

Input:  data/catalog.json
Output: data/raw/<group>/<slug>/  (raw files, _meta.json, _manifest.json)
Standard library only.

Each source folder gets:
    _meta.json      metadata from the portal API (data.taipei / data.gov.tw)
    _manifest.json  what was fetched: url, local file, bytes, sha256, time, status
Raw files are never edited by hand. Downstream cleaning reads them as-is.
File names are ASCII: r<position>-<resource id prefix>.<ext>; the manifest maps
each file back to its original resource name.
"""

import csv
import datetime as dt
import hashlib
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from pipelines.common import CATALOG, RAW

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) civic-debug-hackathon-fetch/1.0",
    "Accept": "*/*",
}
TIMEOUT = 120


def now_iso():
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def get_json(url):
    req = urllib.request.Request(url, headers={**HEADERS, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.load(r)


def sniff_ext(head, fallback):
    if head.startswith(b"PK"):
        return "zip"
    if head.startswith(b"\x1f\x8b"):
        return "gz"
    if head.lstrip(b"\xef\xbb\xbf").lstrip()[:1] in (b"{", b"["):
        return "json" if fallback not in ("geojson",) else fallback
    if head.lstrip().lower().startswith((b"<!doctype html", b"<html")):
        return "html"
    if head.lstrip(b"\xef\xbb\xbf").lstrip().startswith(b"<?xml"):
        return "xml"
    return fallback


def download(url, dest_stem, fallback_ext, force):
    """Stream url to dest_stem.<ext>. Returns a manifest record."""
    rec = {"url": url, "fetched_at": now_iso()}
    existing = list(dest_stem.parent.glob(dest_stem.name + ".*"))
    if existing and not force:
        f = existing[0]
        rec.update(file=f.name, bytes=f.stat().st_size, status="kept")
        return rec
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            first = r.read(4096)
            ext = sniff_ext(first, fallback_ext)
            tmp = dest_stem.with_suffix(".part")
            h = hashlib.sha256(first)
            n = len(first)
            with open(tmp, "wb") as out:
                out.write(first)
                while chunk := r.read(1 << 20):
                    out.write(chunk)
                    h.update(chunk)
                    n += len(chunk)
            for f in existing:
                f.unlink()
            final = dest_stem.parent / f"{dest_stem.name}.{ext}"
            tmp.replace(final)
            rec.update(file=final.name, bytes=n, sha256=h.hexdigest(),
                       content_type=r.headers.get("Content-Type"), status="ok")
    except Exception as e:  # keep going; the manifest records the failure
        rec.update(status="error", error=f"{type(e).__name__}: {e}")
    return rec


def ext_of(fmt, url):
    fmt = (fmt or "").strip().lower()
    if fmt in ("csv", "json", "geojson", "xml", "gz", "zip", "kml", "xlsx", "xls", "ods"):
        return fmt
    if fmt == "shp":
        return "zip"
    path_ext = Path(urllib.parse.urlparse(url).path).suffix.lstrip(".").lower()
    return path_ext or "bin"


def decode_text(b):
    for enc in ("utf-8-sig", "big5", "cp950"):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode("utf-8", errors="replace")


def follow_index(index_file, rule, folder, force, realtime_tag):
    rows = list(csv.DictReader(io.StringIO(decode_text(index_file.read_bytes()))))
    picked = rows[-rule.get("latest", 1):] if rule.get("latest") else rows
    recs = []
    for row in picked:
        url = row[rule["url_column"]].strip()
        name = Path(urllib.parse.unquote(urllib.parse.urlparse(url).path)).stem
        tag = re.sub(r"[^0-9]", "", name)[-6:] or "item"
        rec = download(url, folder / f"index-{tag}{realtime_tag}", ext_of("", url), force)
        rec["resource_name"] = name
        recs.append(rec)
    return recs


def fetch_data_taipei(src, folder, force, realtime_tag):
    f = src["fetch"]
    meta = get_json(f"https://data.taipei/api/frontstage/tpeod/dataset.view?id={f['dataset_id']}")
    (folder / "_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    recs = []
    for r in meta["payload"]["resources"]:
        fmt = r.get("file_format") or ""
        if f.get("formats") and fmt.upper() not in f["formats"]:
            continue
        url = urllib.parse.urljoin("https://data.taipei", r["url"])
        name = r.get("name") or ""
        target = folder
        if f.get("subdir_from") and (m := re.match(f["subdir_from"], name)):
            target = folder / m.group(1)
            target.mkdir(exist_ok=True)
        if f.get("name_from") and (m := re.match(f["name_from"], name)):
            stem_name = m.group(1)
        else:
            stem_name = f"r{int(r.get('position') or 0):03d}-{r['rid'][:8]}"
        rec = download(url, target / f"{stem_name}{realtime_tag}", ext_of(fmt, url), force)
        if rec.get("file"):
            rec["file"] = str((target / rec["file"]).relative_to(folder)).replace("\\", "/")
        rec.update(resource_name=name, declared_format=fmt,
                   declared_encoding=r.get("encoding"), rid=r["rid"])
        recs.append(rec)
        if f.get("follow_index") and rec["status"] in ("ok", "kept"):
            recs += follow_index(folder / rec["file"], f["follow_index"], folder, force, realtime_tag)
    return recs


def fetch_data_gov_tw(src, folder, force, realtime_tag):
    f = src["fetch"]
    meta = get_json(f"https://data.gov.tw/api/v2/rest/dataset/{f['dataset_id']}")
    (folder / "_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    if not meta.get("success", True) or "result" not in meta:
        return [{"url": src["page_url"], "status": "error", "error": f"metadata API: {meta.get('error')}",
                 "fetched_at": now_iso()}]
    recs = []
    for i, d in enumerate(meta["result"].get("distribution", [])):
        fmt = d.get("resourceFormat") or ""
        if f.get("formats") and fmt.upper() not in f["formats"]:
            continue
        url = d["resourceDownloadUrl"]
        rid = hashlib.sha1(url.encode()).hexdigest()[:8]
        rec = download(url, folder / f"r{i:03d}-{rid}{realtime_tag}", ext_of(fmt, url), force)
        rec.update(resource_name=d.get("resourceDescription"), declared_format=fmt)
        recs.append(rec)
    return recs


def fetch_source(src, force):
    if src["fetch"]["mode"] == "script":
        # Fetched by its own script, which writes its own _manifest.json. Do not touch the folder.
        return {"slug": src["slug"], "mode": "script", "files": [],
                "note": f"run: uv run python -X utf8 -m {src['fetch']['script']}"}
    folder = RAW / src["group"] / src["slug"]
    folder.mkdir(parents=True, exist_ok=True)
    mode = src["fetch"]["mode"]
    realtime_tag = "-" + dt.datetime.now().strftime("%Y%m%dT%H%M") if src.get("realtime") else ""
    try:
        if mode == "data_taipei":
            recs = fetch_data_taipei(src, folder, force, realtime_tag)
        elif mode == "data_gov_tw":
            recs = fetch_data_gov_tw(src, folder, force, realtime_tag)
        elif mode == "snapshot":
            day = dt.date.today().isoformat()
            recs = [download(src["page_url"], folder / f"page-{day}", "html", force)]
        elif mode == "urls":
            recs = []
        else:  # manual / pending: nothing to download
            recs = []
        for i, url in enumerate(src["fetch"].get("extra_urls", [])):
            rid = hashlib.sha1(url.encode()).hexdigest()[:8]
            day = dt.date.today().isoformat() if mode == "urls" else ""
            stem = folder / (f"x{i:03d}-{rid}" + (f"-{day}" if day else "") + realtime_tag)
            recs.append(download(url, stem, ext_of("", url), force))
    except Exception as e:
        recs = [{"url": src.get("page_url"), "status": "error", "error": f"{type(e).__name__}: {e}",
                 "fetched_at": now_iso()}]
    manifest = {"slug": src["slug"], "title": src["title"], "mode": mode,
                "manual": src.get("manual"), "run_at": now_iso(), "files": recs}
    (folder / "_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return manifest


def main(argv):
    force = "--force" in argv
    wanted = [a for a in argv if not a.startswith("--")]
    sources = json.loads(CATALOG.read_text(encoding="utf-8"))["sources"]
    if wanted:
        sources = [s for s in sources if s["slug"] in wanted]
    for src in sources:
        m = fetch_source(src, force)
        ok = sum(f["status"] in ("ok", "kept") for f in m["files"])
        bad = [f for f in m["files"] if f["status"] == "error"]
        mb = sum(f.get("bytes", 0) for f in m["files"]) / 1e6
        print(f"{src['slug']:<36} {m['mode']:<12} files={ok:<4} err={len(bad):<3} {mb:8.1f} MB", flush=True)
        if m.get("note"):
            print(f"    - {m['note']}", flush=True)
        for f in bad[:3]:
            print(f"    ! {f['url']}  {f['error']}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])

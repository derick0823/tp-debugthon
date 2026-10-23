"""Download the Taipei social housing list (data.taipei) once and make a small table.

Purpose: name, district, planned units and coordinates of each social housing site,
         for the renewal MVPs (where relocation housing could come from).
Usage:   uv run python -X utf8 research/issue-06/mvp-variants/uro-cases/scripts/fetch_social_housing.py
Input:   data.taipei dataset 659c3565-df41-4f80-915f-95e83071bdcd (臺北市社會住宅興建工程進度, 都市發展局)
Output:  data/raw/extra/renewal/social-housing-construction-progress/  (_meta.json + raw resources)
         research/issue-06/mvp-variants/uro-cases/out/social-housing.csv
Network: yes, one metadata request plus one request per resource; no polling
"""

import json
import sys
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT))
from pipelines.address import TOWNS  # noqa: E402
from pipelines.common import RAW  # noqa: E402

DATASET = "659c3565-df41-4f80-915f-95e83071bdcd"
RAW_DIR = RAW / "extra" / "renewal" / "social-housing-construction-progress"
OUT = Path(__file__).resolve().parents[1] / "out"


def get(url):
    r = requests.get(url, timeout=60, headers={"User-Agent": "taipei-debugathon-research (one-off download)"})
    r.raise_for_status()
    time.sleep(2)
    return r


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    meta_file = RAW_DIR / "_meta.json"
    if meta_file.exists():
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
    else:
        meta = get(f"https://data.taipei/api/frontstage/tpeod/dataset.view?id={DATASET}").json()
        meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    frames = []
    for res in meta["payload"]["resources"]:
        rid = res["rid"]
        print("resource:", res.get("name"), res.get("file_format"), res.get("url"))
        # This resource is an external API (hms.udd.gov.taipei); the data.taipei v1 endpoint
        # returned an empty list on 2026-10-22, so call the resource URL itself
        raw = RAW_DIR / f"{rid[:8]}.json"
        if raw.exists() and raw.stat().st_size > 10:  # keep the first download; rerun without network
            body = json.loads(raw.read_text(encoding="utf-8"))
        else:
            body = get(urllib.parse.urljoin("https://data.taipei", res["url"])).json()
            raw.write_text(json.dumps(body, ensure_ascii=False, indent=1), encoding="utf-8")
        rows = body if isinstance(body, list) else body.get("data") or body.get("result") or []
        print("  rows:", len(rows), "columns:", list(rows[0])[:15] if rows else [])
        frames.append(pd.DataFrame(rows))
    if not frames or all(f.empty for f in frames):
        print("NO ROWS")
        return
    df = pd.concat(frames, ignore_index=True).rename(columns={
        "distict": "town_name", "lng": "lon", "houseHolds": "households_planned", "persons": "residents"})
    df["town_code"] = df.town_name.map(TOWNS)
    for c in ["lat", "lon", "households_planned", "residents", "floors"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    # Two rows are totals, not sites (e.g. "民辦都更(56處)"); their district is not meaningful
    df["row_type"] = df.name.str.contains(r"\(\d+處\)").map({True: "aggregate", False: "site"})
    df.loc[df.row_type == "aggregate", ["town_name", "town_code"]] = None
    df["in_taipei"] = df.town_code.notna() | (df.row_type == "aggregate")  # 新店、三重 joint sites are New Taipei
    df["source"] = "data.taipei 659c3565 臺北市社會住宅興建工程進度（都市發展局）"
    df["fetched"] = datetime.now().strftime("%Y-%m-%d")
    cols = ["name", "row_type", "in_taipei", "town_code", "town_name", "address", "lat", "lon",
            "households_planned", "residents", "floors", "progress", "source", "fetched"]
    df = df[cols]
    df.to_csv(OUT / "social-housing.csv", index=False, encoding="utf-8")
    sites = df[(df.row_type == "site") & df.in_taipei]
    print(sites.progress.value_counts().to_string())
    print("Taipei sites:", len(sites), "units:", int(sites.households_planned.sum()),
          "| aggregate rows:", int((df.row_type == "aggregate").sum()),
          "units:", int(df.loc[df.row_type == "aggregate", "households_planned"].sum()),
          "| New Taipei sites:", int((~df.in_taipei).sum()))
    print("wrote", OUT / "social-housing.csv", df.shape)


if __name__ == "__main__":
    main()

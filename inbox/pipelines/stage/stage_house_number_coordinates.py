"""Stage the Taipei house-number table for geocoding and unit counts.

One row per address unit (each floor has its own row in the source).
Address parts are normalized with pipelines.address.normalize so that
other datasets can match them.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_house_number_coordinates
Input:   data/raw/extra/base/house-number-coordinates/taipei-house-number-coords-20261002.csv
         data/staged/base/village-boundary-nlsc.csv   (run stage_village_boundary first)
Output:  data/staged/base/house-number-coordinates.parquet
         columns: town_code, village_code, village_name, road, lane, alley, no, no_sub,
                  is_ground (no floor suffix), x, y (EPSG:3826), lon, lat (EPSG:4326)
Network: no
"""

import re

import pandas as pd
from pyproj import Transformer

from pipelines.address import normalize
from pipelines.common import RAW, STAGED

SRC = RAW / "extra" / "base" / "house-number-coordinates" / "taipei-house-number-coords-20261002.csv"
VILLAGES = STAGED / "base" / "village-boundary-nlsc.csv"
OUT = STAGED / "base" / "house-number-coordinates.parquet"

NO_RE = re.compile(r"^(\d+)(?:之(\d+))?號(.*)$")


def num_part(s, suffix):
    s = normalize(s)
    return str(int(s[: -len(suffix)])) if s.endswith(suffix) and s[: -len(suffix)].isdigit() else ""


def main():
    d = pd.read_csv(SRC, dtype=str, encoding="utf-8-sig")
    v = pd.read_csv(VILLAGES, dtype=str)
    d = d.rename(columns={"鄉鎮市區代碼": "town_code", "村里": "village_name"})
    d["village_name"] = d["village_name"].str.strip()
    d = d.merge(v[["town_code", "village_name", "village_code"]], on=["town_code", "village_name"], how="left")
    miss = d["village_code"].isna().sum()
    print(f"rows={len(d)} village name not in NLSC={miss}")

    d["road"] = d["街路段"].map(normalize)
    d["lane"] = d["巷"].fillna("").map(lambda s: num_part(s, "巷"))
    d["alley"] = d["弄"].fillna("").map(lambda s: num_part(s, "弄"))
    parts = d["號"].fillna("").map(normalize).str.extract(NO_RE)
    d["no"] = pd.to_numeric(parts[0], errors="coerce").astype("Int64")
    d["no_sub"] = pd.to_numeric(parts[1], errors="coerce").astype("Int64")
    d["is_ground"] = parts[2].fillna("").eq("")
    d["x"] = pd.to_numeric(d["橫座標"])
    d["y"] = pd.to_numeric(d["縱座標"])
    tr = Transformer.from_crs("EPSG:3826", "EPSG:4326", always_xy=True)
    d["lon"], d["lat"] = tr.transform(d["x"].values, d["y"].values)
    out = d[["town_code", "village_code", "village_name", "road", "lane", "alley", "no", "no_sub",
             "is_ground", "x", "y", "lon", "lat"]]
    print(f"no number parsed={out['no'].isna().sum()} buildings={out.drop_duplicates(['town_code','road','lane','alley','no']).shape[0]}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(OUT, index=False)


if __name__ == "__main__":
    main()

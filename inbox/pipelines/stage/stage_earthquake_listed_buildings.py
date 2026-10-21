"""Stage the earthquake listed buildings (921/331/403 黃單) and locate each one.

The address cell often lists ranges or several numbers; the first address is used.
Source fix: "信義區路" -> "信義路" (2 rows write the road name with an extra 區).

Usage:   uv run python -X utf8 -m pipelines.stage.stage_earthquake_listed_buildings
Input:   data/raw/extra/hazard/earthquake-listed-buildings/earthquake-listed-buildings-1150318.csv
         data/staged/base/house-number-coordinates.parquet
Output:  data/staged/hazard/earthquake-listed-buildings.csv
         columns: case_id, quake (921|331|403), town_code, address, village_code,
                  x, y (EPSG:3826), geo_level, geo_note, building_key (geo_level 1 only)
Network: no
"""

import pandas as pd

from pipelines.address import POSTAL_TO_TOWN, Geocoder, match_report
from pipelines.common import RAW, STAGED

SRC = RAW / "extra" / "hazard" / "earthquake-listed-buildings" / "earthquake-listed-buildings-1150318.csv"
OUT = STAGED / "hazard" / "earthquake-listed-buildings.csv"


def main():
    d = pd.read_csv(SRC, dtype=str, encoding="utf-8-sig")
    d["case_id"] = range(1, len(d) + 1)
    d["town_code"] = d["行政區代碼（編碼）"].map(POSTAL_TO_TOWN)
    d["quake"] = d["備註"].str.extract(r"(921|331|403)")[0]
    d["address"] = d["建築地點"]
    d["_addr"] = d["address"].str.replace("信義區路", "信義路", regex=False)
    d = Geocoder().locate_frame(d, "_addr", "town_code")
    match_report(d, "earthquake-listed-buildings")
    out = d[["case_id", "quake", "town_code", "address", "village_code", "x", "y", "geo_level", "geo_note",
             "building_key"]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

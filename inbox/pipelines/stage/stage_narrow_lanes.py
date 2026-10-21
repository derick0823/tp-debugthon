"""Stage the narrow lane list (狹小巷道清冊，紅黃區) and locate each lane to a village.

A lane name has no house number, so most rows match at geo_level 3
(majority village of the lane). See pipelines/address.py for the levels.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_narrow_lanes
Input:   data/raw/extra/hazard/narrow-lanes-red-yellow/narrow-lanes.utf8.csv
         data/staged/base/house-number-coordinates.parquet
Output:  data/staged/hazard/narrow-lanes-red-yellow.csv
         columns: lane_id, zone (red|yellow), town_code, fire_unit, lane_name, width_m,
                  village_code, x, y (EPSG:3826), geo_level, geo_note
Network: no
"""

import pandas as pd

from pipelines.address import Geocoder, match_report
from pipelines.common import RAW, STAGED

SRC = RAW / "extra" / "hazard" / "narrow-lanes-red-yellow" / "narrow-lanes.utf8.csv"
OUT = STAGED / "hazard" / "narrow-lanes-red-yellow.csv"


def main():
    d = pd.read_csv(SRC, dtype=str, encoding="utf-8-sig")
    d = d.rename(columns={"項次編號": "lane_id", "行政區代碼": "town_code", "分隊名稱": "fire_unit",
                          "巷道名稱": "lane_name", "寬度": "width_m"})
    d["zone"] = d["分類"].map({"紅區": "red", "黃區": "yellow"})
    d["width_m"] = pd.to_numeric(d["width_m"], errors="coerce")
    d = Geocoder().locate_frame(d, "lane_name", "town_code")
    match_report(d, "narrow-lanes")
    out = d[["lane_id", "zone", "town_code", "fire_unit", "lane_name", "width_m",
             "village_code", "x", "y", "geo_level", "geo_note"]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

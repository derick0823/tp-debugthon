"""Stage the fire rescue difficult site list (火災搶救困難地區場所清冊) and locate each site.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_fire_rescue_difficult_areas
Input:   data/raw/extra/hazard/fire-rescue-difficult-areas/fire-rescue-difficult-areas.csv
         data/staged/base/house-number-coordinates.parquet
Output:  data/staged/hazard/fire-rescue-difficult-areas.csv
         columns: site_id, grade, criteria_code, town_code, address, site_name,
                  village_code, x, y (EPSG:3826), geo_level, geo_note
Network: no
"""

import pandas as pd

from pipelines.address import Geocoder, match_report
from pipelines.common import RAW, STAGED

SRC = RAW / "extra" / "hazard" / "fire-rescue-difficult-areas" / "fire-rescue-difficult-areas.csv"
OUT = STAGED / "hazard" / "fire-rescue-difficult-areas.csv"


def main():
    d = pd.read_csv(SRC, dtype=str, encoding="utf-8-sig")
    d = d.rename(columns={"項次編號": "site_id", "評分等級": "grade", "認定項目": "criteria_code",
                          "行政區編號": "town_code", "地址": "address", "場所名稱": "site_name"})
    d = Geocoder().locate_frame(d, "address", "town_code")
    match_report(d, "fire-rescue-difficult-areas")
    out = d[["site_id", "grade", "criteria_code", "town_code", "address", "site_name",
             "village_code", "x", "y", "geo_level", "geo_note"]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

"""Stage the full sea-sand (high chloride) building list and locate each case.

The PDF was converted to CSV by an earlier agent (parser not in repo; row count and
totals match the PDF: 158 cases, 7,424 units). The use-permit number starts with the
ROC year of the permit, which gives an upper bound on the building age.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_sea_sand_houses
Input:   data/raw/extra/renewal/sea-sand-houses-full-list/taipei-high-chloride-buildings-1150325.parsed.csv
         data/staged/base/house-number-coordinates.parquet
Output:  data/staged/renewal/sea-sand-houses-full-list.csv
         columns: case_id, town_code, town_name, address, permit_no, permit_year_ad, units,
                  category (rebuild|retrofit), village_code, x, y (EPSG:3826), geo_level, geo_note,
                  building_key (geo_level 1 only)
Network: no
"""

import pandas as pd

from pipelines.address import TOWNS, Geocoder, match_report
from pipelines.common import RAW, STAGED

SRC = RAW / "extra" / "renewal" / "sea-sand-houses-full-list" / "taipei-high-chloride-buildings-1150325.parsed.csv"
OUT = STAGED / "renewal" / "sea-sand-houses-full-list.csv"


def main():
    d = pd.read_csv(SRC, dtype=str, encoding="utf-8-sig")
    d = d.rename(columns={"序號": "case_id", "行政區": "town_name", "地點": "address",
                          "使照號碼": "permit_no", "列管戶數": "units"})
    d["town_code"] = d["town_name"].str.strip().map(TOWNS)
    d["permit_year_ad"] = pd.to_numeric(d["permit_no"].str[:3], errors="coerce") + 1911
    d["units"] = pd.to_numeric(d["units"], errors="coerce")
    d["category"] = d["列管分類"].map({"須拆除重建": "rebuild", "可加勁補強": "retrofit"})
    d = Geocoder().locate_frame(d, "address", "town_code")
    match_report(d, "sea-sand-houses")
    print(f"units={d.units.sum()} category={d.category.value_counts(dropna=False).to_dict()}")
    out = d[["case_id", "town_code", "town_name", "address", "permit_no", "permit_year_ad", "units",
             "category", "village_code", "x", "y", "geo_level", "geo_note", "building_key"]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

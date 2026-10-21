"""Stage building-permit footprints (建築執照套繪圖, permits from ROC 90 onward).

Each footprint gets the village that contains its centroid. The permit number
(budatt_no, e.g. "101.0225.6F") gives the construction permit year and serial;
it joins to staged use permits by cp_key = "101-0225" to add the completion year
and the build type (新建 / 增建 ...).

Usage:   uv run python -X utf8 -m pipelines.stage.stage_building_permit_footprints
Input:   data/raw/extra/permits/building-permit-footprints/extracted/taipei_1151005.shp  (EPSG:3826)
         data/staged/base/village-boundary-nlsc.geojson
         data/staged/permits/use-permits.csv  (run stage_use_permits first)
Output:  data/staged/permits/building-permit-footprints.geojson  (EPSG:4326)
         columns: budatt_no, cp_key, cp_year_ad, floors, structure, structure_class,
                  footprint_m2, floor_area_m2 (= footprint x floors), village_code,
                  completed_year_ad, build_type
Network: no
"""

import geopandas as gpd
import pandas as pd

from pipelines.common import RAW, STAGED, CRS_WGS84, CRS_TWD97
from pipelines.stage.stage_use_permits import structure_class

SRC = RAW / "extra" / "permits" / "building-permit-footprints" / "extracted" / "taipei_1151005.shp"
VILLAGES = STAGED / "base" / "village-boundary-nlsc.geojson"
PERMITS = STAGED / "permits" / "use-permits.csv"
OUT = STAGED / "permits" / "building-permit-footprints.geojson"


def main():
    g = gpd.read_file(SRC).to_crs(CRS_TWD97)
    parts = g["budatt_no"].str.extract(r"^(\d{2,3})\.(\d+)")
    g["cp_key"] = parts[0].str.zfill(3) + "-" + parts[1].str.zfill(4)
    g["cp_year_ad"] = pd.to_numeric(parts[0], errors="coerce") + 1911
    g["floors"] = g["bud_floor"]
    g["structure"] = g["bud_const"]
    g["structure_class"] = g["bud_const"].map(lambda s: structure_class(s) if isinstance(s, str) else None)
    g["footprint_m2"] = g.area.round(1)
    g["floor_area_m2"] = (g["footprint_m2"] * g["floors"].where(g["floors"] > 0)).round(1)
    v = gpd.read_file(VILLAGES).to_crs(CRS_TWD97)[["village_code", "geometry"]]
    cent = g[["geometry"]].copy()
    cent["geometry"] = g.representative_point()
    j = gpd.sjoin(cent, v, how="left", predicate="within")
    g["village_code"] = j.loc[~j.index.duplicated(), "village_code"]
    up = pd.read_csv(PERMITS, dtype={"cp_key": str})
    up = (up.dropna(subset=["cp_key"]).sort_values("completed_year_ad")
            .drop_duplicates("cp_key")[["cp_key", "completed_year_ad", "build_type"]])
    g = g.merge(up, on="cp_key", how="left")
    print(f"footprints={len(g)} no village={g.village_code.isna().sum()} "
          f"joined to use permit={g.completed_year_ad.notna().sum()} "
          f"cp_year range={g.cp_year_ad.min()}-{g.cp_year_ad.max()}")
    print(g["build_type"].value_counts(dropna=False).to_dict())
    out = g[["budatt_no", "cp_key", "cp_year_ad", "floors", "structure", "structure_class", "footprint_m2",
             "floor_area_m2", "village_code", "completed_year_ad", "build_type", "geometry"]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_crs(CRS_WGS84).to_file(OUT, driver="GeoJSON")


if __name__ == "__main__":
    main()

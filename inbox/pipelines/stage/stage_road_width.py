"""Stage the planned road width markers (臺北市道路寬度，都發局) and tag each with its village.

Each line in the source is a width marker drawn across the road, not a road
centreline: its length equals the width it labels (correlation 0.999999, checked
2026-10-17). So the data gives "how many road cross-sections of each width", not
road length. These are urban-plan widths; informal lanes may be missing [doc].

Usage:   uv run python -X utf8 -m pipelines.stage.stage_road_width
Input:   data/raw/extra/hazard/road-width-planned/extracted/roadsize2.shp  (EPSG:3826)
         data/staged/base/village-boundary-nlsc.geojson
Output:  data/staged/hazard/road-width-planned.geojson  (EPSG:4326, one marker per row)
         columns: marker_id, width_m, marker_length_m, village_code
Network: no
"""

import geopandas as gpd
import pandas as pd

from pipelines.common import RAW, STAGED, CRS_WGS84, CRS_TWD97

SRC = RAW / "extra" / "hazard" / "road-width-planned" / "extracted" / "roadsize2.shp"
VILLAGES = STAGED / "base" / "village-boundary-nlsc.geojson"
OUT = STAGED / "hazard" / "road-width-planned.geojson"


def main():
    r = gpd.read_file(SRC).to_crs(CRS_TWD97)
    r["marker_id"] = range(1, len(r) + 1)
    r["width_m"] = pd.to_numeric(r["road_width"].str.replace("M", "", regex=False), errors="coerce")
    r["marker_length_m"] = r.length.round(2)
    v = gpd.read_file(VILLAGES).to_crs(CRS_TWD97)[["village_code", "geometry"]]
    mid = r[["marker_id", "geometry"]].copy()
    mid["geometry"] = r.interpolate(0.5, normalized=True)
    j = gpd.sjoin(mid, v, how="left", predicate="within").drop_duplicates("marker_id")
    r["village_code"] = j.set_index("marker_id").loc[r["marker_id"], "village_code"].values
    corr = r[["width_m", "marker_length_m"]].corr().iat[0, 1]
    print(f"markers={len(r)} bad width={r.width_m.isna().sum()} no village={r.village_code.isna().sum()} "
          f"corr(width, length)={corr:.6f} share<6m={(r.width_m < 6).mean():.4f}")
    out = r[["marker_id", "width_m", "marker_length_m", "village_code", "geometry"]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_crs(CRS_WGS84).to_file(OUT, driver="GeoJSON")


if __name__ == "__main__":
    main()

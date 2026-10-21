"""Stage soil.taipei liquefaction boreholes (3,979 holes with PL) and tag each with its village.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_liquefaction_boreholes
Input:   data/raw/extra/hazard/liquefaction-boreholes-soil-taipei/Taipei_hole_97.geojson  (TWD97)
         data/staged/base/village-boundary-nlsc.geojson
Output:  data/staged/hazard/liquefaction-boreholes-soil-taipei.geojson  (EPSG:4326)
         columns: hole_id, project, water_table_m, depth_m, pl, village_code
Network: no
"""

import geopandas as gpd
import pandas as pd

from pipelines.common import RAW, STAGED, CRS_WGS84, CRS_TWD97

SRC = RAW / "extra" / "hazard" / "liquefaction-boreholes-soil-taipei" / "Taipei_hole_97.geojson"
VILLAGES = STAGED / "base" / "village-boundary-nlsc.geojson"
OUT = STAGED / "hazard" / "liquefaction-boreholes-soil-taipei.geojson"


def main():
    g = gpd.read_file(SRC).set_crs(CRS_TWD97, allow_override=True)
    g = g.rename(columns={"proj_name": "project", "hole_point": "hole_id", "wt_depth": "water_table_m",
                          "depth": "depth_m", "PL": "pl"})
    for c in ["water_table_m", "depth_m", "pl"]:
        g[c] = pd.to_numeric(g[c], errors="coerce")
    v = gpd.read_file(VILLAGES).to_crs(CRS_TWD97)[["village_code", "geometry"]]
    g = gpd.sjoin(g, v, how="left", predicate="within").drop(columns="index_right")
    g = g[~g.index.duplicated()]
    print(f"holes={len(g)} pl median={g.pl.median()} no village={g.village_code.isna().sum()}")
    out = g[["hole_id", "project", "water_table_m", "depth_m", "pl", "village_code", "geometry"]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_crs(CRS_WGS84).to_file(OUT, driver="GeoJSON")


if __name__ == "__main__":
    main()

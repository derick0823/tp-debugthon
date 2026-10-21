"""Stage the NLSC village boundary for Taipei (456 villages).

Usage:   uv run python -X utf8 -m pipelines.stage.stage_village_boundary
Input:   data/raw/extra/base/village-boundary-nlsc/taipei-villages-nlsc-1150817.geojson
Output:  data/staged/base/village-boundary-nlsc.geojson   (EPSG:4326)
         data/staged/base/village-boundary-nlsc.csv       (attributes and area, no geometry)
Network: no
"""

import geopandas as gpd

from pipelines.common import RAW, STAGED, CRS_WGS84, CRS_TWD97

SRC = RAW / "extra" / "base" / "village-boundary-nlsc" / "taipei-villages-nlsc-1150817.geojson"
OUT = STAGED / "base"


def main():
    g = gpd.read_file(SRC)
    g = g.rename(columns={"VILLCODE": "village_code", "VILLNAME": "village_name",
                          "TOWNCODE": "town_code", "TOWNNAME": "town_name"})
    g = g[["town_code", "town_name", "village_code", "village_name", "geometry"]]
    g["area_m2"] = g.to_crs(CRS_TWD97).area.round(1)
    g = g.to_crs(CRS_WGS84).sort_values("village_code").reset_index(drop=True)
    assert len(g) == 456 and g["village_code"].is_unique
    OUT.mkdir(parents=True, exist_ok=True)
    g.to_file(OUT / "village-boundary-nlsc.geojson", driver="GeoJSON")
    g.drop(columns="geometry").to_csv(OUT / "village-boundary-nlsc.csv", index=False, encoding="utf-8")
    print(f"villages={len(g)} total_km2={g.area_m2.sum()/1e6:.2f}")


if __name__ == "__main__":
    main()

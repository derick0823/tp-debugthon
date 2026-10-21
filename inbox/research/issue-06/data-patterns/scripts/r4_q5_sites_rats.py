"""R4 Q5: are rat reports more common near active construction sites? (cross-section, capped at 1 hour)

Why not before/after: Rat Radar reports start in 2026-05 (830 of 949 Taipei reports
in the launch month), the same month the city's pre-demolition rodent control rule
started (2026-05-05). Time series are too short and launch-biased.

Test: the share of rat reports within R metres of an active site, compared with the
share of doorplate units (where people live and could report) within R metres.
Ratio > 1 means reports cluster near sites more than population does.
Active site = new-build construction permit issued 2023-07..2026-09, located at
geo_level 1-2, with no use permit yet (not completed).
This is an association only: density, report bias and site choice are not controlled.

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/r4_q5_sites_rats.py
Input:   data/raw/sanitation/ratdar-reports/manual-export-20261017T135057.csv
         data/staged/permits/construction-permits.csv, use-permits.csv
         data/staged/base/house-number-coordinates.parquet
Output:  results.json["r4_q5"]  (aggregates only; no report text or point is written)
Network: no
"""

import geopandas as gpd
import numpy as np
import pandas as pd

from common import STAGED, save_result
from pipelines.common import RAW, CRS_TWD97, CRS_WGS84

RADII = [50, 100, 200]


def share_within(points, sites, r, weights=None):
    buf = sites.buffer(r).union_all()
    inside = points.within(buf)
    if weights is None:
        return inside.mean()
    return (weights * inside).sum() / weights.sum()


def main():
    rr = pd.read_csv(RAW / "sanitation" / "ratdar-reports" / "manual-export-20261017T135057.csv")
    rr = rr[rr["地點"].str.startswith("臺北市", na=False) & (rr["類型"] == "鼠蹤")]
    rats = gpd.GeoDataFrame(geometry=gpd.points_from_xy(rr["經度"], rr["緯度"]), crs=CRS_WGS84).to_crs(CRS_TWD97)

    cp = pd.read_csv(STAGED / "permits" / "construction-permits.csv", dtype={"cp_key": str})
    up = pd.read_csv(STAGED / "permits" / "use-permits.csv", dtype={"cp_key": str})
    cp["issued_date"] = pd.to_datetime(cp.issued_date)
    act = cp[(cp.build_type == "新建") & cp.geo_level.between(1, 2) & (cp.issued_date >= "2023-07-01")
             & ~cp.cp_key.isin(up.cp_key.dropna())]
    sites = gpd.GeoDataFrame(geometry=gpd.points_from_xy(act.x, act.y), crs=CRS_TWD97)
    weilao_sites = gpd.GeoDataFrame(geometry=gpd.points_from_xy(act[act.weilao_remark].x, act[act.weilao_remark].y),
                                    crs=CRS_TWD97)

    hn = pd.read_parquet(STAGED / "base" / "house-number-coordinates.parquet", columns=["x", "y"])
    units = hn.groupby(["x", "y"]).size().rename("w").reset_index()
    pop = gpd.GeoDataFrame(units, geometry=gpd.points_from_xy(units.x, units.y), crs=CRS_TWD97)

    res = {"rat_reports_taipei": len(rats), "active_sites": len(sites), "active_weilao_sites": len(weilao_sites)}
    for r in RADII:
        a = share_within(rats.geometry, sites, r)
        b = share_within(pop.geometry, sites, r, pop.w)
        res[f"r{r}_reports_share"] = round(a, 4)
        res[f"r{r}_units_share"] = round(b, 4)
        res[f"r{r}_ratio"] = round(a / b, 2) if b else None
        aw = share_within(rats.geometry, weilao_sites, r)
        bw = share_within(pop.geometry, weilao_sites, r, pop.w)
        res[f"r{r}_weilao_ratio"] = round(aw / bw, 2) if bw else None
    # rough uncertainty for r=100: binomial standard error of the report share
    p, n = res["r100_reports_share"], len(rats)
    res["r100_reports_share_se"] = round(float(np.sqrt(p * (1 - p) / n)), 4)
    save_result("r4_q5", res)
    for k, v in res.items():
        print(k, v)


if __name__ == "__main__":
    main()

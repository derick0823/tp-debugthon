"""G3: how many owners must agree for a dangerous-old-building rebuild site?

The act needs every owner of the land and legal buildings to agree (危老條例 §5).
The list gives each approved site's area, not its owners. Estimate:
  owners per site ~= site area / land share per unit,
where "land share per unit" is the median land area transferred with one unit in
real-price sales of old walk-ups (one building, one unit per sale). This is an
estimate: one owner can hold several units, and land shares vary.

Also: lapse, permit and completion rates by site-area band, and the share of sites
under 500 m2 (the draft amendment of 115-07-16 would cap bonuses for them).

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/g3_consent_threshold.py
Input:   data/raw/extra/housing-stats/real-price-registration-lvr/taipei-*/a_lvr_land_a.csv
         data/raw/extra/housing-stats/lvr-history/*/a_lvr_land_a.csv
         research/issue-06/data-patterns/out/r4_q4_cases.csv (run r4_q4_weilao_funnel.py first)
Output:  out/g3_site_bands.csv, results.json["g3"]
Network: no
"""

import re

import numpy as np
import pandas as pd

from common import OUT, save_result
from pipelines.common import RAW

BANDS = [0, 300, 500, 1000, 1e9]
BAND_LABELS = ["<300", "300-500", "500-1000", ">=1000"]


def land_share_per_unit():
    """Median land m2 per unit in single-unit sales of walk-ups built 1965-1990."""
    paths = (list((RAW / "extra" / "housing-stats" / "real-price-registration-lvr").glob("taipei-*/a_lvr_land_a.csv"))
             + list((RAW / "extra" / "housing-stats" / "lvr-history").glob("*/a_lvr_land_a.csv")))
    cols = ["交易標的", "交易筆棟數", "建物型態", "建築完成年月", "土地移轉總面積平方公尺", "編號"]
    a = pd.concat([pd.read_csv(p, dtype=str, skiprows=[1], usecols=cols, encoding="utf-8-sig") for p in paths])
    a = a.drop_duplicates("編號")
    a = a[a["建物型態"].str.startswith("公寓", na=False) & a["交易標的"].str.startswith("房地", na=False)]
    a = a[a["交易筆棟數"].str.contains(r"建物1車位", na=False)]
    y = pd.to_numeric(a["建築完成年月"].str.zfill(7).str[:3], errors="coerce") + 1911
    a = a[y.between(1965, 1990)]
    land = pd.to_numeric(a["土地移轉總面積平方公尺"], errors="coerce")
    land = land[(land > 3) & (land < 200)]
    return land


def main():
    land = land_share_per_unit()
    per_unit = float(land.median())
    q = pd.read_csv(OUT / "r4_q4_cases.csv")
    q["band"] = pd.cut(q.site_area_m2, BANDS, labels=BAND_LABELS, right=False)
    q["owners_est"] = q.site_area_m2 / per_unit
    act = q[~q.lapsed]
    bands = q.groupby("band", observed=False).agg(
        cases=("case_id", "size"), lapsed_share=("lapsed", "mean"),
        owners_est_median=("owners_est", "median"))
    bands["permit_share_of_active"] = act.groupby("band", observed=False).permit_no.apply(lambda s: s.notna().mean())
    bands["completed_share_of_active"] = act.groupby("band", observed=False).completed_date.apply(
        lambda s: s.notna().mean())
    bands = bands.round(3)
    bands.to_csv(OUT / "g3_site_bands.csv", encoding="utf-8")
    print(bands.to_string())

    owners_q = act.owners_est.quantile([0.25, 0.5, 0.75]).round(0)
    # illustration only: if each owner agreed independently with probability p
    illus = {f"p={p}": {f"N={int(n)}": round(p ** n, 3) for n in owners_q.values} for p in (0.9, 0.95, 0.98)}
    res = {
        "land_share_per_unit_m2_median": round(per_unit, 2),
        "land_share_per_unit_iqr": [round(float(land.quantile(0.25)), 2), round(float(land.quantile(0.75)), 2)],
        "land_share_sample_n": int(land.size),
        "site_area_m2_quantiles_active": act.site_area_m2.quantile([0.25, 0.5, 0.75]).round(0).to_dict(),
        "owners_est_quantiles_active": owners_q.to_dict(),
        "share_sites_lt500_all": round((q.site_area_m2 < 500).mean(), 3),
        "share_sites_lt500_active": round((act.site_area_m2 < 500).mean(), 3),
        "share_sites_lt500_completed": round((act[act.completed_date.notna()].site_area_m2 < 500).mean(), 3),
        "consent_illustration_all_agree": illus,
        "bands": bands.reset_index().astype({"band": str}).to_dict("records"),
    }
    save_result("g3", res)
    for k, v in res.items():
        print(k, v)


if __name__ == "__main__":
    main()

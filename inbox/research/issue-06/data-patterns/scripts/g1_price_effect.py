"""G1: did prices in high-liquefaction areas change after the 2016 map releases?

Events: 2016-02-06 Tainan earthquake; 2016-03-14 national query system (CGS) incl.
Taipei; 2016-09-10 Taipei city map. Sales: real-price registration 101S4-115S3.

Model (event study, OLS with district x quarter fixed effects by demeaning):
  log(price per m2) = sum_y beta_y * [high liquefaction] * [trade year y]   (y != 2015)
                      + gamma * [high] + [medium] + controls + FE(district x quarter)
Controls: building age and its square, log floor area, building type, floors band.
Treatment = the point lies in the CITY map's high class. The city map we hold is the
2019 version, not the one released in 2016 [limitation]. Standard errors are
clustered by village.

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/g1_price_effect.py
Input:   data/staged/housing-stats/real-price-registration-lvr-all.parquet
         data/staged/building-hazard/soil-liquefaction.geojson
Output:  out/g1_event_study.csv, out/g1_event_study.png, results.json["g1"]
Network: no
"""

import geopandas as gpd
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from common import OUT, STAGED, save_result
from pipelines.common import CRS_TWD97

BASE_YEAR = 2015


def demean(df, cols, group):
    g = df.groupby(group)[cols].transform("mean")
    return df[cols] - g


def cluster_se(X, resid, clusters):
    XtX_inv = np.linalg.inv(X.T @ X)
    meat = np.zeros((X.shape[1], X.shape[1]))
    for _, idx in pd.Series(np.arange(len(clusters))).groupby(clusters.values):
        s = X[idx.values].T @ resid[idx.values]
        meat += np.outer(s, s)
    g = clusters.nunique()
    n, k = X.shape
    adj = g / (g - 1) * (n - 1) / (n - k)
    return np.sqrt(np.diag(adj * XtX_inv @ meat @ XtX_inv))


def main():
    lv = pd.read_parquet(STAGED / "housing-stats" / "real-price-registration-lvr-all.parquet")
    lv = lv[lv.geo_level.between(1, 2) & lv.built_year_ad.notna() & lv.trade_date.notna()].copy()
    lv["trade"] = pd.to_datetime(lv.trade_date)
    lv["year"] = lv.trade.dt.year
    lv = lv[(lv.year >= 2013) & (lv.year <= 2026)]
    lv["ppm2"] = lv.total_price / lv.building_area_m2
    lv = lv[lv.building_area_m2.between(20, 300) & lv.ppm2.between(3e4, 3e6)]
    lv = lv[lv.building_type.isin(["walkup_5_or_less", "midrise_elevator", "tower_11plus", "townhouse", "studio"])]
    lv["age"] = lv.year - lv.built_year_ad
    lv = lv[lv.age.between(0, 70)]

    liq = gpd.read_file(STAGED / "building-hazard" / "soil-liquefaction.geojson").to_crs(CRS_TWD97)
    pts = gpd.GeoDataFrame(lv[["txn_id"]], geometry=gpd.points_from_xy(lv.x, lv.y), crs=CRS_TWD97)
    j = gpd.sjoin(pts, liq[["level", "geometry"]], how="left", predicate="within").drop_duplicates("txn_id")
    lv["liq"] = j.set_index("txn_id").level.reindex(lv.txn_id).fillna("not_mapped").values
    lv["high"] = (lv.liq == "high").astype(float)
    lv["medium"] = (lv.liq == "medium").astype(float)

    lv["y"] = np.log(lv.ppm2)
    lv["age2"] = lv.age ** 2 / 100
    lv["larea"] = np.log(lv.building_area_m2)
    lv["fe"] = lv.town_name.str.strip() + "|" + lv.trade.dt.to_period("Q").astype(str)
    X = pd.DataFrame({"high": lv.high, "medium": lv.medium, "age": lv.age, "age2": lv.age2, "larea": lv.larea},
                     index=lv.index)
    for t in ["midrise_elevator", "tower_11plus", "townhouse", "studio"]:
        X[f"type_{t}"] = (lv.building_type == t).astype(float)
    years = sorted(y for y in lv.year.unique() if y != BASE_YEAR)
    for y in years:
        X[f"high_x_{y}"] = lv.high * (lv.year == y)
    cols = list(X.columns)
    data = pd.concat([X, lv[["y", "fe"]]], axis=1)
    Xd = demean(data, cols, "fe").to_numpy()
    yd = demean(data, ["y"], "fe").to_numpy().ravel()
    beta, *_ = np.linalg.lstsq(Xd, yd, rcond=None)
    resid = yd - Xd @ beta
    se = cluster_se(Xd, resid, lv.village_code.fillna("na").reset_index(drop=True))
    tab = pd.DataFrame({"coef": beta, "se": se}, index=cols)
    tab["pct"] = (np.exp(tab.coef) - 1) * 100
    tab.round(4).to_csv(OUT / "g1_event_study.csv", encoding="utf-8")
    ev = tab.loc[[f"high_x_{y}" for y in years]].copy()
    ev.index = years
    ev.loc[BASE_YEAR] = [0, 0, 0]
    ev = ev.sort_index()
    print(tab.round(4).to_string())

    pre = ev.loc[[2013, 2014]].coef.mean()
    post = ev.loc[[2016, 2017, 2018]].coef.mean()
    res = {
        "n_sales": len(lv), "n_high": int(lv.high.sum()), "villages": int(lv.village_code.nunique()),
        "high_level_gap_pct_base2015": round(float(tab.loc["high", "pct"]), 2),
        "event_coef_pct": {int(k): round(float((np.exp(v) - 1) * 100), 2) for k, v in ev.coef.items()},
        "event_se": {int(k): round(float(v), 4) for k, v in ev.se.items()},
        "mean_coef_2013_2014": round(float(pre), 4), "mean_coef_2016_2018": round(float(post), 4),
    }
    save_result("g1", res)
    for k, v in res.items():
        print(k, v)

    fig, ax = plt.subplots(figsize=(8, 4.2))
    ax.errorbar(ev.index, ev.coef * 100, yerr=1.96 * ev.se * 100, fmt="o-", color="#4c78a8", capsize=3)
    ax.axhline(0, color="#999", lw=0.8)
    ax.axvline(2016, color="#e45756", ls=":", label="2016 液化圖公開")
    ax.set_title("液化高潛勢區（城市版）相對其他地區的房價差，以 2015 年為基準（%）")
    ax.set_xlabel("成交年")
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUT / "g1_event_study.png", dpi=100)


if __name__ == "__main__":
    main()

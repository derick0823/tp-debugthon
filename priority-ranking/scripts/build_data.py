"""Data files for MVP variant 0: the old-building check-up priority ranking (issue #6 core).

The page re-weights the five factors in the browser. This script ships each factor's
percentile (same pct() as pipelines/build/build_village_rankings.py), so equal weights
reproduce composite_equal_city2019 exactly. City 2019 liquefaction only; no national 2026.

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/priority-ranking/scripts/build_data.py
Input:   data/marts/village_rankings.geojson, data/marts/village_indicators.csv,
         data/marts/building_points.parquet (50+ year share by year, the issue's first sentence)
         mvp-variants/data/village_unit_prices_net.csv (renewal-calculator; net of new builds and odd deals)
         mvp-variants/uro-cases/out/uro-review-case-villages.csv (E3; the 168-project cases only)
         mvp-variants/uro-cases/out/uro-review-cases.csv (approved first plans, for the market-gap chart)
Output:  research/issue-06/mvp-variants/priority-ranking/data/
           villages.geojson, meta.json
         (generated, not committed; run this script)
Network: no
"""

import json
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
sys.path.insert(0, str(ROOT))

import geopandas as gpd  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from pipelines.build.build_village_rankings import MIN_KNOWN, factor_table, pct  # noqa: E402
from pipelines.common import MARTS, CRS_TWD97, CRS_WGS84  # noqa: E402

OUT = HERE.parent / "data"
VARIANTS = HERE.parents[1]
RISK_TOP = 120          # city-led renewal: equal-weight rank cut
FACTORS = {"elderly": "f_elderly", "old_stock": "f_old_stock", "liquefaction": "f_liquefaction_city2019",
           "rescue": "f_rescue", "soft_story": "f_soft_story"}
LEVELS = {"elderly": "lv_elderly", "old_stock": "lv_old_stock", "liquefaction": "lv_liquefaction_city2019",
          "rescue": "lv_rescue", "soft_story": "lv_soft_story"}
R_COLS = ["village_code", "town_name", "village_name", "composite_equal_city2019", "composite_rank_city2019",
          "rank_p05_city2019", "rank_p50_city2019", "rank_p95_city2019", "share_top46_city2019",
          "hidden_by_composite_city2019", "hidden_factors_city2019"]
I_COLS = ["village_code", "pop_total", "share_65plus", "bld_share_pre_policy_1999", "bld_age_known_n",
          "liq_high_share_city2019", "liq_medium_share_city2019", "narrow_lanes_n", "fire_access_lanes",
          "road_markers_lt6m_share", "soft_story_a_n", "soft_story_b_n", "doorplate_buildings",
          "weilao_active_est", "lvr_share_newbuild"]


def unrounded_percentiles():
    """Factor percentiles from village_indicators, same steps as build_village_rankings.main.

    The mart's f_* columns are rounded to 4 places; ranking the rounded values makes ties."""
    t = pd.read_csv(MARTS / "village_indicators.csv", dtype={"village_code": str, "town_code": str})
    t = t.set_index("village_code")
    town_med = t.groupby("town_code")["bld_share_pre_policy_1999"].transform("median")
    thin = t["bld_age_known_n"] < MIN_KNOWN
    t["old_stock_share"] = t["bld_share_pre_policy_1999"].where(~thin, town_med).fillna(town_med)
    return factor_table(t, "city2019").apply(pct).round(5).add_prefix("p_").reset_index()


def aging_by_year(years=(2025, 2035, 2045)):
    """Share of buildings 50+ years old in a given year, buildings with a real built year only.

    Assumes today's stock stays (no demolition). Neighbour-borrowed intervals are left out."""
    b = pd.read_parquet(MARTS / "building_points.parquet", columns=["built_year", "doorplate_units"])
    k = b[b.built_year.notna()]
    out = {"known_buildings": int(len(k)), "all_buildings": int(len(b)), "years": {}}
    for y in years:
        old = k.built_year <= y - 50
        out["years"][str(y)] = {"buildings": round(float(old.mean()), 3),
                                "units": round(float((k.doorplate_units * old).sum() / k.doorplate_units.sum()), 3)}
    return out


def renewal_inputs():
    """Per-village market signals for the city-led renewal tab: net unit price and URO case count."""
    p = pd.read_csv(VARIANTS / "data" / "village_unit_prices_net.csv", dtype={"village_code": str})
    p = p[(p.building_type == "all") & (p.decade == "all")]
    p = p[["village_code", "n", "price_per_ping_median"]].rename(columns={"n": "price_n", "price_per_ping_median": "price"})
    u = pd.read_csv(VARIANTS / "uro-cases" / "out" / "uro-review-case-villages.csv", dtype={"village_code": str})
    u = u.groupby("village_code")["village_weight"].sum().rename("uro_cases").reset_index()
    return p.merge(u, on="village_code", how="outer")


def renewal_flags(v):
    """Four conditions for a city-led renewal candidate; thresholds go to meta.json."""
    th = {"risk_top": RISK_TOP,
          "price_p33": float(v.price.quantile(1 / 3)),
          "elderly_p67": float(v.share_65plus.quantile(2 / 3)),
          "weilao_median": float(v.weilao_active_est.median())}
    v["c_risk"] = v.rank_eq <= RISK_TOP
    v["c_price"] = v.price <= th["price_p33"]
    v["c_elderly"] = v.share_65plus >= th["elderly_p67"]
    v["c_market"] = (v.weilao_active_est < th["weilao_median"]) & (v.lvr_share_newbuild.fillna(0) == 0)
    v["c_n"] = v[["c_risk", "c_price", "c_elderly", "c_market"]].sum(axis=1).astype(int)
    return th


HOUSE = {"old_stock": "老屋", "soft_story": "軟弱層", "liquefaction": "液化"}


def market_gap(v):
    """Market-gap chart: do the villages whose houses look worst get their share of rebuild cases?

    Groups villages by each house-side factor level (top = level 4-5, the page's top 7%) and
    compares their share of buildings with their share of active 危老 approvals (expected count,
    spread over the road's villages) and of approved first-plan 168 URO cases (village weights).
    Both counts are village-level estimates; the URO list is the 168 fast track only."""
    c = pd.read_csv(VARIANTS / "uro-cases" / "out" / "uro-review-cases.csv", dtype=str,
                    usecols=["case_id", "revision", "approve_date"])
    c = c[(c.revision == "擬訂") & c.approve_date.notna()]
    cv = pd.read_csv(VARIANTS / "uro-cases" / "out" / "uro-review-case-villages.csv", dtype={"village_code": str, "case_id": str})
    cv = cv[cv.case_id.isin(c.case_id)]
    uro = v.village_code.map(cv.groupby("village_code")["village_weight"].sum()).fillna(0)
    wl = v.weilao_active_est.fillna(0)
    bld = v.doorplate_buildings.fillna(0)
    tot = {"bld": float(bld.sum()), "weilao": float(wl.sum()), "uro": float(uro.sum())}
    groups = []
    for k, name in HOUSE.items():
        lv = v[f"lv_{k}"].clip(upper=4)
        rows = []
        for g in [4, 3, 2, 1]:
            m = lv == g
            b, w, u = float(bld[m].sum()), float(wl[m].sum()), float(uro[m].sum())
            rows.append({"level": "4-5" if g == 4 else str(g), "villages": int(m.sum()),
                         "bld_share": round(b / tot["bld"], 4), "weilao_share": round(w / tot["weilao"], 4),
                         "uro_share": round(u / tot["uro"], 4),
                         "cases_share": round((w + u) / (tot["weilao"] + tot["uro"]), 4),
                         "cases_per_1k_bld": round((w + u) / b * 1000, 2)})
        groups.append({"factor": k, "name": name, "levels": rows})
    return {"groups": groups,
            "weilao_total": round(tot["weilao"], 1), "uro_total": round(tot["uro"], 1),
            "cases_per_1k_bld_city": round((tot["weilao"] + tot["uro"]) / tot["bld"] * 1000, 2),
            "weilao_period": "107-07～115-09 核准、仍有效（危老核准清冊 1151002 版，截至 115-09-30）",
            "uro_period": f"{c.approve_date.min()[:7]}～{c.approve_date.max()[:7]} 核定的第一次擬訂案（168 專案，2026-10-22 擷取）"}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    r = gpd.read_file(MARTS / "village_rankings.geojson")
    i = pd.read_csv(MARTS / "village_indicators.csv", dtype={"village_code": str})[I_COLS]
    v = r[R_COLS + list(FACTORS.values()) + list(LEVELS.values()) + ["geometry"]].merge(i, on="village_code")
    v = v.merge(unrounded_percentiles(), on="village_code")
    v = v.merge(renewal_inputs(), on="village_code", how="left")
    # equal-weight check: must match the mart's composite
    comp = v[[f"p_{k}" for k in FACTORS]].mean(axis=1)
    gap = float(np.abs(comp - v.composite_equal_city2019).max())
    assert gap < 1e-3, f"composite mismatch {gap}"

    rename = {"composite_equal_city2019": "comp", "composite_rank_city2019": "rank_eq",
              "rank_p05_city2019": "r05", "rank_p50_city2019": "r50", "rank_p95_city2019": "r95",
              "share_top46_city2019": "top46", "hidden_by_composite_city2019": "hidden",
              "hidden_factors_city2019": "hidden_f"}
    rename.update({c: f"lv_{k}" for k, c in LEVELS.items()})
    rename.update({c: f"f_{k}" for k, c in FACTORS.items()})
    v = v.rename(columns=rename)
    v["hidden"] = v["hidden"].astype(bool)
    v["hidden_f"] = v["hidden_f"].fillna("")
    v["lanes_n"] = (v.narrow_lanes_n.fillna(0) + v.fire_access_lanes.fillna(0)).round(1)
    v["soft_n"] = (v.soft_story_a_n.fillna(0) + v.soft_story_b_n.fillna(0)).astype(int)
    for c in ["r05", "r50", "r95", "rank_eq"]:
        v[c] = v[c].astype(int)
    th = renewal_flags(v)
    keep = ["village_code", "town_name", "village_name", "comp", "rank_eq", "r05", "r50", "r95", "top46",
            "hidden", "hidden_f", "pop_total", "share_65plus", "bld_share_pre_policy_1999", "bld_age_known_n",
            "liq_high_share_city2019", "liq_medium_share_city2019", "lanes_n", "road_markers_lt6m_share",
            "soft_n", "doorplate_buildings"]
    keep += ["price", "price_n", "uro_cases", "weilao_active_est", "lvr_share_newbuild",
             "c_risk", "c_price", "c_elderly", "c_market", "c_n"]
    keep += [f"p_{k}" for k in FACTORS] + [f"lv_{k}" for k in FACTORS] + [f"f_{k}" for k in FACTORS]
    g = v[keep + ["geometry"]].to_crs(CRS_TWD97)
    g["geometry"] = g.simplify(8)
    g = g.to_crs(CRS_WGS84)
    for c in g.columns:
        if g[c].dtype == float and c not in ("geometry",):
            g[c] = g[c].round(4)
    g.to_file(OUT / "villages.geojson", driver="GeoJSON", COORDINATE_PRECISION=5)

    meta = {"generated": date.today().isoformat(),
            "villages": int(len(g)),
            "equal_weight_max_gap": round(gap, 6),
            "stable_top46": int((v.top46 >= 0.9).sum()),
            "hidden": int(v.hidden.sum()),
            "aging": aging_by_year(),
            "renewal": {**th, "candidates": int((v.c_n == 4).sum()), "one_short": int(((v.c_n == 3) & v.c_risk).sum()),
                        "uro_villages": int((v.uro_cases > 0).sum()),
                        "uro_cases_total": round(float(v.uro_cases.sum()))},
            "market_gap": market_gap(v),
            "elderly_share_city": round(float((v.share_65plus * v.pop_total).sum() / v.pop_total.sum()), 3),
            "sources": {"rankings": "data/marts/village_rankings（R1b，2026-10-18；權重敏感度 2,000 次 Dirichlet 抽樣，種子 20261018）",
                        "indicators": "data/marts/village_indicators（人口 115/9；液化 soil.taipei 2019 城市版；逐棟屋齡與軟弱層為推估）",
                        "boundary": "內政部國土測繪中心里界 115/8/17 版，簡化 8 m"}}
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    sizes = {p.name: round(p.stat().st_size / 1e6, 2) for p in OUT.iterdir()}
    print(f"villages={len(g)} gap={gap:.2e} stable_top46={meta['stable_top46']} hidden={meta['hidden']} sizes_mb={sizes}")


if __name__ == "__main__":
    main()

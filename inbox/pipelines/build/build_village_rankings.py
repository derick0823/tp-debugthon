"""Build the village ranking table for S1 (factor levels, rank intervals) and S5 (candidates).

No weights are proposed here. The table shows, for each village:
  * five factors: elderly (65+ share), old stock (units built before the 1999 policy
    line), liquefaction (high + 0.5 x medium, per version), rescue access (lanes and
    narrow road markers), soft-story candidate rate;
  * each factor's value, percentile and level (1-5, fixed shares as in Tokyo's
    district risk ranking: top 1.6% / 5.6% / 15.8% / 31.8% / 45.2%);
  * an equal-weight composite and, over random weights, the rank interval
    (5th / 50th / 95th percentile of rank) and the share of draws in the top 46;
  * "hidden by composite": a factor in level 4-5 while the composite is level 1-2;
  * S5 candidate flag with the reason.
Everything is computed twice, once per liquefaction version.

Usage:   uv run python -X utf8 -m pipelines.build.build_village_rankings
Input:   data/marts/village_indicators.csv (run build_building_points, then build_village_indicators)
Output:  data/marts/village_rankings.csv
         data/marts/village_rankings.geojson  (EPSG:4326, same columns + village polygon)
Network: no
"""

import geopandas as gpd
import numpy as np
import pandas as pd

from pipelines.common import MARTS

DRAWS = 2000
TOP_N = 46            # top 10% of 456 villages
SEED = 20261018
# Tokyo district risk ranking shares, from the most dangerous level down
LEVEL_SHARES = [0.016, 0.056, 0.158, 0.318, 0.452]
LIQ_VERSIONS = ["city2019", "national2026"]
MIN_KNOWN = 20       # known buildings needed to trust a village's own old-stock share


def pct(s):
    """Percentile rank in 0-1, higher = more risk. Missing values get the median."""
    return s.rank(pct=True).fillna(0.5)


def levels(score):
    """Level 5 (worst) .. 1 by fixed shares of villages, ranked by score descending."""
    order = score.rank(ascending=False, method="first")
    cuts = np.cumsum(LEVEL_SHARES) * len(score)
    lv = pd.Series(1, index=score.index)
    for i, c in enumerate(cuts[:-1]):
        lv[(order <= c) & (lv == 1)] = 5 - i
    return lv


def factor_table(t, liq):
    """Factor values (higher = more risk) for one liquefaction version."""
    return pd.DataFrame({
        "elderly": t["share_65plus"],
        "old_stock": t["old_stock_share"],
        "liquefaction": t[f"liq_high_share_{liq}"] + 0.5 * t[f"liq_medium_share_{liq}"],
        "rescue": (pct(t["fire_access_lanes"] + t["narrow_lanes_n"]) + pct(t["road_markers_lt6m_share"])) / 2,
        "soft_story": t["soft_story_rate"],
    }, index=t.index)


def rank_intervals(p, rng):
    """Random weights from a flat Dirichlet; returns rank p05/p50/p95 and share in top N."""
    w = rng.dirichlet(np.ones(p.shape[1]), size=DRAWS)        # draws x factors
    scores = p.values @ w.T                                    # villages x draws
    ranks = (-scores).argsort(axis=0).argsort(axis=0) + 1      # 1 = worst
    return pd.DataFrame({
        "rank_p05": np.percentile(ranks, 5, axis=1).round(0),
        "rank_p50": np.percentile(ranks, 50, axis=1).round(0),
        "rank_p95": np.percentile(ranks, 95, axis=1).round(0),
        "share_top46": (ranks <= TOP_N).mean(axis=1).round(3),
    }, index=p.index)


def main():
    t = pd.read_csv(MARTS / "village_indicators.csv", dtype={"village_code": str, "town_code": str})
    t = t.set_index("village_code")
    # old stock: unit share built before the 1999 policy line (88-12-31), from the
    # building table. Villages with fewer than MIN_KNOWN known buildings use the district median.
    town_med = t.groupby("town_code")["bld_share_pre_policy_1999"].transform("median")
    thin = t["bld_age_known_n"] < MIN_KNOWN
    t["old_stock_share"] = t["bld_share_pre_policy_1999"].where(~thin, town_med).fillna(town_med)
    out = t[["town_code", "town_name", "village_name"]].copy()
    rng = np.random.default_rng(SEED)
    for liq in LIQ_VERSIONS:
        f = factor_table(t, liq)
        p = f.apply(pct)
        lv = p.apply(levels)
        comp = p.mean(axis=1)
        comp_lv = levels(comp)
        for c in f.columns:
            out[f"f_{c}_{liq}" if c == "liquefaction" else f"f_{c}"] = f[c].round(4)
            out[f"lv_{c}_{liq}" if c == "liquefaction" else f"lv_{c}"] = lv[c]
        out[f"composite_equal_{liq}"] = comp.round(4)
        out[f"composite_rank_{liq}"] = comp.rank(ascending=False, method="min").astype(int)
        out[f"composite_level_{liq}"] = comp_lv
        ri = rank_intervals(p, rng)
        for c in ri.columns:
            out[f"{c}_{liq}"] = ri[c]
        hidden = (lv >= 4).any(axis=1) & (comp_lv <= 2)
        out[f"hidden_by_composite_{liq}"] = hidden
        out[f"hidden_factors_{liq}"] = lv.apply(
            lambda r: ";".join(c for c in lv.columns if r[c] >= 4), axis=1).where(hidden, "")

    # S5: rescue access problem x liquefaction (either version) x oldest-old residents
    lanes = t["fire_access_lanes"] + t["narrow_lanes_n"]
    narrow = (lanes > 0) | (t["road_markers_lt6m_share"] >= t["road_markers_lt6m_share"].quantile(0.9))
    liq_hi = ((t["liq_high_share_city2019"] >= 0.25) | (t["liq_high_share_national2026"] >= 0.25))
    old80 = t["share_80plus"] >= t["share_80plus"].median()
    out["s5_candidate"] = narrow & liq_hi & old80

    def reason(r):
        if not out.at[r.name, "s5_candidate"]:
            return ""
        parts = []
        if r.fire_access_lanes + r.narrow_lanes_n > 0:
            parts.append(f"窄巷 {r.fire_access_lanes + r.narrow_lanes_n:g} 條")
        if r.road_markers_lt6m_share >= t["road_markers_lt6m_share"].quantile(0.9):
            parts.append(f"<6m 道路標註 {r.road_markers_lt6m_share:.0%}")
        parts.append(f"液化高 城市版 {r.liq_high_share_city2019:.0%}／全國版 {r.liq_high_share_national2026:.0%}")
        parts.append(f"80 歲以上 {r.share_80plus:.1%}")
        return "；".join(parts)

    out["s5_reason"] = t.apply(reason, axis=1)
    out = out.reset_index()
    out.to_csv(MARTS / "village_rankings.csv", index=False, encoding="utf-8")
    g = gpd.read_file(MARTS / "village_indicators.geojson")[["village_code", "geometry"]]
    g.merge(out, on="village_code").to_file(MARTS / "village_rankings.geojson", driver="GeoJSON")
    for liq in LIQ_VERSIONS:
        stable = (out[f"share_top46_{liq}"] >= 0.9).sum()
        print(f"[{liq}] stable top46 (>=90% of draws)={stable} hidden_by_composite="
              f"{out[f'hidden_by_composite_{liq}'].sum()}")
    print(f"s5_candidates={out.s5_candidate.sum()}")


if __name__ == "__main__":
    main()

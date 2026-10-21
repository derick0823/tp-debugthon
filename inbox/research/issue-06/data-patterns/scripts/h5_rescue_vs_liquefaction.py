"""H5: are rescue-access problems (narrow lanes) and liquefaction in different places?

Hill proxy: the share of a village that the national 2026 map marks as "none"
(outside the plain), i.e. 1 - (high + medium + low).

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/h5_rescue_vs_liquefaction.py
Input:   data/marts/village_indicators.{csv,geojson}
Output:  out/h5_town_table.csv, out/h5_maps.png, results.json["h5"]
Network: no
"""

import matplotlib.pyplot as plt
import pandas as pd

from common import OUT, choropleth, mart, mart_geo, save_result, spearman

RESCUE = ["fire_access_lanes", "narrow_lanes_n", "fire_rescue_sites_n", "road_markers_lt6m_share"]


def main():
    t = mart()
    t["hill_share"] = (1 - t[["liq_high_share_national2026", "liq_medium_share_national2026",
                              "liq_low_share_national2026"]].sum(axis=1)).clip(0, 1)
    t["lanes_any"] = (t.fire_access_lanes + t.narrow_lanes_n) > 0
    t["lanes_total"] = t.fire_access_lanes + t.narrow_lanes_n
    t["liq_high"] = t.liq_high_share_city2019 >= 0.25
    t["edge"] = t.hill_share >= 0.2

    town = t.groupby("town_name").agg(
        fire_access_lanes=("fire_access_lanes", "sum"), narrow_lanes=("narrow_lanes_n", "sum"),
        rescue_sites=("fire_rescue_sites_n", "sum"),
        lt6m_share_median=("road_markers_lt6m_share", "median"),
        liq_city_high_villages=("liq_high", "sum"), villages=("village_code", "size"))
    town["lanes_total"] = town.fire_access_lanes + town.narrow_lanes
    town = town.sort_values("lanes_total", ascending=False)
    town.round(3).to_csv(OUT / "h5_town_table.csv", encoding="utf-8")
    print(town.round(3).to_string())

    hill3 = ["士林區", "北投區", "內湖區"]
    res = {f"spearman_{c}_vs_liq_city_high": spearman(t[c], t.liq_high_share_city2019) for c in RESCUE}
    res.update({f"spearman_{c}_vs_hill_share": spearman(t[c], t.hill_share) for c in RESCUE})
    res.update({
        "lanes_total": round(t.lanes_total.sum(), 1),
        "lanes_share_in_shilin_beitou_neihu": round(t[t.town_name.isin(hill3)].lanes_total.sum()
                                                    / t.lanes_total.sum(), 3),
        "fire_access_share_in_shilin_beitou_neihu": round(t[t.town_name.isin(hill3)].fire_access_lanes.sum()
                                                          / t.fire_access_lanes.sum(), 3),
        "narrow_lanes_share_in_shilin_beitou_neihu": round(t[t.town_name.isin(hill3)].narrow_lanes_n.sum()
                                                           / t.narrow_lanes_n.sum(), 3),
        "lanes_share_in_edge_villages": round(t[t.edge].lanes_total.sum() / t.lanes_total.sum(), 3),
        "edge_villages_share": round(t.edge.mean(), 3),
        "lanes_share_in_liq_high_villages": round(t[t.liq_high].lanes_total.sum() / t.lanes_total.sum(), 3),
        "liq_high_villages_share": round(t.liq_high.mean(), 3),
        "villages_lanes_any": int(t.lanes_any.sum()),
        "villages_liq_high": int(t.liq_high.sum()),
        "villages_both": int((t.lanes_any & t.liq_high).sum()),
        "villages_both_expected_if_independent": round(t.lanes_any.mean() * t.liq_high.mean() * len(t), 1),
        "villages_both_list": t[t.lanes_any & t.liq_high].sort_values("lanes_total", ascending=False)
        [["town_name", "village_name", "lanes_total", "liq_high_share_city2019", "share_65plus"]]
        .head(15).values.tolist(),
        "rescue_sites_share_in_liq_high_villages": round(t[t.liq_high].fire_rescue_sites_n.sum()
                                                         / t.fire_rescue_sites_n.sum(), 3),
    })
    save_result("h5", res)
    for k, v in res.items():
        print(k, v)

    g = mart_geo().merge(t[["village_code", "lanes_total", "hill_share"]], on="village_code")
    fig, ax = plt.subplots(1, 3, figsize=(16, 6.5))
    choropleth(g, "lanes_total", "消防通道＋狹小巷道（條，落到里）", None, cmap="Reds", ax=ax[0])
    choropleth(g, "road_markers_lt6m_share", "計畫道路寬度標註 < 6 m 的比例", None, cmap="Reds", ax=ax[1])
    choropleth(g, "liq_high_share_city2019", "液化高潛勢面積比例（城市版）", None, cmap="Blues", ax=ax[2])
    fig.tight_layout()
    fig.savefig(OUT / "h5_maps.png", dpi=100)


if __name__ == "__main__":
    main()

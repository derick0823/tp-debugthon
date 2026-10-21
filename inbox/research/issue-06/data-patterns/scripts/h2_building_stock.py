"""H2: is the main high-risk stock the 1970-1990 walk-up apartments of 4-5 floors?

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/h2_building_stock.py
Input:   data/staged/building-hazard/building-count.csv
         data/staged/housing-stats/use-permit-by-structure.csv
         data/staged/housing-stats/real-price-registration-lvr.csv
         data/staged/renewal/sea-sand-houses-full-list.csv
Output:  out/h2_lvr_decade_type.csv, out/h2_lvr_decade_structure.csv, out/h2_stock.png,
         results.json["h2"]
Network: no
"""

import matplotlib.pyplot as plt
import pandas as pd

from common import OUT, STAGED, save_result


def decade(y):
    return (y // 10 * 10).astype("Int64")


def main():
    bc = pd.read_csv(STAGED / "building-hazard" / "building-count.csv")
    up = pd.read_csv(STAGED / "housing-stats" / "use-permit-by-structure.csv")
    lv = pd.read_csv(STAGED / "housing-stats" / "real-price-registration-lvr.csv")
    ss = pd.read_csv(STAGED / "renewal" / "sea-sand-houses-full-list.csv")

    last = bc[bc.year_roc == 114].iloc[0]
    floor_share = {c: round(last[c] / last.bld_total, 4) for c in
                   ["bld_1f", "bld_2f", "bld_3f", "bld_4f", "bld_5_6f", "bld_7_9f", "bld_10_12f",
                    "bld_13_15f", "bld_16f_plus"]}

    # when was the 4-6 floor stock built? growth of the count by year
    bc["bld_4_6f"] = bc.bld_4f + bc.bld_5_6f
    s46 = bc.set_index("year_roc")["bld_4_6f"]
    reached = {f"{p:.0%}": int(s46[s46 >= p * s46.max()].index.min()) + 1911 for p in (0.5, 0.8, 0.9, 0.95)}

    # brick share of new floor area by year (city use permits)
    tot = up[up.structure_class == "total"].set_index("year_ad")["floor_area_m2"]
    brick = (up[up.structure_class.isin(["brick_reinforced", "brick"])]
             .groupby("year_ad")["floor_area_m2"].sum().reindex(tot.index).fillna(0))
    brick_share = (brick / tot).round(4)

    # LVR: decade x building type, decade x structure, floors of walk-ups
    lv = lv.dropna(subset=["built_year_ad"]).copy()
    lv["decade"] = decade(lv.built_year_ad)
    dt = pd.crosstab(lv.decade, lv.building_type)
    dt.to_csv(OUT / "h2_lvr_decade_type.csv", encoding="utf-8")
    ds = pd.crosstab(lv.decade, lv.structure_class)
    ds.to_csv(OUT / "h2_lvr_decade_structure.csv", encoding="utf-8")
    pre99 = lv[lv.built_year_ad < 1999]
    walk = lv[lv.building_type == "walkup_5_or_less"]
    w7090 = walk[(walk.built_year_ad >= 1970) & (walk.built_year_ad < 1990)]
    res = {
        "city_floor_share_114": floor_share,
        "city_4_6f_share_114": round((last.bld_4f + last.bld_5_6f) / last.bld_total, 4),
        "city_4_6f_stock_reached_year": reached,
        "brick_share_new_floor_area": {int(k): v for k, v in brick_share.items() if k in
                                       (1968, 1969, 1970, 1971, 1972, 1975, 1980, 1990, 2000)},
        "lvr_n_with_year": len(lv),
        "lvr_pre1999_n": len(pre99),
        "lvr_pre1999_type_share": pre99.building_type.value_counts(normalize=True).round(4).to_dict(),
        "lvr_walkup_n": len(walk),
        "lvr_walkup_built_1970_1989_share": round(len(w7090) / len(walk), 4),
        "lvr_walkup_floors": walk.total_floors.value_counts(normalize=True).round(4).head(6).to_dict(),
        "lvr_walkup_structure": walk.structure_class.value_counts(normalize=True).round(4).to_dict(),
        "lvr_1970_1989_share_walkup": round((lv[(lv.built_year_ad >= 1970) & (lv.built_year_ad < 1990)]
                                             .building_type == "walkup_5_or_less").mean(), 4),
        "lvr_brick_reinforced_median_year": float(lv[lv.structure_class == "brick_reinforced"].built_year_ad.median()),
        "lvr_brick_reinforced_type": lv[lv.structure_class == "brick_reinforced"].building_type
        .value_counts(normalize=True).round(3).to_dict(),
        "sea_sand_permit_year_decades": decade(ss.permit_year_ad.dropna().astype(int)).value_counts().sort_index()
        .to_dict(),
        "sea_sand_permit_year_range": [int(ss.permit_year_ad.min()), int(ss.permit_year_ad.max())],
    }
    save_result("h2", res)
    for k, v in res.items():
        print(k, v)

    fig, ax = plt.subplots(1, 3, figsize=(17, 5))
    cols = ["bld_1f", "bld_2f", "bld_3f", "bld_4f", "bld_5_6f", "bld_7_9f", "bld_10_12f", "bld_13_15f", "bld_16f_plus"]
    lab = ["平房", "2層", "3層", "4層", "5-6層", "7-9層", "10-12層", "13-15層", "16+層"]
    b = bc.set_index(bc.year_roc + 1911)[cols]
    b.columns = lab
    b.plot.area(ax=ax[0], cmap="tab20c", linewidth=0)
    ax[0].set_title("全市建物棟數依樓層（官方棟數表，1976–2025）")
    ax[0].set_xlabel("")
    ax[0].legend(fontsize=7, ncol=3)
    bs = brick_share[brick_share.index <= 2005]
    ax[1].plot(bs.index, bs.values * 100, color="#b5562b")
    ax[1].set_title("新發使照面積中磚造與加強磚造的比例（%）")
    ax[1].axvline(1971, ls=":", color="#777")
    order = ["walkup_5_or_less", "midrise_elevator", "tower_11plus", "townhouse", "other"]
    labs = {"walkup_5_or_less": "公寓（5樓以下無電梯）", "midrise_elevator": "華廈", "tower_11plus": "住宅大樓",
            "townhouse": "透天", "other": "其他"}
    dtt = dt.reindex(columns=order).fillna(0)
    dtt = dtt[(dtt.index >= 1950)]
    dtt.columns = [labs[c] for c in dtt.columns]
    dtt.plot.bar(stacked=True, ax=ax[2], cmap="Set2")
    ax[2].set_title("實價登錄交易依建成年代與建物型態（114S4–115S3）")
    ax[2].set_xlabel("建成年代")
    fig.tight_layout()
    fig.savefig(OUT / "h2_stock.png", dpi=100)


if __name__ == "__main__":
    main()

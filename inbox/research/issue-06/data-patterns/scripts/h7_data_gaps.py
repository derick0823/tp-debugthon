"""H7: measure the data gaps, and the bias of the real-price sample used to fill them.

  1. Address match rates of every geocoded list (for the report).
  2. "50 years or older": what the open data can and cannot say.
  3. Real-price sample bias: share older than 30 years in traded units vs the
     house-tax building count, by district.
  4. Coverage of the post-2001 permit data.

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/h7_data_gaps.py
Input:   data/staged/** and data/marts/village_indicators.csv
Output:  out/h7_geocode_rates.csv, out/h7_lvr_bias_by_town.csv, results.json["h7"]
Network: no
"""

import pandas as pd

from common import OUT, STAGED, mart, save_result

GEOCODED = {
    "fire-rescue-difficult-areas": STAGED / "hazard" / "fire-rescue-difficult-areas.csv",
    "narrow-lanes-red-yellow": STAGED / "hazard" / "narrow-lanes-red-yellow.csv",
    "earthquake-listed-buildings": STAGED / "hazard" / "earthquake-listed-buildings.csv",
    "sea-sand-houses-full-list": STAGED / "renewal" / "sea-sand-houses-full-list.csv",
    "dangerous-old-building-rebuild-approved-cases": STAGED / "renewal" / "dangerous-old-building-rebuild-approved-cases.csv",
    "use-permit-summary (90-115)": STAGED / "permits" / "use-permits.csv",
    "real-price-registration-lvr": STAGED / "housing-stats" / "real-price-registration-lvr.csv",
}


def main():
    rows = []
    for name, p in GEOCODED.items():
        d = pd.read_csv(p, dtype={"list_version": str})
        if "list_version" in d:
            d = d[d.list_version == "1150210"]   # the R1 report uses this list version
        vc = d.geo_level.value_counts()
        rows.append({"dataset": name, "n": len(d), **{f"level_{k}": int(vc.get(k, 0)) for k in range(5)},
                     "share_exact": round(vc.get(1, 0) / len(d), 4),
                     "share_village_ok": round(d.geo_level.between(1, 3).mean(), 4),
                     "share_any": round((d.geo_level > 0).mean(), 4)})
    gr = pd.DataFrame(rows)
    gr.to_csv(OUT / "h7_geocode_rates.csv", index=False, encoding="utf-8")
    print(gr.to_string(index=False))

    lv = pd.read_csv(STAGED / "housing-stats" / "real-price-registration-lvr.csv")
    lv = lv.dropna(subset=["built_year_ad"])
    lv["town_name"] = lv.town_name.str.strip()
    # 115 tax year: 30+ years means built in 1996 or earlier
    lv["age30plus"] = lv.built_year_ad <= 1996
    lv["age50plus"] = lv.built_year_ad <= 1976
    lv["presale_like"] = lv.built_year_ad >= 2024
    h = pd.read_csv(STAGED / "housing-stats" / "house-tax-housing-overview-by-tax-office.csv")
    h = h[h.year_roc == 115].set_index("town_name")
    bias = pd.DataFrame({
        "lvr_n": lv.groupby("town_name").size(),
        "lvr_share_age30plus": lv.groupby("town_name").age30plus.mean().round(4),
        "lvr_share_age50plus": lv.groupby("town_name").age50plus.mean().round(4),
        "lvr_share_built_2024plus": lv.groupby("town_name").presale_like.mean().round(4),
        "tax_share_age30plus_bld": h.share_age_30plus,
    })
    old = lv[~lv.presale_like]
    bias["lvr_share_age30plus_excl_new"] = old.groupby("town_name").age30plus.mean().round(4)
    bias["gap_pp"] = ((bias.lvr_share_age30plus - bias.tax_share_age30plus_bld) * 100).round(1)
    bias.to_csv(OUT / "h7_lvr_bias_by_town.csv", encoding="utf-8")
    print(bias.to_string())

    t = mart()
    bc = pd.read_csv(STAGED / "building-hazard" / "building-count.csv")
    res = {
        "geocode": gr.set_index("dataset")[["n", "share_exact", "share_village_ok", "share_any"]].to_dict("index"),
        "official_building_count_age_bands": "只有「未滿 30 年」與「30 年以上」，從民國 96 年起",
        "city_share_30plus_114": round(float(bc[bc.year_roc == 114].bld_age_30plus.iat[0]
                                             / bc[bc.year_roc == 114].bld_total.iat[0]), 4),
        "lvr_city_share_age30plus_units": round(lv.age30plus.mean(), 4),
        "lvr_city_share_age50plus_units": round(lv.age50plus.mean(), 4),
        "lvr_city_share_age50plus_units_excl_2024plus": round(old.age50plus.mean(), 4),
        "lvr_city_share_built_2024plus": round(lv.presale_like.mean(), 4),
        "new2001_units_total": int(t.new2001_units.sum()),
        "doorplate_units_total": int(t.doorplate_units.sum()),
        "new2001_units_share_city": round(t.new2001_units.sum() / t.doorplate_units.sum(), 4),
        # unit-to-unit check: units built before 2001 (doorplates minus post-2001 permit units) vs LVR
        "units_pre2001_share_from_doorplates": round(1 - t.new2001_units.sum() / t.doorplate_units.sum(), 4),
        "lvr_units_pre2001_share": round((lv.built_year_ad < 2001).mean(), 4),
        "lvr_units_pre2001_share_excl_2024plus": round((old.built_year_ad < 2001).mean(), 4),
        "villages_lvr_n_lt10": int((t.lvr_n_built < 10).sum()),
        "villages_lvr_n_lt30": int((t.lvr_n_built < 30).sum()),
        "lvr_n_built_median": float(t.lvr_n_built.median()),
    }
    save_result("h7", res)
    for k, v in res.items():
        print(k, v)


if __name__ == "__main__":
    main()

"""Unit prices of existing homes, for the renewal calculator (MVP variant A).

From real-price registration sales (2012-2026) at geo_level 1-2:
  * village_unit_prices.csv: village x building type x build decade, last 3 years;
    median price per ping (坪) of the building area, sample size, and a fallback
    district median. Shares of land per unit are included (median land m2 per unit)
    so the calculator can show "土地持分".
  * building_unit_prices.csv: per building_key, all years, median price per ping and
    the last trade year; only buildings with >= 2 sales.
Prices are per ping of 建物移轉總面積 (includes common areas), in NTD.

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/scripts/build_unit_prices.py
Input:   data/staged/housing-stats/real-price-registration-lvr-all.parquet
         data/raw/extra/housing-stats/{real-price-registration-lvr,lvr-history}/**/a_lvr_land_a.csv (land area per sale)
Output:  research/issue-06/mvp-variants/data/village_unit_prices.csv
         research/issue-06/mvp-variants/data/town_unit_prices.csv
         research/issue-06/mvp-variants/data/building_unit_prices.csv
Network: no
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT))

import pandas as pd  # noqa: E402

from pipelines.common import RAW, STAGED  # noqa: E402

OUT = HERE.parent / "data"
PING = 3.30579
RECENT_FROM = "2023-10-01"


def decade(y):
    return pd.cut(y, [0, 1974, 1982, 1990, 1999, 2010, 2100],
                  labels=["pre1974", "1974-1981", "1982-1989", "1990-1998", "1999-2009", "2010plus"])


def land_per_sale():
    paths = (list((RAW / "extra" / "housing-stats" / "real-price-registration-lvr").glob("taipei-*/a_lvr_land_a.csv"))
             + list((RAW / "extra" / "housing-stats" / "lvr-history").glob("*/a_lvr_land_a.csv")))
    cols = ["編號", "交易筆棟數", "土地移轉總面積平方公尺"]
    a = pd.concat([pd.read_csv(p, dtype=str, skiprows=[1], usecols=cols, encoding="utf-8-sig") for p in paths])
    a = a.drop_duplicates("編號")
    one_unit = a["交易筆棟數"].str.contains(r"建物1車位", na=False)
    land = pd.to_numeric(a["土地移轉總面積平方公尺"], errors="coerce")
    return pd.Series(land.where(one_unit).values, index=a["編號"].values, name="land_m2")


def main():
    lv = pd.read_parquet(STAGED / "housing-stats" / "real-price-registration-lvr-all.parquet")
    lv = lv[lv.geo_level.between(1, 2) & lv.building_area_m2.between(15, 400) & lv.total_price.gt(0)].copy()
    lv["ping"] = lv.building_area_m2 / PING
    lv["price_per_ping"] = lv.total_price / lv.ping
    lv = lv[lv.price_per_ping.between(1e5, 1e7)]
    lv["decade"] = decade(lv.built_year_ad)
    lv["town_code"] = lv.village_code.str[:8]
    lv = lv.join(land_per_sale(), on="txn_id")
    lv["land_ping_per_unit"] = lv.land_m2 / PING
    recent = lv[lv.trade_date >= RECENT_FROM]

    def agg(g):
        return pd.Series({
            "n": len(g), "price_per_ping_median": round(g.price_per_ping.median()),
            "price_per_ping_p25": round(g.price_per_ping.quantile(0.25)),
            "price_per_ping_p75": round(g.price_per_ping.quantile(0.75)),
            "unit_ping_median": round(g.ping.median(), 1),
            "land_ping_per_unit_median": round(g.land_ping_per_unit.median(), 2),
            "total_price_median": round(g.total_price.median()),
            "built_year_median": g.built_year_ad.median(),
        })

    keys = ["village_code", "building_type", "decade"]
    v = recent.dropna(subset=["building_type", "decade"]).groupby(keys, observed=True).apply(agg, include_groups=False).reset_index()
    v_all = recent.groupby("village_code").apply(agg, include_groups=False).reset_index().assign(building_type="all", decade="all")
    v = pd.concat([v, v_all], ignore_index=True)
    t = recent.dropna(subset=["building_type", "decade"]).groupby(["town_code", "building_type", "decade"], observed=True).apply(agg, include_groups=False).reset_index()
    t_all = recent.groupby("town_code").apply(agg, include_groups=False).reset_index().assign(building_type="all", decade="all")
    t = pd.concat([t, t_all], ignore_index=True)

    b = lv.dropna(subset=["building_key"]).groupby("building_key").agg(
        n=("txn_id", "size"), price_per_ping_median=("price_per_ping", "median"),
        last_trade=("trade_date", "max"), built_year=("built_year_ad", "median"),
        unit_ping_median=("ping", "median"), land_ping_per_unit_median=("land_ping_per_unit", "median"),
        building_type=("building_type", lambda s: s.mode().iat[0] if s.notna().any() else None),
        village_code=("village_code", "first"))
    b = b[b.n >= 2].round({"price_per_ping_median": 0, "unit_ping_median": 1, "land_ping_per_unit_median": 2}).reset_index()

    OUT.mkdir(parents=True, exist_ok=True)
    v.to_csv(OUT / "village_unit_prices.csv", index=False, encoding="utf-8")
    t.to_csv(OUT / "town_unit_prices.csv", index=False, encoding="utf-8")
    b.to_csv(OUT / "building_unit_prices.csv", index=False, encoding="utf-8")
    walk = recent[(recent.building_type == "walkup_5_or_less") & (recent.built_year_ad < 1990)]
    print(f"recent sales={len(recent)} village rows={len(v)} town rows={len(t)} buildings={len(b)}")
    print(f"old walk-ups (<1990) last 3y: n={len(walk)} price/ping median={walk.price_per_ping.median():.0f} "
          f"unit ping median={walk.ping.median():.1f} land ping/unit median={walk.land_ping_per_unit.median():.2f}")
    print("villages with >=10 old walk-up sales:", int((v[(v.building_type == 'walkup_5_or_less') & v.decade.isin(['pre1974', '1974-1981', '1982-1989'])].groupby('village_code').n.sum() >= 10).sum()))


if __name__ == "__main__":
    main()

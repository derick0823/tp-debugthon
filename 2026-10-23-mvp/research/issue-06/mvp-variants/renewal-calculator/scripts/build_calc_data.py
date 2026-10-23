"""Data for the renewal calculator page (MVP variant A, "我家都更划不划算").

Unit prices are net of parking: (總價 - 車位總價) / (建物移轉總面積 - 車位面積), per ping.
Sales are kept only when they look like an ordinary home sale:
  * geo_level 1-2, residential use (住家用、住商用), 15-400 m2 after parking,
  * no remark about related parties, presale, parking only, government sales,
    renewal value, raw units, defects or foreclosure,
  * the parking price can be split (no "車位N" with a zero parking price),
  * not a new build (traded more than 2 years after completion),
  * 1e5-1e7 NTD per ping.
"Recent" means trade_date >= 2023-10-01 (3 years up to 115S3).

New-build proxy for the after-renewal price: same filters, but traded within 2 years
of completion, elevator mid-rise or tower, per district. This is a stand-in until
debug-e3's renewal review cases arrive; the page labels it 推估.

Outputs are rewritten on every run and stay out of git (see ../.gitignore).

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/renewal-calculator/scripts/build_calc_data.py
Input:   data/staged/housing-stats/real-price-registration-lvr-all.parquet
         data/raw/extra/housing-stats/{real-price-registration-lvr,lvr-history}/**/a_lvr_land_a.csv
         data/marts/building_points.parquet
         data/marts/village_indicators.csv
         research/issue-06/mvp-variants/consent-simulator/decision-tree/decision-tree.json (optional)
Output:  research/issue-06/mvp-variants/data/{village,town,building}_unit_prices_net.csv  (in git; same
         columns as debug-6f's tables plus a `filters` column)
         research/issue-06/mvp-variants/renewal-calculator/data/prices.json
         research/issue-06/mvp-variants/renewal-calculator/data/towns/<town_code>.json
         research/issue-06/mvp-variants/renewal-calculator/data/meta.json
         research/issue-06/mvp-variants/renewal-calculator/data/decision-tree.json  (copy of debug-6a's tree, when present)
Network: no
"""

import json
import shutil
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
sys.path.insert(0, str(ROOT))

import pandas as pd  # noqa: E402

from pipelines.common import MARTS, RAW, STAGED  # noqa: E402

OUT = HERE.parent / "data"
PING = 3.30579
RECENT_FROM = "2023-10-01"
MIN_N = 5
BAD_REMARK = ("親友|特殊關係|預售屋|容積代金|僅車位|公共設施保留地|未登記建物|毛胚|都更|重建|"
              "政府機關|地上權|瑕疵|凶宅|法拍|債權|拍賣")
TYPE_GROUPS = {
    "walkup_5_or_less": "walkup", "midrise_elevator": "midrise", "tower_11plus": "tower",
    "townhouse": "townhouse", "studio": "midrise",
}
DECADE_BINS = [0, 1974, 1982, 1990, 1999, 2010, 2100]
DECADE_LABELS = ["pre1974", "1974-1981", "1982-1989", "1990-1998", "1999-2009", "2010plus"]


def read_raw_sales():
    paths = (list((RAW / "extra" / "housing-stats" / "real-price-registration-lvr").glob("taipei-*/a_lvr_land_a.csv"))
             + list((RAW / "extra" / "housing-stats" / "lvr-history").glob("*/a_lvr_land_a.csv")))
    frames = []
    for p in paths:
        d = pd.read_csv(p, dtype=str, skiprows=[1], encoding="utf-8-sig")
        # Old seasons spell the area columns with brackets, e.g. 車位移轉總面積(平方公尺).
        d.columns = [("車位移轉總面積平方公尺" if c.startswith("車位移轉總面積")
                      else "土地移轉總面積平方公尺" if c.startswith("土地移轉總面積") else c) for c in d.columns]
        frames.append(d[["編號", "交易筆棟數", "車位總價元", "車位移轉總面積平方公尺", "土地移轉總面積平方公尺",
                         "備註", "主要用途"]])
    a = pd.concat(frames).drop_duplicates("編號").set_index("編號")
    a["park_price"] = pd.to_numeric(a["車位總價元"], errors="coerce").fillna(0)
    a["park_m2"] = pd.to_numeric(a["車位移轉總面積平方公尺"], errors="coerce").fillna(0)
    a["land_m2"] = pd.to_numeric(a["土地移轉總面積平方公尺"], errors="coerce")
    a["park_n"] = pd.to_numeric(a["交易筆棟數"].str.extract(r"車位(\d+)")[0], errors="coerce").fillna(0)
    a["one_unit"] = a["交易筆棟數"].str.contains(r"建物1車位", na=False)
    a["bad_remark"] = a["備註"].fillna("").str.contains(BAD_REMARK)
    return a[["park_price", "park_m2", "land_m2", "park_n", "one_unit", "bad_remark", "主要用途"]]


def clean_sales():
    lv = pd.read_parquet(STAGED / "housing-stats" / "real-price-registration-lvr-all.parquet")
    lv = lv[lv.geo_level.between(1, 2) & lv.total_price.gt(0)].join(read_raw_sales(), on="txn_id")
    lv["net_m2"] = lv.building_area_m2 - lv.park_m2
    lv["ping"] = lv.net_m2 / PING
    lv["ppp"] = (lv.total_price - lv.park_price) / lv.ping
    lv["age_at_sale"] = pd.to_numeric(lv.trade_date.str[:4], errors="coerce") - lv.built_year_ad
    lv["land_ping"] = (lv.land_m2 / PING).where(lv.one_unit)
    ok = (lv.net_m2.between(15, 400) & ~lv.bad_remark.fillna(False) & lv["主要用途"].isin(["住家用", "住商用"])
          & ~((lv.park_n > 0) & (lv.park_price == 0)) & lv.ppp.between(1e5, 1e7))
    lv = lv[ok].copy()
    lv["type_group"] = lv.building_type.map(TYPE_GROUPS)
    lv["decade"] = pd.cut(lv.built_year_ad, DECADE_BINS, labels=DECADE_LABELS).astype(str).replace("nan", None)
    lv["town_code"] = lv.village_code.str[:8]
    return lv


def summarise(g):
    return {
        "n": int(len(g)),
        "med": int(round(g.ppp.median())),
        "p25": int(round(g.ppp.quantile(0.25))),
        "p75": int(round(g.ppp.quantile(0.75))),
        "unit_ping": round(float(g.ping.median()), 1),
        "land_ping": None if g.land_ping.isna().all() else round(float(g.land_ping.median()), 2),
        "built_year": None if g.built_year_ad.isna().all() else int(g.built_year_ad.median()),
    }


def group_table(df, keys):
    out = {}
    for k, g in df.groupby(keys, observed=True):
        if len(g) < MIN_N:
            continue
        k = k if isinstance(k, tuple) else (k,)
        out["|".join(str(x) for x in k)] = summarise(g)
    return out


def town_files(old):
    bp = pd.read_parquet(MARTS / "building_points.parquet")
    by_bld = old.dropna(subset=["building_key"]).groupby("building_key").agg(
        pn=("ppp", "size"), pp=("ppp", "median"), plt=("trade_date", "max"),
        pl=("land_ping", "median"), pu=("ping", "median"))
    by_bld = by_bld[by_bld.pn >= 2]
    bp = bp.join(by_bld, on="building_key")
    fields = ["address", "point_id", "village_code", "built_year", "built_year_min", "built_year_max",
              "age_source", "age_conf", "floors", "structure_class", "doorplate_units", "lvr_building_type",
              "lvr_has_elevator", "sea_sand", "sea_sand_list_address", "sea_sand_list_version",
              "quake_listed", "quake_listed_address", "quake_listed_version",
              # read by the alternatives decision tree (consent-simulator/decision-tree)
              "status", "code_generation", "pre_policy_1999", "near_heritage_50m", "heritage_n_50m",
              "soft_story_candidate", "no_elevator_30plus", "liq_level_city2019",
              "pn", "pp", "plt", "pl", "pu"]
    (OUT / "towns").mkdir(parents=True, exist_ok=True)
    counts = {}
    for town, g in bp.groupby("town_code"):
        rows = []
        for rec in g[fields].itertuples(index=False):
            row = []
            for f, v in zip(fields, rec):
                if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NA:
                    row.append(None)
                elif f in ("built_year", "built_year_min", "built_year_max", "floors", "doorplate_units", "pn", "pp",
                           "heritage_n_50m"):
                    row.append(int(round(v)))
                elif f == "quake_listed":
                    row.append(str(int(v)) if isinstance(v, float) else str(v))
                elif f in ("pl", "pu"):
                    row.append(round(float(v), 2))
                elif isinstance(v, (bool,)) or type(v).__name__ == "bool_":
                    row.append(bool(v))
                else:
                    row.append(v)
            rows.append(row)
        with open(OUT / "towns" / f"{town}.json", "w", encoding="utf-8") as fh:
            json.dump({"town_code": town, "fields": fields, "records": rows}, fh, ensure_ascii=False,
                      separators=(",", ":"))
        counts[town] = {"buildings": len(rows), "with_own_price": int(g.pn.notna().sum())}
    return counts


FILTERS = ("net of parking; geo_level 1-2; 住家用/住商用; 15-400 m2 net; remarks excluded: " + BAD_REMARK
           + "; parking count >0 with zero parking price excluded; age at sale >2 years; trade_date >= " + RECENT_FROM)


def net_tables(old):
    """Same columns as ../../data/*_unit_prices.csv (debug-6f), but on the cleaned net-of-parking sales."""
    def agg(g):
        return pd.Series({
            "n": len(g), "price_per_ping_median": round(g.ppp.median()),
            "price_per_ping_p25": round(g.ppp.quantile(0.25)),
            "price_per_ping_p75": round(g.ppp.quantile(0.75)),
            "unit_ping_median": round(g.ping.median(), 1),
            "land_ping_per_unit_median": round(g.land_ping.median(), 2),
            "total_price_median": round((g.total_price - g.park_price).median()),
            "built_year_median": g.built_year_ad.median(),
        })

    t = old.dropna(subset=["building_type", "decade"])
    v = pd.concat([
        t.groupby(["village_code", "building_type", "decade"]).apply(agg, include_groups=False).reset_index(),
        old.groupby("village_code").apply(agg, include_groups=False).reset_index().assign(building_type="all", decade="all"),
    ], ignore_index=True)
    tw = pd.concat([
        t.groupby(["town_code", "building_type", "decade"]).apply(agg, include_groups=False).reset_index(),
        old.groupby("town_code").apply(agg, include_groups=False).reset_index().assign(building_type="all", decade="all"),
    ], ignore_index=True)
    b = old.dropna(subset=["building_key"]).groupby("building_key").agg(
        n=("txn_id", "size"), price_per_ping_median=("ppp", "median"),
        last_trade=("trade_date", "max"), built_year=("built_year_ad", "median"),
        unit_ping_median=("ping", "median"), land_ping_per_unit_median=("land_ping", "median"),
        building_type=("building_type", lambda s: s.mode().iat[0] if s.notna().any() else None),
        village_code=("village_code", "first"))
    b = b[b.n >= 2].round({"price_per_ping_median": 0, "unit_ping_median": 1, "land_ping_per_unit_median": 2}).reset_index()
    shared = OUT.parent.parent / "data"
    for name, df in [("village_unit_prices_net.csv", v), ("town_unit_prices_net.csv", tw), ("building_unit_prices_net.csv", b)]:
        df.assign(filters=FILTERS).to_csv(shared / name, index=False, encoding="utf-8")
    return len(v), len(tw), len(b)


def uro_district():
    """debug-e3's renewal review cases (168 專案): after-renewal residential price and burden proxy.

    Reads ../uro-cases/out/uro-review-cases.csv (optional; {} when missing).
    One row per site: the row with the latest price_year. District comes from the
    first 3 characters of site_group because town_name is still blank for most rows.
    Keys: town name, or "全市". "recent" uses price_year >= 2021 only.
    """
    path = OUT.parent.parent / "uro-cases" / "out" / "uro-review-cases.csv"
    if not path.exists():
        return {}
    d = pd.read_csv(path, dtype={"case_id": str})
    d = d[d.res_price_after_per_ping.notna()].copy()
    d["town"] = d.site_group.astype(str).str[:3]
    d = d.sort_values("price_year").drop_duplicates("site_group", keep="last")

    def stats(g):
        if g.empty:
            return None
        b = g.burden_ratio_proxy.dropna()
        return {
            "n": int(len(g)),
            "res_after": int(round(g.res_price_after_per_ping.median())),
            "res_p25": int(round(g.res_price_after_per_ping.quantile(0.25))),
            "res_p75": int(round(g.res_price_after_per_ping.quantile(0.75))),
            "price_year": None if g.price_year.isna().all() else int(g.price_year.median()),
            "year_min": None if g.price_year.isna().all() else int(g.price_year.min()),
            "year_max": None if g.price_year.isna().all() else int(g.price_year.max()),
            "burden_n": int(len(b)),
            "burden": None if b.empty else round(float(b.median()), 4),
            "burden_p25": None if b.empty else round(float(b.quantile(0.25)), 4),
            "burden_p75": None if b.empty else round(float(b.quantile(0.75)), 4),
        }

    out = {"全市": stats(d), "全市_recent": stats(d[d.price_year >= 2021])}
    for town, g in d.groupby("town"):
        out[town] = stats(g)
    out["_source"] = {"file": "research/issue-06/mvp-variants/uro-cases/out/uro-review-cases.csv",
                      "modified": date.fromtimestamp(path.stat().st_mtime).isoformat(),
                      "rule": "one row per site_group (latest price_year); district from site_group"}
    return out


def main():
    lv = clean_sales()
    recent = lv[lv.trade_date >= RECENT_FROM]
    old = recent[recent.age_at_sale > 2]
    print("net tables (village, town, building rows):", net_tables(old))
    new = recent[(recent.age_at_sale <= 2) & recent.type_group.isin(["midrise", "tower"])
                 & recent["主要用途"].eq("住家用")]

    towns = pd.read_csv(MARTS / "village_indicators.csv", dtype={"village_code": str, "town_code": str})
    prices = {
        "village_type_decade": group_table(old.dropna(subset=["type_group", "decade"]), ["village_code", "type_group", "decade"]),
        "village_type": group_table(old.dropna(subset=["type_group"]), ["village_code", "type_group"]),
        "town_type_decade": group_table(old.dropna(subset=["type_group", "decade"]), ["town_code", "type_group", "decade"]),
        "town_type": group_table(old.dropna(subset=["type_group"]), ["town_code", "type_group"]),
        "town_all": group_table(old, ["town_code"]),
        "town_newbuild": group_table(new, ["town_code"]),
        "uro_district": uro_district(),
        "village_names": dict(zip(towns.village_code, towns.village_name)),
        "town_names": dict(zip(towns.town_code, towns.town_name)),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "prices.json", "w", encoding="utf-8") as fh:
        json.dump(prices, fh, ensure_ascii=False, separators=(",", ":"))
    counts = town_files(old)
    tree = OUT.parent.parent / "consent-simulator" / "decision-tree" / "decision-tree.json"
    if tree.exists():
        shutil.copyfile(tree, OUT / "decision-tree.json")

    walk = old[(old.type_group == "walkup") & (old.built_year_ad < 1990)]
    meta = {
        "generated": date.today().isoformat(),
        "recent_from": RECENT_FROM,
        "seasons": f"{lv.season.min()}~{lv.season.max()}",
        "trade_date_max": recent.trade_date.max(),
        "sales_recent_old": int(len(old)),
        "sales_recent_newbuild": int(len(new)),
        "old_walkup_pre1990": summarise(walk),
        "towns": counts,
    }
    with open(OUT / "meta.json", "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in meta.items() if k != "towns"}, ensure_ascii=False))
    print("buildings with own 3-year price:", sum(c["with_own_price"] for c in counts.values()))
    print("newbuild by town:", {k: (v["n"], v["med"]) for k, v in prices["town_newbuild"].items()})


if __name__ == "__main__":
    main()

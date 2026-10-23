"""Build the data files for the bonus translator page.

Purpose: write small JSON files that the static page reads.
Usage:   uv run python -X utf8 research/issue-06/mvp-variants/bonus-translator/scripts/build_page_data.py
Input:   research/issue-06/mvp-variants/uro-cases/out/uro-review-cases.csv (debug-e3, 466 cases)
         data/raw/extra/renewal/uro-review-cases/<case_id>.json (optional, adds sidewalk area)
         data/marts/village_indicators.csv, data/marts/village_rankings.csv
Output:  research/issue-06/mvp-variants/bonus-translator/data/cases.json      (in git)
         research/issue-06/mvp-variants/bonus-translator/data/bonus-usage.json (in git)
         research/issue-06/mvp-variants/bonus-translator/data/villages.json   (not in git: copy of marts)
Network: no.

villages.json exists because a server rooted at research/issue-06 cannot reach
data/marts/. It is a column subset of the marts plus URO site counts per village.
Personal data: no phone numbers or addresses. Company names (legal persons) are kept.
"""

import json
import math
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parents[1]
ROOT = Path(__file__).resolve().parents[5]
URO_CSV = ROOT / "research" / "issue-06" / "mvp-variants" / "uro-cases" / "out" / "uro-review-cases.csv"
RAW = ROOT / "data" / "raw" / "extra" / "renewal" / "uro-review-cases"
MARTS = ROOT / "data" / "marts"
OUT = HERE / "data"

DF_COLS = ["dF1", "dF2", "dF3", "dF4", "dF4_1", "dF4_2", "dF4_3", "dF5", "dF5_1", "dF5_2",
           "dF5_3", "dF5_4", "dF5_5", "dF5_6", "dF6"]

VILLAGE_COLS = [
    "village_code", "town_code", "town_name", "village_name", "pop_total", "area_km2",
    "share_65plus", "liq_high_share_city2019", "liq_medium_share_city2019", "bld_age_known_n",
    "narrow_lanes_n", "fire_access_lanes", "road_markers_lt6m_share", "soft_story_a_n",
    "soft_story_b_n", "heritage_sites_n", "sea_sand_cases_n", "quake_listed_n", "weilao_active_est",
]
RANK_COLS = [
    "village_code", "f_old_stock", "lv_elderly", "lv_old_stock", "lv_liquefaction_city2019",
    "lv_rescue", "lv_soft_story", "share_top46_city2019", "hidden_by_composite_city2019",
    "hidden_factors_city2019", "s5_candidate", "s5_reason",
]


def clean(v):
    if v is None:
        return None
    if isinstance(v, float):
        return None if math.isnan(v) else round(v, 4)
    if hasattr(v, "item"):
        return clean(v.item())
    return v


def deep_clean(x):
    """Replace NaN anywhere in a nested structure with None (JSON has no NaN)."""
    if isinstance(x, dict):
        return {k: deep_clean(v) for k, v in x.items()}
    if isinstance(x, list):
        return [deep_clean(v) for v in x]
    return clean(x)


def sidewalk_area(case_id):
    f = RAW / f"{case_id}.json"
    if not f.exists():
        return None
    d = json.loads(f.read_text(encoding="utf-8"))
    if "third" not in d:
        return None
    rows = json.loads(d["third"]) if isinstance(d["third"], str) else d["third"]
    return clean(float(rows[0].get("Sidewalk_Area") or 0)) if rows else None


def latest_per_site(uro):
    """One row per site: the latest case whose F is above F0 (rows with F == F0 carry no dF data)."""
    far = uro[(uro["has_far"] == True) & (uro["far_F0_m2"] > 0) & (uro["far_F_m2"] - uro["far_F0_m2"] > 0.01)].copy()  # noqa: E712
    far["apply_date"] = far["apply_date"].fillna("")
    return far.sort_values(["site_group", "apply_date", "case_id"]).groupby("site_group").tail(1)


LEAF = [("ΔF1", "dF1"), ("ΔF2", "dF2"), ("ΔF3", "dF3"), ("ΔF4-1", "dF4_1"), ("ΔF4-2", "dF4_2"),
        ("ΔF4-3", "dF4_3"), ("ΔF5-1", "dF5_1"), ("ΔF5-2", "dF5_2"), ("ΔF5-3", "dF5_3"),
        ("ΔF5-4", "dF5_4"), ("ΔF5-5", "dF5_5"), ("ΔF5-6", "dF5_6"), ("ΔF6", "dF6")]


def build_usage(uro):
    """Share of sites that use each bonus item, and the median share of F0 when used."""
    s = latest_per_site(uro)
    items = []
    for code, col in LEAF:
        v = s[col + "_m2"].fillna(0)
        used = v > 0
        items.append({"code": code, "sites": int(used.sum()), "share": round(float(used.mean()), 4),
                      "median_pct_of_F0": round(float((v[used] / s.loc[used, "far_F0_m2"]).median()), 4) if used.any() else None})
    gain = (s["far_F_m2"] - s["far_F0_m2"]) / s["far_F0_m2"]
    excluded = int(((uro["has_far"] == True) & (uro["far_F0_m2"] > 0) & ((uro["far_F_m2"] - uro["far_F0_m2"]).abs() <= 0.01)).sum())  # noqa: E712
    return {"n_sites": int(len(s)), "n_rows": int(len(uro)), "rows_F_equals_F0": excluded,
            "gain_median": round(float(gain.median()), 4), "gain_p75": round(float(gain.quantile(0.75)), 4),
            "items": items,
            "method": "每個基地（site_group）只算一次：取最新一版、且 F 大於 F0 的案。F＝F0 的案沒有 ΔF 資料，不算。"}


def build_cases(uro):
    far = latest_per_site(uro)
    cases = []
    for _, r in far.iterrows():
        old = {"F": clean(r["far_F_m2"]), "F0": clean(r["far_F0_m2"])}
        for c in DF_COLS:
            old[c[1:].replace("_", "_")] = clean(r.get(c + "_m2"))
        cases.append({
            "case_id": r["case_id"], "case_name": r["case_name"], "site_group": r["site_group"],
            "town_name": r["town_name"], "village_names": r["village_names_raw"],
            "village_codes": r["village_codes"], "define_way": r["define_way"],
            "progress": r["progress"], "plan_app_date": r["apply_date"], "approve_date": clean(r["approve_date"]),
            "implementer": r["implementer"], "zoning": r["zoning_1"],
            "base_area_m2": clean(r["base_area_m2"]), "law_volume_rate": clean(r["far_rate_legal"]),
            "set_volume_rate": clean(r["far_rate_designed"]), "volume_transfer_m2": clean(r["far_transfer_m2"]),
            "live_units": clean(r["units_residential"]), "max_floors": clean(r["max_floors"]),
            "cap_label": r["bonus_cap_rule"], "sidewalk_area_m2": sidewalk_area(r["case_id"]),
            "old": old, "new": {},
            "source": f"都市更新審議服務平台 case_id={r['case_id']}（debug-e3 uro-review-cases.csv）",
        })
    # Keep one row per bonus set (a plan and its revision can carry the same numbers).
    seen, out = set(), []
    for c in sorted(cases, key=lambda c: c["case_id"], reverse=True):
        key = (c["old"]["F"], c["old"]["F0"], c["base_area_m2"])
        if key not in seen:
            seen.add(key)
            out.append(c)
    return sorted(out, key=lambda c: c["case_id"])


def site_counts(uro):
    """Distinct URO sites per village. A site counts as approved when any of its cases was
    approved, or is under construction or finished (a later revision may still be in review)."""
    u = uro.copy()
    u["apply_date"] = u["apply_date"].fillna("")
    prog = u["progress"].fillna("").astype(str)
    u["is_approved"] = u["approve_date"].notna() | prog.str.contains("核定") | prog.str.contains("執行階段")
    approved_sites = set(u.loc[u["is_approved"], "site_group"])
    latest = u.sort_values(["site_group", "apply_date", "case_id"]).groupby("site_group").tail(1)
    rows = []
    for _, r in latest.iterrows():
        for code in str(r["village_codes"] or "").split(";"):
            if code and code != "nan":
                rows.append({"village_code": code, "site_group": r["site_group"],
                             "approved": r["site_group"] in approved_sites})
    s = pd.DataFrame(rows)
    if s.empty:
        return {}
    g = s.groupby("village_code").agg(uro_sites=("site_group", "nunique"), uro_sites_approved=("approved", "sum"))
    return {k: {"uro_sites": int(v.uro_sites), "uro_sites_approved": int(v.uro_sites_approved)} for k, v in g.iterrows()}


def build_villages(uro):
    ind = pd.read_csv(MARTS / "village_indicators.csv", dtype={"village_code": str, "town_code": str})
    rk = pd.read_csv(MARTS / "village_rankings.csv", dtype={"village_code": str})
    v = ind[VILLAGE_COLS].merge(rk[RANK_COLS], on="village_code", how="left")
    counts = site_counts(uro) if uro is not None else {}
    out = []
    for rec in v.to_dict("records"):
        rec = {k: clean(x) for k, x in rec.items()}
        rec.update(counts.get(rec["village_code"], {"uro_sites": 0, "uro_sites_approved": 0}))
        out.append(rec)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    uro = None
    if URO_CSV.exists():
        uro = pd.read_csv(URO_CSV, dtype={"case_id": str, "village_codes": str, "town_code": str})
        cases = build_cases(uro)
        (OUT / "cases.json").write_text(json.dumps({"cases": deep_clean(cases)}, ensure_ascii=False, indent=1, allow_nan=False), encoding="utf-8")
        print(f"cases.json: {len(cases)} bonus sets from {len(uro)} URO rows")
        usage = build_usage(uro)
        (OUT / "bonus-usage.json").write_text(json.dumps(deep_clean(usage), ensure_ascii=False, indent=1, allow_nan=False), encoding="utf-8")
        print(f"bonus-usage.json: {usage['n_sites']} sites, {usage['rows_F_equals_F0']} rows with F == F0 left out")
    else:
        print(f"skip cases.json: {URO_CSV} not found")
    villages = build_villages(uro)
    meta = {"generated_from": ["data/marts/village_indicators.csv", "data/marts/village_rankings.csv",
                               "mvp-variants/uro-cases/out/uro-review-cases.csv"],
            "uro_rows": 0 if uro is None else int(len(uro)),
            "uro_rows_with_village": 0 if uro is None else int(uro["village_codes"].notna().sum())}
    (OUT / "villages.json").write_text(json.dumps({"meta": meta, "villages": deep_clean(villages)}, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    print(f"villages.json: {len(villages)} villages, {sum(1 for x in villages if x['uro_sites'])} with URO sites")


if __name__ == "__main__":
    main()

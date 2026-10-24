"""Parse raw gis.uro.taipei case responses into a fact table (one row per case).

Purpose: turn the per-case ashx responses into the economic fact table for the
         renewal calculator (unit prices, costs, floor-area bonuses, base data).
Usage:   uv run python -X utf8 research/issue-06/mvp-variants/uro-cases/scripts/parse_uro_cases.py
Input:   data/raw/extra/renewal/uro-review-cases/project168_list.json
         data/raw/extra/renewal/uro-review-cases/<case_id>.json  (from fetch_uro_cases.py)
         data/staged/base/village-boundary-nlsc.csv
Output:  research/issue-06/mvp-variants/uro-cases/out/uro-review-cases.csv          one row per case
         research/issue-06/mvp-variants/uro-cases/out/uro-review-case-villages.csv  case x village, weight = 1/n
Network: no
Notes:   phone numbers and street addresses of implementers are dropped on purpose.
"""

import json
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT))
from pipelines.address import TOWNS  # noqa: E402
from pipelines.common import RAW, STAGED  # noqa: E402

RAW_DIR = RAW / "extra" / "renewal" / "uro-review-cases"
VILLAGES = STAGED / "base" / "village-boundary-nlsc.csv"
OUT = Path(__file__).resolve().parents[1] / "out"

# ashx field -> output column
FIRST = {"District": "town_name", "Lie": "village_names_raw", "Place": "place",
         "Define_Way": "define_way", "Define_Date": "define_date", "name_progress_no": "progress",
         "exe_name_1": "implementer", "exe_name_2": "planner", "exe_name_3": "designer"}
TOP = {"CASE_NAME": "case_name_top", "plan_app_date": "apply_date_plan", "plan_app_date2": "apply_date_rt",
       "uro_chk_date": "approve_date_plan", "uro_chk_date2": "approve_date_rt", "phase": "phase",
       "exe_name2": "implementer_top2", "EXE_NAME": "implementer_top"}
THIRD = {"Exe_Way": "exe_way", "Base_Area": "base_area_m2", "Old_Doors": "households_before",
         "Settle_Old_Doors": "resettle_households", "Settle_Doors": "resettle_illegal",
         "Urban_Renew_Fee": "cost_total_third", "pc_afterUpdTotalValue": "sales_total",
         "Private_Area": "land_private_m2", "State_Area": "land_state_m2", "Muni_Area": "land_city_m2",
         "Land_Owners_Pir": "land_owners_private", "Land_Owners_Pub": "land_owners_public",
         "Bui_Owners_Legal": "building_owners_legal", "Landkind1": "zoning_1", "Landkind1_Area": "zoning_1_m2",
         "Landkind2": "zoning_2", "Eng_Start_Date": "construction_start_date", "Ulic_Date": "use_permit_date"}
FOURTH = {"name_reward_no": "bonus_cap_rule", "F": "far_F_m2", "F0": "far_F0_m2",
          "F1": "dF1_m2", "F2": "dF2_m2", "F3": "dF3_m2", "F4": "dF4_m2", "F4_1": "dF4_1_m2",
          "F4_2": "dF4_2_m2", "F4_3": "dF4_3_m2", "F5": "dF5_m2", "F5_1": "dF5_1_m2", "F5_2": "dF5_2_m2",
          "F5_3": "dF5_3_m2", "F5_4": "dF5_4_m2", "F5_5": "dF5_5_m2", "F5_6": "dF5_6_m2", "F6": "dF6_m2",
          "Park_Area": "parking_bonus_m2"}
FIFTH = {"VolumeTurn_Area": "far_transfer_m2", "AllFloor_Area": "total_floor_m2",
         "House_Use_Area": "residential_far_m2", "Live_Houses": "units_residential",
         "Busi_Unit": "units_commercial", "Max_Flr_Num": "max_floors",
         "Law_Volume_Rate": "far_rate_legal", "Set_Volume_Rate": "far_rate_designed"}
SIXTH = {"Renew_Mon1": "land_price_before_per_ping", "Renew_Mon2": "res_price_after_per_ping",
         "Renew_Mon3": "parking_price_after_each", "ChargeA": "cost_rebuild",
         "Chargeb": "cost_public_facility", "Chargec": "cost_rights_transform", "Charged": "cost_loan_interest",
         "Charge": "cost_tax", "ChargeF": "cost_management", "Urban_Renew_Fee": "cost_total",
         "ChargeG": "cost_far_transfer", "ChargeH": "cost_plan_change"}
# Typos in the platform's village cell; the target is the only close name in the same district
VILLAGE_ALIAS = {"啤頭里": "埤頭里", "新西里": "西新里"}
ENDPOINT_MAPS = {"First": FIRST, "top": TOP, "third": THIRD, "fourth": FOURTH, "fifth": FIFTH, "sixth": SIXTH}
# Zero means "not filled in" for these, not a real zero
ZERO_IS_MISSING = {"land_price_before_per_ping", "res_price_after_per_ping", "parking_price_after_each",
                   "cost_total", "cost_rebuild", "sales_total", "base_area_m2", "far_F_m2", "far_F0_m2",
                   "total_floor_m2", "cost_total_third"}


def first_obj(text):
    try:
        o = json.loads(text)
    except (TypeError, ValueError):
        return {}
    if isinstance(o, list):
        o = o[0] if o else {}
    return o if isinstance(o, dict) else {}


def norm_date(s):
    s = str(s or "").strip()
    m = re.match(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})", s)
    return f"{m[1]}-{int(m[2]):02d}-{int(m[3]):02d}" if m else ""


def site_group(name):
    """District + section (+ sub-section) + first lot number from the case name, e.g. 南港區新光段二小段134."""
    m = re.search(rf"({'|'.join(TOWNS)})(.+?段(?:[一二三四五六七八九十]+小段)?)(\d+(?:-\d+)?)(?:[（(]原[^)）]*[)）])?地號", name)
    return "".join(m.groups()) if m else ""


def plan_type(name):
    biz, rt = "事業計畫" in name, "權利變換" in name
    return "business+rights" if biz and rt else "business" if biz else "rights" if rt else "other"


def parse_case(item):
    cid = item["case_id"]
    row = {"case_id": cid, "case_name": item.get("T_name", ""), "stage168": item.get("stage", ""),
           "progress168": item.get("progress", ""), "memo168": item.get("MEMO", "")}
    f = RAW_DIR / f"{cid}.json"
    rec = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    row["endpoints_fetched"] = ",".join(sorted(rec))
    for ep, fmap in ENDPOINT_MAPS.items():
        obj = first_obj(rec.get(ep))
        lower = {k.lower(): v for k, v in obj.items()}
        for src, col in fmap.items():
            v = obj.get(src, lower.get(src.lower()))
            if isinstance(v, str):
                v = v.strip()
            row[col] = v
    return row


def main():
    items = json.loads((RAW_DIR / "project168_list.json").read_text(encoding="utf-8"))
    df = pd.DataFrame([parse_case(i) for i in items])

    num_cols = [c for m in (THIRD, FOURTH, FIFTH, SIXTH) for c in m.values()
                if c not in {"exe_way", "zoning_1", "zoning_2", "bonus_cap_rule", "construction_start_date",
                             "use_permit_date"}]
    for c in num_cols:
        df[c] = pd.to_numeric(df[c].replace("", None), errors="coerce")
        if c in ZERO_IS_MISSING:
            df.loc[df[c] == 0, c] = pd.NA
    for c in ["define_date", "apply_date_plan", "apply_date_rt", "approve_date_plan", "approve_date_rt",
              "construction_start_date", "use_permit_date"]:
        df[c] = df[c].map(norm_date)

    for c in ["implementer_top2", "implementer_top"]:
        df["implementer"] = df.implementer.where(df.implementer.fillna("") != "", df[c])
    # Keep legal persons only; a bare personal name is removed (task rule: no personal data)
    org = r"公司|事務所|會|社|局|署|處|所|中心|機構|銀行|基金|府|部|院|團|聯合|大學|合作"
    for c in ["implementer", "planner", "designer"]:
        person = df[c].notna() & (df[c].fillna("") != "") & ~df[c].fillna("").str.contains(org)
        df.loc[person, c] = "(personal name removed)"
    df["plan_type"] = df.case_name.map(plan_type)
    df["revision"] = df.case_name.str.extract(r"^(擬訂|變更)", expand=False).fillna("")
    # Price date proxy: the platform shows no valuation date, so use the application date
    df["apply_date"] = df.apply_date_rt.where(df.apply_date_rt != "", df.apply_date_plan)
    df["approve_date"] = df.approve_date_rt.where(df.approve_date_rt != "", df.approve_date_plan)
    df["approve_date_memo"] = df.memo168.str.extract(r"(\d{4}/\d{1,2}/\d{1,2})\s*核定", expand=False).map(norm_date)
    # Price date proxy, best first: application date (top), approval date (top), approval date (168 list memo)
    df["price_date_proxy"] = df.apply_date
    df["date_source"] = (df.apply_date != "").map({True: "top.apply_date", False: ""})
    for col, src in [("approve_date", "top.approve_date"), ("approve_date_memo", "list.memo_approve")]:
        fill = (df.price_date_proxy == "") & (df[col].fillna("") != "")
        df.loc[fill, "price_date_proxy"] = df.loc[fill, col]
        df.loc[fill, "date_source"] = src
    df["apply_year"] = pd.to_numeric(df.apply_date.str[:4], errors="coerce").astype("Int64")
    df["price_year"] = pd.to_numeric(df.price_date_proxy.str[:4], errors="coerce").astype("Int64")
    df["site_group"] = df.case_name.map(site_group)
    # District from the case name when the First endpoint was not fetched
    from_name = df.case_name.str.extract(f"({'|'.join(TOWNS)})", expand=False)
    df["town_source"] = df.town_name.fillna("").ne("").map({True: "First.District", False: "case_name"})
    df["town_name"] = df.town_name.where(df.town_name.fillna("") != "", from_name)
    df["town_code"] = df.town_name.map(TOWNS)
    df["has_cost"] = df.land_price_before_per_ping.notna() | df.cost_total.notna()
    df["has_far"] = df.far_F0_m2.notna()
    df["price_ratio_after_res_to_before_land"] = (df.res_price_after_per_ping / df.land_price_before_per_ping).round(4)
    df["burden_ratio_proxy"] = (df.cost_total / df.sales_total).round(4)
    # Outside 5%-80% is a data-entry error on the platform (sales total off by a digit), not a real ratio
    df["burden_ratio_ok"] = df.burden_ratio_proxy.between(0.05, 0.8)
    df["bonus_ratio"] = ((df.far_F_m2 - df.far_F0_m2) / df.far_F0_m2).round(4)

    # Split village cells ("黎忠里、黎安里") into case x village rows with weight 1/n
    v = pd.read_csv(VILLAGES, dtype=str)
    rows = []
    for r in df.itertuples():
        cell = re.sub(rf"(臺北市|台北市|{'|'.join(TOWNS)})", "", str(r.village_names_raw or ""))
        names = re.findall(r"[^、﹑,，/;；及\s]+?里", cell)
        df.loc[r.Index, "village_count"] = len(names)
        for n in names:
            rows.append({"case_id": r.case_id, "town_code": r.town_code, "village_name": VILLAGE_ALIAS.get(n, n),
                         "village_weight": round(1 / len(names), 4),
                         "village_alias_from": n if n in VILLAGE_ALIAS else ""})
    cv = pd.DataFrame(rows).merge(v[["town_code", "village_name", "village_code"]],
                                  on=["town_code", "village_name"], how="left")
    miss = cv[cv.village_code.isna()]
    cv = cv[["case_id", "town_code", "village_code", "village_name", "village_weight", "village_alias_from"]]
    df["village_count"] = df.village_count.fillna(0).astype(int)
    df["village_codes"] = df.case_id.map(cv.dropna(subset=["village_code"]).groupby("case_id").village_code
                                         .agg(lambda s: ";".join(s)))

    lead = ["case_id", "case_name", "site_group", "plan_type", "revision", "town_code", "town_name", "town_source", "village_names_raw",
            "village_codes", "village_count", "place", "define_way", "define_date", "progress", "stage168",
            "progress168", "memo168", "phase", "apply_date", "approve_date", "approve_date_memo",
            "price_date_proxy", "date_source", "price_year", "apply_year", "implementer",
            "planner", "designer", "has_cost", "has_far", "land_price_before_per_ping",
            "res_price_after_per_ping", "parking_price_after_each", "price_ratio_after_res_to_before_land",
            "cost_total", "sales_total", "burden_ratio_proxy", "burden_ratio_ok", "bonus_ratio"]
    drop = {"case_name_top", "cost_total_third", "implementer_top2", "implementer_top"}
    rest = [c for c in df.columns if c not in lead and c not in drop]
    df = df[lead + rest]
    OUT.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT / "uro-review-cases.csv", index=False, encoding="utf-8")
    cv.to_csv(OUT / "uro-review-case-villages.csv", index=False, encoding="utf-8")
    print(f"cases={len(df)} has_cost={int(df.has_cost.sum())} has_far={int(df.has_far.sum())} "
          f"case-village rows={len(cv)} unmatched villages={len(miss)}")
    if len(miss):
        print(miss.to_string(index=False))


if __name__ == "__main__":
    main()

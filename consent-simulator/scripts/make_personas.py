"""Generate synthetic households for five archetype old apartment buildings.

Each archetype is a made-up building anchored on one S5 candidate village. Village-level
numbers (age mix, build year, walk-up share) come from data/marts and data/staged. The
building itself and every household are synthetic: no real address, no real person.
Attributes without a data source are drawn from stated assumptions (see ATTR_SOURCE).

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/make_personas.py
Input:   data/marts/village_indicators.csv, data/marts/village_rankings.csv,
         data/staged/base/village-population-by-age.csv
Output:  research/issue-06/mvp-variants/consent-simulator/out/personas.jsonl
         research/issue-06/mvp-variants/consent-simulator/out/archetypes.json
Network: no
"""

import json
import random
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))
from pipelines.common import MARTS, STAGED  # noqa: E402

HERE = Path(__file__).resolve().parents[1]
OUT = HERE / "out"
SEED = 20261022

# One synthetic building per village. Floors, units and ground-floor use are assumptions
# shaped by the village's walk-up share and build-year median (see archetypes.json).
ARCHETYPES = [
    {"id": "A1", "village_code": "63000120002", "floors": 4, "units_per_floor": 4,
     "ground": "residential", "structure": "RC", "lane": "6 公尺巷內",
     "note": "北投文林里。無電梯公寓占成交 67%，建成年中位 1976。"},
    {"id": "A2", "village_code": "63000070002", "floors": 4, "units_per_floor": 2,
     "ground": "shops", "structure": "加強磚造", "lane": "臨 8 公尺街，後側窄巷",
     "note": "萬華萬壽里。65 歲以上 30%，無電梯公寓只占 9%，以街屋為主。"},
    {"id": "A3", "village_code": "63000030005", "floors": 5, "units_per_floor": 4,
     "ground": "mixed", "structure": "RC", "lane": "巷內",
     "note": "大安仁愛里。80 歲以上 9.4%，全市最高之一；地價高。"},
    {"id": "A4", "village_code": "63000060024", "floors": 4, "units_per_floor": 4,
     "ground": "mixed", "structure": "RC", "lane": "巷內",
     "note": "大同老師里。成交的老屋全是無電梯公寓。"},
    {"id": "A5", "village_code": "63000110004", "floors": 3, "units_per_floor": 4,
     "ground": "residential", "structure": "加強磚造", "lane": "窄巷，消防車進不去",
     "note": "士林福德里。建成年中位 1966，五個原型中最老。"},
]

ATTR_SOURCE = {
    "village": "real: data/marts/village_rankings.csv (S5 candidate)",
    "built_year": "estimated: lvr_built_year_median of the village",
    "floors_units_ground_use": "assumption: shaped by village walk-up share",
    "head_age_band": "real band shares (115/09, village-population-by-age) with assumption weights",
    "gender": "assumption: 50/50, older bands 55% female",
    "tenure": "assumption: no tenure data in catalog",
    "land_share_m2": "estimated: median 29.0 m2, IQR 23.8-35.3 (g3-consent-threshold.md)",
    "household_type": "assumption: conditioned on age",
    "years_lived": "assumption: bounded by age and build year",
    "economic_pressure": "assumption",
    "mobility": "assumption: conditioned on age band",
    "info_source": "assumption",
    "trust_in_implementer": "assumption",
    "dispute_exposure": "assumption",
    "risk_awareness": "assumption",
    "life_details": "assumption: drawn from fixed lists",
    "wants": "assumption: mixed pro, con and neutral motives",
}

OCC_YOUNG = ["工程師", "門市店員", "外送員", "護理師", "補習班老師", "公務員", "設計接案", "會計"]
OCC_MID = ["小吃店老闆", "計程車司機", "中小企業業務", "國小老師", "水電師傅", "銀行行員", "家管", "傳產會計"]
OCC_OLD = ["退休公務員", "退休國小老師", "退休工廠作業員", "以前開雜貨店", "退休公車司機", "一輩子家管", "退休裁縫", "退休軍人"]
SHOP = ["小吃店", "五金行", "中藥行", "機車行", "早餐店", "洗衣店", "里長服務處兼雜貨", "按摩店"]
KIDS = ["孩子都在臺北，每週回來", "孩子在國外", "孩子住新北，偶爾回來", "沒有孩子", "孩子同住"]
EXTRA = ["樓上漏水跟鄰居吵過", "去年中風過一次", "房貸還剩 6 年", "房子是唯一資產", "在附近還有一間店面",
         "跟隔壁棟住戶是親戚", "曾經被投資客出價想買", "921 那年牆壁裂過", "養了兩隻狗", "照顧失智的配偶",
         "正在辦繼承，兄弟姊妹意見不同", "在里民活動中心當志工", "頂樓有自己加蓋的鐵皮"]
# What the household wants from its home. Mixes reasons to support, oppose and not care,
# so that attitudes are not pre-decided by a one-sided background (assumption).
WANTS_OWNER = ["很想要有電梯，爬樓梯越來越吃力", "受不了漏水和壁癌，修了好幾次", "想把房子變成新的留給孩子",
               "當初買來就是等都更增值", "想趁改建換一間比較大的", "只想安安靜靜住到老，不想再搬",
               "想賣掉換現金去住孩子附近", "地震時很怕，晚上睡不好", "希望不要多花任何一毛錢",
               "最在意一樓的店能不能繼續做生意", "沒什麼想法，看大家怎麼做", "想要有停車位"]
WANTS_TENANT = ["想找房租便宜、離上班近的地方", "希望房東不要突然漲價", "想要住安全一點的房子給小孩",
                "存錢準備自己買房", "沒什麼想法，到時候再搬就好"]


def pick(rng, weights):
    keys = list(weights)
    return rng.choices(keys, [weights[k] for k in keys])[0]


def village_info():
    v = pd.read_csv(MARTS / "village_indicators.csv", dtype={"village_code": str})
    r = pd.read_csv(MARTS / "village_rankings.csv", dtype={"village_code": str})
    p = pd.read_csv(STAGED / "base" / "village-population-by-age.csv", dtype={"village_code": str})
    p = p[(p.year_roc == 115) & (p.month == 9)].set_index("village_code")
    v = v.merge(r[["village_code", "s5_candidate", "s5_reason"]], on="village_code").set_index("village_code")
    return v, p


def head_age_weights(prow):
    # Household heads are adults; 15-64 is one band in the source, weighted down because
    # many 15-24s are not heads (assumption 0.75).
    a1564 = prow.pop_15_64 * 0.75
    a6574 = prow.pop_65plus - prow.pop_75plus
    a7579 = prow.pop_75plus - prow.pop_80plus
    a80 = prow.pop_80plus
    return {"30-64": a1564, "65-74": a6574, "75-79": a7579, "80+": a80}


def age_in_band(rng, band):
    lo, hi = {"30-64": (30, 64), "65-74": (65, 74), "75-79": (75, 79), "80+": (80, 92)}[band]
    return rng.randint(lo, hi)


def make_household(rng, arch, unit_floor, unit_no, ground_use, built_year, age_w):
    is_shop = ground_use == "shop"
    if is_shop:
        tenure = pick(rng, {"一樓店家（自有）": 0.55, "一樓店家（承租）": 0.45})
    else:
        tenure = pick(rng, {"所有權人自住": 0.58, "所有權人出租": 0.22, "繼承共有（持分人不同住）": 0.08,
                            "所有權人自住（繼承共有）": 0.12})
    band = pick(rng, age_w)
    age = age_in_band(rng, band)
    female_p = 0.55 if band != "30-64" else 0.5
    gender = "女" if rng.random() < female_p else "男"
    max_years = max(1, min(age - 20, 2026 - built_year))
    if band == "30-64":
        years = rng.randint(1, max_years)
        hh = pick(rng, {"小家庭": 0.45, "單身上班族": 0.25, "三代同堂": 0.15, "與年邁父母同住": 0.15})
        occ = rng.choice(OCC_YOUNG if age < 45 else OCC_MID)
    else:
        years = rng.randint(max(1, max_years // 2), max_years)
        hh = pick(rng, {"獨居長輩": 0.3, "老夫妻兩人": 0.4, "三代同堂": 0.15, "與單身子女同住": 0.15})
        occ = rng.choice(OCC_OLD)
    if years >= 2026 - built_year - 1 and band != "30-64":
        years_label = "建好就搬進來"
    elif years > 15:
        years_label = "15 年以上"
    elif years > 3:
        years_label = "3-15 年"
    else:
        years_label = "3 年以下"
    mobility = "行動自如"
    if band in ("75-79", "80+"):
        mobility = pick(rng, {"行動自如": 0.4, "上下樓梯吃力": 0.4, "需要輪椅或人扶": 0.2})
    elif band == "65-74":
        mobility = pick(rng, {"行動自如": 0.75, "上下樓梯吃力": 0.25})
    econ = pick(rng, {"低": 0.3, "中": 0.45, "高": 0.25})
    if hh == "獨居長輩":
        econ = pick(rng, {"低": 0.2, "中": 0.4, "高": 0.4})
    land = round(max(12.0, rng.gauss(29.0, 8.5)), 1)
    if is_shop:
        land = round(land * 1.4, 1)
    rec = {
        "unit": f"{unit_floor}F-{unit_no}",
        "floor": unit_floor,
        "floor_label": "一樓" if unit_floor == 1 else ("頂樓" if unit_floor == arch["floors"] else "中間樓層"),
        "tenure": tenure,
        "is_owner": "承租" not in tenure,
        "lives_here": tenure not in ("所有權人出租", "繼承共有（持分人不同住）"),
        "land_share_m2": land,
        "head_age_band": band,
        "age": age,
        "gender": gender,
        "household_type": hh,
        "occupation": occ,
        "years_lived": years if tenure not in ("所有權人出租", "繼承共有（持分人不同住）") else None,
        "years_lived_label": years_label,
        "economic_pressure": econ,
        "mobility": mobility,
        "info_source": pick(rng, {"里長": 0.2, "LINE 群組": 0.25, "新聞": 0.15, "建商說明會": 0.1, "鄰居": 0.2, "子女": 0.1}),
        "trust_in_implementer": pick(rng, {"低": 0.3, "中": 0.45, "高": 0.25}),
        "dispute_exposure": pick(rng, {"沒聽過": 0.35, "聽過新聞上的糾紛": 0.45, "親友經歷過都更糾紛": 0.2}),
        "risk_awareness": pick(rng, {"不知道自家風險": 0.5, "大概知道老房子不耐震": 0.4, "做過或看過評估": 0.1}),
        "children": rng.choice(KIDS) if band != "30-64" else rng.choice(["有小孩在念國小", "沒有小孩", "小孩剛出生"]),
        "extra": rng.sample(EXTRA, 2),
        "wants": rng.choice(WANTS_OWNER),
    }
    if is_shop:
        rec["shop_type"] = rng.choice(SHOP)
        rec["occupation"] = f"經營{rec['shop_type']}"
        rec["household_type"] = rec["household_type"] if rec["is_owner"] else "店家，住別處"
    if unit_floor == arch["floors"] and rec["is_owner"] and rng.random() < 0.5:
        rec["extra"] = ["頂樓有自己加蓋的鐵皮"] + [e for e in rec["extra"] if "頂樓" not in e][:1]
    return rec


def tenant_for(rng, owner):
    band = pick(rng, {"20-34": 0.45, "35-64": 0.4, "65+": 0.15})
    age = {"20-34": rng.randint(22, 34), "35-64": rng.randint(35, 64), "65+": rng.randint(65, 85)}[band]
    return {
        **{k: owner[k] for k in ("unit", "floor", "floor_label")},
        "tenure": "租客",
        "is_owner": False,
        "lives_here": True,
        "land_share_m2": None,
        "head_age_band": band,
        "age": age,
        "gender": rng.choice(["女", "男"]),
        "household_type": pick(rng, {"單身上班族": 0.35, "小家庭": 0.35, "學生分租": 0.1, "獨居長輩": 0.2 if band == "65+" else 0.0}),
        "occupation": rng.choice(OCC_YOUNG + OCC_MID),
        "years_lived": rng.randint(1, 12),
        "years_lived_label": "3 年以下" if rng.random() < 0.5 else "3-15 年",
        "economic_pressure": pick(rng, {"低": 0.2, "中": 0.4, "高": 0.4}),
        "mobility": "行動自如" if band != "65+" else pick(rng, {"行動自如": 0.5, "上下樓梯吃力": 0.5}),
        "info_source": pick(rng, {"房東": 0.4, "鄰居": 0.3, "LINE 群組": 0.2, "新聞": 0.1}),
        "trust_in_implementer": pick(rng, {"低": 0.4, "中": 0.5, "高": 0.1}),
        "dispute_exposure": pick(rng, {"沒聽過": 0.5, "聽過新聞上的糾紛": 0.4, "親友經歷過都更糾紛": 0.1}),
        "risk_awareness": pick(rng, {"不知道自家風險": 0.6, "大概知道老房子不耐震": 0.35, "做過或看過評估": 0.05}),
        "children": rng.choice(["有小孩在念國小", "沒有小孩", "小孩剛出生"]),
        "wants": rng.choice(WANTS_TENANT),
        "extra": rng.sample(["租金比附近便宜很多", "房東年紀大很少來", "在附近上班走路就到", "小孩學區在這裡", "之前被房東漲過租"], 2),
    }


def main():
    rng = random.Random(SEED)
    v, p = village_info()
    OUT.mkdir(parents=True, exist_ok=True)
    personas, archetypes = [], []
    for arch in ARCHETYPES:
        vc = arch["village_code"]
        row, prow = v.loc[vc], p.loc[vc]
        assert bool(row.s5_candidate), vc
        built_year = int(round(row.lvr_built_year_median))
        age_w = head_age_weights(prow)
        units = arch["floors"] * arch["units_per_floor"]
        archetypes.append({
            **arch,
            "town_name": row.town_name, "village_name": row.village_name,
            "built_year": built_year, "units": units,
            "village_share_65plus": round(float(row.share_65plus), 4),
            "village_share_80plus": round(float(row.share_80plus), 4),
            "village_walkup_share": round(float(row.lvr_share_walkup), 4),
            "s5_reason": row.s5_reason,
            "head_age_weights": {k: round(float(w), 1) for k, w in age_w.items()},
        })
        n = 0
        for fl in range(1, arch["floors"] + 1):
            for u in range(1, arch["units_per_floor"] + 1):
                if fl == 1 and arch["ground"] == "shops":
                    gu = "shop"
                elif fl == 1 and arch["ground"] == "mixed" and u <= 2:
                    gu = "shop"
                else:
                    gu = "home"
                h = make_household(rng, arch, fl, u, gu, built_year, age_w)
                n += 1
                base = {"archetype_id": arch["id"], "village_code": vc, "town_name": row.town_name,
                        "village_name": row.village_name, "built_year": built_year,
                        "building_floors": arch["floors"], "building_units": units,
                        "structure": arch["structure"], "lane": arch["lane"]}
                personas.append({"persona_id": f"{arch['id']}-{n:02d}", **base, **h})
                if h["tenure"] in ("所有權人出租", "一樓店家（承租）"):
                    if h["tenure"] == "一樓店家（承租）":
                        continue  # the shop tenant is this record; the landlord stays off-stage
                    n += 1
                    personas.append({"persona_id": f"{arch['id']}-{n:02d}", **base, **tenant_for(rng, h)})
    with open(OUT / "personas.jsonl", "w", encoding="utf-8") as f:
        for r in personas:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    (OUT / "archetypes.json").write_text(
        json.dumps({"seed": SEED, "attr_source": ATTR_SOURCE, "archetypes": archetypes}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    df = pd.DataFrame(personas)
    print(len(df), "personas")
    print(df.groupby(["archetype_id", "tenure"]).size().unstack(fill_value=0).to_string())
    print(df.head_age_band.value_counts().to_string())


if __name__ == "__main__":
    main()

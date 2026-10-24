"""Two extra checklist items for the rescue drill map: where to go after a quake, and hydrant reach.

(1) Earthquake shelters serving each village, from the Taipei Education Department list
    (震災＝是 or 備用, matched by 服務里別), plus counts of shelters the National Fire Agency
    marks 適合避難弱者 and 震災, by point-in-polygon in the village and in its district.
(2) For each listed narrow lane (red/yellow zone, located at its doorplate centroid), the
    straight-line distance to the nearest Taipei Water fire hydrant; the farthest per village.

Contact names and phone numbers in the shelter list are never read into the output.

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/rescue-drill-map/scripts/build_extra.py
Input:   data/raw/extra/hazard/shelters-taipei-edu/*.ods
         data/raw/extra/hazard/shelters-nfa/Shelter.xml
         data/raw/extra/hazard/fire-hydrants-taipei-water/*.csv
         data/staged/hazard/narrow-lanes-red-yellow.csv, data/marts/village_rankings.geojson
Output:  research/issue-06/mvp-variants/rescue-drill-map/data/drill_extra.json
         (generated, not committed; run this script after build_data.py)
Network: no
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
sys.path.insert(0, str(ROOT))

import geopandas as gpd  # noqa: E402
import pandas as pd  # noqa: E402

from pipelines.common import MARTS, RAW, STAGED, CRS_TWD97  # noqa: E402

OUT = HERE.parent / "data"
EXTRA = RAW / "extra" / "hazard"
EDU_COLS = ["收容所編號", "名稱(學校機關全銜)", "鄉鎮", "類型", "震災", "無障礙設施", "室內", "服務里別", "容納人數", "備考"]
# Spelling variants in 服務里別 that do not match NLSC village names (checked by hand, 2026-10-24).
FIX = {"糖部里": "糖廍里", "舊庄里": "舊莊里", "凌雲里": "凌霄里", "福佳港里": "福佳里", "治里": "法治里"}
PAREN = re.compile(r"[(（]([^)）]*)[)）]")
UNDER_WORK = re.compile(r"拆除|改建|施工|暫停|停用")


def read_ods(path):
    """First sheet of an .ods file as a list of row lists (stdlib only)."""
    ns = {"table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
          "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0"}
    t = "{%s}" % ns["table"]
    root = ET.fromstring(zipfile.ZipFile(path).read("content.xml"))
    sheet = next(root.iter(t + "table"))
    rows = []
    for r in sheet.iter(t + "table-row"):
        cells = []
        for c in r:
            n = min(int(c.get(t + "number-columns-repeated", "1")), 64)
            cells += ["\n".join("".join(p.itertext()) for p in c.findall("text:p", ns)).strip()] * n
        if any(cells):
            rows.append(cells)
    return rows


def edu_shelters(names):
    """Rows of the Education Department list that are earthquake shelters, with served villages."""
    src = next((EXTRA / "shelters-taipei-edu").glob("*.ods"))
    rows = read_ods(src)
    head = rows[0]
    df = pd.DataFrame([dict(zip(head, r)) for r in rows[1:]])
    df = df[[c for c in EDU_COLS if c in df.columns]]  # contact columns dropped here
    df = df[df["鄉鎮"].str.endswith("區") & df["震災"].isin(["是", "備用"])].copy()
    city_names = {}
    for town, vil in names:
        city_names.setdefault(vil, []).append(town)
    serve, whole, unmatched = {}, {}, set()
    for _, s in df.iterrows():
        rec = {"name": s["名稱(學校機關全銜)"], "eq": s["震災"], "type": s["類型"],
               "cap": int(s["容納人數"]) if str(s["容納人數"]).isdigit() else None,
               "acc": s["無障礙設施"] == "是", "code": s["收容所編號"]}
        if UNDER_WORK.search(s.get("備考") or ""):
            rec["work"] = True
        limit = PAREN.findall(s["服務里別"])
        if limit:
            rec["limit"] = "；".join(limit)
        seen = set()
        for nm in re.split(r"[、,，/\s]+", PAREN.sub("", s["服務里別"])):
            nm = nm.strip("。()（）")
            if not nm or nm == "無":
                continue
            if nm == "全區":
                whole.setdefault(s["鄉鎮"], []).append(rec)
                continue
            nm = nm if nm.endswith("里") else nm + "里"
            nm = FIX.get(nm, nm)
            town = s["鄉鎮"] if (s["鄉鎮"], nm) in names else (
                city_names[nm][0] if len(city_names.get(nm, [])) == 1 else None)
            if town is None:
                unmatched.add((s["鄉鎮"], nm))
                continue
            if (town, nm) in seen:
                continue
            seen.add((town, nm))
            serve.setdefault((town, nm), []).append(rec)
    return src, serve, whole, unmatched, len(df)


def nfa_weaker(vil):
    """NFA shelters (Taipei, de-duplicated by shelterId) marked 適合避難弱者 and 震災, joined to villages."""
    root = ET.parse(EXTRA / "shelters-nfa" / "Shelter.xml").getroot()
    recs = [{c.tag: (c.text or "").strip() for c in e} for e in root.iter("ShletersInfo") if e.find("county") is not None]
    df = pd.DataFrame([r for r in recs if r.get("county") == "臺北市"]).drop_duplicates("shelterId")
    n_tp = len(df)
    df = df[(df.adaptForWeaker == "是") & df.disastertype.str.contains("震災") & (df.twd97x != "")]
    g = gpd.GeoDataFrame(df[["shelterId", "shelterCode", "name"]],
                         geometry=gpd.points_from_xy(df.twd97x.astype(float), df.twd97y.astype(float)), crs=CRS_TWD97)
    j = gpd.sjoin(g, vil[["village_code", "town_code", "geometry"]], how="left", predicate="within")
    return j, n_tp


def hydrant_reach(vil):
    """Distance from each located narrow lane to its nearest hydrant, in metres (TWD97)."""
    src = next((EXTRA / "fire-hydrants-taipei-water").glob("*.csv"))
    h = pd.read_csv(src, encoding="utf-8-sig")
    # Hydrants on both sides of the city line count: the nearest one may be across it.
    hg = gpd.GeoDataFrame(h[["WPID"]], geometry=gpd.points_from_xy(h["97X座標"], h["97Y座標"]), crs=CRS_TWD97)
    n = pd.read_csv(STAGED / "hazard" / "narrow-lanes-red-yellow.csv", dtype={"village_code": str})
    n = n[n.geo_level.between(1, 3)]
    lg = gpd.GeoDataFrame(n[["lane_id", "lane_name", "zone", "village_code"]],
                          geometry=gpd.points_from_xy(n.x, n.y), crs=CRS_TWD97)
    j = gpd.sjoin_nearest(lg, hg, how="left", distance_col="d_m").drop_duplicates("lane_id")
    return src, j, int(h["所在地區"].str.startswith("臺北市").sum()), len(h)


def r10(x):
    return int(round(x / 10.0) * 10)


def main():
    vil = gpd.read_file(MARTS / "village_rankings.geojson")[["village_code", "town_code", "town_name",
                                                             "village_name", "geometry"]].to_crs(CRS_TWD97)
    names = set(zip(vil.town_name, vil.village_name))
    code_of = {(t, v): c for t, v, c in zip(vil.town_name, vil.village_name, vil.village_code)}
    town_of = dict(zip(vil.village_code, vil.town_code))

    edu_src, serve, whole, unmatched, n_edu = edu_shelters(names)
    weak, n_nfa = nfa_weaker(vil)
    weak_codes = set(weak.shelterCode.dropna())
    weak_v = weak.groupby("village_code").size().to_dict()
    weak_t = weak.groupby("town_code").size().to_dict()
    hyd_src, lanes, n_hyd_tp, n_hyd = hydrant_reach(vil)

    out = {}
    for (town, vname), code in code_of.items():
        sh = sorted(serve.get((town, vname), []), key=lambda r: (r["eq"] != "是", r["name"]))
        rec = {"sh": [{k: v for k, v in dict(r, weak=r["code"] in weak_codes).items() if k != "code"} for r in sh],
               "sh_town_all": len(whole.get(town, [])),
               "weak_v": int(weak_v.get(code, 0)), "weak_t": int(weak_t.get(town_of[code], 0))}
        ln = lanes[lanes.village_code == code]
        if len(ln):
            far = ln.loc[ln.d_m.idxmax()]
            rec["hyd"] = {"n": int(len(ln)), "far_name": far.lane_name, "far_zone": far.zone,
                          "far_m": r10(far.d_m), "median_m": r10(ln.d_m.median())}
        out[code] = rec

    meta = {"generated": date.today().isoformat(),
            "shelters_edu": f"臺北市政府教育局「臺北市可供避難收容處所一覽表」115-02-24 版（檔名 {edu_src.name}；"
                            f"data.taipei 更新 2026-09-14，2026-10-23 下載）；震災欄「是」或「備用」{n_edu} 處",
            "shelters_nfa": f"內政部消防署「避難收容處所」（data.gov.tw 12849，2026-10-23 下載）；臺北市去重後 {n_nfa} 處，"
                            f"適合避難弱者且含震災 {len(weak)} 處，依經緯度落里",
            "hydrants": f"臺北自來水事業處「大臺北地區消防栓清冊」115-09-15 版（data.taipei，2026-10-23 下載）；"
                        f"{n_hyd:,} 支（臺北市 {n_hyd_tp:,} 支）",
            "lane_note": "窄巷位置是該巷門牌中心（推估），距離是直線距離，不是水帶實際拉的路線",
            "unmatched_villages": sorted(f"{t}{v}" for t, v in unmatched)}
    payload = {"meta": meta, "v": out}
    p = OUT / "drill_extra.json"
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    with_sh = sum(1 for r in out.values() if r["sh"])
    print(f"villages={len(out)} with_listed_shelter={with_sh} edu_eq={n_edu} nfa_tp={n_nfa} weak={len(weak)} "
          f"weak_in_village={int(weak.village_code.notna().sum())} lanes={len(lanes)} "
          f"lane_d_max={lanes.d_m.max():.0f} lane_d_median={lanes.d_m.median():.0f} unmatched={sorted(unmatched)} "
          f"size_kb={p.stat().st_size / 1e3:.0f}")


if __name__ == "__main__":
    main()

"""Stage construction permit summaries (建造執照摘要, ROC 90 onward) and their land lots.

One row per permit, plus a long table of the land lots each permit covers.
Remarks (備註說明) are not kept as text; two flags are derived from them:
  * weilao_remark: mentions the dangerous-old-building act (危險及老舊 / 危老);
  * renewal_remark: mentions urban renewal (都市更新).
The lot key ("town_code|section|main lot") joins permits to the dangerous-old-building
list, which gives only lot numbers. `cp_key` (e.g. "101-0225") joins to use permits.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_construction_permits
Input:   data/raw/extra/permits/construction-permit-summary-historical/Taipei01_90-114.xml
         data/raw/extra/permits/construction-permit-summary-115/Taipei01-115.xml
         data/staged/base/house-number-coordinates.parquet
Output:  data/staged/permits/construction-permits.csv
         columns: permit_no, cp_key, issued_date (ISO), issued_year_ad, build_type, structure,
                  structure_class, floors_above, floors_below, units, buildings, site_area_m2,
                  work_cost, weilao_remark, renewal_remark, lot_n, address,
                  village_code, x, y (EPSG:3826), geo_level, geo_note, building_key
         data/staged/permits/construction-permit-lots.csv
         columns: permit_no, town_code, section, lot_main, lot_sub, lot_key
Network: no
"""

import re
import xml.etree.ElementTree as ET

import pandas as pd

from pipelines.address import TOWNS, Geocoder, match_report, normalize
from pipelines.common import RAW, STAGED
from pipelines.stage.stage_use_permits import roc7, structure_class

SRC = [RAW / "extra" / "permits" / "construction-permit-summary-historical" / "Taipei01_90-114.xml",
       RAW / "extra" / "permits" / "construction-permit-summary-115" / "Taipei01-115.xml"]
OUT = STAGED / "permits" / "construction-permits.csv"
OUT_LOTS = STAGED / "permits" / "construction-permit-lots.csv"
LOT_RE = re.compile(r"^(?:臺北市)?(\S{2}區)?(.+?段(?:.+?小段)?)(\d+)(?:-(\d+))?號?$")


def parse_lot(text, town_hint=None):
    """'臺北市文山區華興段四小段0191-0000號' -> (town_code, section, main, sub)."""
    # keep the first lot only: "598-1、602-1、603地號等3筆土地" -> "598-1"
    t = re.split(r"地號|、|等(?=\d|筆|土地)", normalize(text))[0]   # not the 等 in 平等段
    m = LOT_RE.match(t)
    if not m:
        return None
    town = TOWNS.get(m.group(1)) if m.group(1) else town_hint
    return town, m.group(2), int(m.group(3)), int(m.group(4) or 0)


def lot_key(town, section, main):
    return f"{town}|{section}|{main}"


def text(el, tag):
    x = el.find(tag)
    return x.text.strip() if x is not None and x.text else None


def main():
    rows, lots = [], []
    for path in SRC:
        for _, el in ET.iterparse(path, events=("end",)):
            if el.tag != "Data":
                continue
            no = text(el, "執照號碼")
            info = el.find("建物資訊")
            remarks = " ".join((x.text or "") for x in el.iter("備註說明"))
            lot_texts = [x.text for x in el.iter("地段號") if x.text]
            addr = next((x.text for x in el.iter("地址") if x.text), None)
            rows.append({
                "permit_no": no, "issued_roc": text(el, "發照日期"), "build_type": text(el, "建造類別"),
                "structure": text(el, "構造種類"),
                "floors_above": text(info, "地上層數") if info is not None else None,
                "floors_below": text(info, "地下層數") if info is not None else None,
                "units": text(info, "戶數") if info is not None else None,
                "buildings": text(info, "棟數") if info is not None else None,
                "site_area_m2": text(el, "其他基地面積"), "work_cost": text(el, "工程金額"),
                "weilao_remark": ("危險及老舊" in remarks) or ("危老" in remarks),
                "renewal_remark": "都市更新" in remarks,
                "lot_n": len(lot_texts), "address": addr,
            })
            for lt in lot_texts:
                p = parse_lot(lt)
                if p:
                    lots.append({"permit_no": no, "town_code": p[0], "section": p[1],
                                 "lot_main": p[2], "lot_sub": p[3], "lot_key": lot_key(p[0], p[1], p[2])})
            el.clear()
    d = pd.DataFrame(rows).drop_duplicates("permit_no")
    m = d["permit_no"].str.extract(r"^(\d{2,3})建字第(\d+)號")
    d["cp_key"] = m[0].str.zfill(3) + "-" + m[1].str.zfill(4)
    issued = d["issued_roc"].map(roc7)
    d["issued_date"] = issued.dt.strftime("%Y-%m-%d")
    d["issued_year_ad"] = issued.dt.year
    d["structure_class"] = d["structure"].map(lambda s: structure_class(s) if s else None)
    for c in ["floors_above", "floors_below", "units", "buildings", "site_area_m2", "work_cost"]:
        d[c] = pd.to_numeric(d[c], errors="coerce")
    d = Geocoder().locate_frame(d, "address")
    match_report(d, "construction-permits")
    lt = pd.DataFrame(lots).drop_duplicates(["permit_no", "lot_key", "lot_sub"])
    print(f"permits={len(d)} weilao_remark={d.weilao_remark.sum()} renewal_remark={d.renewal_remark.sum()} "
          f"lots={len(lt)} lot parse failures={d.lot_n.sum() - len(lt)}")
    cols = ["permit_no", "cp_key", "issued_date", "issued_year_ad", "build_type", "structure", "structure_class",
            "floors_above", "floors_below", "units", "buildings", "site_area_m2", "work_cost", "weilao_remark",
            "renewal_remark", "lot_n", "address", "village_code", "x", "y", "geo_level", "geo_note", "building_key"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    d[cols].to_csv(OUT, index=False, encoding="utf-8")
    lt.to_csv(OUT_LOTS, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

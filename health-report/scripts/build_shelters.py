"""Small shelter file for the health report: NFA shelters in Taipei marked 適合避難弱者 and 震災.

Same selection as rescue-drill-map/scripts/build_extra.py (nfa_weaker): Taipei rows of the
NFA Shelter.xml, de-duplicated by shelterId, adaptForWeaker == 是, disastertype contains 震災,
with TWD97 coordinates as in build_extra.py (119 sites on the 2026-10-23 download). Capacity is joined from the Education
Department list by name when the names match; otherwise null.

Only name, lon, lat, capacity are written. Contact names and phone numbers are never read:
the NFA file has no contact fields, and only the name and 容納人數 columns of the
Education Department list are read.

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/health-report/scripts/build_shelters.py
Input:   data/raw/extra/hazard/shelters-nfa/Shelter.xml
         data/raw/extra/hazard/shelters-taipei-edu/*.ods
Output:  research/issue-06/mvp-variants/health-report/data/shelters_weak.json (rewritten each run)
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

from pipelines.common import RAW  # noqa: E402

EXTRA = RAW / "extra" / "hazard"
OUT = HERE.parent / "data" / "shelters_weak.json"


def short(n):
    """Same shortening as rescue-drill-map/app.js shortName, plus 高工/高職 variants."""
    n = re.sub(r"^臺北市(立)?(\S{2}區)?", "", n or "")
    for a, b in [("國民小學", "國小"), ("國民中學", "國中"), ("高級中學", "高中"),
                 ("高級工業職業學校", "高工"), ("高級商業職業學校", "高商")]:
        n = n.replace(a, b)
    return n.strip()


def edu_capacity():
    """{short name: capacity} from the Education Department list; reads only two columns."""
    src = next((EXTRA / "shelters-taipei-edu").glob("*.ods"))
    ns = {"table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
          "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0"}
    t = "{%s}" % ns["table"]
    root = ET.fromstring(zipfile.ZipFile(src).read("content.xml"))
    sheet = next(root.iter(t + "table"))
    rows = []
    for r in sheet.iter(t + "table-row"):
        cells = []
        for c in r:
            n = min(int(c.get(t + "number-columns-repeated", "1")), 64)
            cells += ["\n".join("".join(p.itertext()) for p in c.findall("text:p", ns)).strip()] * n
        if any(cells):
            rows.append(cells)
    head = rows[0]
    i_name, i_cap = head.index("名稱(學校機關全銜)"), head.index("容納人數")
    cap = {}
    for r in rows[1:]:
        if len(r) > max(i_name, i_cap) and r[i_cap].isdigit():
            cap.setdefault(short(r[i_name]), int(r[i_cap]))
    return cap


def main():
    root = ET.parse(EXTRA / "shelters-nfa" / "Shelter.xml").getroot()
    keep = ("shelterId", "name", "lon", "lat", "twd97x", "adaptForWeaker", "disastertype", "county")
    seen, items = set(), []
    cap = edu_capacity()
    for e in root.iter("ShletersInfo"):
        if e.find("county") is None:
            continue
        r = {c.tag: (c.text or "").strip() for c in e if c.tag in keep}
        if r.get("county") != "臺北市" or r["shelterId"] in seen:
            continue
        seen.add(r["shelterId"])
        if r.get("adaptForWeaker") != "是" or "震災" not in r.get("disastertype", "") or not r.get("lon") or not r.get("twd97x"):
            continue
        nm = r["name"]
        c = cap.get(short(nm))
        if c is None:
            hits = [v for k, v in cap.items() if k and (k.endswith(nm) or nm.endswith(k))]
            c = hits[0] if len(hits) == 1 else None
        items.append({"name": nm, "lon": float(r["lon"]), "lat": float(r["lat"]), "cap": c})
    items.sort(key=lambda x: x["name"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    meta = {
        "generated": date.today().isoformat(),
        "source": "內政部消防署「避難收容處所」（data.gov.tw 12849，2026-10-23 下載）；臺北市依 shelterId 去重，適合避難弱者且災害類別含震災",
        "capacity": "容量依名稱對到教育局「臺北市可供避難收容處所一覽表」115-02-24 版的容納人數；對不到為 null",
        "n": len(items),
        "n_with_cap": sum(1 for x in items if x["cap"] is not None),
        "fields": ["name", "lon", "lat", "cap"],
    }
    with OUT.open("w", encoding="utf-8", newline="\n") as f:
        json.dump({"meta": meta, "items": items}, f, ensure_ascii=False, indent=0)
        f.write("\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(items)} sites, {meta['n_with_cap']} with capacity")


if __name__ == "__main__":
    main()

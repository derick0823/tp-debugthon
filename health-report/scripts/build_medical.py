"""Small medical-facility file for the health report: ER hospitals, hospitals, clinics and AEDs in Taipei.

Kinds:
  er_hospital  臺北市急救責任醫院名冊 (Department of Health)
  hospital     臺北市公私立醫院病床數統計 (every public and private hospital), minus the ER hospitals
  clinic       臺北市各項預防接種合約醫療院所名冊, minus names containing 醫院. This is a subset of all
               clinics (only those contracted for vaccination); there is no open full clinic list with
               addresses on data.taipei.
  aed          臺北市AED自動體外心臟去顫器設置地點 (has WGS84 lat/lon in the source)

Coordinates: AED rows use the source lat/lon. The three hospital/clinic lists have only an address;
it is matched offline with pipelines.address.Geocoder against the Taipei house-number table
(data/staged/base/house-number-coordinates.parquet, the same table that built
solutions/prototype/data/buildings/<town>.json). Accepted match levels: 1 exact doorplate,
2 nearest number on the same road/lane/alley, 3 lane majority. Level 4 (road majority) and
no-match rows are dropped and counted. No external geocoding service is used.

Written fields: kind, name, lon, lat, district, note. Phone numbers, contact or manager names and
addresses are never written (address is read only to geocode; a street address in brackets
in an AED place name is removed). AEDs at the same site and coordinates are merged into one item. note holds the AED placement
(e.g. "1樓大廳") or a short hint for approximate positions.

The geocode counts are also written into each source folder's _manifest.json under "geocode".

License: all four sources are 政府資料開放授權條款-第1版 (data.taipei metadata, checked 2026-10-24).
Attribution required: 臺北市政府衛生局, via 臺北市資料大平臺 (data.taipei).

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/health-report/scripts/build_medical.py
Input:   data/raw/extra/medical/{er-hospitals-taipei,hospital-beds-taipei,
         vaccination-contract-clinics-taipei,aed-locations-taipei}/*.csv (+ _manifest.json)
         data/staged/base/house-number-coordinates.parquet
Output:  research/issue-06/mvp-variants/health-report/data/medical.json (rewritten each run)
Network: no
"""

import csv
import io
import json
import re
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
sys.path.insert(0, str(ROOT))

from pyproj import Transformer  # noqa: E402

from pipelines.address import TOWN_NAMES, TOWNS, Geocoder, normalize  # noqa: E402
from pipelines.common import RAW  # noqa: E402

MED = RAW / "extra" / "medical"
OUT = HERE.parent / "data" / "medical.json"
TO_WGS = Transformer.from_crs("EPSG:3826", "EPSG:4326", always_xy=True)
OK_LEVELS = {1, 2, 3}
BARE_ADDR = re.compile(r"^[^\d]{1,8}(路|街|大道)(\d+段)?(\d+巷)?(\d+弄)?\d+(之\d+)?號.*$")


def read_csv(slug):
    """Rows of the single CSV in a source folder, as dicts. Big5 or UTF-8."""
    src = next((MED / slug).glob("*.csv"))
    raw = src.read_bytes()
    for enc in ("utf-8-sig", "cp950"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    rows = list(csv.DictReader(io.StringIO(text)))
    return [{(k or "").strip(): (v or "").strip() for k, v in r.items()} for r in rows]


def manifest(slug):
    return json.loads((MED / slug / "_manifest.json").read_text(encoding="utf-8"))


def first_address(addr):
    """Hospitals list several buildings ("A60號、B250號1至4樓"); keep the first."""
    a = normalize(addr)
    return re.split(r"[、;；]", a)[0]


def town_of(addr, code=""):
    if code in TOWN_NAMES:
        return code
    a = normalize(addr)
    for name, c in TOWNS.items():
        if name in a:
            return c
    return None


def short_name(n):
    return normalize(n).replace("(", "（").replace(")", "）")


def name_key(n):
    """Loose key for matching the ER list to the hospital list."""
    n = normalize(n)
    n = re.split(r"[-─–]", n)[0]
    n = re.sub(r"[（(].*?[)）]", "", n)
    n = re.sub(r"^.*(醫療財團法人|醫療社團法人|基金會)", "", n)
    for w in ("財團法人", "社團法人", "臺北市立", "臺北市", "附設", "附屬"):
        n = n.replace(w, "")
    return n


def strip_addr(n):
    """AED place names sometimes carry the street address in brackets; drop it."""
    return re.sub(r"[（(][^（()）]*(路|街|巷|號)[^（()）]*[)）]", "", n).strip()


class Locator:
    def __init__(self):
        self.gc = Geocoder()

    def __call__(self, addr, town_code):
        a = first_address(addr)
        hit = self.gc.locate(a, town_code)
        if hit["geo_level"] not in OK_LEVELS:
            return None, hit["geo_level"]
        lon, lat = TO_WGS.transform(hit["x"], hit["y"])
        return (round(lon, 5), round(lat, 5)), hit["geo_level"]


def geocode_list(rows, kind, name_col, addr_col, town_col, locate, note_fn=None):
    items, stats, missed = [], {1: 0, 2: 0, 3: 0}, []
    for r in rows:
        name = r.get(name_col, "")
        if not name:
            continue
        town = town_of(r.get(addr_col, ""), r.get(town_col, "") if town_col else "")
        if town is None:
            missed.append(name)
            continue
        pt, level = locate(r.get(addr_col, ""), town)
        if pt is None:
            missed.append(name)
            continue
        stats[level] += 1
        note = note_fn(r) if note_fn else ""
        if level == 3:
            note = (note + "；" if note else "") + "位置為同巷近似"
        items.append({"kind": kind, "name": short_name(name), "lon": pt[0], "lat": pt[1],
                      "district": TOWN_NAMES[town], "note": note, "_key": name_key(name)})
    return items, stats, missed


def write_geocode_note(slug, n_in, stats, missed, extra=""):
    m = manifest(slug)
    m["geocode"] = {
        "built_by": "research/issue-06/mvp-variants/health-report/scripts/build_medical.py",
        "built": date.today().isoformat(),
        "rows": n_in,
        "matched": {"exact": stats.get(1, 0), "nearest_number": stats.get(2, 0),
                    "lane_majority": stats.get(3, 0)},
        "unmatched": len(missed),
        "unmatched_names": missed,
        "note": ("座標由地址對門牌表（pipelines.address.Geocoder，離線）取得；只收 1 精確、2 同路巷弄最近門牌、"
                 "3 同巷多數；4 只對到路名與對不到的捨棄。" + extra),
    }
    (MED / slug / "_manifest.json").write_text(json.dumps(m, ensure_ascii=False, indent=1),
                                               encoding="utf-8", newline="\n")


def aed_items():
    rows = read_csv("aed-locations-taipei")
    items, bad, seen = [], 0, {}
    for r in rows:
        try:
            lat, lon = float(r["緯度"]), float(r["經度"])
        except (KeyError, ValueError):
            bad += 1
            continue
        if not (24.9 < lat < 25.3 and 121.4 < lon < 121.7):
            bad += 1
            continue
        code = r.get("區域代碼", "")
        district = TOWN_NAMES.get(code) or TOWN_NAMES.get(town_of(r.get("場所地址", "")) or "", "")
        place = r.get("AED放置地點", "")
        if BARE_ADDR.match(place):
            place = ""
        name = strip_addr(short_name(r.get("場所名稱", "")))
        if BARE_ADDR.match(name):  # the place name is only a street address
            name = r.get("場所類型") or "AED 設置點"
        key = (name, round(lon, 5), round(lat, 5))
        if key in seen:  # several AEDs at one site: one item, placements joined
            it = seen[key]
            if place and place not in it["note"] and len(it["note"]) < 40:
                it["note"] = (it["note"] + "、" + place)[:60]
            continue
        seen[key] = {"kind": "aed", "name": name, "lon": key[1], "lat": key[2],
                     "district": district, "note": place[:40]}
        items.append(seen[key])
    m = manifest("aed-locations-taipei")
    m["geocode"] = {"built_by": "research/issue-06/mvp-variants/health-report/scripts/build_medical.py",
                    "built": date.today().isoformat(), "rows": len(rows), "kept": len(items),
                    "dropped_bad_coords": bad,
                    "merged_same_site": len(rows) - bad - len(items),
                    "note": "座標用原檔緯度、經度欄（WGS84），不需門牌比對；超出臺北市範圍或空白的捨棄。"}
    (MED / "aed-locations-taipei" / "_manifest.json").write_text(
        json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    return items, len(rows), bad


def main():
    locate = Locator()

    er_rows = read_csv("er-hospitals-taipei")
    er, er_s, er_miss = geocode_list(er_rows, "er_hospital", "醫事機構名稱", "地址", "行政區", locate,
                                     lambda r: "急救責任醫院")
    write_geocode_note("er-hospitals-taipei", len(er_rows), er_s, er_miss)

    h_rows = read_csv("hospital-beds-taipei")
    hosp, h_s, h_miss = geocode_list(h_rows, "hospital", "機構名稱", "地址", None, locate)
    er_keys = {i["_key"] for i in er}
    n_dup = sum(i["_key"] in er_keys for i in hosp)
    hosp = [i for i in hosp if i["_key"] not in er_keys]
    write_geocode_note("hospital-beds-taipei", len(h_rows), h_s, h_miss,
                       f"與急救責任醫院同名的 {n_dup} 家只留在 er_hospital。")

    c_rows = [r for r in read_csv("vaccination-contract-clinics-taipei") if "醫院" not in r.get("院所名稱", "")]
    clin, c_s, c_miss = geocode_list(c_rows, "clinic", "院所名稱", "地址", "行政區", locate)
    write_geocode_note("vaccination-contract-clinics-taipei", len(c_rows), c_s, c_miss,
                       "名稱含「醫院」的列先排除（醫院用病床數名冊）。這份只是預防接種合約院所，不是全部診所。")

    aed, n_aed, aed_bad = aed_items()

    items = [{k: v for k, v in i.items() if k != "_key"} for i in er + hosp + clin + aed]
    sources = []
    for slug, kind in [("er-hospitals-taipei", "er_hospital"), ("hospital-beds-taipei", "hospital"),
                       ("vaccination-contract-clinics-taipei", "clinic"), ("aed-locations-taipei", "aed")]:
        m = manifest(slug)
        sources.append({"kind": kind, "title": m["title"], "agency": m["agency"],
                        "dataset_page": m["dataset_page"], "license": "政府資料開放授權條款-第1版",
                        "fetched": m["files"][0]["fetched_at"][:10],
                        "coords": "原檔經緯度" if kind == "aed" else "地址對門牌表（離線）"})
    counts = {k: sum(i["kind"] == k for i in items) for k in ("er_hospital", "hospital", "clinic", "aed")}
    out = {
        "version": date.today().isoformat(),
        "generated_by": "research/issue-06/mvp-variants/health-report/scripts/build_medical.py",
        "attribution": "資料來源：臺北市政府衛生局，臺北市資料大平臺（data.taipei），依政府資料開放授權條款第 1 版",
        "counts": counts,
        "unmatched": {"er_hospital": len(er_miss), "hospital": len(h_miss), "clinic": len(c_miss),
                      "aed_bad_coords": aed_bad},
        "fields": ["kind", "name", "lon", "lat", "district", "note"],
        "sources": sources,
        "items": items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")).replace('},{"kind"', '},\n{"kind"'),
                   encoding="utf-8", newline="\n")
    print(counts, out["unmatched"], f"{OUT.stat().st_size / 1024:.0f} KB")
    print("match levels er", er_s, "hosp", h_s, "clinic", c_s)
    print("unmatched er", er_miss, "\nhosp", h_miss, "\nclinic", c_miss[:20])


if __name__ == "__main__":
    main()

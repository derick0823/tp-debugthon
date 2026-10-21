"""Address parsing and geocoding against the Taipei house-number table.

Purpose:
    Shared helpers for stage scripts whose source has only an address.
    The geocoder looks up data/staged/base/house-number-coordinates.parquet,
    which pipelines.stage.stage_house_number_coordinates writes.

Usage (as a library):
    from pipelines.address import Geocoder, parse_address
    gc = Geocoder()
    hit = gc.locate("忠孝東路1段12號", town_code="63000050")

Input:   data/staged/base/house-number-coordinates.parquet
Output:  none (library)
Network: no

Match levels (column `geo_level` in every staged output that uses this):
    1 exact      town + road + lane + alley + base number
    2 nearest    same town + road + lane + alley, closest house number
    3 lane       same town + road + lane, majority village of that lane
    4 road       same town + road, majority village of that road (weak)
    0 none       no match

Rows at level 1 also get `building_key` (see building_key()), which joins them to
the building table data/marts/building_points.*.
"""

import re
import unicodedata

import pandas as pd

from pipelines.common import STAGED

HOUSE_NUMBERS = STAGED / "base" / "house-number-coordinates.parquet"

CN_DIGIT = {"零": 0, "〇": 0, "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4,
            "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}

TOWNS = {
    "松山區": "63000010", "信義區": "63000020", "大安區": "63000030",
    "中山區": "63000040", "中正區": "63000050", "大同區": "63000060",
    "萬華區": "63000070", "文山區": "63000080", "南港區": "63000090",
    "內湖區": "63000100", "士林區": "63000110", "北投區": "63000120",
}
TOWN_NAMES = {v: k for k, v in TOWNS.items()}
# Postal codes used by earthquake-listed-buildings ("行政區代碼（編碼）")
POSTAL_TO_TOWN = {
    "100": "63000050", "103": "63000060", "104": "63000040", "105": "63000010",
    "106": "63000030", "108": "63000070", "110": "63000020", "111": "63000110",
    "112": "63000120", "114": "63000100", "115": "63000090", "116": "63000080",
}


def cn_to_int(s):
    """Convert a Chinese numeral up to 99 ("十二", "二十三") to int."""
    if s.isdigit():
        return int(s)
    if "十" in s:
        a, _, b = s.partition("十")
        tens = CN_DIGIT.get(a, 1) if a else 1
        ones = CN_DIGIT.get(b, 0) if b else 0
        return tens * 10 + ones
    return CN_DIGIT[s] if s in CN_DIGIT else None


def normalize(text):
    """Half-width digits, unify 台/臺, Chinese section numbers to Arabic, drop spaces."""
    if text is None or (isinstance(text, float) and pd.isna(text)):
        return ""
    t = unicodedata.normalize("NFKC", str(text))
    t = t.translate(VARIANTS)
    t = t.replace("台北市", "臺北市").replace("台", "臺")
    t = re.sub(r"\s+", "", t)
    t = t.replace("－", "-").replace("~", "～")
    t = re.sub(r"([一二三四五六七八九十]+)段",
               lambda m: f"{cn_to_int(m.group(1))}段", t)
    return t


SEP = r"[、,及和與～~至到-]"
ADDR_RE = re.compile(
    rf"^(?:(?P<lane>\d+)(?:{SEP}\d+)*巷)?"
    rf"(?:(?P<alley>\d+)(?:{SEP}\d+)*弄)?"
    rf"(?:(?P<no>\d+)(?:之(?P<sub>\d+))?(?:{SEP}\d+(?:之\d+)?)*號)?"
)
# variant characters seen in source lists
# "㇐" (U+31D0, a CJK stroke) comes from PDF text extraction in place of "一".
# The house-number table writes 公舘路; other lists write 公館路. Both sides go through
# normalize(), so mapping 舘 -> 館 makes them meet.
VARIANTS = str.maketrans({"褔": "福", "峯": "峰", "陞": "升", "濬": "浚", "嵋": "眉",
                          "㇐": "一", "舘": "館"})


def strip_admin(t):
    """Remove city, district, village and neighbourhood prefixes. Returns (rest, town_code)."""
    town = None
    t = re.sub(r"^\d{3,6}", "", t)  # postal code
    t = re.sub(r"^臺北市", "", t)
    for name, code in TOWNS.items():
        if t.startswith(name):
            town, t = code, t[len(name):]
            break
    return t, town


def building_key(town_code, road, lane, alley, no):
    """One key per house-number building (all floors of one base number).

    Only geo_level 1 rows carry it: a nearest-number match is a different building.
    """
    return f"{town_code}|{road}|{lane}|{alley}|{int(no)}"


def strip_village(t):
    """Remove a leading village name and neighbourhood number, for a second try."""
    t = re.sub(r"^[^路街道巷號\d]{1,3}里", "", t)
    return re.sub(r"^\d+鄰", "", t)


class Geocoder:
    """Match an address string to the house-number table."""

    def __init__(self, path=HOUSE_NUMBERS):
        hn = pd.read_parquet(path)
        # one row per building (base number), unit count kept separately
        self.b = (hn.groupby(["town_code", "road", "lane", "alley", "no"], dropna=False)
                    .agg(village_code=("village_code", lambda s: s.mode().iat[0]),
                         x=("x", "mean"), y=("y", "mean"))
                    .reset_index())
        self.exact = {
            (r.town_code, r.road, r.lane, r.alley, r.no): (r.village_code, r.x, r.y)
            for r in self.b.itertuples(index=False)
        }
        self.by_alley = {k: g for k, g in self.b.groupby(["town_code", "road", "lane", "alley"], dropna=False)}
        self.lane_major = self._major(["town_code", "road", "lane"])
        self.road_major = self._major(["town_code", "road"])
        self.roads = {}
        for town, g in self.b.groupby("town_code"):
            self.roads[town] = sorted(g["road"].unique(), key=len, reverse=True)
        self.all_roads = sorted(self.b["road"].unique(), key=len, reverse=True)
        self.road_towns = self.b.groupby("road")["town_code"].agg(lambda s: s.mode().iat[0]).to_dict()
        self.b["road_base"] = self.b["road"].str.replace(r"\d+段$", "", regex=True)
        self.base_major = self._major(["town_code", "road_base"])
        self.base_roads = {t: sorted(g["road_base"].unique(), key=len, reverse=True)
                           for t, g in self.b.groupby("town_code")}

    def _major(self, keys):
        g = self.b.groupby(keys + ["village_code"], dropna=False).size().rename("n").reset_index()
        tot = g.groupby(keys, dropna=False)["n"].transform("sum")
        g["share"] = g["n"] / tot
        g = g.sort_values("n", ascending=False).drop_duplicates(keys)
        xy = self.b.groupby(keys, dropna=False)[["x", "y"]].mean().reset_index()
        g = g.merge(xy, on=keys, how="left")
        return {tuple(r[k] for k in keys): (r["village_code"], r["x"], r["y"], r["share"])
                for _, r in g.iterrows()}

    def parse(self, address, town_code=None):
        """Return dict(town_code, road, lane, alley, no) or None when no road matches."""
        t = normalize(address)
        t, town = strip_admin(t)
        town = town_code or town
        candidates = self.roads.get(town, self.all_roads) if town else self.all_roads
        road = next((r for r in candidates if t.startswith(r)), None)
        if road is None:
            t = strip_village(t)
            road = next((r for r in candidates if t.startswith(r)), None)
        if road is None and town and t.startswith(TOWN_NAMES[town][:-1]):
            # district written without 區, e.g. "臺北市大同長安西路"
            t2 = t[len(TOWN_NAMES[town]) - 1:]
            road = next((r for r in candidates if t2.startswith(r)), None)
            t = t2 if road else t
        note = ""
        if road is None and town:
            road = next((r for r in self.all_roads if t.startswith(r)), None)
            if road is not None:
                note, town = "road in other town", self.road_towns.get(road)
        if road is None:
            # road written without its section, e.g. "忠孝東路、復興南路口"
            base = next((b for b in self.base_roads.get(town, []) if t.startswith(b)), None) if town else None
            if base is None:
                return None
            return {"town_code": town, "road": None, "road_base": base, "lane": "", "alley": "",
                    "no": None, "note": "road without section"}
        if town is None:
            town = self.road_towns.get(road)
        rest = t[len(road):]
        m = ADDR_RE.match(rest)
        lane = f"{int(m.group('lane'))}" if m and m.group("lane") else ""
        alley = f"{int(m.group('alley'))}" if m and m.group("alley") else ""
        no = int(m.group("no")) if m and m.group("no") else None
        return {"town_code": town, "road": road, "lane": lane, "alley": alley, "no": no, "note": note}

    def locate(self, address, town_code=None):
        """Return dict with village_code, x, y (EPSG:3826), geo_level, geo_note."""
        p = self.parse(address, town_code)
        out = {"village_code": None, "x": None, "y": None, "geo_level": 0, "geo_note": "no road"}
        if p is None:
            return out
        if p["road"] is None:
            hit = self.base_major.get((p["town_code"], p["road_base"]))
            if hit:
                return {"village_code": hit[0], "x": hit[1], "y": hit[2], "geo_level": 4,
                        "geo_note": f"road without section, majority {hit[3]:.2f}"}
            return out
        key = (p["town_code"], p["road"], p["lane"], p["alley"])
        if p["no"] is not None:
            hit = self.exact.get(key + (p["no"],))
            if hit:
                return {"village_code": hit[0], "x": hit[1], "y": hit[2], "geo_level": 1,
                        "geo_note": ("exact; " + p["note"]).strip("; "),
                        "building_key": building_key(*key, p["no"])}
            g = self.by_alley.get(key)
            if g is not None and g["no"].notna().any():
                d = (g["no"] - p["no"]).abs()
                # prefer the same side of the street (same parity)
                d = d + ((g["no"] % 2) != (p["no"] % 2)) * 0.5
                r = g.loc[d.idxmin()]
                return {"village_code": r.village_code, "x": r.x, "y": r.y, "geo_level": 2,
                        "geo_note": f"nearest no {int(r.no)}"}
        if p["lane"]:
            hit = self.lane_major.get((p["town_code"], p["road"], p["lane"]))
            if hit:
                return {"village_code": hit[0], "x": hit[1], "y": hit[2], "geo_level": 3,
                        "geo_note": f"lane majority {hit[3]:.2f}"}
        hit = self.road_major.get((p["town_code"], p["road"]))
        if hit:
            return {"village_code": hit[0], "x": hit[1], "y": hit[2], "geo_level": 4,
                    "geo_note": f"road majority {hit[3]:.2f}"}
        out["geo_note"] = "road not in town"
        return out

    def locate_frame(self, df, address_col, town_col=None):
        """Apply locate() to a DataFrame. Returns the frame with geo columns appended."""
        rows = [self.locate(a, (t if town_col else None))
                for a, t in zip(df[address_col], df[town_col] if town_col else [None] * len(df))]
        geo = pd.DataFrame(rows, index=df.index)
        return pd.concat([df, geo], axis=1)


def match_report(df, name):
    """Print and return the share of rows at each geo_level."""
    vc = df["geo_level"].value_counts().sort_index()
    share = (vc / len(df)).round(4)
    print(f"[{name}] n={len(df)} geo_level counts: {vc.to_dict()} share: {share.to_dict()}")
    return vc

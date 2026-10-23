"""Read the shot table of a video script (Markdown) by column name, for tts.py and build_timeline.py.

The table is the first one whose header row has a column starting with "配音".
Column order does not matter. Known columns (by header prefix):
  "#"      beat number (rows whose first cell is not a number are skipped)
  "配音"   narration, one or more sentences
  "錄影名" recording name under video/recordings/; "—", "-" or empty = no recording
  "角色"   role badge text
  "標籤"   step label; falls back to "段落" when there is no "標籤" column
  "秒"     planned interval such as "0–15", returned as span (start, end) in seconds, or None
Missing columns give "" (or None for the recording).

read_meta() reads the title and outro texts for the video, from either
  front matter at the top of the file:        or a two-column table (key | value) anywhere:
    ---                                          | 項目 | 值 |
    title: 描述：壞 prompt 改成好任務書            | 堂名 | 描述：壞 prompt 改成好任務書 |
    kicker: 公務 AI 減壓課・L02                   | 副標 | 公務 AI 減壓課・L02 |
    outro_lines: 下載任務書；明天就用              | 片尾句 | 下載任務書；明天就用 |
    outro_cards: 📝 任務書範本；💊 處方卡          | 片尾卡 | 📝 任務書範本；💊 處方卡 |
    ---
Lists are split on "；" or ";". A card is "<icon> <label>". Front matter wins over the table.
"""

import re
from pathlib import Path

SPAN = re.compile(r"\s*(\d+(?:\.\d+)?)\s*[–—\-～~]\s*(\d+(?:\.\d+)?)")  # "0–15" in the 秒 column
NO_REC = {"", "—", "-", "–", "（無）"}
META_KEYS = {"title": "title", "堂名": "title", "kicker": "kicker", "副標": "kicker",
             "outro_lines": "outro_lines", "片尾句": "outro_lines", "outro_cards": "outro_cards", "片尾卡": "outro_cards"}


def _cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def read_beats(path: Path):
    """Return [{beat, voice, rec, role, label}] in table order."""
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    beats, header = [], None
    for line in lines:
        if not line.strip().startswith("|"):
            if beats:
                break  # end of the shot table
            header = None  # a table without narration rows ended; look for the next one
            continue
        cells = _cells(line)
        if header is None:
            if any(c.startswith("配音") for c in cells):
                header = cells
            continue
        if set("".join(cells)) <= set("-: "):
            continue  # the |---|---| row
        col = {name: i for i, name in enumerate(header)}

        def get(prefix):
            for name, i in col.items():
                if name.startswith(prefix) and i < len(cells):
                    return cells[i]
            return ""

        if not cells[0].isdigit():
            continue
        rec = get("錄影名")
        m = SPAN.match(get("秒"))
        beats.append({"beat": int(cells[0]), "voice": get("配音"), "rec": None if rec in NO_REC else rec,
                      "role": get("角色"), "label": get("標籤") or get("段落"),
                      "span": (float(m[1]), float(m[2])) if m else None})
    return beats


def _split(v):
    return [x.strip() for x in v.replace(";", "；").split("；") if x.strip()]


def read_meta(path: Path):
    """Return {"title": {...}, "outro": {...}} with only the parts the script gives (may be {})."""
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    raw = {}
    for line in lines:  # two-column key | value tables
        cells = _cells(line) if line.strip().startswith("|") else []
        if len(cells) == 2 and cells[0] in META_KEYS and cells[1]:
            raw.setdefault(META_KEYS[cells[0]], cells[1])
    if lines and lines[0].strip() == "---":  # front matter wins
        cur, started = None, set()  # current key; keys whose YAML list has begun
        for line in lines[1:]:
            if line.strip() == "---":
                break
            if cur and re.match(r"\s*- ", line):  # YAML list item: joined with "；" like a one-line value
                item = re.sub(r"^\s*- ", "", line).strip()
                raw[cur] = item if cur not in started else raw[cur] + "；" + item
                started.add(cur)
                continue
            key, sep, value = line.partition(":")
            cur = META_KEYS.get(key.strip()) if sep and not line.startswith((" ", "	")) else None
            if cur and value.strip():
                raw[cur] = value.strip()
    meta = {}
    title = {k: raw[k] for k in ("title", "kicker") if k in raw}
    if title:
        meta["title"] = title
    outro = {}
    if "outro_lines" in raw:
        outro["lines"] = _split(raw["outro_lines"])
    if "outro_cards" in raw:
        outro["cards"] = [dict(zip(("icon", "label"), c.split(None, 1))) if " " in c else {"label": c}
                          for c in _split(raw["outro_cards"])]
    if outro:
        meta["outro"] = outro
    return meta

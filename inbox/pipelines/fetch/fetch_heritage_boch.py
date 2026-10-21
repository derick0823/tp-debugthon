"""Fetch the national cultural heritage case lists (文化部文化資產局 open data v2), with coordinates.

The Taipei list on data.gov.tw (121275) has no location. The national lists do:
each case has latitude, longitude and addresses. One JSON file per category:
assetsCase/1.1.json (古蹟), 1.2 (歷史建築), and further 1.x codes when they exist.
Codes 1.1 .. 1.9 are tried one at a time, 5 seconds apart; a code that does not
return a JSON list is recorded as missing.

Source pages: https://data.gov.tw/dataset/6246 (古蹟), https://data.gov.tw/dataset/6965 (歷史建築),
API docs: https://data.boch.gov.tw/swagger-ui/4.18.2/index.html?urls.primaryName=OpendataApi_v2
Licence: 政府資料開放授權條款第 1 版 (data.gov.tw pages).

Usage:   uv run python -X utf8 -m pipelines.fetch.fetch_heritage_boch
Input:   network
Output:  data/raw/extra/land/cultural-heritage-boch/assetsCase-<code>.json (as downloaded)
         data/raw/extra/land/cultural-heritage-boch/_manifest.json
Network: yes
"""

import hashlib
import json
import subprocess
import time
from datetime import datetime, timedelta, timezone

from pipelines.common import RAW

OUT = RAW / "extra" / "land" / "cultural-heritage-boch"
URL = "https://data.boch.gov.tw/opendata/v2/assetsCase/{code}.json"
CODES = [f"1.{i}" for i in range(1, 10)]
WAIT_S = 5
TZ = timezone(timedelta(hours=8))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = []
    for i, code in enumerate(CODES):
        if i:
            time.sleep(WAIT_S)
        path = OUT / f"assetsCase-{code}.json"
        url = URL.format(code=code)
        r = subprocess.run(["curl", "-s", "-A", "Mozilla/5.0", "-o", str(path), "-w", "%{http_code}", url],
                           capture_output=True, text=True)
        status, n = "missing", None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list) and data:
                status, n = "ok", len(data)
        except (OSError, ValueError):
            pass
        entry = {"code": code, "url": url, "http_code": r.stdout.strip(), "status": status, "cases": n,
                 "fetched_at": datetime.now(TZ).isoformat(timespec="seconds")}
        if status == "ok":
            b = path.read_bytes()
            entry.update({"file": path.name, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()})
        else:
            path.unlink(missing_ok=True)
        files.append(entry)
        print(code, status, n)
    (OUT / "_manifest.json").write_text(json.dumps({"slug": "cultural-heritage-boch", "files": files},
                                                   ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

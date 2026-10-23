"""Verify every cited sentence in gov-reports/report.md against the cited PDF pages with the Claude API.

Usage:  python -X utf8 research/issue-06/gov-reports/verify/check_report_with_api.py [--model claude-opus-5-5]
Input:  ../report.md; PDFs in data/raw/extra/research/fulltext/ (grb-*-<id>-*.pdf); ~/.config/anthropic/.env
Output: api-r3.json (this folder); ledger lines in ~/.config/anthropic/usage/YYYY-MM.jsonl
A citation looks like 【文件，12407597 p.86】 or 【文件，1248828 p.5～6；3083548 p.8】. The sentence is the text
from the previous sentence end (。 or line start) up to the citation. Pages are PDF page order; ±1 page is sent.
"""
from __future__ import annotations

import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import anthropic
import pymupdf

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
FULLTEXT = REPO / "data/raw/extra/research/fulltext"
LEDGER = Path.home() / ".config/anthropic/usage"
MODEL = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else "claude-opus-5-5"
RUN = uuid.uuid4().hex[:8]
CITE = re.compile(r"【文件，([^】]+)】")
REF = re.compile(r"(\d{6,8})\s*p\.(\d+)(?:[～~-](\d+))?")
_cache: dict[str, list[str]] = {}


def env() -> dict:
    out = {}
    for line in (Path.home() / ".config/anthropic/.env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def pdf_pages(gid: str) -> list[str]:
    if gid not in _cache:
        files = sorted(FULLTEXT.glob(f"grb-*-{gid}-*.pdf"))
        _cache[gid] = []
        for f in files[:1]:
            with pymupdf.open(f) as d:
                _cache[gid] = [p.get_text() for p in d]
    return _cache[gid]


def citations(md: str):
    for line_no, line in enumerate(md.splitlines(), 1):
        for m in CITE.finditer(line):
            start = max(line.rfind("。", 0, m.start()) + 1, 0)
            sentence = re.sub(r"^(\s|\||\*|-|\d+\.\s)+", "", line[start:m.start()]).strip()
            refs = [(g, int(a), int(b or a)) for g, a, b in REF.findall(m.group(1))]
            if sentence and refs:
                yield line_no, sentence, refs, m.group(0)


def main():
    e = env()
    client = anthropic.Anthropic(api_key=e["ANTHROPIC_API_KEY"], default_headers={"anthropic-workspace-id": e["ANTHROPIC_WORKSPACE_ID"]})
    md = (HERE.parent / "report.md").read_text(encoding="utf-8")
    out = []
    for n, (line_no, sentence, refs, tag) in enumerate(citations(md), 1):
        parts, missing = [], []
        for gid, a, b in refs:
            pages = pdf_pages(gid)
            if not pages:
                missing.append(gid)
                continue
            for i in range(max(a - 2, 0), min(b + 1, len(pages))):
                parts.append(f"=== GRB {gid} PDF 第 {i + 1} 頁 ===\n{pages[i]}")
        if parts and all(len(re.sub(r"=== .* ===|\s", "", x)) < 80 for x in parts):
            out.append({"n": n, "line": line_no, "sentence": sentence, "cite": tag, "verdict": "掃描檔未查",
                        "problems": "引用頁沒有文字層（掃描檔），API 無法查；交給 session 看圖查核"})
            print(n, "掃描檔未查", flush=True)
            continue
        if not parts:
            out.append({"n": n, "line": line_no, "sentence": sentence, "cite": tag, "verdict": "無原文檔", "problems": f"找不到 PDF：{missing}"})
            print(n, "無原文檔", missing, flush=True)
            continue
        prompt = ("你是事實查核員。下面是臺灣政府研究報告的原文節錄，與別人根據它寫的一句話。只根據原文判斷這句話對不對，不要用你自己的知識。"
                  "數字、年份、比較對象、樣本範圍要逐一核對；也檢查是不是把研究計畫的預期、文獻回顧引用的別人說法、或參考文獻標題當成這份研究的發現。\n\n"
                  f"【句子】{sentence} {tag}\n\n【原文】\n" + "\n".join(parts)[:50000] +
                  "\n\n只回一個 JSON 物件，鍵：verdict（正確／部分正確／錯誤／原文找不到）、quote（逐字原文，最多 200 字）、page（頁碼）、"
                  "problems（哪裡不對；正確寫「無」）、suggested_wording（更貼近原文的寫法）。")
        m = client.messages.create(model=MODEL, max_tokens=1500, messages=[{"role": "user", "content": prompt}])
        text = "".join(b.text for b in m.content if b.type == "text")
        try:
            v = json.loads(text[text.find("{"): text.rfind("}") + 1])
        except json.JSONDecodeError:
            v = {"verdict": "解析失敗", "problems": text[:300]}
        out.append({"n": n, "line": line_no, "sentence": sentence, "cite": tag, **v})
        LEDGER.mkdir(parents=True, exist_ok=True)
        with open(LEDGER / f"{datetime.now(timezone.utc):%Y-%m}.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({"ts": datetime.now(timezone.utc).isoformat(), "project": "市政debug松", "purpose": "verify-r3-report",
                                "run_id": RUN, "uid": f"line{line_no}", "model": MODEL,
                                "tokens": {"in": m.usage.input_tokens, "out": m.usage.output_tokens}, "ok": True}, ensure_ascii=False) + "\n")
        print(n, v.get("verdict"), "|", str(v.get("problems", ""))[:70], flush=True)
    (HERE / "api-r3.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

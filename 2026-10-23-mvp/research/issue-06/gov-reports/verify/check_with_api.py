"""Verify each claim in claims.json against the source text with the Claude API (independent of the session that wrote the claims).

Usage:  python -X utf8 research/issue-06/gov-reports/verify/check_with_api.py [--model claude-opus-5-5]
Input:  claims.json (this folder); full-text PDFs in data/raw/extra/research/fulltext/grb-*-<id>-grb1.pdf;
        abstracts from data/staged/grb/grb_list.csv; key and workspace id from ~/.config/anthropic/.env
Output: api-verdicts.json (this folder); one ledger line per call in ~/.config/anthropic/usage/YYYY-MM.jsonl
Needs:  system Python with anthropic and pymupdf (pip install pymupdf if missing).
"""
from __future__ import annotations

import csv
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import anthropic

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
FULLTEXT = REPO / "data/raw/extra/research/fulltext"
LEDGER = Path.home() / ".config/anthropic/usage"
MODEL = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else "claude-opus-5-5"
RUN = uuid.uuid4().hex[:8]


def env() -> dict:
    out = {}
    for line in (Path.home() / ".config/anthropic/.env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def pages_text(grb: str) -> list[str]:
    import pymupdf
    pdf = next(FULLTEXT.glob(f"grb-*-{grb}-grb1.pdf"))
    with pymupdf.open(pdf) as d:
        return [p.get_text() for p in d]


def abstract(grb: str) -> str:
    for r in csv.DictReader(open(REPO / "data/staged/grb/grb_list.csv", encoding="utf-8-sig")):
        if r["GRB系統id"] == grb:
            return f"計畫名稱：{r['計畫名稱']}\n報告中文摘要：{r['報告中文摘要']}\n計畫中文摘要：{r['計畫中文摘要']}"
    return ""


def source_for(c: dict) -> str:
    sel = c["pages"]
    if sel == "abstract":
        return abstract(c["grb"])
    pages = pages_text(c["grb"])
    if isinstance(sel, str) and sel.startswith("search:"):
        pat = re.compile(sel[7:])
        idx = sorted({j for i, p in enumerate(pages) if pat.search(p) for j in (i - 1, i, i + 1) if 0 <= j < len(pages)})[:10]
    else:
        idx = [p - 1 for p in sel if 0 < p <= len(pages)]
    return "\n".join(f"=== PDF 第 {i + 1} 頁 ===\n{pages[i]}" for i in idx)


SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["正確", "部分正確", "錯誤", "原文找不到"]},
        "quote": {"type": "string", "description": "支持或反駁的原文，逐字，最多 200 字"},
        "page": {"type": "string"},
        "problems": {"type": "string", "description": "哪裡不對或誇大；正確就寫「無」"},
        "suggested_wording": {"type": "string", "description": "更貼近原文的寫法"},
    },
    "required": ["verdict", "quote", "page", "problems", "suggested_wording"],
}


def main():
    e = env()
    client = anthropic.Anthropic(api_key=e["ANTHROPIC_API_KEY"], default_headers={"anthropic-workspace-id": e["ANTHROPIC_WORKSPACE_ID"]})
    claims = json.loads((HERE / "claims.json").read_text(encoding="utf-8"))
    out = []
    for c in claims:
        src = source_for(c)
        prompt = (f"你是事實查核員。下面是一份臺灣政府研究報告（GRB {c['grb']}）的原文節錄，與一句別人寫的主張。"
                  "只根據原文判斷主張對不對，不要用你自己的知識。數字、年份、比較對象要逐一核對。原文沒寫的就說原文找不到。\n\n"
                  f"【主張 {c['id']}】{c['claim']}\n\n【原文】\n{src[:60000]}")
        prompt += ("\n\n只回一個 JSON 物件，不要其他文字，鍵：verdict（正確／部分正確／錯誤／原文找不到）、quote（逐字原文，最多 200 字）、"
                   "page（PDF 頁碼）、problems（哪裡不對；正確寫「無」）、suggested_wording（更貼近原文的寫法）。")
        m = client.messages.create(model=MODEL, max_tokens=2000, messages=[{"role": "user", "content": prompt}])
        text = "".join(b.text for b in m.content if b.type == "text")
        v = json.loads(text[text.find("{"): text.rfind("}") + 1])
        out.append({"id": c["id"], "grb": c["grb"], **v})
        LEDGER.mkdir(parents=True, exist_ok=True)
        with open(LEDGER / f"{datetime.now(timezone.utc):%Y-%m}.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({"ts": datetime.now(timezone.utc).isoformat(), "project": "市政debug松", "purpose": "verify-grb-claims",
                                "run_id": RUN, "uid": c["id"], "model": MODEL, "tokens": {"in": m.usage.input_tokens, "out": m.usage.output_tokens},
                                "ok": True}, ensure_ascii=False) + "\n")
        print(c["id"], v["verdict"], "|", v["problems"][:80], flush=True)
    (HERE / "api-verdicts.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

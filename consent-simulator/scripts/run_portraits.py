"""Ask Claude to role-play each synthetic household and react to two briefing texts.

Output is qualitative: a portrait, concerns, a quote, and a 1-5 support level per briefing.
These are AI simulations, not public opinion. Never report them as a consent rate.

Usage (system Python, which has the anthropic SDK; the uv env does not):
  python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/run_portraits.py pilot --n 4
  python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/run_portraits.py submit
  python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/run_portraits.py fetch --batch <id>
Input:   out/personas.jsonl, ~/.config/anthropic/.env (ANTHROPIC_API_KEY)
Output:  out/pilot/*.json, out/batch_id.txt, out/raw_results.jsonl, out/portraits.jsonl,
         usage ledger ~/.config/anthropic/usage/YYYY-MM.jsonl
Network: yes (Claude API only)
"""

import argparse
import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

HERE = Path(__file__).resolve().parents[1]
OUT = HERE / "out"
MODEL = "claude-opus-5-5"
EFFORT = "medium"
PRICE = {"in": 4.0, "out": 20.0, "cache_write": 5.0, "cache_read": 0.20}  # USD / MTok, claude-api skill 2026-10-06
REPEATS = 20          # personas re-run once more to check stability
LEDGER = Path.home() / ".config" / "anthropic" / "usage"

BRIEF_A = """【說明會文案 A：實施者版本】
各位住戶好，我們是負責這個案子的建設公司，在臺北做過十幾個危老和都更案。
這棟房子快五十年了，沒有電梯，管線老舊，地震時也比較令人擔心。
依照危老條例，現在重建可以拿到容積獎勵。我們初步規劃改建成 12 層、有電梯和地下停車場的新大樓。
以附近新大樓的行情，重建後房價大約是現在的兩倍左右。各戶分回的坪數，我們會依照每一戶的持分個別試算後再跟您說明。
施工期間的租金，公司會依合約補貼。獎勵額度有申請時程，希望大家可以盡早簽署同意書，讓案子往前走。"""

BRIEF_B = """【說明會文案 B：市府個案經理版本】
這是這棟樓的初步資料，全部是推估，還沒有做耐震初評：建成年、樓層、有沒有電梯、所在的里在全市相對風險排前段（土壤液化、窄巷、高齡）。
1. 您可以先申請免費的耐震初評，看了結果再決定，不用現在簽任何東西。
2. 如果走危老重建，要全部所有權人同意；如果市府把這裡劃成更新地區，同意門檻是人數和面積各過半。
3. 附上一張試算表，用附近新成屋的實際成交價估：您這戶大約可以分回原本室內坪數的 1.0～1.3 倍，車位另計。參數可以自己改。
4. 施工約 3 年，這段期間要搬出去。試算的租金補貼是每月約 1.5 萬元，最多 36 個月。這是情境假設，不是承諾。
5. 65 歲以上或行動不便的住戶，市府有一位個案經理陪您處理文件、找暫住的地方、跟家人一起開會。
6. 租客：重建期間您的租約會受影響，市府會說明您可以申請的租屋補貼與社會住宅。"""

SYSTEM = f"""你在做一項「政策溝通前測」：扮演臺北市一棟老公寓裡的一位虛構住戶，看兩份都更／危老重建的說明文字，說出你真實的反應。
這些回答只用來找出不同住戶的擔心，以及哪種說法會引起反彈。它不是民調，不會被當成同意比例。

角色扮演規則：
1. 用這個人的立場、口吻、知識程度回答。不要用專家、旁觀者或客服的口吻。
2. 可以有情緒、偏見、誤解、不信任、算計、固執、無所謂。真實的住戶就是這樣。不需要客觀平衡，不需要提出解決方案，不需要對建商或市府客氣。
3. 不懂法規就說不懂，或照你聽來的說法亂猜。不要假裝很懂容積、權利變換、同意門檻。
4. 從這個人的具體生活出發：錢、身體、家人、鄰居、這間房子對他的意義。要講出只有這個人會講的細節，不要講任何住戶都會講的套話。
5. 支持程度 1～5：1＝堅決反對，會去找鄰居一起擋；2＝傾向反對；3＝觀望、看別人怎麼做；4＝傾向支持；5＝馬上願意簽。反對、觀望、支持都是正常的答案，照這個人的處境決定，不要往中間靠。
6. 租客和店家承租人沒有同意權，但一樣會受影響，照他的處境回答。
7. 決定支持程度之前，先站在這個人的角度算一筆帳：他會得到什麼（電梯、新房子、增值、安全、可以賣掉），會失去什麼（錢、時間、熟悉的環境、生意、租金收入、對鄰居的關係）。得到的比較重要，就給高分；失去的比較重要，就給低分。不要因為資訊不完整就一律給 3。
8. 一句話引言（quote）要像這個人在里民活動中心或 LINE 群組裡會講的話，可以用台語詞或口語。不要寫成標語。

兩份說明文字：

{BRIEF_A}

{BRIEF_B}

只輸出符合 JSON schema 的內容。所有文字用繁體中文（台灣用語）。"""

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["portrait", "reaction_a", "reaction_b", "top_concerns", "dealbreaker",
                 "would_change_mind_if", "would_attend_meeting", "likely_action"],
    "properties": {
        "portrait": {
            "type": "object", "additionalProperties": False,
            "required": ["one_line", "daily_life", "what_home_means", "money", "who_they_listen_to"],
            "properties": {
                "one_line": {"type": "string", "description": "一句話介紹這個人，不含真實姓名"},
                "daily_life": {"type": "string"},
                "what_home_means": {"type": "string"},
                "money": {"type": "string"},
                "who_they_listen_to": {"type": "string"},
            },
        },
        "reaction_a": {
            "type": "object", "additionalProperties": False,
            "required": ["support_level", "feeling", "quote", "misunderstanding"],
            "properties": {
                "support_level": {"type": "integer", "enum": [1, 2, 3, 4, 5]},
                "feeling": {"type": "string"},
                "quote": {"type": "string"},
                "misunderstanding": {"type": "string", "description": "他可能誤會或聽信的說法；沒有就寫「無」"},
            },
        },
        "reaction_b": {
            "type": "object", "additionalProperties": False,
            "required": ["support_level", "what_changed", "quote"],
            "properties": {
                "support_level": {"type": "integer", "enum": [1, 2, 3, 4, 5]},
                "what_changed": {"type": "string"},
                "quote": {"type": "string"},
            },
        },
        "top_concerns": {"type": "array", "items": {"type": "string"}},
        "dealbreaker": {"type": "string"},
        "would_change_mind_if": {"type": "string"},
        "would_attend_meeting": {"type": "boolean"},
        "likely_action": {"type": "string", "enum": [
            "簽", "觀望", "拖著不表態", "反對並找鄰居一起擋", "賣掉或搬走", "沒有同意權，只能接受", "沒有同意權，會去抗議"]},
    },
}

HARD_OPPOSITION = {
    "trust_in_implementer": "低",
    "dispute_exposure": "親友經歷過都更糾紛，被建商拖了八年還沒分回房子",
    "extra": ["房子是唯一資產", "三十年前被建商騙過一次合建"],
}


HARD_SUPPORT = {
    "trust_in_implementer": "高",
    "wants": "很想要有電梯，爬樓梯越來越吃力；也想讓房子增值留給孩子",
    "economic_pressure": "低",
    "extra": ["朋友住的危老重建大樓去年完工，分回的房子很滿意", "樓上漏水和壁癌修了好幾次"],
}


def load_env():
    for line in (Path.home() / ".config" / "anthropic" / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            if v.strip() and not os.environ.get(k.strip()):
                os.environ[k.strip()] = v.strip().strip('"').strip("'")


def make_client():
    ws = os.environ.get("ANTHROPIC_WORKSPACE_ID")
    return anthropic.Anthropic(default_headers={"anthropic-workspace-id": ws} if ws else None)


def persona_card(p):
    lines = [
        f"建物：臺北市{p['town_name']}一棟 {p['built_year']} 年左右蓋的 {p['building_floors']} 層老公寓，{p['structure']}，沒有電梯，"
        f"全棟 {p['building_units']} 戶，位置：{p['lane']}。",
        f"你住（或擁有）的是 {p['floor_label']}（{p['unit']}）。",
        f"身分：{p['tenure']}。" + ("" if p["lives_here"] else "你不住在這裡。"),
        f"年齡 {p['age']} 歲，{p['gender']}性。家戶：{p['household_type']}。職業：{p['occupation']}。",
    ]
    if p.get("years_lived"):
        lines.append(f"在這裡住了約 {p['years_lived']} 年（{p['years_lived_label']}）。")
    if p.get("land_share_m2"):
        lines.append(f"土地持分約 {p['land_share_m2']} 平方公尺。")
    lines += [
        f"經濟壓力：{p['economic_pressure']}。身體：{p['mobility']}。孩子：{p['children']}。",
        f"平常的消息來源：{p['info_source']}。對建商或實施者的信任：{p['trust_in_implementer']}。",
        f"對都更糾紛的經驗：{p['dispute_exposure']}。對自家耐震風險：{p['risk_awareness']}。",
        f"你最在意的事：{p['wants']}。",
        f"其他：{'；'.join(p['extra'])}。",
    ]
    return "\n".join(lines)


def params(p):
    return MessageCreateParamsNonStreaming(
        model=MODEL,
        max_tokens=8000,
        system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral", "ttl": "1h"}}],
        output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content":
                   "你的人設如下。請照這個人回答。\n\n" + persona_card(p)
                   + f"\n\n（內部編號 {p['persona_id']}，不要寫進回答。）"}],
    )


def load_personas():
    return [json.loads(x) for x in (OUT / "personas.jsonl").read_text(encoding="utf-8").splitlines() if x]


def requests_all(personas):
    reqs = [(p["persona_id"] + "-r1", p) for p in personas]
    rng = random.Random(7)
    for p in rng.sample(personas, REPEATS):
        reqs.append((p["persona_id"] + "-r2", p))
    for p in rng.sample([q for q in personas if q["is_owner"] and q["lives_here"]], 6):
        hard = {**p, **HARD_OPPOSITION, "persona_id": p["persona_id"] + "X"}
        reqs.append((hard["persona_id"] + "-r1", hard))
    for p in rng.sample([q for q in personas if q["is_owner"] and q["lives_here"]], 6):
        eager = {**p, **HARD_SUPPORT, "persona_id": p["persona_id"] + "Y"}
        reqs.append((eager["persona_id"] + "-r1", eager))
    return reqs


def cost(u, batch):
    c = (u.get("input_tokens", 0) * PRICE["in"] + u.get("output_tokens", 0) * PRICE["out"]
         + u.get("cache_creation_input_tokens", 0) * PRICE["cache_write"]
         + u.get("cache_read_input_tokens", 0) * PRICE["cache_read"]) / 1e6
    return round(c * (0.5 if batch else 1.0), 6)


def ledger(rec):
    LEDGER.mkdir(parents=True, exist_ok=True)
    f = LEDGER / f"{datetime.now(timezone.utc):%Y-%m}.jsonl"
    with open(f, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


def base_rec(purpose, uid, batch):
    return {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), "project": "市政debug松",
            "purpose": purpose, "run_id": "consent-simulator-2026-10-23", "uid": uid, "attempt": 0,
            "model": MODEL, "price_source": "claude-api skill 2026-10-06" + ("; batch 50%" if batch else ""),
            "thinking": f"adaptive, effort {EFFORT}"}


def usage_dict(u):
    return {k: getattr(u, k, 0) or 0 for k in
            ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")}


def pilot(n):
    client = make_client()
    d = OUT / "pilot"
    d.mkdir(parents=True, exist_ok=True)
    ps = load_personas()
    rng = random.Random(1)
    for p in rng.sample(ps, n):
        t0 = time.time()
        rec = base_rec("persona-portrait-pilot", p["persona_id"], False)
        try:
            m = client.messages.create(**params(p))
            text = next(b.text for b in m.content if b.type == "text")
            data = json.loads(text)
            u = usage_dict(m.usage)
            rec.update(u, latency_ms=int((time.time() - t0) * 1000), ok=True, error=None,
                       request_id=m.id, stop_reason=m.stop_reason, cost_usd=cost(u, False))
            (d / f"{p['persona_id']}.json").write_text(
                json.dumps({"persona": p, "response": data, "usage": u}, ensure_ascii=False, indent=2), encoding="utf-8")
            print(p["persona_id"], p["tenure"], p["age"], "A", data["reaction_a"]["support_level"],
                  "B", data["reaction_b"]["support_level"], u, rec["cost_usd"])
        except (anthropic.APIError, json.JSONDecodeError, StopIteration) as e:
            rec.update(ok=False, error=f"{type(e).__name__}: {e}"[:300], latency_ms=int((time.time() - t0) * 1000))
            print(p["persona_id"], "ERROR", rec["error"])
        ledger(rec)


def submit():
    client = make_client()
    reqs = requests_all(load_personas())
    (OUT / "batch_requests.jsonl").write_text(
        "\n".join(json.dumps({"custom_id": cid, "persona": p}, ensure_ascii=False) for cid, p in reqs) + "\n",
        encoding="utf-8")
    b = client.messages.batches.create(requests=[Request(custom_id=cid, params=params(p)) for cid, p in reqs])
    (OUT / "batch_id.txt").write_text(b.id + "\n", encoding="utf-8")
    print("batch", b.id, b.processing_status, len(reqs), "requests")


def fetch(batch_id):
    client = make_client()
    while True:
        b = client.messages.batches.retrieve(batch_id)
        if b.processing_status == "ended":
            break
        print(datetime.now().strftime("%H:%M:%S"), b.processing_status, b.request_counts)
        time.sleep(60)
    meta = {}
    for line in (OUT / "batch_requests.jsonl").read_text(encoding="utf-8").splitlines():
        if line:
            r = json.loads(line)
            meta[r["custom_id"]] = r["persona"]
    raw, good, total = [], [], 0.0
    for r in client.messages.batches.results(batch_id):
        rec = base_rec("persona-portrait-batch", r.custom_id, True)
        row = {"custom_id": r.custom_id, "type": r.result.type}
        if r.result.type == "succeeded":
            m = r.result.message
            u = usage_dict(m.usage)
            text = next((x.text for x in m.content if x.type == "text"), "")
            row.update(usage=u, stop_reason=m.stop_reason, text=text)
            rec.update(u, ok=True, error=None, request_id=m.id, stop_reason=m.stop_reason, cost_usd=cost(u, True))
            total += rec["cost_usd"]
            try:
                good.append({"custom_id": r.custom_id, "persona": meta[r.custom_id], "response": json.loads(text)})
            except json.JSONDecodeError as e:
                row["parse_error"] = str(e)
        else:
            rec.update(ok=False, error=r.result.type)
        raw.append(row)
        ledger(rec)
    (OUT / "raw_results.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in raw) + "\n", encoding="utf-8")
    good.sort(key=lambda x: x["custom_id"])
    (OUT / "portraits.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in good) + "\n", encoding="utf-8")
    print("results", len(raw), "parsed", len(good), "cost_usd", round(total, 4))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["pilot", "submit", "fetch"])
    ap.add_argument("--n", type=int, default=4)
    ap.add_argument("--batch")
    a = ap.parse_args()
    load_env()
    {"pilot": lambda: pilot(a.n), "submit": submit, "fetch": lambda: fetch(a.batch)}[a.mode]()


if __name__ == "__main__":
    main()

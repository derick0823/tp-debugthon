"""Validate the alternatives decision tree used by the renewal calculator.

用途：檢查 decision-tree.json 的結構是否自洽，讓「我家都更划不划算」試算器
（mvp-variants/renewal-calculator/）可以放心讀它。檢查項目：
  1. 頂層鍵齊全；id 不重複。
  2. 每個 branch 的 next 指到存在的節點、option_ids 指到存在的選項。
  3. 每個 input 的 source_field／hint_field 若非 null，真的出現在 data/marts/README.md。
  4. 沒有孤兒節點：每個節點都從 nodes[0]（起點）走得到；沒有迴圈；每條路都會結束。
  5. 每個節點都有處理「資料缺漏」的分支（is_null 或 else）；else 只能放最後。
  6. when 的運算子與值符合 input 型別；enum 值在 input 的 values 裡。
  7. 每個 option 都有 source（檔案真的存在）與證據等級；金額或截止日是 null 時要標【待確認】；
     每個 option 至少被一個分支用到。
  8. source_field 是 null、又不是 user_only 的 input，要列在某一筆 data_debts 的 input_ids。

Usage（從 repo 根目錄執行）：
    uv run python -X utf8 research/issue-06/mvp-variants/consent-simulator/decision-tree/scripts/validate_tree.py

Input：
    research/issue-06/mvp-variants/consent-simulator/decision-tree/decision-tree.json
    data/marts/README.md
    各 option 的 source 路徑（只檢查檔案存在）

Output：
    標準輸出印出摘要（inputs、nodes、options、data_debts 數）與錯誤、警告。
    有錯誤時 exit code 1，沒有錯誤時 0。不寫任何檔案。

網路：不需要。只用標準函式庫。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TREE_DIR = HERE.parent
REPO = TREE_DIR.parents[4]  # decision-tree -> consent-simulator -> mvp-variants -> issue-06 -> research -> repo
TREE_PATH = TREE_DIR / "decision-tree.json"
MARTS_README = REPO / "data" / "marts" / "README.md"

TOP_KEYS = ["version", "disclaimer", "inputs", "nodes", "options", "data_debts"]
INPUT_TYPES = {"bool", "enum", "number"}
OPS_BY_TYPE = {
    "bool": {"eq", "is_null", "else"},
    "enum": {"eq", "in", "is_null", "else"},
    "number": {"eq", "gt", "gte", "lt", "lte", "is_null", "else"},
}
OPTION_KEYS = [
    "id", "name", "what", "who_can_apply", "amount", "deadline_or_period",
    "legal_basis", "why_fits", "required_fields", "source", "evidence",
]
EVIDENCE_TAGS = ("【實測】", "【文件】", "【推論】", "【待確認】")
PENDING_TAG = "【待確認】"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def check_ids(items: list[dict], kind: str, rep: Report) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for i, it in enumerate(items):
        iid = it.get("id")
        if not iid:
            rep.err(f"{kind}[{i}] has no id")
            continue
        if iid in out:
            rep.err(f"duplicate {kind} id: {iid}")
        out[iid] = it
    return out


def check_value(inp: dict, value, where: str, rep: Report) -> None:
    t = inp["type"]
    if t == "bool" and not isinstance(value, bool):
        rep.err(f"{where}: bool input expects true/false, got {value!r}")
    elif t == "number" and (isinstance(value, bool) or not isinstance(value, (int, float))):
        rep.err(f"{where}: number input expects a number, got {value!r}")
    elif t == "enum":
        allowed = {v["value"] for v in inp.get("values", [])}
        if value not in allowed:
            rep.err(f"{where}: enum value {value!r} not in {sorted(allowed)}")


def check_condition(cond: dict, inp: dict, where: str, rep: Report) -> None:
    op = cond.get("op")
    if op not in OPS_BY_TYPE[inp["type"]]:
        rep.err(f"{where}: op {op!r} not allowed for {inp['type']} input {inp['id']}")
        return
    if op in {"eq", "gt", "gte", "lt", "lte"}:
        if "value" not in cond:
            rep.err(f"{where}: op {op} needs 'value'")
        else:
            check_value(inp, cond["value"], where, rep)
    elif op == "in":
        vals = cond.get("values")
        if not isinstance(vals, list) or not vals:
            rep.err(f"{where}: op in needs a non-empty 'values' list")
        else:
            for v in vals:
                check_value(inp, v, where, rep)


def main() -> int:
    rep = Report()
    tree = json.loads(TREE_PATH.read_text(encoding="utf-8"))
    marts_text = MARTS_README.read_text(encoding="utf-8")
    marts_fields = set(re.findall(r"`([A-Za-z0-9_]+)`", marts_text))

    for k in TOP_KEYS:
        if k not in tree:
            rep.err(f"missing top-level key: {k}")
    if rep.errors:
        return finish(rep, tree)
    if "不是個案判定" not in tree["disclaimer"]:
        rep.err("disclaimer must say 不是個案判定")

    inputs = check_ids(tree["inputs"], "input", rep)
    nodes = check_ids(tree["nodes"], "node", rep)
    options = check_ids(tree["options"], "option", rep)
    debts = check_ids(tree["data_debts"], "data_debt", rep)

    # ---- inputs
    for iid, inp in inputs.items():
        for key in ("label", "type", "how_user_provides"):
            if not inp.get(key):
                rep.err(f"input {iid}: missing {key}")
        if "source_field" not in inp:
            rep.err(f"input {iid}: missing source_field (use null when no data)")
        if inp.get("type") not in INPUT_TYPES:
            rep.err(f"input {iid}: bad type {inp.get('type')!r}")
            continue
        if inp["type"] == "enum" and not inp.get("values"):
            rep.err(f"input {iid}: enum needs values")
        for fkey in ("source_field", "hint_field"):
            f = inp.get(fkey)
            if f is not None and f not in marts_fields:
                rep.err(f"input {iid}: {fkey} `{f}` not found in data/marts/README.md")

    debt_inputs: set[str] = set()
    for did, d in debts.items():
        for key in ("missing", "needed_for", "who_holds", "note"):
            if not d.get(key):
                rep.err(f"data_debt {did}: missing {key}")
        for iid in d.get("input_ids", []):
            if iid not in inputs:
                rep.err(f"data_debt {did}: unknown input {iid}")
            debt_inputs.add(iid)
    for iid, inp in inputs.items():
        if inp.get("source_field") is None and not inp.get("user_only") and iid not in debt_inputs:
            rep.err(f"input {iid}: source_field is null but not listed in data_debts")

    # ---- nodes
    used_inputs: set[str] = set()
    used_options: set[str] = set()
    edges: dict[str, list[str]] = {}
    for nid, node in nodes.items():
        if not node.get("question"):
            rep.err(f"node {nid}: missing question")
        inp = inputs.get(node.get("input_id"))
        if inp is None:
            rep.err(f"node {nid}: unknown input_id {node.get('input_id')!r}")
        else:
            used_inputs.add(inp["id"])
        branches = node.get("branches") or []
        if not branches:
            rep.err(f"node {nid}: no branches")
        edges[nid] = []
        has_fallback = False
        for bi, b in enumerate(branches):
            where = f"node {nid} branch {bi}"
            cond = b.get("when")
            if not isinstance(cond, dict):
                rep.err(f"{where}: when must be an object")
                continue
            if inp is not None and inp.get("type") in INPUT_TYPES:
                check_condition(cond, inp, where, rep)
            if cond.get("op") in {"is_null", "else"}:
                has_fallback = True
            if cond.get("op") == "else" and bi != len(branches) - 1:
                rep.err(f"{where}: else must be the last branch")
            if not b.get("label"):
                rep.err(f"{where}: missing label")
            if "next" not in b and "option_ids" not in b:
                rep.err(f"{where}: needs next or option_ids")
            nxt = b.get("next")
            if nxt is not None:
                if nxt not in nodes:
                    rep.err(f"{where}: next {nxt!r} does not exist")
                else:
                    edges[nid].append(nxt)
            for oid in b.get("option_ids", []) or []:
                if oid not in options:
                    rep.err(f"{where}: option {oid!r} does not exist")
                used_options.add(oid)
        if not has_fallback:
            rep.err(f"node {nid}: no is_null or else branch for missing data")

    # ---- reachability, orphans, cycles
    root = tree["nodes"][0]["id"] if tree["nodes"] else None
    reached: set[str] = set()
    state: dict[str, int] = {}  # 1 visiting, 2 done

    def dfs(n: str) -> None:
        state[n] = 1
        reached.add(n)
        for m in edges.get(n, []):
            if state.get(m) == 1:
                rep.err(f"cycle: {n} -> {m}")
            elif state.get(m) is None:
                dfs(m)
        state[n] = 2

    if root:
        sys.setrecursionlimit(10000)
        dfs(root)
    for nid in nodes:
        if nid not in reached:
            rep.err(f"orphan node (not reachable from {root}): {nid}")
    terminals = [nid for nid, node in nodes.items()
                 if any("next" not in b for b in node.get("branches", []))]
    if not terminals:
        rep.err("no terminal branch: the walk never ends")

    # ---- options
    for oid, o in options.items():
        for key in OPTION_KEYS:
            if key not in o:
                rep.err(f"option {oid}: missing key {key}")
        for key in ("name", "what", "who_can_apply", "why_fits"):
            if not o.get(key):
                rep.err(f"option {oid}: empty {key}")
        srcs = o.get("source") or []
        if not srcs:
            rep.err(f"option {oid}: no source")
        for s in srcs:
            p = s.get("path") if isinstance(s, dict) else None
            if not p or not s.get("section"):
                rep.err(f"option {oid}: source needs path and section: {s!r}")
            elif not (REPO / p).is_file():
                rep.err(f"option {oid}: source path not found: {p}")
        ev = o.get("evidence") or ""
        if not any(t in ev for t in EVIDENCE_TAGS):
            rep.err(f"option {oid}: evidence has no tag {EVIDENCE_TAGS}")
        pending_text = ev + "".join(o.get("pending", []))
        for key in ("amount", "deadline_or_period"):
            if o.get(key) is None and PENDING_TAG not in pending_text:
                rep.err(f"option {oid}: {key} is null but no 【待確認】 in evidence")
        if o.get("legal_basis") is None and not o.get("pending"):
            rep.err(f"option {oid}: legal_basis is null but pending is empty")
        dd = o.get("deadline_date")
        if dd is not None and not DATE_RE.match(dd):
            rep.err(f"option {oid}: deadline_date must be YYYY-MM-DD, got {dd!r}")
        for iid in o.get("required_fields", []):
            if iid not in inputs:
                rep.err(f"option {oid}: required_field {iid!r} is not an input id")
            used_inputs.add(iid)
        for ei, ex in enumerate(o.get("excluded_when", [])):
            inp = inputs.get(ex.get("input_id"))
            if inp is None:
                rep.err(f"option {oid}: excluded_when[{ei}] unknown input {ex.get('input_id')!r}")
                continue
            used_inputs.add(inp["id"])
            check_condition(ex, inp, f"option {oid} excluded_when[{ei}]", rep)
            if not ex.get("reason"):
                rep.err(f"option {oid}: excluded_when[{ei}] missing reason")
        if oid not in used_options:
            rep.err(f"option {oid}: not used by any branch")

    for iid, inp in inputs.items():
        if iid not in used_inputs and not inp.get("display_only"):
            rep.warn(f"input {iid}: not used by any node or option")

    return finish(rep, tree)


def finish(rep: Report, tree: dict) -> int:
    try:
        shown = TREE_PATH.relative_to(REPO).as_posix()
    except ValueError:
        shown = str(TREE_PATH)
    print(f"tree: {shown}  version={tree.get('version')}")
    for k in ("inputs", "nodes", "options", "data_debts"):
        print(f"  {k}: {len(tree.get(k, []))}")
    for w in rep.warnings:
        print(f"WARN  {w}")
    for e in rep.errors:
        print(f"ERROR {e}")
    if rep.errors:
        print(f"FAILED: {len(rep.errors)} error(s), {len(rep.warnings)} warning(s)")
        return 1
    print(f"OK: 0 errors, {len(rep.warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

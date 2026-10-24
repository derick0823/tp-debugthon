"""Turn the portrait results and the decision tree into JS data files for index.html.

The page loads data as <script> globals so it also works when opened from disk.

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/build_web_data.py
Input:   out/portraits.jsonl, out/archetypes.json, decision-tree/decision-tree.json
Output:  data/portraits-data.js (window.PORTRAITS), data/tree-data.js (window.DECISION_TREE)
Network: no
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
KEEP = ["persona_id", "archetype_id", "town_name", "village_name", "built_year", "floor_label", "tenure",
        "is_owner", "lives_here", "age", "gender", "household_type", "economic_pressure", "trust_in_implementer",
        "dispute_exposure", "wants"]


def main():
    arch = json.loads((HERE / "out" / "archetypes.json").read_text(encoding="utf-8"))["archetypes"]
    items = []
    for line in (HERE / "out" / "portraits.jsonl").read_text(encoding="utf-8").splitlines():
        if not line:
            continue
        x = json.loads(line)
        pid, run = x["custom_id"].rsplit("-r", 1)
        check = "oppose" if pid.endswith("X") else "support" if pid.endswith("Y") else None
        items.append({"id": x["custom_id"], "run": int(run), "check": check,
                      "p": {k: x["persona"].get(k) for k in KEEP}, "r": x["response"]})
    payload = {
        "note": "AI simulated residents (Claude). Not real people, not a poll.",
        "archetypes": [{k: a[k] for k in ("id", "town_name", "village_name", "built_year", "units", "floors", "note")}
                       for a in arch],
        "items": items,
    }
    out = HERE / "data"
    out.mkdir(exist_ok=True)
    (out / "portraits-data.js").write_text(
        "window.PORTRAITS = " + json.dumps(payload, ensure_ascii=False) + ";\n", encoding="utf-8")
    tree = json.loads((HERE / "decision-tree" / "decision-tree.json").read_text(encoding="utf-8"))
    (out / "tree-data.js").write_text(
        "window.DECISION_TREE = " + json.dumps(tree, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(len(items), "portrait items;", len(tree["nodes"]), "tree nodes")


if __name__ == "__main__":
    main()

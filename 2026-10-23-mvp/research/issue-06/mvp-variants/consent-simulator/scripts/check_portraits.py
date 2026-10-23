"""Quality checks on the AI portraits: are the answers all the same?

Checks (handoff section 8-2 to 8-4):
1. Concentration: share of the most common support level per tenure group (flag >= 90%).
2. Stability: same persona run twice, difference in support level.
3. Two-way probe: personas forced to a hostile or an eager background; do the levels move?
4. Text sameness: character 4-gram Jaccard between quotes; share of near-duplicate pairs.

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/check_portraits.py
Input:   out/portraits.jsonl
Output:  out/check.json (printed too)
Network: no
"""

import json
from collections import Counter
from itertools import combinations
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]


def group(t):
    if t.startswith("一樓店家"):
        return "店家"
    if t == "租客":
        return "租客"
    if "出租" in t or "不同住" in t:
        return "不住這裡的屋主"
    return "住在這裡的屋主"


def grams(s, n=4):
    s = "".join(ch for ch in s if not ch.isspace())
    return {s[i:i + n] for i in range(max(0, len(s) - n + 1))}


def jacc(a, b):
    return len(a & b) / len(a | b) if a and b else 0.0


def main():
    rows = [json.loads(x) for x in (HERE / "out" / "portraits.jsonl").read_text(encoding="utf-8").splitlines() if x]
    for r in rows:
        r["pid"], r["run"] = r["custom_id"].rsplit("-r", 1)
    main_rows = [r for r in rows if r["run"] == "1" and not r["pid"].endswith(("X", "Y"))]
    res = {"n_main": len(main_rows)}

    conc = {}
    for g in ["住在這裡的屋主", "不住這裡的屋主", "租客", "店家"]:
        xs = [r for r in main_rows if group(r["persona"]["tenure"]) == g]
        if not xs:
            continue
        out = {"n": len(xs)}
        for k in ("reaction_a", "reaction_b"):
            c = Counter(r["response"][k]["support_level"] for r in xs)
            mode, cnt = c.most_common(1)[0]
            out[k] = {"dist": dict(sorted(c.items())), "mode": mode, "mode_share": round(cnt / len(xs), 3),
                      "flag_over_90": cnt / len(xs) >= 0.9}
        out["mean_shift_b_minus_a"] = round(sum(r["response"]["reaction_b"]["support_level"]
                                                - r["response"]["reaction_a"]["support_level"] for r in xs) / len(xs), 2)
        conc[g] = out
    res["concentration"] = conc
    allc = {k: dict(sorted(Counter(r["response"][k]["support_level"] for r in main_rows).items()))
            for k in ("reaction_a", "reaction_b")}
    res["overall_dist"] = allc
    res["actions"] = dict(Counter(r["response"]["likely_action"] for r in main_rows).most_common())

    by = {}
    for r in rows:
        by.setdefault(r["pid"], {})[r["run"]] = r
    pairs = [(v["1"], v["2"]) for v in by.values() if "1" in v and "2" in v]
    diffs = {k: [abs(a["response"][k]["support_level"] - b["response"][k]["support_level"]) for a, b in pairs]
             for k in ("reaction_a", "reaction_b")}
    res["stability"] = {"pairs": len(pairs),
                        **{k: {"same": sum(d == 0 for d in v), "off_by_1": sum(d == 1 for d in v),
                               "off_by_2plus": sum(d >= 2 for d in v)} for k, v in diffs.items()},
                        "same_action": sum(a["response"]["likely_action"] == b["response"]["likely_action"] for a, b in pairs)}

    probe = {}
    for suffix, name in (("X", "hostile"), ("Y", "eager")):
        xs = [r for r in rows if r["pid"].endswith(suffix)]
        base = [by[r["pid"][:-1]]["1"] for r in xs if r["pid"][:-1] in by]
        probe[name] = {
            "n": len(xs),
            "a_levels": [r["response"]["reaction_a"]["support_level"] for r in xs],
            "b_levels": [r["response"]["reaction_b"]["support_level"] for r in xs],
            "same_people_baseline_a": [r["response"]["reaction_a"]["support_level"] for r in base],
            "same_people_baseline_b": [r["response"]["reaction_b"]["support_level"] for r in base],
            "actions": [r["response"]["likely_action"] for r in xs],
        }
    res["probe"] = probe

    for k in ("reaction_a", "reaction_b"):
        g = [grams(r["response"][k]["quote"]) for r in main_rows]
        sims = [jacc(a, b) for a, b in combinations(g, 2)]
        res.setdefault("quote_similarity", {})[k] = {
            "pairs": len(sims), "mean": round(sum(sims) / len(sims), 4),
            "near_dup_over_0_5": sum(s > 0.5 for s in sims), "over_0_3": sum(s > 0.3 for s in sims)}
    concerns = Counter()
    for r in main_rows:
        for c in r["response"]["top_concerns"]:
            concerns[c[:8]] += 1
    res["concern_prefix_top10"] = concerns.most_common(10)

    (HERE / "out" / "check.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()

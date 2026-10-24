// Acceptance check for lib/report.js, run with Node (no server needed):
//   node research/issue-06/mvp-variants/health-report/test/check-engine.mjs
// Reads the sibling prototypes' data/ from disk through a fetch shim and compares with the
// numbers the existing pages show (see ../README.md, 驗收).
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildReport } from "../lib/report.js";

const base = new URL("../../", import.meta.url); // mvp-variants/
const fsFetch = async (href) => {
  try {
    const buf = await readFile(fileURLToPath(href));
    return { ok: true, status: 200, json: async () => JSON.parse(buf.toString("utf8")), text: async () => buf.toString("utf8") };
  } catch (e) {
    return { ok: false, status: 404 };
  }
};
const opts = (o = {}) => ({ base, fetch: fsFetch, ...o });

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${JSON.stringify(got)}${ok ? "" : `, want ${JSON.stringify(want)}`}`);
};

// 1. the demo address
const r1 = await buildReport({ addr: "信義路2段86巷40號", age: 50, elder: 1 }, opts());
check("addr match", r1.address.match, "exact");
check("addr town", r1.address.town_code, "63000030");
check("built year (calc page shows 1976)", r1.building?.built_year, 1976);
check("pre1999", r1.building?.pre1999, true);
check("has elevator", r1.building?.has_elevator, false);
check("checklist first item is elder-related when elder=1", r1.checklist[0]?.elder_related, true);
check("actions count in 3..5", r1.actions.length >= 3 && r1.actions.length <= 5, true);
check("elevator action when elder=1", r1.actions.some((a) => a.id === "elevator"), true);
check("home from building_points", r1.home?.source, "building_points");
check("nearest weak shelter has distance", typeof r1.nearest_weak_shelter?.distance_m, "number");
check("user age 50 -> generation g2 (same as data)", r1.building?.code_generation_user, "g2_1974_1982");
check("generation match", r1.building?.code_generation_match, true);
check("age_rank share in 0..1", r1.age_rank && r1.age_rank.older_than_share_estimated >= 0 && r1.age_rank.older_than_share_estimated <= 1, true);
console.log("      home:", JSON.stringify(r1.home), "shelter:", r1.nearest_weak_shelter?.name, r1.nearest_weak_shelter?.distance_m, "m; age_rank:", JSON.stringify(r1.age_rank));
console.log("      village:", r1.village?.town_name, r1.village?.village_name, "rank", r1.ranking?.rank, "eq", r1.ranking?.rank_equal);
console.log("      top-level keys:", Object.keys(r1).join(", "));

// 2. 大安區龍圖里: priority-ranking #w=1,1,3,3,1 shows 第 145 名, 等權第 121 名
const r2 = await buildReport({}, opts({ village_code: "63000030022" }));
check("龍圖里 name", r2.village?.village_name, "龍圖里");
check("龍圖里 rank w=1,1,3,3,1", r2.ranking?.rank, 145);
check("龍圖里 rank equal", r2.ranking?.rank_equal, 121);
check("village only: home falls back to village centre", r2.home?.source, "village_center");

// 3. 信義區黎忠里: bonus-translator 我的里 shows 7%
const r3 = await buildReport({}, opts({ village_code: "63000020040" }));
check("黎忠里 name", r3.village?.village_name, "黎忠里");
check("黎忠里 my_village top10_text", r3.my_village?.top10_text, "7%");

// 5. round 3: plain-language layer
const len = (t) => [...String(t)].length;
check("verdict yellow for the demo address", r1.verdict?.level, "yellow");
check("verdict label", r1.verdict?.label, "建議找人檢查");
check("verdict line <= 30 chars", len(r1.verdict?.line) <= 30, true);
const ids = ["age_code", "ground_floor", "soil", "elder_lift", "quake_listed", "sea_sand", "fire_lane", "shelter"];
check("risks cover the 8 ids", ids.every((k) => r1.risks.some((x) => x.id === k)), true);
for (const r of [r1, r2, r3]) {
  const bad = r.risks.filter((x) => len(x.title) > 12 || len(x.plain) > 30 || !["high", "mid", "low", "unknown"].includes(x.level) || !["data", "estimate", "user"].includes(x.basis));
  check(`risk text limits (${r.village?.village_name})`, bad.map((x) => x.id).join(","), "");
}
check("village-only: listing flags unknown", r2.risks.find((x) => x.id === "sea_sand")?.level, "unknown");
check("report_id format", /^HR-\d{8}-[0-9A-F]{4}$/.test(r1.report_id), true);
const r1b = await buildReport({ addr: "臺北市大安區信義路二段86巷40號", age: 50, elder: 1 }, opts({ user: { name: "測試", id: "u1" } }));
check("report_id stable across address spellings", r1b.report_id, r1.report_id);
check("user from opts", JSON.stringify(r1b.user), JSON.stringify({ name: "測試", id: "u1" }));
check("user null without opts.user", r1.user, null);
check("plain_village is a sentence", typeof r1.plain_village === "string" && r1.plain_village.startsWith("你住的里"), true);
const rs = await buildReport({ addr: "大安區仁愛路3段96號", age: "", elder: 0 }, opts());
check("sea-sand doorplate -> red", rs.verdict?.level, "red");
check("sea-sand risk high", rs.risks.find((x) => x.id === "sea_sand")?.level, "high");
console.log("      verdict:", JSON.stringify(r1.verdict), "| plain_village:", r1.plain_village, "| report_id:", r1.report_id);

// 6. round 4: optional inputs (same set as the coordinator's acceptance URL)
const { parseQuery } = await import("../lib/report.js");
const pq = parseQuery("addr=信義路2段86巷40號&age=50&elder=1&type=apt&units=12&floor=4&ground=shop&own=renter&mc=0&crack=1");
const r5 = await buildReport(pq.input, opts(pq.opts));
check("input_optional echo", JSON.stringify(r5.input_optional), JSON.stringify({ type: "apt", units: 12, floor: 4, ground: "shop", own: "renter", mc: 0, crack: 1 }));
check("missing_optional empty", r5.missing_optional.join(","), "");
check("r1 missing_optional all", r1.missing_optional.length, 7);
check("first 8 risks keep their order", r5.risks.slice(0, 8).map((x) => x.id).join(","), ids.join(","));
check("visible_damage then medical at the end", r5.risks.slice(8).map((x) => x.id).join(","), "visible_damage,medical");
check("visible_damage high/user", `${r5.risks[8].level}/${r5.risks[8].basis}`, "high/user");
check("ground=shop -> ground_floor mid, basis user", `${r5.risks.find((x) => x.id === "ground_floor").level}/${r5.risks.find((x) => x.id === "ground_floor").basis}`, "mid/user");
check("floor=4 no lift elder -> high", r5.risks.find((x) => x.id === "elder_lift").level, "high");
check("crack -> visible_damage action", r5.actions.some((a) => a.id === "visible_damage"), true);
check("units=12 -> 每戶約 1,100 元", r5.actions.find((a) => a.id === "initial_eval")?.money_tag, "每戶約 1,100 元");
const HOUSE = new Set(["initial_eval", "soft_story", "elevator", "visible_damage", "weilao", "listed"]);
check("renter prefix only on building actions", r5.actions.every((a) => a.next.who.startsWith("先跟房東說：") === HOUSE.has(a.id)), true);
check("crack=1 -> verdict yellow with crack line", r5.verdict?.line, "你說看到裂縫或鋼筋外露，建議請人來看。");
const rsc = await buildReport({ addr: "大安區仁愛路3段96號", crack: 1 }, opts());
check("crack=1 keeps red for a listed doorplate", rsc.verdict?.level, "red");
check("renter: no duplicated note", r5.actions.every((x) => !x.notes.some((n) => n.includes("租屋"))), true);
check("mc=0 note on initial_eval", r5.actions.find((a) => a.id === "initial_eval")?.notes.includes("沒有管委會：要先推派住戶代表"), true);
check("plain_title <= 12 and money_tag on every action", r5.actions.every((a) => len(a.plain_title) <= 12 && a.money_tag), true);
const r6 = await buildReport({ addr: "信義路2段86巷40號", age: 50, elder: 1, type: "house", floor: 1 }, opts());
check("type=house: no elevator action", r6.actions.some((a) => a.id === "elevator"), false);
check("type=house: soft story 50 萬 when shown", r6.actions.filter((a) => a.id === "soft_story").every((a) => a.money_tag === "最多補 50 萬"), true);
check("floor=1 -> elder_lift low", r6.risks.find((x) => x.id === "elder_lift").level, "low");
check("units from doorplates when not given (estimate)", r1.actions.find((a) => a.id === "initial_eval")?.per_household?.units_basis, "estimate");
check("nearby_medical null or object", r5.nearby_medical === null || typeof r5.nearby_medical === "object", true);
{
  // Logic check with a two-site fixture, independent of whether data/medical.json exists yet.
  const fixture = { items: [
    { kind: "er_hospital", name: "測試急救醫院", lon: 121.5249, lat: 25.0517, district: "測試區" }, // ~2 km north
    { kind: "aed", name: "測試 AED", lon: 121.5250, lat: 25.0338, district: "測試區" },
  ] };
  const fx = async (href) => (href.endsWith("health-report/data/medical.json")
    ? { ok: true, status: 200, json: async () => fixture } : fsFetch(href));
  const rf = await buildReport(pq.input, { base, fetch: fx, ...pq.opts });
  check("fixture: er_hospital distance ~2 km", Math.abs(rf.nearby_medical.er_hospital.distance_m - 2000) <= 20, true);
  check("fixture: clinic null when none", rf.nearby_medical.clinic, null);
  check("fixture: medical risk mid (just over 2 km) or low", ["low", "mid"].includes(rf.risks.find((x) => x.id === "medical").level), true);
}
if (r5.nearby_medical) {
  check("medical risk level known when er_hospital exists", r5.nearby_medical.er_hospital ? r5.risks.find((x) => x.id === "medical").level !== "unknown" : true, true);
  console.log("      nearby_medical:", JSON.stringify(r5.nearby_medical));
}

// 4. missing everything: no crash, asks for village
const r4 = await buildReport({}, opts());
check("empty input needs village", r4.needs_village, true);
check("empty input missing", r4.missing.join(","), "addr,age,elder");

console.log(fail ? `${fail} FAIL` : "ALL PASS");
process.exitCode = fail ? 1 : 0;

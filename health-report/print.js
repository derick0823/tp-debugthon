// A4 print layout ("列印版") of the health report. Same URL params as index.html:
//   print.html?addr=&age=&elder=1  (optional v=<village_code>, t=<town_code>, #w=1,1,3,3,1)
// Every number comes from lib/report.js; this file only lays them out for paper.
import { buildReport, parseQuery, FACTORS, DISCLAIMER } from "./lib/report.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x, d = 0) => (x == null || isNaN(x) ? "—" : (x * 100).toFixed(d) + "%");
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }));

window.__errors = [];
const logErr = (m) => { window.__errors.push(m); document.body.dataset.errors = String(window.__errors.length); };
window.addEventListener("error", (e) => logErr(String(e.message)));
window.addEventListener("unhandledrejection", (e) => logErr(String(e.reason)));

$("#btn-print").addEventListener("click", () => window.print());

// Optional inputs: engine field input_optional echoes the codes (CONTRACT.md section 1); this maps them to words.
const OPT_KEYS = ["type", "units", "floor", "ground", "own", "mc", "crack"];
const OPT_NAME = { type: "房子類型", units: "全棟戶數", floor: "住幾樓", ground: "一樓用途", own: "自有或租屋", mc: "管委會", crack: "牆面裂縫" };
const OPT_LABEL = {
  type: { apt: "公寓", house: "透天", building: "大樓" },
  ground: { shop: "店面", parking: "停車", arcade: "騎樓", home: "住家" },
  own: { owner: "自有", renter: "租屋" },
  mc: { 1: "有", 0: "沒有", true: "有", false: "沒有" },
  crack: { 1: "有看到裂縫、鋼筋外露或漏水", 0: "沒看到", true: "有看到裂縫、鋼筋外露或漏水", false: "沒看到" },
};
function optText(k, v) {
  if (v == null || v === "") return null;
  if (typeof v === "object") return v.label ?? v.text ?? (v.value != null ? optText(k, v.value) : null);
  if (k === "units") return `${v} 戶`;
  if (k === "floor") return `${v} 樓`;
  return (OPT_LABEL[k] && OPT_LABEL[k][String(v)]) || String(v);
}


const tag = (est) => `<span class="ev ${est ? "est" : "real"}">${est ? "估" : "實"}</span>`;
const today = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
};

/* ---------------- header ---------------- */
function renderMeta(r) {
  const b = r.building, v = r.village, a = r.age;
  const addr = b ? `${v.town_name}${b.address}` : (r.input.addr ? `${r.input.addr}（門牌沒有對上）` : "（沒有門牌，只看里）");
  const elder = r.input.elder == null ? "未填" : r.input.elder ? "有（65 歲以上）" : "沒有";
  const user = r.user && r.user.name ? esc(r.user.name) : `王小明（示範）<small class="fine">登入後自動帶入</small>`;
  const rows = [
    ["報告編號", esc(r.report_id || "—")],
    ["受檢人", user],
    ["門牌", esc(addr)],
    ["所在里", `${esc(v.town_name)} ${esc(v.village_name)}`],
    ["你填屋齡", a.user == null ? "未填" : `${a.user} 年（約 ${a.built_year_user} 年建）`],
    ["推估屋齡", a.estimated == null ? "判不出來" : `${a.estimated} 年（${esc(a.estimated_source)}，${a.built_year_estimated} 年建）`],
    ["家中長者", elder],
    ["產生日期", today(r.generated_at)],
  ];
  $("#meta").innerHTML = rows.map(([k, x]) => `<div><dt>${k}</dt><dd>${x}</dd></div>`).join("");
  // optional inputs: one line, only the ones filled in
  const src = r.input_optional || {};
  const parts = OPT_KEYS.map((k) => { const t = optText(k, src[k]); return t ? `${OPT_NAME[k]}：${t}` : null; }).filter(Boolean);
  $("#optline").hidden = !parts.length;
  $("#optline").innerHTML = parts.length ? `<b>你另外填的：</b>${esc(parts.join("；"))}` : "";
}

/* ---------------- overall verdict: engine field report.verdict ---------------- */
const VCLS = { red: "red", yellow: "amber", green: "green" };
function renderVerdict(r) {
  const v = r.verdict;
  $("#verdict").hidden = !v;
  if (!v) return;
  $("#verdict").className = `verdict ${VCLS[v.level] || "amber"}`;
  $("#verdict").innerHTML = `<span class="lamp" aria-hidden="true"></span><b class="vword">總評：${esc(v.label)}</b><span class="vline">${esc(v.line)}</span>`;
}

/* ---------------- 1. building table ---------------- */
function renderBuilding(r) {
  const b = r.building;
  if (!b) {
    $("#bldg").innerHTML = `<p class="nobldg">沒有對上確切門牌，這一節不列逐棟資料與列管旗標。輸入完整門牌（含號）再產生一次。</p>`;
    return;
  }
  const elder = r.input.elder === 1;
  const yr = b.built_year ? `${b.built_year} 年${b.built_year_range ? `（${b.built_year_range[0]}～${b.built_year_range[1]}）` : ""}` : "判不出來";
  const gap = b.age_gap == null ? "你沒有填屋齡。" : Math.abs(b.age_gap) >= 3 ? `兩個屋齡差 ${Math.abs(b.age_gap)} 年，以使用執照為準。` : "和你填的屋齡差不到 3 年。";
  const listed = b.flags.sea_sand ? `海砂屋列管（${b.flags.sea_sand.kind_label}）` : b.flags.quake_listed ? `${b.flags.quake_listed.event} 地震受損列管` : "不在清冊上";
  // [item, result, reference, note, estimated?, outOfRange?]
  const kind = [b.floors ? b.floors + " 層" : null, b.building_type_label, b.structure_label, b.units ? `約 ${b.units} 戶` : null].filter(Boolean).join("，");
  const R = Object.fromEntries((r.risks || []).map((x) => [x.id, x]));
  const item = (id, fallback, formal) => `${R[id] ? R[id].title : fallback}（${formal}）`;
  const note = (id, fallback) => (R[id] && R[id].plain) || fallback;
  const high = (id, fallback) => (R[id] ? R[id].level === "high" : fallback);
  const listedRisk = [R.sea_sand, R.quake_listed].find((x) => x && x.level === "high");
  const rows = [
    [item("age_code", "房子的年紀", "耐震規範"), `約 ${yr} 建；推估 ${b.age_estimated ?? "—"} 年／你填 ${b.age_user ?? "未填"}${b.age_user == null ? "" : " 年"}`, "1999 年以後申請建造", `${note("age_code", "")}${b.age_gap != null && Math.abs(b.age_gap) >= 3 ? `。${gap}` : ""}`, !b.built_year_confirmed, high("age_code", b.pre1999 === true)],
    ["房子的樣子（樓層、型態、構造）", kind || "—", "—", "從實價登錄推估；門牌數當戶數。", true, false],
    [item("elder_lift", "長輩上下樓", "電梯"), b.has_elevator === true ? "有電梯" : b.has_elevator === false ? "沒有電梯" : "不確定", elder ? "有電梯（家有長輩）" : "—", note("elder_lift", "實價登錄推估。"), true, high("elder_lift", elder && b.has_elevator === false)],
    [item("ground_floor", "一樓的牆夠不夠", "一樓軟弱層"), b.soft_story_candidate ? `${b.soft_story_candidate} 型候選` : "不是候選", "不是候選", note("ground_floor", "從公開資料推估，不是判定。"), true, high("ground_floor", !!b.soft_story_candidate)],
    [item("soil", "地下的土壤", "土壤液化潛勢"), b.liq_label, "低", note("soil", "城市版 2019，區域尺度。"), false, high("soil", b.liq_level === "high")],
    ["附近的老建築（50 公尺內文化資產）", `${b.heritage_n_50m ?? 0} 處`, "0 處", "有的話，重建可能受限。", false, !!b.near_heritage_50m],
    ["市府列管名單（海砂屋、地震受損）", listed, "不在名單上", listedRisk ? listedRisk.plain : "這個門牌不在兩份清冊上", false, !!(b.flags.sea_sand || b.flags.quake_listed)],
  ];
  $("#bldg").innerHTML = `<table class="tbl">
    <thead><tr><th class="c-item">檢查項目</th><th class="c-res">結果</th><th class="c-ref">參考值</th><th>說明</th></tr></thead>
    <tbody>${rows.map(([k, v, ref, note, est, bad]) => `<tr${bad ? ' class="bad"' : ""}>
      <td>${esc(k)}</td><td class="res">${bad ? '<span class="mark">▲</span>' : ""}${esc(v)} ${tag(est)}</td><td>${esc(ref)}</td><td class="note">${esc(note)}</td></tr>`).join("")}</tbody>
  </table>
  <p class="legend">▲＝和參考值不同，建議留意。「估」＝推估或候選；「實」＝原始資料或官方清冊。參考值是本頁整理的比較基準，不是法定標準。</p>`;
}

/* ---------------- 2. village: five axes + ranking + bars ---------------- */
function renderVillage(r) {
  const k = r.ranking, M = r.my_village, R = r.rescue;
  const lv = (k && k.levels) || (M && M.levels) || {};
  const text = (M && M.level_text) || {};
  $("#axes").innerHTML = `<table class="tbl axes"><thead><tr><th class="c-ax"></th>${FACTORS.map((f) => `<th>${esc(f.name)}<span class="hint">${esc(f.hint)}</span></th>`).join("")}</tr></thead>
    <tbody><tr><th class="c-ax">級數</th>${FACTORS.map((f) => { const n = lv[f.k]; return `<td${n >= 4 ? ' class="bad"' : ""}><span class="lv" aria-label="${n ?? "—"} 級">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= (n || 0) ? `on l${n}` : ""}"></i>`).join("")}</span> <b>${n ?? "—"}</b></td>`; }).join("")}</tr>
    <tr><th class="c-ax">白話</th>${FACTORS.map((f) => `<td class="note">${esc(text[lv[f.k]] || "—")}</td>`).join("")}</tr></tbody></table>
`;
  $("#rank").innerHTML = k ? `<p class="small"><span class="rbig"><b>第 ${k.rank} 名</b><span>／${k.n_villages} 里</span></span>權重 ${k.weights.join("、")}（高齡、老屋、液化、救災、軟弱層）；等權時第 ${k.rank_equal} 名。名次越前面越該先處理，相對於臺北其他里。</p>
    <p class="small">${r.plain_village ? `<b>${esc(r.plain_village)}</b>` : esc(k.sentence[0])}隨機權重 2,000 次：排進前 ${k.top_k} 名的比例 <b>${pct(k.top_k_share)}</b>，名次 ${k.rank_range.p05}～${k.rank_range.p95}。${M && M.hidden_factors.length ? `${esc(M.hidden_factors.join("、"))}偏高，但總分不高，容易被忽略。` : ""}</p>
    ${M && M.silver ? `<p class="small">銀髮住宅狀況：${esc(M.silver.top_text)}（456 里中第 ${fmt(M.silver.rank)} 名），約 ${pct(M.silver.share)} 的人住在 30 年以上、沒電梯的 2～5 樓公寓（內政部統計處，113 年；推算）。</p>` : ""}`
    : "<p>沒有這個里的排名資料。</p>";
  $("#vmap").innerHTML = R ? villageMap(R.map) : "";
  if (!R) { $("#vbars").innerHTML = ""; return; }
  $("#vbars").innerHTML = `<table class="tbl vb">
    <thead><tr><th class="c-item">里的指標</th><th class="c-res">本里</th><th class="c-ref">和全市最高的里比</th><th>說明</th></tr></thead>
    <tbody>${R.bars.map((b) => `<tr><td>${esc(b.label)}</td><td class="res">${esc(b.text)} ${tag(!!b.estimated)}</td>
      <td><span class="meter"><i style="width:${(Math.max(0, Math.min(1, b.ratio)) * 100).toFixed(1)}%"></i></span> ${pct(b.ratio)}</td><td class="note">${esc(b.sub || "")}</td></tr>`).join("")}
      <tr><td>80 歲以上住戶</td><td class="res">約 ${fmt(R.pop_80plus)} 人 ${tag(false)}</td><td>全市中位 ${pct(R.share_80plus_city_median, 1)}</td><td class="note">本里占 ${pct(R.share_80plus, 1)}${R.s5_candidate ? "；救災可及性候選里" : ""}</td></tr>
    </tbody></table>`;
}

// Small static SVG of the village boundary, lanes and heritage points (no tiles, never blocks printing).
function villageMap(m) {
  if (!m || !m.village || !m.village.geometry) return "";
  const polys = m.village.geometry.type === "Polygon" ? [m.village.geometry.coordinates] : m.village.geometry.coordinates;
  const pts = polys.flat(2);
  if (!pts.length) return "";
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const W = 200, H = 140, pad = 8;
  const s = Math.min((W - 2 * pad) / ((x1 - x0) * kx || 1e-9), (H - 2 * pad) / ((y1 - y0) || 1e-9));
  const ox = (W - (x1 - x0) * kx * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  const P = ([x, y]) => `${(ox + (x - x0) * kx * s).toFixed(1)},${(oy + (y1 - y) * s).toFixed(1)}`;
  const path = polys.map((poly) => poly.map((ring) => "M" + ring.map(P).join("L") + "Z").join("")).join("");
  const dot = (f, cls) => (f.geometry && f.geometry.type === "Point" ? `<circle class="${cls}" cx="${P(f.geometry.coordinates).split(",")[0]}" cy="${P(f.geometry.coordinates).split(",")[1]}" r="3.2"/>` : "");
  const lanes = ((m.lanes && m.lanes.features) || []).map((f) => dot(f, f.properties && f.properties.zone === "red" ? "ln red" : "ln yel")).join("");
  const her = ((m.heritage && m.heritage.features) || []).map((f) => dot(f, "hr")).join("");
  return `<figure class="vmap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="本里範圍、列管窄巷與文資點"><path d="${path}" class="vb"/>${lanes}${her}</svg>
    <figcaption><span class="k red"></span>紅區窄巷 <span class="k yel"></span>黃區窄巷 <span class="k hr"></span>文資點。窄巷位置用門牌中心，是推估；沒有標「你家」。</figcaption></figure>`;
}

/* ---------------- nearby: shelter + engine nearby_medical ---------------- */
// Shelter (nearest_weak_shelter) plus the engine's nearby_medical {er_hospital, hospital, clinic, aed}; only the
// emergency hospital and AED are printed. Missing items are skipped; nearby_medical null prints nothing extra.
function nearItem(icon, label, x) {
  if (!x || !x.name) return null;
  const from = x.from === "village_center" ? "離里中心" : "";
  const d = x.distance_m != null ? `，${from}直線約 ${fmt(x.distance_m)} 公尺` : "";
  return `<span>${icon} <b>${esc(label)}</b>：${esc(x.name)}${d}</span>`;
}
function renderNearby(r) {
  const m = r.nearby_medical || {};
  const list = [
    nearItem("🏫", "適合長輩的收容所", r.nearest_weak_shelter),
    nearItem("🏥", "急救責任醫院", m.er_hospital),
    nearItem("❤️", "AED", m.aed),
  ].filter(Boolean);
  $("#nearby").hidden = !list.length;
  $("#nearby").innerHTML = list.length ? `<b class="nh">附近可以去哪裡</b>${list.join("")}<span class="fine">直線距離，不是步行路線。</span>` : "";
}

/* ---------------- 3. checklist ---------------- */
function renderChecklist(r) {
  $("#check-note").hidden = !r.checklist_note;
  $("#check-note").textContent = r.checklist_note || "";
  $("#check").innerHTML = r.checklist.map((c, i) => `<li><label for="ck${i}"><input type="checkbox" id="ck${i}"><span class="ct"><span class="sign">負責 ________</span><b>${esc(c.title)}</b>${r.input.elder === 1 && c.elder_related ? `<span class="eld">長者</span>` : ""}
    ${c.shelters && c.shelters.length ? `<span class="cd">${esc(c.shelters.join("、"))}。</span>` : ""}<span class="cd">${esc(c.detail)}</span></span></label></li>`).join("");
}

/* ---------------- 4. actions ---------------- */
function renderActions(r) {
  $("#acts").innerHTML = r.actions.map((a) => `<li><b class="t">${esc(a.plain_title || a.title)}</b>${a.money_tag ? `<span class="tagm">${esc(a.money_tag)}</span>` : ""}
    <span class="why">${esc(a.why)}${a.notes && a.notes.length ? `<b class="nt">${esc(a.notes.join("；"))}</b>` : ""}</span>
    <span class="money">補助：${esc(a.subsidy)}</span>
    <span class="who">下一步找：${esc(a.next.who)}${a.next.url ? `　<span class="url">${esc(a.next.url.replace(/^https?:\/\//, ""))}</span>` : ""}</span></li>`).join("");
}

/* ---------------- 5. sources + QR ---------------- */
function renderFoot(r) {
  $("#disc").innerHTML = `<b>${esc(r.disclaimer || DISCLAIMER)}</b>里的數字都是相對於臺北其他里；逐棟的建造年、電梯、軟弱層都是推估或候選。這張單子不能取代建築師、技師的耐震評估。`;
  $("#src").innerHTML = r.sources.map((s) => `<li><b>${esc(s.part)}</b>：${esc(s.text)}</li>`).join("") +
    (r.warnings && r.warnings.length ? `<li><b>提醒</b>：${esc(r.warnings.join(" "))}</li>` : "");
  const url = location.href;
  $("#url").textContent = url;
  const box = $("#qr");
  box.innerHTML = "";
  try {
    if (!window.QRCode) throw new Error("qrcode library not loaded");
    new window.QRCode(box, { text: url, width: 96, height: 96, correctLevel: window.QRCode.CorrectLevel.L });
    box.removeAttribute("title"); // qrcodejs sets title=url; the URL is printed next to it already
  } catch (e) {
    box.hidden = true; // fall back to the printed URL only
  }
}

async function run() {
  const { input, opts } = parseQuery(location.search);
  const autoprint = new URLSearchParams(location.search).get("autoprint") === "1";
  let r;
  try {
    r = await buildReport(input, opts);
  } catch (e) {
    $("#status").textContent = `資料讀不到（${e.message}）。請先產生各原型的 data/（見 README），並用 http 伺服器開這頁。`;
    $("#status").className = "status err";
    logErr(String(e.message));
    return;
  }
  window.__report = r;
  if (!r.village) {
    $("#status").textContent = input.addr ? "找不到這個門牌，也沒有指定里。網址加上區名，或帶 v=<里代碼>。" : "網址要帶 addr=<門牌> 或 v=<里代碼>。";
    $("#status").className = "status err";
    document.body.dataset.ready = "1";
    return;
  }
  const msgs = [];
  if (input.addr && r.address.match !== "exact") msgs.push(r.address.match === "similar" ? "門牌沒有完全對上，只印里的部分。" : "找不到這個門牌，只印里的部分。");
  if (r.missing.includes("age")) msgs.push("屋齡未填。");
  if (r.missing.includes("elder")) msgs.push("有無長者未填。");
  $("#status").textContent = msgs.join(" ");
  $("#status").hidden = !msgs.length;
  $("#body").hidden = false;
  renderMeta(r);
  renderVerdict(r);
  renderBuilding(r);
  renderNearby(r);
  renderVillage(r);
  renderChecklist(r);
  renderActions(r);
  renderFoot(r);
  document.title = `我家健檢單（列印版）${r.village.town_name}${r.village.village_name}`;
  document.body.dataset.ready = "1";
  // ?autoprint=1 (from index.html's print button): open the print dialog after the QR image settles
  if (autoprint) setTimeout(() => window.print(), 400);
}

run();

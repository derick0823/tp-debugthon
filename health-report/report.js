// Version 4 "正式健檢報告": formal look, plain language, big type, details folded away.
// Same URL params as index.html: report.html?addr=&age=&elder=1 (optional v=, t=, #w=).
// Everything comes from lib/report.js (round-3 fields: verdict, risks, user, report_id, plain_village; see CONTRACT.md).
// This file adds no rules of its own except the short action titles and the money tag read from the subsidy text.
// The resident's name is never read from the URL.
import { buildReport, DEFAULT_WEIGHTS, DISCLAIMER } from "./lib/report.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => (x == null || isNaN(x) ? "—" : Math.round(x * 100) + "%");
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }));

window.__errors = [];
const logErr = (m) => { window.__errors.push(m); document.body.dataset.errors = String(window.__errors.length); };
window.addEventListener("error", (e) => logErr(String(e.message)));
window.addEventListener("unhandledrejection", (e) => logErr(String(e.reason)));
$("#btn-print").addEventListener("click", () => window.print());

function readParams() {
  const q = new URLSearchParams(location.search);
  const m = location.hash.match(/w=([\d.,]+)/);
  let w = DEFAULT_WEIGHTS;
  if (m) {
    const x = m[1].split(",").map(Number);
    if (x.length === 5 && x.every((v) => v >= 0 && v <= 4)) w = x;
  }
  return { addr: q.get("addr") || "", age: q.get("age") ?? "", elder: q.get("elder") ?? "", v: q.get("v") || "", t: q.get("t") || "", w };
}

/* ---------------- levels: verdict uses red/yellow/green, risks use high/mid/low/unknown ---------------- */
const LV = {
  red: { cls: "red", word: "要注意" },
  amber: { cls: "amber", word: "留意" },
  green: { cls: "green", word: "還好" },
  gray: { cls: "gray", word: "查不到" },
};
function lvOf(x) {
  const s = String(x ?? "").toLowerCase();
  if (s === "red" || s === "high") return LV.red;
  if (s === "yellow" || s === "amber" || s === "mid" || s === "medium") return LV.amber;
  if (s === "green" || s === "low") return LV.green;
  return LV.gray;
}
const BASIS = { data: "官方資料", estimate: "我們推估", user: "你填的資料" };

/* ---------------- actions: short title, money tag, who ---------------- */
const ACT = {
  listed: ["📋", "確認列管狀況"], initial_eval: ["🔍", "請人來看耐震"], soft_story: ["🧱", "補強一樓"],
  elevator: ["🛗", "加裝電梯"], elder: ["👵", "安排長輩避難"], liquefaction: ["💧", "查土壤會不會變軟"],
  weilao: ["🏗️", "問能不能重建"], village_drill: ["🚒", "里內一起演練"],
};
function moneyOf(a) {
  const t = a.subsidy || "";
  const nums = [...t.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*萬元/g)].map((m) => Number(m[1].replace(/,/g, "")));
  if (nums.length) {
    const n = a.id === "elevator" ? Math.max(...nums) : nums[0];
    return `最多補 ${fmt(n, n % 1 ? 1 : 0)} 萬`;
  }
  if (/免費/.test(t)) return "免費";
  return "";
}

/* ---------------- render ---------------- */
function renderMeta(r) {
  const b = r.building, v = r.village, a = r.age;
  const user = r.user && r.user.name
    ? esc(r.user.name)
    : `王小明（示範）<span class="fine">登入後自動帶入</span>`;
  const addr = b ? `${v.town_name}${b.address}` : `${v.town_name} ${v.village_name}${r.input.addr ? "（門牌沒有對上）" : "（只看里）"}`;
  const age = a.user != null ? `${a.user} 年（你填的）` : a.estimated != null ? `約 ${a.estimated} 年（推估）` : "未填";
  const elder = r.input.elder == null ? "未填" : r.input.elder ? "有" : "沒有";
  const rows = [["報告編號", esc(r.report_id || "—")], ["產生日期", esc(new Date(r.generated_at || Date.now()).toLocaleDateString("zh-TW"))],
    ["受檢人", user], ["門牌", esc(addr)], ["屋齡", esc(age)], ["家中長者", elder]];
  $("#meta").innerHTML = rows.map(([k, x]) => `<div><dt>${k}</dt><dd>${x}</dd></div>`).join("");
}

function renderVerdict(r) {
  const v = r.verdict;
  if (!v) { $("#verdict").hidden = true; return; }
  const lv = lvOf(v.level);
  const icon = { red: "!", amber: "!", green: "✓", gray: "?" }[lv.cls];
  $("#verdict").hidden = false;
  $("#verdict").className = `verdict ${lv.cls}`;
  $("#verdict").innerHTML = `<div class="lamp" aria-hidden="true">${icon}</div>
    <div><p class="v-kicker">總評</p><p class="v-label">${esc(v.label)}</p><p class="v-line">${esc(v.line)}</p></div>`;
}

function renderRisks(r) {
  const list = r.risks || [];
  $("#risks").innerHTML = list.map((x) => {
    const lv = lvOf(x.level);
    const more = [x.detail, x.basis ? `依據：${BASIS[x.basis] || x.basis}` : "", x.source ? `出處：${x.source}` : ""].filter(Boolean);
    return `<div class="risk ${lv.cls}">
      <div class="r-top"><span class="r-icon" aria-hidden="true">${esc(x.icon || "•")}</span><span class="r-lamp"><i></i>${lv.word}</span></div>
      <p class="r-title">${esc(x.title)}</p>
      <p class="r-plain">${esc(x.plain)}</p>
      ${more.length ? `<details><summary>細節</summary>${more.map((m) => `<p>${esc(m)}</p>`).join("")}</details>` : ""}
    </div>`;
  }).join("");
}

const TILE = [["elderly", "👵", "長輩"], ["old_stock", "🏚️", "老房子"], ["liquefaction", "💧", "土壤變軟"], ["rescue", "🚒", "窄巷"], ["soft_story", "🧱", "一樓偏弱"]];
const LVWORD = (n) => (n >= 4 ? "高" : n === 3 ? "偏高" : n === 2 ? "中" : "低");
function renderVillage(r) {
  const k = r.ranking, M = r.my_village, v = r.village;
  const lv = (M && M.levels) || (k && k.levels) || {};
  const leader = k ? `<ul>
      <li>排序（權重 ${k.weights.join("、")}，依序是高齡、老屋、液化、救災、軟弱層）：全市 ${k.n_villages} 里中第 ${k.rank} 名；五項同等重要（等權）時第 ${k.rank_equal} 名。</li>
      <li>隨機換權重 2,000 次，排進前 ${k.top_k} 名的比例 ${pct(k.top_k_share)}；名次大多落在 ${k.rank_range.p05}～${k.rank_range.p95} 名。</li>
      ${M ? `<li>2000 種算法裡排進全市前 10% 的比例：${esc(M.top10_text)}。</li>` : ""}
      ${M && M.silver ? `<li>銀髮住宅狀況：456 里中第 ${fmt(M.silver.rank)} 名，約 ${pct(M.silver.share)} 的人住在 30 年以上、沒電梯的 2～5 樓公寓（內政部統計處，113 年；推算）。</li>` : ""}
      ${M ? `<li>本里文化資產 ${fmt(M.facts.heritage_sites_n)} 處；海砂屋列管 ${fmt(M.facts.sea_sand_cases_n)} 案；地震列管 ${fmt(M.facts.quake_listed_n)} 筆。</li>` : ""}
      <li>級數 1～5，5 是全市最高的約 7 個里。</li></ul>` : "<p>沒有這個里的排名資料。</p>";
  $("#village").innerHTML = `<p class="v-name">📍 ${esc(v.town_name)} ${esc(v.village_name)}</p>
    ${r.plain_village ? `<p class="v-plain">${esc(r.plain_village)}</p>` : ""}
    <div class="tiles">${TILE.map(([key, ic, nm]) => { const n = lv[key]; return `<div class="tile t${n || 1}"><span class="t-ic" aria-hidden="true">${ic}</span><span class="t-nm">${nm}</span><b>${LVWORD(n)}</b></div>`; }).join("")}</div>
    <details class="more"><summary>給里長看：排名與數字</summary>${leader}</details>`;
}

function actCard(a) {
  const [ic, short] = ACT[a.id] || ["📌", a.title];
  const money = moneyOf(a);
  return `<div class="act">
    <div class="a-top"><span class="a-icon" aria-hidden="true">${ic}</span>${money ? `<span class="money">${esc(money)}</span>` : ""}</div>
    <p class="a-title">${esc(short)}</p>
    <p class="a-who">找誰：${esc(a.next.who)}</p>
    <details><summary>說明</summary><p>${esc(a.title)}。${esc(a.why)}</p><p>補助：${esc(a.subsidy)}</p>
      ${a.next.url ? `<p>網址：<a href="${esc(a.next.url)}" target="_blank" rel="noopener">${esc(a.next.url.replace(/^https?:\/\//, ""))}</a></p>` : ""}<p class="fine-p">出處：${esc(a.source)}</p></details>
  </div>`;
}
function renderActions(r) {
  const top = r.actions.slice(0, 3), rest = r.actions.slice(3);
  $("#acts").innerHTML = top.map(actCard).join("");
  $("#acts-more").innerHTML = rest.length ? `<details class="more"><summary>還有 ${rest.length} 件可以做</summary><div class="acts">${rest.map(actCard).join("")}</div></details>` : "";
}

function renderFoot(r) {
  $("#disc").innerHTML = `<b>${esc(r.disclaimer || DISCLAIMER)}</b>里的比較都是相對於臺北其他里；房子的年紀、電梯、一樓狀況是從公開資料推估。要知道房子真正的耐震能力，請找建築師或技師評估。`;
  $("#src").innerHTML = r.sources.map((s) => `<li><b>${esc(s.part)}</b>：${esc(s.text)}</li>`).join("");
  const box = $("#qr");
  try {
    if (!window.QRCode) throw new Error("qrcode library not loaded");
    new window.QRCode(box, { text: location.href, width: 112, height: 112, correctLevel: window.QRCode.CorrectLevel.L });
    box.removeAttribute("title");
  } catch (e) {
    $(".qrrow").innerHTML = `<p class="qrtext">線上版網址：<span class="url">${esc(location.href)}</span></p>`;
  }
}

/* ---------------- loader: three ticks in ~1 s, then fade the report in ---------------- */
const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function playLoader() {
  if (reduce) { $("#loader").remove(); return Promise.resolve(); }
  const steps = [...document.querySelectorAll("#loader li")];
  return new Promise((done) => {
    steps.forEach((li, i) => setTimeout(() => li.classList.add("done"), 280 * (i + 1)));
    setTimeout(done, 280 * steps.length + 150);
  });
}
function hideLoader() {
  const l = $("#loader");
  if (!l) return;
  l.classList.add("out");
  setTimeout(() => l.remove(), 350);
}

async function run() {
  document.body.classList.toggle("anim", !reduce);
  const p = readParams();
  const anim = playLoader();
  let r;
  try {
    r = await buildReport({ addr: p.addr, age: p.age, elder: p.elder }, { village_code: p.v || undefined, town_code: p.t || undefined, weights: p.w });
  } catch (e) {
    await anim; hideLoader();
    $("#status").hidden = false;
    $("#status").textContent = `資料讀不到（${e.message}）。請先產生各原型的 data/（見 README），並用 http 伺服器開這頁。`;
    logErr(String(e.message));
    return;
  }
  window.__report = r;
  await anim;
  hideLoader();
  if (!r.village) {
    $("#status").hidden = false;
    $("#status").textContent = p.addr ? "找不到這個門牌。請在門牌前面加上區名再試一次。" : "網址要帶門牌（addr）或里代碼（v）。";
    document.body.dataset.ready = "1";
    return;
  }
  renderMeta(r);
  renderVerdict(r);
  renderRisks(r);
  renderVillage(r);
  renderActions(r);
  renderFoot(r);
  $("#body").hidden = false;
  requestAnimationFrame(() => $("#paper").classList.add("shown"));
  document.title = `老屋健檢報告｜${r.village.town_name}${r.village.village_name}`;
  document.body.dataset.ready = "1";
}

run();

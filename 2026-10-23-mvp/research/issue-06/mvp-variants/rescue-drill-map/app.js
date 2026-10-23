/* Rescue drill map (MVP variant C). Static: reads ./data/*.geojson built by scripts/build_data.py.
   Visual-first: pictograms and bars first, text second. Numbers are village aggregates of open data. */
(async function () {
  const $ = (s) => document.querySelector(s);
  const fmtPct = (x) => (x == null || isNaN(x)) ? "—" : (x * 100).toFixed(x >= 0.1 ? 0 : 1) + "%";
  const fmtInt = (x) => (x == null || isNaN(x)) ? "—" : Math.round(x).toLocaleString("zh-Hant");
  const n0 = (x) => (x == null || isNaN(x)) ? 0 : +x;
  const load = (f) => fetch("data/" + f).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let villages, lanes, fireLanes, heritage, liqHigh, meta;
  try {
    [villages, lanes, fireLanes, heritage, liqHigh, meta] = await Promise.all([
      load("villages.geojson"), load("narrow_lanes.geojson"), load("fire_access_lanes.json"),
      load("heritage.geojson"), load("liq_high_city2019.geojson"), load("meta.json")]);
  } catch (e) {
    $("#card").innerHTML = "<p>資料還沒產生。先跑 <code>uv run python -X utf8 research/issue-06/mvp-variants/rescue-drill-map/scripts/build_data.py</code>，並用 http 伺服器開這一頁。</p>";
    return;
  }
  // Shelters and hydrant reach (scripts/build_extra.py). Optional: the card works without it.
  const extra = await load("drill_extra.json").catch(() => null);
  const P = villages.features.map((f) => f.properties);
  P.forEach((p) => { p.lanes_total = n0(p.narrow_lanes_n) + n0(p.fire_access_lanes); p.soft_total = n0(p.soft_story_a_n) + n0(p.soft_story_b_n); });
  const MAX = {};
  ["lanes_total", "liq_high_share_city2019", "share_80plus", "heritage_sites_n", "bld_share_pre_policy_1999", "soft_total"]
    .forEach((k) => (MAX[k] = Math.max(...P.map((p) => n0(p[k]))) || 1));
  const CAND = P.filter((p) => p.s5_candidate).length;
  $("#foot").textContent = `資料：${meta.sources.villages}；窄巷：${meta.sources.narrow_lanes}；文資：${meta.sources.heritage}；液化：${meta.sources.liquefaction}。產生日 ${meta.generated}。${extra ? `收容所：${extra.meta.shelters_edu}；${extra.meta.shelters_nfa}。消防栓：${extra.meta.hydrants}。` : ""}`;
  $("#hdrStat").innerHTML = `<b>${CAND}</b> 個候選里 <span class="muted">／ 456 里</span>`;

  const map = L.map("map", { zoomControl: true }).setView([25.05, 121.54], 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  L.geoJSON(liqHigh, { style: { color: "#2b6cb0", weight: 0.5, fillColor: "#2b6cb0", fillOpacity: 0.18 } }).addTo(map);
  L.geoJSON(villages, {
    style: (f) => ({ color: f.properties.s5_candidate ? "#c0392b" : "#777", weight: f.properties.s5_candidate ? 1.6 : 0.4, fillOpacity: f.properties.s5_candidate ? 0.14 : 0.02, fillColor: "#c0392b" }),
    onEachFeature: (f, l) => { l.on("click", () => select(f.properties.village_code)); l.bindTooltip(f.properties.town_name + " " + f.properties.village_name, { sticky: true }); },
  }).addTo(map);
  let laneLayer = null, herLayer = null, hiLayer = null;

  const byCode = {}; villages.features.forEach((f) => (byCode[f.properties.village_code] = f));
  const towns = [...new Set(P.map((p) => p.town_name))].sort();
  towns.forEach((t) => { const o = document.createElement("option"); o.value = t; o.textContent = t; $("#town").appendChild(o); });

  // 3 mini bars per row: lanes (red), liquefaction (blue), 80+ (amber). Width = value / city max.
  const spark = (p) => `<span class="spark">
      <span title="列管窄巷 ${fmtInt(p.lanes_total)} 條">🚒<i style="--w:${(p.lanes_total / MAX.lanes_total * 100).toFixed(0)}%"></i></span>
      <span title="液化高潛勢 ${fmtPct(p.liq_high_share_city2019)}">💧<i style="--w:${(n0(p.liq_high_share_city2019) / MAX.liq_high_share_city2019 * 100).toFixed(0)}%"></i></span>
      <span title="80 歲以上 ${fmtPct(p.share_80plus)}">👵<i style="--w:${(n0(p.share_80plus) / MAX.share_80plus * 100).toFixed(0)}%"></i></span></span>`;

  function renderList() {
    const t = $("#town").value, only = $("#onlyS5").checked, q = $("#q").value.trim();
    const rows = P.filter((p) => (!t || p.town_name === t) && (!only || p.s5_candidate) && (!q || p.village_name.includes(q)))
      .sort((a, b) => b.lanes_total - a.lanes_total || b.share_80plus - a.share_80plus);
    $("#rows").innerHTML = rows.map((p) => `<button class="row" data-v="${p.village_code}">
      <div class="t">${p.town_name} ${p.village_name}${p.s5_candidate ? " <span class='badge'>候選</span>" : ""}</div>
      ${spark(p)}
    </button>`).join("") || "<p class='muted' style='padding:12px'>沒有符合的里。</p>";
    $("#rows").querySelectorAll("button.row").forEach((b) => b.addEventListener("click", () => select(b.dataset.v)));
    requestAnimationFrame(() => $("#rows").classList.add("grow"));
  }
  ["#town", "#onlyS5", "#q"].forEach((s) => $(s).addEventListener("input", renderList));
  renderList();
  P.filter((p) => p.s5_candidate).sort((a, b) => b.lanes_total - a.lanes_total).forEach((p) => {
    const o = document.createElement("option"); o.value = p.village_code; o.textContent = `${p.town_name} ${p.village_name}`; $("#pick").appendChild(o);
  });
  $("#pick").addEventListener("change", (e) => select(e.target.value));

  function select(code) {
    const f = byCode[code]; if (!f) return;
    const p = f.properties;
    $("#rows").querySelectorAll("button.row").forEach((b) => b.setAttribute("aria-current", b.dataset.v === code ? "true" : "false"));
    $("#pick").value = code;
    if (hiLayer) map.removeLayer(hiLayer);
    hiLayer = L.geoJSON(f, { style: { color: "#111", weight: 3, fill: false, dashArray: "6 4", className: "hi" } }).addTo(map);
    map.flyToBounds(hiLayer.getBounds(), { padding: [20, 20], maxZoom: 17, duration: 0.8 });
    if (laneLayer) map.removeLayer(laneLayer);
    laneLayer = L.geoJSON({ type: "FeatureCollection", features: lanes.features.filter((x) => x.properties.village_code === code) }, {
      pointToLayer: (x, ll) => L.circleMarker(ll, { radius: 7, color: "#fff", fillColor: x.properties.zone === "red" ? "#c0392b" : "#d08a00", fillOpacity: 0.95, weight: 1.5 }),
      onEachFeature: (x, l) => l.bindTooltip(`🚒 ${x.properties.lane_name}（${x.properties.zone === "red" ? "紅區" : "黃區"}，寬 ${x.properties.width_m} m，${x.properties.fire_unit}）`),
    }).addTo(map);
    if (herLayer) map.removeLayer(herLayer);
    herLayer = L.geoJSON({ type: "FeatureCollection", features: heritage.features.filter((x) => x.properties.village_code === code) }, {
      pointToLayer: (x, ll) => L.circleMarker(ll, { radius: 6, color: "#fff", fillColor: "#6b46c1", fillOpacity: 0.95, weight: 1.5 }),
      onEachFeature: (x, l) => l.bindTooltip(`🏛️ ${x.properties.case_name}（${x.properties.class_name}）`),
    }).addTo(map);
    renderCard(p, code);
  }

  const ICON = { lanes: "🚒", liq: "💧", old: "👵", her: "🏛️", bld: "🏚️", soft: "🏢", next: "📋", gas: "🔥", shelter: "🏫", hyd: "🚰" };
  const shortName = (n) => n.replace(/^臺北市(立)?(\S{2}區)?/, "").replace("國民小學", "國小").replace("國民中學", "國中").replace("高級中學", "高中");

  // 「本里震後去哪裡」: Education Department shelters serving this village (earthquake: main or backup),
  // plus NFA shelters marked 適合避難弱者 in the village and the district.
  function shelterCheck(p, x) {
    const main = x.sh.filter((s) => s.eq === "是"), backup = x.sh.filter((s) => s.eq === "備用");
    const head = x.sh.length ? `確認震後去哪裡：${main.length} 處主要、${backup.length} 處備用收容所` : "確認震後去哪裡：本里沒有列到震災收容所";
    const li = x.sh.map((s) => `<li>${esc(shortName(s.name))}（${s.eq === "是" ? "主要" : "備用"}${s.cap ? `，約 ${fmtInt(s.cap)} 人` : ""}${s.weak ? "，消防署標適合避難弱者" : ""}${s.acc ? "" : "，無障礙設施：否"}${s.limit ? "，" + esc(s.limit) : ""}${s.work ? "，備考有改建或拆除說明" : ""}）</li>`).join("");
    const d = `${li ? `<ul class="sh">${li}</ul>` : ""}
      ${x.sh_town_all ? `另有 ${x.sh_town_all} 處服務${esc(p.town_name)}全區。` : ""}
      消防署標「適合避難弱者」且含震災的收容所：里內 ${x.weak_v} 處、${esc(p.town_name)} ${x.weak_t} 處（依經緯度落點）。
      演練時確認這幾處誰開門、輪椅能不能進。<br><span class="muted">教育局一覽表 115-02-24 版、消防署資料 2026-10-23 下載。「主要／備用」是一覽表震災欄的「是／備用」。</span>`;
    return [ICON.shelter, head, d];
  }

  // 「列管窄巷離最近消防栓」: farthest located red/yellow lane in the village, straight line, 10 m steps.
  function hydrantCheck(x) {
    const h = x.hyd;
    return [ICON.hyd, `量窄巷到消防栓：最遠一條約 ${h.far_m} m（${esc(h.far_name)}）`,
      `本里 ${h.n} 條紅黃區窄巷都算了，中位數約 ${h.median_m} m。直線距離、巷子位置用門牌中心，是推估，不是水帶實際拉的路線；消防通道清冊沒有座標，沒有算。<br><span class="muted">消防栓：臺北自來水事業處清冊 115-09-15 版。</span>`];
  }
  const LVNAME = ["", "低", "偏低", "中", "偏高", "高"];

  // One horizontal bar: icon, label, value, bar scaled to the city max.
  function bar(icon, label, valueText, ratio, color, sub) {
    return `<div class="brow"><span class="ic" aria-hidden="true">${icon}</span>
      <div class="bl"><div class="bk"><span>${label}</span><b>${valueText}</b></div>
      <div class="bar"><i style="--w:${Math.max(0, Math.min(1, ratio)) * 100}%;background:${color}"></i></div>
      ${sub ? `<div class="bs">${sub}</div>` : ""}</div></div>`;
  }

  // 100 dots: how many people in 100 are 80 or older.
  function pictogram(share) {
    const k = Math.round(n0(share) * 100);
    let s = "";
    for (let i = 0; i < 100; i++) s += `<i class="${i < k ? "on" : ""}" style="--d:${i * 8}ms"></i>`;
    return `<div class="pict"><div class="dots" aria-label="每 100 人有 ${k} 位 80 歲以上">${s}</div>
      <div class="pcap"><b>每 100 人有 ${k} 位</b>是 80 歲以上<span class="muted">（全市中位數約 ${Math.round(median(P.map((x) => n0(x.share_80plus))) * 100)} 位）</span></div></div>`;
  }
  function median(a) { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; }

  // Five factor levels as five columns, height = level.
  function levels(p) {
    const items = [["👵", "高齡", p.lv_elderly], ["🏚️", "老屋", p.lv_old_stock], ["💧", "液化", p.lv_liquefaction_city2019], ["🚒", "救災", p.lv_rescue], ["🏢", "軟弱層", p.lv_soft_story]];
    return `<div class="lvs">${items.map(([ic, nm, lv]) => `<div class="lvc"><div class="lvb"><i class="l${lv}" style="--h:${(lv || 0) * 20}%"></i></div>
      <div class="lvn"><span aria-hidden="true">${ic}</span> ${nm}</div><div class="lvt l${lv}t">${LVNAME[lv] || "—"}</div></div>`).join("")}</div>`;
  }

  function renderCard(p, code) {
    const fl = fireLanes[code] || [];
    const laneRows = lanes.features.filter((x) => x.properties.village_code === code).map((x) => x.properties);
    const checks = [];
    const x = extra && extra.v[code];
    if (p.lanes_total > 0) checks.push([ICON.lanes, `確認 ${fmtInt(p.lanes_total)} 條窄巷的消防車停車點`, "和分隊一條一條走，記水帶要拉多遠。"]);
    if (x && x.hyd) checks.push(hydrantCheck(x));
    if (n0(p.liq_high_share_city2019) >= 0.25) checks.push([ICON.gas, `加入液化情境：路面沉陷、管線中斷`, `里面積 ${fmtPct(p.liq_high_share_city2019)} 在高潛勢區。`]);
    if (n0(p.pop_80plus) > 0) checks.push([ICON.old, `列出要協助的 80 歲以上住戶（約 ${fmtInt(p.pop_80plus)} 人）`, "和鄰長分工。名冊不公開，由里辦公處保管。"]);
    if (n0(p.heritage_sites_n) > 0) checks.push([ICON.her, `避難路線避開 ${fmtInt(p.heritage_sites_n)} 處文資建物`, "文資通常不能重建，先補強與演練。"]);
    if (p.soft_total > 0) checks.push([ICON.soft, `先走 ${fmtInt(p.soft_total)} 棟軟弱層候選路段`, "候選是從公開資料推估，不是判定。只算 1999 年以前的建物；新建街屋也可能有一樓軟弱層（研究裡有兩棟新建案例）。"]);
    if (x) checks.push(shelterCheck(p, x));
    checks.push([ICON.next, `申請耐震初評補助與社區防災演練`, "里辦公處向市府申請。初評每棟最高補助 1.2 萬元（3,000 m² 以上 1.5 萬元）。初評後可申請弱層補強補助：集合住宅每棟最高 450 萬元、透天每件最高 50 萬元，補助至多 85%（1,500 萬元只限 113 年 4 月 3 日花蓮地震的專案）。行政流程可能超過一年。"]);

    $("#card").innerHTML = `
      <h2>${p.town_name} ${p.village_name} ${p.s5_candidate ? "<span class='badge'>候選</span>" : ""}</h2>
      ${p.s5_candidate ? "" : "<p class='why'>不在候選名單。下面是本里數字。</p>"}
      ${pictogram(p.share_80plus)}
      <div class="bars">
        ${bar(ICON.lanes, "列管窄巷", fmtInt(p.lanes_total) + " 條", p.lanes_total / MAX.lanes_total, "var(--red)", `紅黃區 ${fmtInt(p.narrow_lanes_n)}＋消防通道 ${fmtInt(p.fire_access_lanes)}`)}
        ${bar(ICON.liq, "液化高潛勢", fmtPct(p.liq_high_share_city2019), n0(p.liq_high_share_city2019) / MAX.liq_high_share_city2019, "var(--blue)", "占里面積，城市版 2019")}
        ${bar(ICON.bld, "1999 前老屋", fmtPct(p.bld_share_pre_policy_1999), n0(p.bld_share_pre_policy_1999) / MAX.bld_share_pre_policy_1999, "var(--amber)", "占有年份的戶；推估")}
        ${bar(ICON.her, "文資點", fmtInt(p.heritage_sites_n) + " 處", n0(p.heritage_sites_n) / MAX.heritage_sites_n, "var(--purple)")}
        ${bar(ICON.soft, "軟弱層候選", fmtInt(p.soft_total) + " 棟", p.soft_total / MAX.soft_total, "#8a949e", `A 型 ${fmtInt(p.soft_story_a_n)}／B 型 ${fmtInt(p.soft_story_b_n)}；候選`)}
      </div>
      ${levels(p)}
      <h3>演練檢核表</h3>
      <ul class="check">${checks.map(([ic, c, d], i) => `<li><input type="checkbox" id="ck${i}"><label for="ck${i}"><span class="ic" aria-hidden="true">${ic}</span><span>${c}</span></label><details class="ckd"><summary>細節</summary>${d}</details></li>`).join("")}</ul>
      <details><summary>🚒 列管窄巷清單（${laneRows.length + fl.length}）</summary>
        <ul>${laneRows.map((x) => `<li>${x.lane_name}：${x.zone === "red" ? "紅區" : "黃區"}，寬 ${x.width_m} m（${x.fire_unit}）</li>`).join("")}
            ${fl.map((x) => `<li>${x.lane_name}：${x.criteria}${x.site_type ? "，" + x.site_type : ""}（${x.fire_unit}，無座標）</li>`).join("")}</ul>
        <p class="muted small">紅黃區巷道的位置是該巷門牌的中心，不是精確路段。</p>
      </details>
      <details><summary>ℹ️ 這些數字怎麼來</summary>
        <ul class="small">
          <li>長條是本里相對全市最高里的比例。五個因子各自分 5 級，相對於臺北其他里，沒有合成總分。不做單棟定論：單棟倒塌機率通常遠低於 1%、不確定性高，房屋稅籍也有個資風險，所以國震中心的同類工具也以街廓為單位。</li>
          ${p.s5_reason ? `<li>候選理由：${p.s5_reason}</li>` : ""}
          <li>候選門檻三項都成立：有列管窄巷或 &lt;6 m 道路標註比例在前 10%；任一版液化高潛勢面積 ≥25%；80 歲以上比例在全市中位數以上。門檻是本隊定的，不是官方標準。</li>
          <li>窄巷：消防局狹小巷道紅黃區清冊＋消防通道清冊。位置是門牌中心（推估）。</li>
          <li>液化：臺北市土壤液化潛勢圖城市版 2019。class 1＝高是推論。</li>
          <li>老屋、軟弱層：從門牌、使照、海砂屋清冊、實價登錄推估。是候選，不是鑑定。</li>
          <li>為什麼用 1999 年：2024 年 4 月花蓮地震已貼單的 79 棟中，1999 年以前興建的約五成是紅、黃單；1999 年以後興建的約三成是黃單，沒有紅單（分母只有已貼單的建築）。</li>
          ${extra ? `<li>收容所：教育局一覽表的「服務里別」列到本里、震災欄是「是」或「備用」的處所；適合避難弱者的處數用消防署資料（原檔同一處重複列多次，已去重），依經緯度落到里。</li>
          <li>消防栓距離：每條紅黃區窄巷（門牌中心，推估）到最近一支消防栓的直線距離，四捨五入到 10 m；消防栓含新北市側。</li>` : ""}
          <li>文資：文化部文資局開放資料，代表點，不是保存範圍。</li>
        </ul>
      </details>
      <p><button class="btn" onclick="window.print()">🖨️ 列印這一頁</button></p>
      <p class="muted small">所有數字是公開資料的彙總與推估，相對於臺北其他里。不是任何一棟的鑑定。列管狀態以消防局、建管處為準。</p>`;
    requestAnimationFrame(() => requestAnimationFrame(() => $("#card").classList.add("grow")));
    $("#card").classList.remove("grow");
    if (window.Quest) {
      if (userPicked) Quest.done("選一個里");
      $("#card").querySelectorAll("ul.check input").forEach((cb) => cb.addEventListener("change", () => cb.checked && Quest.done("勾一項檢核")));
      $("#card").querySelector(".btn").addEventListener("click", () => Quest.done("列印檢核表"));
    }
  }
  let userPicked = false;
  document.addEventListener("click", () => { userPicked = true; }, { once: true, capture: true });
  document.addEventListener("change", () => { userPicked = true; }, { once: true, capture: true });


  // Layout self-check for headless runs: open with #debug and read data-* on <footer>.
  if (location.hash === "#debug") setTimeout(() => {
    const de = document.documentElement, W = de.clientWidth;
    const wide = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > W + 1)
      .slice(0, 12).map((el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "") + ":" + Math.round(el.getBoundingClientRect().right));
    const ft = $("#foot"); ft.dataset.scrollw = de.scrollWidth; ft.dataset.clientw = W; ft.dataset.wide = wide.join(" | ");
  }, 1500);

  const first = P.filter((p) => p.s5_candidate).sort((a, b) => b.lanes_total - a.lanes_total)[0];
  if (first) select(first.village_code);
})();

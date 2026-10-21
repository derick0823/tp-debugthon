/*
 * citizen.js  Page script for index.html (市民入口「我家危險嗎」, SPEC §6).
 * Depends on common.js (data loading, labels, formatting) and nextsteps.js
 * (NEXT_STEPS). Plain ES2020, no modules.
 *
 * Flow: pick a town -> load that town's building shard -> type an address
 * (autocomplete, at most 20 rows, matched on addr_norm) -> pick one row ->
 * render the result card (SPEC §6.2 sections 1..9) and the small Leaflet map.
 *
 * Privacy rules carried in code (BD10): sea_sand only renders when the text the
 * user typed matches the building exactly (searchBuildings().exact). Buildings
 * reached through a partial match never reveal list membership, not even via
 * the age source label or the next-step card selection.
 */

'use strict';

(function () {
  const $ = (sel) => document.querySelector(sel);

  // Basemap comes from common.js TILE_LAYERS (OpenStreetMap standard tiles).
  const OSM_TILES = TILE_LAYERS.light;

  const EXAMPLE = { town_name: '萬華區', address: '西園路2段261巷11號' };

  // Source line for the two heritage sentences (SPEC §6.2 rows 2 and 6).
  const HERITAGE_SOURCE_TEXT = '文化部文資局開放資料，2026-10-18';

  const state = {
    towns: [],
    townByName: new Map(),
    villages: null,
    villageIndex: null,
    meta: null,
    townCode: null,
    records: null,
    loadingTown: null,
    suggestions: [],
    activeIndex: -1,
    selected: null,
    exact: false,
    elderly: false,
    map: null,
    mapLayers: [],
  };

  const el = {};

  /* ------------------------------------------------------------ helpers */

  function isNil(v) { return v === null || v === undefined; }

  // Mirror of the mart rule: generation by "推定申請年 = built_year - 2".
  // Verified against all 70,326 shard rows that carry both fields (0 mismatches, 2026-10-18).
  function generationOfYear(year) {
    const y = Number(year);
    if (!Number.isFinite(y)) return null;
    const applied = y - 2;
    if (applied < 1974) return 'g1_pre1974';
    if (applied < 1982) return 'g2_1974_1982';
    if (applied < 1989) return 'g3_1982_1989';
    if (applied < 1997) return 'g4_1989_1997';
    if (applied < 2000) return 'g5_1997_1999';
    return 'g6_2000_plus';
  }

  // Sort door plates so 1號 comes before 10號: compare digit runs numerically.
  function naturalCompare(a, b) {
    const ka = String(buildingSearchKey(a)).split(/(\d+)/);
    const kb = String(buildingSearchKey(b)).split(/(\d+)/);
    const n = Math.max(ka.length, kb.length);
    for (let i = 0; i < n; i++) {
      const x = ka[i] || '';
      const y = kb[i] || '';
      if (x === y) continue;
      const nx = /^\d+$/.test(x) ? Number(x) : NaN;
      const ny = /^\d+$/.test(y) ? Number(y) : NaN;
      if (!Number.isNaN(nx) && !Number.isNaN(ny)) return nx - ny;
      return x.localeCompare(y, 'zh-Hant');
    }
    return 0;
  }

  function pctSmart(x) {
    if (isNil(x) || Number.isNaN(Number(x))) return '無資料';
    const v = Number(x);
    return v > 0 && v < 0.1 ? fmtPct(v, 1) : fmtPct(v, 0);
  }

  function fmtEst(x, digits = 1) {
    if (isNil(x) || Number.isNaN(Number(x))) return '無資料';
    return Number(x).toFixed(digits);
  }

  function pendingText(s) {
    return String(s || '').replace(/【待確認】/g, '請洽窗口確認').replace(/【推論】/g, '');
  }

  function setStatus(text, isError = false) {
    el.status.textContent = text || '';
    el.status.classList.toggle('is-error', Boolean(isError));
  }

  function sectionHtml(num, title, body, extraClass = '') {
    return `<section class="result-section ${extraClass}" aria-labelledby="sec-${num}">` +
      `<h2 id="sec-${num}"><span class="sec-num" aria-hidden="true">${num}</span>${escapeHtml(title)}</h2>${body}</section>`;
  }

  /* ---------------------------------------------------------- age info */

  // Returns {badgeKey, badgeSub, lead, sub, generation}
  function ageInfo(rec, exact) {
    const y = rec.built_year;
    const mn = rec.built_year_min;
    const mx = rec.built_year_max;
    const out = { badgeKey: 'undetermined', badgeSub: '', lead: '未判定', sub: '', generation: null, neighbor: false };

    if (!isNil(y)) {
      let src = AGE_SOURCE_LABELS[rec.age_source] || '';
      // A sea-sand list year is a use-permit year. Naming the list on a non-exact
      // match, or on a building whose flag the build dropped (list address not an
      // exact match, BD10), would reveal list membership, so say what the year is instead.
      const listShown = rec.age_source === 'sea_sand_list' && exact && Boolean(rec.sea_sand);
      if (rec.age_source === 'sea_sand_list' && !listShown) src = '使用執照年';
      if (rec.status === 'confirmed') {
        out.badgeKey = 'confirmed';
        // Keep the badge subtitle consistent with the lead; the list name only shows with the flag.
        out.badgeSub = listShown ? '建成年來自海砂屋清冊' : '建成年來自使用執照';
        out.lead = `已確認 ${y} 年${src ? `（${src}）` : ''}`;
      } else {
        out.badgeKey = 'estimated';
        out.badgeSub = '建成年來自實價登錄';
        out.lead = `推估 ${y} 年${src ? `（${src}）` : ''}`;
        if (rec.age_conf === 'medium') out.sub = '信心中：同棟各筆交易填的建成年相差超過 2 年，可能有增建或填寫不一致。';
        else if (rec.age_conf === 'high') out.sub = '信心高：同棟各筆交易的建成年相差 2 年以內。';
      }
      out.generation = rec.code_generation || generationOfYear(y);
      return out;
    }

    if (!isNil(mn) && !isNil(mx)) {
      out.neighbor = true;
      out.badgeKey = 'undetermined';
      out.badgeSub = '有鄰棟線索';
      out.lead = `依鄰棟推估 ${mn}～${mx} 年，信心低`;
      out.sub = '這棟沒有自己的年份紀錄；年份區間借自同巷弄 ±4 號內有年份的鄰棟，再各放寬 5 年。';
      const g1 = generationOfYear(mn);
      const g2 = generationOfYear(mx);
      out.generation = g1 === g2 ? g1 : null;
      return out;
    }

    out.badgeKey = 'undetermined';
    out.badgeSub = '沒有可用的年份紀錄';
    out.lead = '未判定';
    out.sub = LABELS.reason[rec.undetermined_reason] || '沒有使用執照或實價登錄可以推算建成年。';
    return out;
  }

  /* ------------------------------------------------------ result card */

  function renderResult() {
    const rec = state.selected;
    if (!rec) return;
    const exact = state.exact;
    const vf = state.villageIndex ? state.villageIndex.get(rec.village_code) : null;
    const vp = vf ? vf.properties : null;
    const villageName = vp ? vp.village_name : '';
    const parts = [];

    // 1. header
    const age = ageInfo(rec, exact);
    parts.push(
      `<section class="result-section result-head" aria-labelledby="sec-1">` +
        `<div>` +
          `<p class="addr-town">臺北市 ${escapeHtml(rec.town_name || '')}${villageName ? ` · ${escapeHtml(villageName)}` : ''}</p>` +
          `<h2 class="addr" id="sec-1">${escapeHtml(rec.address)}</h2>` +
          `<p class="addr-village">${villageName ? `所在里：${escapeHtml(villageName)}。` : ''}` +
            `門牌 ${fmtInt(rec.doorplate_units)} 筆${rec.on_main_road ? '，臨主要道路' : '，在巷弄內'}。</p>` +
        `</div>` +
        `<div class="status-big">` +
          `<span class="status-of">建成年狀態</span>` +
          `${badgeHtml(STATUS_LABELS[age.badgeKey], age.badgeKey)}` +
          `${age.badgeSub ? `<span class="status-sub">${escapeHtml(age.badgeSub)}</span>` : ''}` +
        `</div>` +
      `</section>`);

    // 2. this building
    {
      const gen = age.generation ? CODE_GENERATIONS[age.generation] : null;
      const facts = [];
      if (gen) facts.push(`<span><span class="fact-label">耐震規範世代</span>${escapeHtml(gen.text)}</span>`);
      else if (age.neighbor) facts.push(`<span><span class="fact-label">耐震規範世代</span>區間跨兩個世代，不標</span>`);
      if (rec.structure_class) {
        const st = rec.status_structure && STATUS_LABELS[rec.status_structure] ? `（${STATUS_LABELS[rec.status_structure]}）` : '';
        facts.push(`<span><span class="fact-label">構造</span>${escapeHtml(STRUCTURE_LABELS[rec.structure_class] || rec.structure_class)}${escapeHtml(st)}</span>`);
      }
      if (!isNil(rec.floors)) facts.push(`<span><span class="fact-label">地上層數</span>${fmtInt(rec.floors)} 層</span>`);
      if (rec.lvr_building_type && BUILDING_TYPE_LABELS[rec.lvr_building_type]) {
        facts.push(`<span><span class="fact-label">建物型態</span>${escapeHtml(BUILDING_TYPE_LABELS[rec.lvr_building_type])}</span>`);
      }
      if (rec.no_elevator_30plus) facts.push(`<span><span class="fact-label">電梯</span>30 年以上且沒有電梯 ${estimateTagHtml()}</span>`);
      const body =
        `<p class="lead">${escapeHtml(age.lead)}</p>` +
        (age.sub ? `<p class="lead-sub">${escapeHtml(age.sub)}</p>` : '') +
        (facts.length ? `<div class="facts-row">${facts.join('')}</div>` : '') +
        (age.badgeKey === 'undetermined' && !age.neighbor
          ? `<p class="note">判不出來的棟多半是門牌很少的小棟，不是隨機缺漏。下方「這個里」的推估可以當參考。</p>`
          : '') +
        // c8 2026-10-18: heritage pre-check. Only when the shard carries the column and it is true.
        (rec.near_heritage_50m === true
          ? `<p class="note heritage-note">附近 50 公尺內有文化資產。重建前可能需要文化局審查；不影響補強與耐震評估。` +
            `<span class="liq-src">${escapeHtml(HERITAGE_SOURCE_TEXT)}</span></p>`
          : '');
      parts.push(sectionHtml(2, '這棟房子', body));
    }

    // 3. liquefaction
    {
      const cell = (label, key, src) => {
        const v = rec[key];
        const text = isNil(v) ? '無資料' : (LIQ_LEVEL_LABELS[v] || v);
        return `<div class="liq-cell"><div class="liq-label">${escapeHtml(label)}</div>` +
          `<div class="liq-value"><span class="liq-dot liq-${escapeHtml(isNil(v) ? 'null' : v)}" aria-hidden="true"></span>${escapeHtml(text)}</div>` +
          `<div class="liq-src">${escapeHtml(src)}</div></div>`;
      };
      const agree = rec.liq_agreement ? (LIQ_AGREEMENT_LABELS[rec.liq_agreement] || rec.liq_agreement) : '無資料';
      const villageLiq = vp ? liqShareNote(vp, DEFAULT_LIQ_VERSION) : '';
      const body =
        `<div class="liq-grid">` +
          cell('城市版 2019', 'liq_level_city2019', 'soil.taipei 2019 版') +
          cell('全國 2026 版', 'liq_level_national2026', '經濟部地礦中心 2026（115/9/24 更新）') +
          `<div class="liq-cell"><div class="liq-label">兩版一致度</div><div class="liq-value">${escapeHtml(agree)}</div><div class="liq-src">比較兩版是否都判「高」</div></div>` +
        `</div>` +
        (villageLiq
          ? `<p class="note">所在里高潛勢占里面積 ${fmtPct(vp[`liq_high_share_${DEFAULT_LIQ_VERSION}`])}，${escapeHtml(villageLiq)}（${escapeHtml(LIQ_VERSIONS[DEFAULT_LIQ_VERSION].label)}）。</p>`
          : '') +
        `<p class="note"><strong>${escapeHtml(LIQ_SCALE_NOTE)}</strong> 液化潛勢圖是區域尺度的地質推估；要知道這塊地的狀況，請看下一步的液化自主檢查與鑽探資料。</p>`;
      parts.push(sectionHtml(3, '液化', body));
    }

    // 4. soft story candidate (only A or B)
    if (rec.soft_story_candidate === 'A' || rec.soft_story_candidate === 'B') {
      const text = rec.soft_story_candidate === 'A' ? 'A 型候選：連棟騎樓街屋' : 'B 型候選：底層開放的中高樓';
      const body =
        `<p class="lead">${escapeHtml(text)} ${estimateTagHtml()}</p>` +
        `<p class="note"><strong>${escapeHtml(SOFT_STORY_NOTE)}</strong> 依門牌、交易紀錄與建物型態篩出的樣態，要由專業機構的耐震初評才能判斷。</p>`;
      parts.push(sectionHtml(4, '一樓軟弱層候選', body));
    }

    // 5. listed by the city (exact match only)
    const seaSandVisible = exact && rec.sea_sand ? rec.sea_sand : null;
    const quakeVisible = exact && rec.quake_listed ? rec.quake_listed : null;
    if (seaSandVisible || quakeVisible) {
      let body = '';
      if (seaSandVisible) {
        const ver = rec.sea_sand_list_version ? `建管處 ${rec.sea_sand_list_version} 清冊` : '建管處清冊';
        body += `<p class="lead">已確認：市府列管海砂屋（${escapeHtml(ver)}）。</p>`;
        if (rec.sea_sand_list_address) body += `<p class="listed-addr">清冊地址：${escapeHtml(rec.sea_sand_list_address)}</p>`;
        body += `<p>類別：${escapeHtml(SEA_SAND_LABELS[seaSandVisible] || seaSandVisible)}。</p>`;
        body += `<p><a href="${SEA_SAND_OFFICIAL_URL}" target="_blank" rel="noopener">建管處「列管建築物」官方頁</a></p>`;
      }
      if (quakeVisible) {
        const ver = rec.quake_listed_version ? `建管處 ${rec.quake_listed_version} 清冊` : '建管處清冊';
        body += `<p class="lead">已確認：${escapeHtml(QUAKE_LISTED_LABELS[quakeVisible] || `${quakeVisible} 地震黃單`)}（${escapeHtml(ver)}）。</p>`;
        if (rec.quake_listed_address) body += `<p class="listed-addr">清冊地址：${escapeHtml(rec.quake_listed_address)}</p>`;
      }
      body += `<p class="note">列管狀態以建管處為準。本頁只轉載官方清冊原文，不另做比對判斷。</p>`;
      parts.push(sectionHtml(5, '市府列管', body, 'listed'));
    } else if (!exact) {
      parts.push(sectionHtml(5, '市府列管',
        `<p class="note">要查這個門牌是否在市府列管清冊（海砂屋），請在上方輸入完整門牌（含「號」）後按「查詢」。清冊只在完全符合的門牌顯示。</p>`));
    }

    // 6. this village
    if (vp) {
      const levels = villageFactorLevels(vp, DEFAULT_LIQ_VERSION);
      const liqHighKey = `liq_high_share_${DEFAULT_LIQ_VERSION}`;
      const sampleN = vp.bld_age_known_n;
      const sampleSmall = isNil(sampleN) || Number(sampleN) < 20;
      const numText = {
        elderly: `65 歲以上 ${fmtPct(vp.share_65plus)}`,
        old_stock: sampleSmall
          ? `1999 年前 ${fmtPct(vp.f_old_stock)}（樣本 ${fmtInt(sampleN || 0)} 棟，不足 20 棟，改用所在區中位數）`
          : `1999 年前 ${fmtPct(vp.bld_share_pre_policy_1999)}（樣本 ${fmtInt(sampleN)} 棟）`,
        liquefaction: `高潛勢占里面積 ${fmtPct(vp[liqHighKey])}${liqShareNote(vp, DEFAULT_LIQ_VERSION) ? `；${liqShareNote(vp, DEFAULT_LIQ_VERSION)}` : ''}`,
        rescue: `列管窄巷 ${fmtInt(vp.narrow_lanes_n)} 條、寬度 <6 m 標註 ${fmtPct(vp.road_markers_lt6m_share)}`,
        soft_story: `${fmtInt((Number(vp.soft_story_a_n) || 0) + (Number(vp.soft_story_b_n) || 0))} 棟`,
      };
      const tiles = levels.map((f) => {
        const lv = Number(f.level) || 0;
        const bars = [1, 2, 3, 4, 5].map((i) => `<span class="${i <= lv ? 'on' : ''}"></span>`).join('');
        return `<div class="tile ${lv ? levelClass(lv) : 'lv-none'}">` +
          `<div class="tile-name"><span>${escapeHtml(f.short || f.label)}</span>${f.kind === '推估' ? estimateTagHtml() : ''}</div>` +
          `${levelChipHtml(lv)}` +
          `<div class="tile-bar" aria-hidden="true">${bars}</div>` +
          `<div class="tile-num">${escapeHtml(numText[f.key] || '')}</div>` +
          `<div class="tile-date">資料日期 ${escapeHtml(f.data_date)}</div>` +
        `</div>`;
      }).join('');
      const share = vp[`share_top46_${DEFAULT_LIQ_VERSION}`];
      const shareText = isNil(share)
        ? '這個里沒有排名區間資料。'
        : (Number(share) <= 0
          ? '這個里在 2,000 組隨機權重下都<strong>沒有</strong>排進全市前 46 名（前 10%）。'
          : `這個里在 <strong>${escapeHtml(pctSmart(share))}</strong> 的權重組合下都排進全市前 46 名（前 10%）。`);
      const body =
        `<p class="ns-why">${escapeHtml(villageName)}（${escapeHtml(vp.town_name)}）的五個因子，各自分 1～5 級，5 級最危險。不合成單一總分。液化用${escapeHtml(LIQ_VERSIONS[DEFAULT_LIQ_VERSION].label)}。</p>` +
        `<div class="tiles">${tiles}</div>` +
        `<p class="village-summary">${shareText}</p>` +
        (Number(vp.heritage_sites_n) > 0
          ? `<p class="village-summary heritage-note">本里有登錄文化資產 ${fmtInt(vp.heritage_sites_n)} 處。` +
            `<span class="liq-src">${escapeHtml(HERITAGE_SOURCE_TEXT)}</span></p>`
          : '') +
        `<p class="note"><strong>等級是相對於臺北市其他里。</strong> 排名區間是預先用 2,000 組隨機權重算的，不是哪一組權重的結論。</p>`;
      parts.push(sectionHtml(6, '這個里', body));

      // 7. known cases in this village
      const body7 =
        `<div class="cases">` +
          `<div class="case"><span class="case-num">${fmtInt(vp.sea_sand_cases_n)}</span><span class="case-label">海砂屋列管案</span></div>` +
          `<div class="case"><span class="case-num">${fmtInt(vp.quake_listed_n)}</span><span class="case-label">地震黃單筆數</span></div>` +
          `<div class="case"><span class="case-num">約 ${escapeHtml(fmtEst(vp.weilao_active_est, 1))}</span><span class="case-label">有效危老核准案 ${estimateTagHtml()}</span></div>` +
        `</div>` +
        `<p class="note">本里海砂屋列管 ${fmtInt(vp.sea_sand_cases_n)} 案、地震黃單 ${fmtInt(vp.quake_listed_n)} 筆、有效危老核准案約 ${escapeHtml(fmtEst(vp.weilao_active_est, 1))} 件（依路段分攤的期望值）。` +
        `海砂屋 115/3/25 版、黃單 115/3/18 版、危老 1151002 版。件數是用清冊地址比對到里的結果，門牌不公開。</p>`;
      parts.push(sectionHtml(7, '里層級已知案件', body7));
    } else {
      parts.push(sectionHtml(6, '這個里', `<p class="note">找不到這棟所在里（${escapeHtml(rec.village_code || '')}）的里層級資料。</p>`));
    }

    // 8. next steps
    parts.push(sectionHtml(8, '下一步', renderNextSteps(rec, exact, state.elderly)));

    // 9. map
    parts.push(sectionHtml(9, '位置與里界',
      `<div class="map-stage"><div id="map" class="map" role="img" aria-label="這棟房子的位置與所在里界"></div>` +
      `<div id="map-note" class="map-note" hidden></div></div>` +
      `<div class="map-legend-row"><span class="lg"><span class="lg-point"></span>這棟房子</span><span class="lg"><span class="lg-area"></span>${escapeHtml(villageName || '所在里')}里界</span></div>` +
      `<p class="note">座標是該棟各樓層門牌座標的平均（門牌 2026-10-02 版）；里界 115/8/17 版。</p>`));

    el.result.innerHTML = `<article class="card result-card">${parts.join('')}</article>`;
    el.result.hidden = false;
    renderMap(rec, vf);
    updateUrl();
    if (window.matchMedia && window.matchMedia('(max-width: 719px)').matches) {
      el.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ------------------------------------------------------- next steps */

  function pickNextSteps(rec, exact, elderly) {
    const picks = new Set([1, 15, 16]);
    const y = rec.built_year;
    const mx = rec.built_year_max;
    const old = rec.status === 'undetermined' ||
      (!isNil(y) && Number(y) <= 1999) ||
      (isNil(y) && !isNil(mx) && Number(mx) <= 1999);
    if (old) [2, 3, 4, 5, 6, 11].forEach((n) => picks.add(n));
    if (rec.no_elevator_30plus || (!isNil(rec.floors) && Number(rec.floors) <= 6 && !isNil(y) && Number(y) <= 1996)) picks.add(10);
    if (exact && rec.sea_sand) { picks.add(8); picks.add(9); }
    if (exact && rec.quake_listed) picks.add(8);
    if (elderly) [12, 13, 14].forEach((n) => picks.add(n));
    if (picks.has(5) || picks.has(6)) picks.add(17);
    return picks;
  }

  function deadlineHtml(row) {
    let text = pendingText(row.deadline);
    let flag = '';
    if (row.deadline_date) {
      const d = new Date(`${row.deadline_date}T23:59:59`);
      const days = Math.floor((d.getTime() - Date.now()) / 86400000);
      if (days < 0) flag = badgeHtml('已截止', 'undetermined');
      else if (days <= 60) flag = badgeHtml('快截止', 'warn');
    }
    return `<span>${escapeHtml(text)}</span>${flag}`;
  }

  function renderNextSteps(rec, exact, elderly) {
    const picks = pickNextSteps(rec, exact, elderly);
    const rows = (window.NEXT_STEPS || []).filter((r) => picks.has(r.order)).sort((a, b) => a.order - b.order);
    const cards = rows.map((r) => {
      let money = r.general;
      if (elderly && r.elderly && r.elderly !== '同左') money = r.elderly;
      else if (r.general === '—' && r.elderly && r.elderly !== '同左') money = r.elderly;
      money = pendingText(money);
      const entry = r.entry_url
        ? `<a href="${escapeHtml(r.entry_url)}" target="_blank" rel="noopener">${escapeHtml(r.entry_text)}</a>`
        : escapeHtml(r.entry_text);
      return `<article class="ns-card">` +
        `<div class="ns-head"><h3>${escapeHtml(r.title)}</h3><span class="ns-order">#${r.order}</span></div>` +
        `<p class="ns-what">${escapeHtml(r.what)}</p>` +
        `<dl>` +
          `<dt>誰可以申請</dt><dd>${escapeHtml(pendingText(r.who))}</dd>` +
          `<dt>${elderly ? '金額（高齡戶）' : '金額'}</dt><dd class="ns-money">${escapeHtml(money)}</dd>` +
          `<dt>截止</dt><dd class="ns-deadline">${deadlineHtml(r)}</dd>` +
          `<dt>入口</dt><dd class="ns-entry">${entry}</dd>` +
        `</dl>` +
        `<div class="ns-foot">資料日期 ${escapeHtml(window.NEXT_STEPS_DATA_DATE || '2026-10-18')}。以主管機關公告為準。來源：${escapeHtml(r.source)}</div>` +
      `</article>`;
    }).join('');
    const why = [];
    why.push('依這棟房子的狀況挑出的項目');
    if (elderly) why.push('已切換成高齡戶欄位');
    return `<p class="ns-why">${escapeHtml(why.join('，'))}。共 ${rows.length} 張，順序照建議的先後。</p>` +
      `<div class="steps-grid">${cards}</div>`;
  }

  /* -------------------------------------------------------------- map */

  function renderMap(rec, villageFeature) {
    const container = $('#map');
    const note = $('#map-note');
    if (!container) return;
    const showNote = (t) => { if (note) { note.textContent = t; note.hidden = false; } };

    if (isNil(rec.lat) || isNil(rec.lon)) {
      showNote('這棟沒有座標，無法標在地圖上。');
      return;
    }

    loadLeaflet().then((L) => {
      // A fresh container is rendered each time, so always create a new map.
      if (state.map) { try { state.map.remove(); } catch (e) { /* ignore */ } state.map = null; }
      const map = L.map(container, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      state.map = map;
      // Vector layers need a view before they are added, or Leaflet throws in _clipPoints.
      map.setView([Number(rec.lat), Number(rec.lon)], 16);

      let tileFailed = false;
      const tiles = L.tileLayer(OSM_TILES.url, { attribution: OSM_TILES.attribution, maxZoom: OSM_TILES.maxZoom });
      tiles.on('tileerror', () => {
        if (!tileFailed) { tileFailed = true; showNote('底圖載入失敗，仍顯示位置與里界。'); }
      });
      tiles.addTo(map);

      const point = L.latLng(Number(rec.lat), Number(rec.lon));
      let bounds = L.latLngBounds(point, point);
      if (villageFeature) {
        const poly = L.geoJSON(villageFeature, {
          style: { color: '#1f5f8b', weight: 2, fillColor: '#1f5f8b', fillOpacity: 0.12 },
        }).addTo(map);
        const vn = villageFeature.properties.village_name || '';
        poly.bindTooltip(`${vn}（里界）`, { sticky: true });
        bounds = poly.getBounds().extend(point);
      }
      L.circleMarker(point, { radius: 8, color: '#ffffff', weight: 2, fillColor: '#1f5f8b', fillOpacity: 1 })
        .addTo(map)
        .bindPopup(`<strong>${escapeHtml(rec.address)}</strong><br>${escapeHtml(rec.town_name || '')}`);
      map.fitBounds(bounds.pad(0.08), { maxZoom: 17 });
      requestAnimationFrame(() => map.invalidateSize());
    }).catch((err) => {
      console.error('map render failed', err);
      showNote('地圖程式載入失敗。位置與里界無法顯示，其他內容不受影響。');
    });
  }

  /* -------------------------------------------------------- query flow */

  function populateTowns() {
    const opts = ['<option value="">請選擇</option>'];
    for (const t of state.towns) {
      opts.push(`<option value="${escapeHtml(t.town_code)}">${escapeHtml(t.town_name)}（${fmtInt(t.n_buildings)} 棟）</option>`);
    }
    el.town.innerHTML = opts.join('');
  }

  function selectTown(code) {
    if (!code) {
      state.townCode = null;
      state.records = null;
      el.input.disabled = true;
      el.searchBtn.disabled = true;
      setStatus('先選一個區。');
      return Promise.resolve(null);
    }
    if (code === state.townCode && state.records) return Promise.resolve(state.records);
    const town = state.towns.find((t) => t.town_code === code);
    state.townCode = code;
    state.records = null;
    state.loadingTown = code;
    el.town.value = code;
    el.input.disabled = false;
    el.searchBtn.disabled = false;
    closeList();
    setStatus(`載入${town ? town.town_name : ''} ${town ? fmtInt(town.n_buildings) : ''} 棟門牌中…`);
    return loadTown(code).then((recs) => {
      if (state.loadingTown !== code) return null;
      state.records = recs;
      setStatus(`${town ? town.town_name : ''}已載入 ${fmtInt(recs.length)} 棟門牌。輸入路名、巷弄與號。`);
      if (el.input.value.trim()) runSearch();
      return recs;
    }).catch((err) => {
      if (state.loadingTown !== code) return null;
      setStatus(`讀不到這一區的門牌資料（${err && err.message ? err.message : '未知錯誤'}）。請確認 data/buildings/ 已產生。`, true);
      return null;
    });
  }

  function maybeSwitchTown(text) {
    const parsed = parseAddress(text);
    if (parsed.town_name && state.townByName.has(parsed.town_name)) {
      const code = state.townByName.get(parsed.town_name);
      if (code !== state.townCode) selectTown(code);
    }
  }

  function runSearch() {
    const q = el.input.value;
    if (!state.records) { closeList(); return; }
    if (!normalizeAddress(q)) { closeList(); return; }
    const res = searchBuildings(state.records, q, 20);
    const exactIds = new Set(res.exact.map((r) => r.point_id));
    const similar = res.similar.filter((r) => !exactIds.has(r.point_id)).sort(naturalCompare);
    const list = res.exact.concat(similar).slice(0, 20);
    state.suggestions = list.map((r) => ({ rec: r, exact: exactIds.has(r.point_id) }));
    state.activeIndex = -1;
    renderList();
    if (!list.length) setStatus('找不到這個門牌。試試只輸入路名與巷弄，或確認區選對了。');
    else setStatus(`${list.length} 筆相近門牌${list.length >= 20 ? '（只列前 20 筆，再多打幾個字）' : ''}。`);
  }

  function renderList() {
    if (!state.suggestions.length) { closeList(); return; }
    el.list.innerHTML = state.suggestions.map((s, i) =>
      `<li role="option" id="opt-${i}" data-i="${i}" class="${s.exact ? 'combo-exact' : ''}" aria-selected="${i === state.activeIndex}">` +
        `<span>${escapeHtml(s.rec.address)}</span>` +
        `<span class="combo-town">${s.exact ? '完全符合 · ' : ''}${escapeHtml(s.rec.town_name || '')}</span>` +
      `</li>`).join('');
    el.list.hidden = false;
    el.input.setAttribute('aria-expanded', 'true');
  }

  function closeList() {
    el.list.hidden = true;
    el.list.innerHTML = '';
    el.input.setAttribute('aria-expanded', 'false');
    el.input.removeAttribute('aria-activedescendant');
    state.activeIndex = -1;
  }

  function setActive(i) {
    if (!state.suggestions.length) return;
    const n = state.suggestions.length;
    state.activeIndex = ((i % n) + n) % n;
    for (const li of el.list.children) li.setAttribute('aria-selected', String(Number(li.dataset.i) === state.activeIndex));
    el.input.setAttribute('aria-activedescendant', `opt-${state.activeIndex}`);
    const li = el.list.children[state.activeIndex];
    if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
  }

  function choose(rec, exact) {
    state.selected = rec;
    state.exact = Boolean(exact);
    el.input.value = rec.address;
    closeList();
    setStatus(exact ? '完全符合的門牌。' : '相近門牌。要查市府列管清冊，請輸入完整門牌後按「查詢」。');
    renderResult();
  }

  function submit() {
    if (!state.records) {
      setStatus(state.townCode ? '門牌還在載入，請稍候。' : '先選一個區。', !state.townCode);
      return;
    }
    const q = el.input.value;
    if (!normalizeAddress(q)) { setStatus('請輸入地址。'); return; }
    const res = searchBuildings(state.records, q, 20);
    if (res.exact.length) { choose(res.exact[0], true); return; }
    if (state.activeIndex >= 0 && state.suggestions[state.activeIndex]) {
      const s = state.suggestions[state.activeIndex];
      choose(s.rec, s.exact);
      return;
    }
    if (res.similar.length === 1) { choose(res.similar[0], false); return; }
    runSearch();
    if (res.similar.length) setStatus(`沒有完全符合的門牌，請從 ${Math.min(res.similar.length, 20)} 筆相近門牌裡選一筆。`);
  }

  function updateUrl() {
    try {
      const u = new URL(window.location.href);
      if (state.townCode) u.searchParams.set('t', state.townCode); else u.searchParams.delete('t');
      if (state.selected) u.searchParams.set('q', state.selected.address); else u.searchParams.delete('q');
      if (state.elderly) u.searchParams.set('e', '1'); else u.searchParams.delete('e');
      history.replaceState(null, '', u.toString());
    } catch (e) { /* ignore */ }
  }

  function applyUrlParams() {
    let params;
    try { params = new URL(window.location.href).searchParams; } catch (e) { return; }
    const t = params.get('t');
    const q = params.get('q');
    const e = params.get('e');
    if (e === '1') { state.elderly = true; el.elderly.checked = true; }
    let code = null;
    if (t && state.towns.some((x) => x.town_code === t)) code = t;
    else if (t && state.townByName.has(t)) code = state.townByName.get(t);
    if (!code && q) {
      const parsed = parseAddress(q);
      if (parsed.town_name && state.townByName.has(parsed.town_name)) code = state.townByName.get(parsed.town_name);
    }
    if (!code) return;
    if (q) el.input.value = q;
    selectTown(code).then((recs) => { if (recs && q) submit(); });
  }

  function useExample() {
    const code = state.townByName.get(EXAMPLE.town_name);
    if (!code) return;
    el.input.value = EXAMPLE.address;
    selectTown(code).then((recs) => { if (recs) submit(); });
  }

  /* ------------------------------------------------------------- init */

  function bind() {
    el.town.addEventListener('change', () => { selectTown(el.town.value); el.input.focus(); });

    const debouncedSearch = debounce(() => { maybeSwitchTown(el.input.value); runSearch(); }, 120);
    el.input.addEventListener('input', debouncedSearch);
    el.input.addEventListener('focus', () => { if (state.suggestions.length && el.input.value) renderList(); });
    el.input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (el.list.hidden) runSearch(); setActive(state.activeIndex + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(state.activeIndex - 1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
      else if (ev.key === 'Escape') { closeList(); }
    });
    el.list.addEventListener('mousedown', (ev) => {
      const li = ev.target.closest('li[data-i]');
      if (!li) return;
      ev.preventDefault();
      const s = state.suggestions[Number(li.dataset.i)];
      if (s) choose(s.rec, s.exact);
    });
    document.addEventListener('click', (ev) => {
      if (!el.combo.contains(ev.target)) closeList();
    });
    el.searchBtn.addEventListener('click', submit);
    el.elderly.addEventListener('change', () => {
      state.elderly = el.elderly.checked;
      if (state.selected) renderResult();
      else updateUrl();
    });
    const ex = $('#use-example');
    if (ex) ex.addEventListener('click', useExample);
  }

  function init() {
    el.town = $('#town-select');
    el.input = $('#addr-input');
    el.list = $('#addr-list');
    el.combo = $('#addr-combo');
    el.status = $('#query-status');
    el.searchBtn = $('#search-btn');
    el.elderly = $('#elderly-check');
    el.result = $('#result');
    el.footer = $('#footer');

    el.input.disabled = true;
    el.searchBtn.disabled = true;
    setStatus('載入區清單中…');
    bind();

    const pTowns = loadTowns().then((towns) => {
      state.towns = towns;
      for (const t of towns) state.townByName.set(t.town_name, t.town_code);
      populateTowns();
      setStatus('先選一個區。');
    });
    const pVillages = loadVillages().then((g) => {
      state.villages = g;
      state.villageIndex = indexVillages(g);
    }).catch(() => { state.villages = null; state.villageIndex = null; });
    const pMeta = loadMeta().catch(() => null).then((meta) => {
      state.meta = meta;
      renderFooter(el.footer, meta);
    });

    Promise.all([pTowns, pVillages, pMeta]).then(applyUrlParams).catch((err) => {
      setStatus(`資料載入失敗：${err && err.message ? err.message : err}`, true);
      renderFooter(el.footer, null);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/*
 * brief.js  One-page village brief (brief.html). Reads ?v=<village_code>
 * (several codes separated by commas render one page each) and optional
 * ?liq=national2026|city2019. Load after common.js and city.js; the shared
 * text helpers come from window.CityShared.
 *
 * Second tab 府函段落 (SPEC §11): per village, sentences built only from raw
 * statistics and confirmed lists, with a 複製全部 button. Hidden when printing.
 */

'use strict';

(function () {
  const root = document.getElementById('brief-root');
  if (!root) return;
  const S = window.CityShared;

  const params = new URLSearchParams(window.location.search);
  const codes = (params.get('v') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const liq = params.get('liq');
  const version = liq && LIQ_VERSIONS[liq] ? liq : DEFAULT_LIQ_VERSION;
  const otherVersion = version === 'national2026' ? 'city2019' : 'national2026';

  function metaFactor(meta, key) {
    return ((meta && meta.factors) || []).find((f) => f.key === key) || {};
  }

  function dateOf(meta, key) {
    const d = meta && meta.data_dates && meta.data_dates[key];
    return d ? { date: d.date, source: d.source } : { date: '', source: '' };
  }

  function factorTableHtml(p, meta, n) {
    const rows = [];
    for (const f of FACTORS) {
      const mf = metaFactor(meta, f.key);
      if (f.versioned) {
        for (const ver of [version, otherVersion]) {
          const lv = p[`lv_liquefaction_${ver}`];
          const label = `液化（${LIQ_VERSIONS[ver].label}）${ver === version ? '' : '，對照'}`;
          // marts README item 6: national2026 columns carry the source note '經濟部地礦中心 2026，僅供對照'.
          let src = meta && meta.liq_versions && meta.liq_versions[ver] ? meta.liq_versions[ver].source : '';
          if (ver === 'national2026') src = `${src}（經濟部地礦中心 2026，僅供對照）`;
          rows.push(`<tr>
            <td>${escapeHtml(label)}</td>
            <td>${levelChipHtml(lv)}</td>
            <td>${escapeHtml(S.factorSentence('liquefaction', p, ver))}${liqShareNote(p, ver) ? `；${escapeHtml(liqShareNote(p, ver))}` : ''}</td>
            <td>${escapeHtml(LIQ_VERSIONS[ver].data_date)}</td>
            <td class="slug">${escapeHtml(src)}</td>
            <td>原始</td>
          </tr>`);
        }
        continue;
      }
      const lv = p[factorField(f.key, 'lv', version)];
      rows.push(`<tr>
        <td>${escapeHtml(f.label)}</td>
        <td>${levelChipHtml(lv)}</td>
        <td>${escapeHtml(S.factorSentence(f.key, p, version))}</td>
        <td>${escapeHtml(mf.data_date || f.data_date)}</td>
        <td class="slug">${escapeHtml(mf.source || '')}</td>
        <td>${escapeHtml(f.kind)}</td>
      </tr>`);
    }
    const clv = p[`composite_level_${version}`];
    rows.push(`<tr class="is-composite">
      <td>等權合成 <span class="tag">${escapeHtml(COMPOSITE_NOTE)}</span></td>
      <td>${levelChipHtml(clv)}</td>
      <td>五個百分位的平均；等權排名第 ${fmtInt(p[`composite_rank_${version}`])}／${n}</td>
      <td>同上</td>
      <td class="slug">village_rankings</td>
      <td>推估</td>
    </tr>`);
    return `<div class="table-wrap"><table class="table brief-table">
      <thead><tr><th>因子</th><th>等級</th><th>數字</th><th>資料日期</th><th>來源</th><th>類型</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div>`;
  }

  function knownCasesTableHtml(p, meta) {
    const sea = dateOf(meta, 'sea_sand');
    const quake = dateOf(meta, 'quake_listed');
    const weilao = dateOf(meta, 'weilao');
    const heritageDate = dateOf(meta, 'heritage');
    const heritage = { date: heritageDate.date || '2026-10-18 下載', source: heritageDate.source || 'cultural-heritage-boch' };
    const heritageN = S.heritageCount(p);
    const rows = [
      ['海砂屋列管', `${fmtInt(p.sea_sand_cases_n)} 案（${fmtInt(p.sea_sand_units)} 戶）`, sea, '推估（地址比對落里）'],
      ['地震黃單（921、331、403）', `${fmtInt(p.quake_listed_n)} 筆`, quake, '推估（第一個地址落里）'],
      ['有效危老核准案', `約 ${S.fmtEst(p.weilao_active_est, 1)} 件（依路段分攤的期望值）`, weilao, '推估'],
      ['所在區有效危老核准案', `${fmtInt(p.town_weilao_active_n)} 件；每千棟 30 年以上建物 ${S.fmtEst(p.town_weilao_per_1k_old_bld, 2)} 件`, weilao, '原始（區層級）'],
      // c8 2026-10-18: listed heritage sites inside the village, 文化部文資局開放資料
      ['文化資產（處）', heritageN === null ? '無資料' : `${fmtInt(heritageN)} 處（古蹟、歷史建築、紀念建築、聚落建築群）`, heritage, '原始（文化部文資局開放資料）'],
    ];
    return `<div class="table-wrap"><table class="table brief-table">
      <thead><tr><th>項目</th><th>數字</th><th>資料日期</th><th>來源</th><th>類型</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2].date)}</td><td class="slug">${escapeHtml(r[2].source)}</td><td>${escapeHtml(r[3])}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function pageHtml(p, meta, n) {
    const pop = dateOf(meta, 'population');
    return `<article class="brief-page">
      <header class="brief-head">
        <div>
          <span class="eyebrow">一頁里況說明 ・ 臺北市老屋耐震優先順序 賽前原型</span>
          <h2>${escapeHtml(p.town_name)} ${escapeHtml(p.village_name)}</h2>
        </div>
        <div class="brief-meta">
          里代碼 ${escapeHtml(p.village_code)}<br>
          人口 ${fmtInt(p.pop_total)} 人，65 歲以上 ${fmtPct(p.share_65plus)}，80 歲以上 ${fmtPct(p.share_80plus)}（${escapeHtml(pop.date)}）<br>
          面積 ${S.fmtEst(p.area_km2, 2)} km²，門牌 ${fmtInt(p.doorplate_buildings)} 棟、${fmtInt(p.doorplate_units)} 筆
        </div>
      </header>

      <section class="brief-section">
        <h3>五因子等級 <span class="hint">${RELATIVE_NOTE}；5 級＝最危險的 1.6%，1 級＝其餘 45.2%</span></h3>
        ${factorTableHtml(p, meta, n)}
      </section>

      <div class="brief-grid">
        <section class="brief-section">
          <h3>排名區間 <span class="hint">1 最危險，共 ${n} 里；液化用${escapeHtml(LIQ_VERSIONS[version].label)}</span></h3>
          ${S.rankBarHtml(p, version, { n })}
          <p class="rank-text">${escapeHtml(S.shareTop46Sentence(p, version))}</p>
          <p class="panel-line muted">${escapeHtml((meta && meta.rank_interval_note) || '權重從平坦 Dirichlet 分布抽 2,000 次，記錄每個里排名的第 5、50、95 百分位。')}</p>
        </section>

        <section class="brief-section">
          <h3>被總分藏起來的因子</h3>
          ${S.hiddenHtml(p, version)}
          <h3 style="margin-top:12px">救災可及性候選 S5</h3>
          ${S.s5Html(p)}
        </section>
      </div>

      <section class="brief-section">
        <h3>里層級已知案件與危老 <span class="hint">筆數，不列門牌</span></h3>
        ${knownCasesTableHtml(p, meta)}
      </section>

      <footer class="brief-foot">
        <p><b>${escapeHtml((meta && meta.disclaimer) || DISCLAIMER)}</b></p>
        <p>${escapeHtml((meta && meta.data_note) || DATA_NOTE)}</p>
        <p>${meta && meta.generated ? `資料檔產生日 ${escapeHtml(meta.generated)}。` : ''}欄位定義見 data/marts/README.md。老屋存量、救災不便、一樓軟弱層候選三個因子與所有里層級比例是推估值，不能當普查值引用。</p>
      </footer>
    </article>`;
  }

  /* ------------------------------------------------- 府函段落 (SPEC §11) */

  // Sentences a clerk can paste into an official reply. Only raw statistics and
  // confirmed records: no estimated factors (no pre-1999 share, no 一樓軟弱層候選,
  // no 危老 expected counts). A sentence whose value is missing is left out whole.
  const letterRoot = document.getElementById('letter-root');

  function has(...vals) {
    return vals.every((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
  }

  function pct1(x) {
    return (Number(x) * 100).toFixed(1);
  }

  function intText(x) {
    return Number(x).toLocaleString('zh-Hant-TW');
  }

  function letterSentences(p) {
    const town = p.town_name || '';
    const out = [];

    // (a) population
    if (has(p.pop_total, p.pop_65plus, p.share_65plus, p.pop_80plus, p.share_80plus)) {
      out.push(`${town}${p.village_name}截至 115 年 9 月設籍人口 ${intText(p.pop_total)} 人，其中 65 歲以上 ${intText(p.pop_65plus)} 人（${pct1(p.share_65plus)}%）、80 歲以上 ${intText(p.pop_80plus)} 人（${pct1(p.share_80plus)}%）。（資料來源：臺北市民政局各里人口數按年齡分，115 年 9 月）`);
    }

    // (b) buildings; the three clauses each have their own source, so each is dropped on its own
    {
      const clauses = [];
      if (has(p.doorplate_buildings, p.doorplate_units)) {
        let c = `該里門牌建物約 ${intText(p.doorplate_buildings)} 棟、門牌 ${intText(p.doorplate_units)} 筆`;
        if (has(p.new2001_units)) c += `；2001 年後取得使用執照之新建戶數 ${intText(Math.round(Number(p.new2001_units)))} 戶`;
        clauses.push(`${c}。`);
      }
      if (has(p.town_share_age_30plus)) clauses.push(`所在${town} 30 年以上建物占 ${pct1(p.town_share_age_30plus)}%。`);
      if (clauses.length) out.push(`${clauses.join('')}（資料來源：臺北市民政局門牌位置 2026-10-02 版、建管處使用執照摘要、臺北市稅捐稽徵處 115 年度房屋稅籍統計）`);
    }

    // (c) liquefaction, two versions, each clause dropped on its own
    {
      const clauses = [];
      if (has(p.liq_high_share_city2019, p.liq_medium_share_city2019)) {
        clauses.push(`依臺北市政府工務局大地工程處土壤液化潛勢圖（2019 年版），該里高潛勢區占里面積 ${pct1(p.liq_high_share_city2019)}%、中潛勢 ${pct1(p.liq_medium_share_city2019)}%`);
      }
      if (has(p.liq_high_share_national2026, p.liq_medium_share_national2026)) {
        clauses.push(`依經濟部地質調查及礦業管理中心 115 年 9 月版，高 ${pct1(p.liq_high_share_national2026)}%、中 ${pct1(p.liq_medium_share_national2026)}%`);
      }
      if (clauses.length) out.push(`${clauses.join('；')}。（面積比例，區域尺度）`);
    }

    // (d) fire and rescue
    if (has(p.fire_access_lanes, p.narrow_lanes_n, p.fire_rescue_sites_n)) {
      out.push(`消防局消防通道列管 ${intText(Math.round(Number(p.fire_access_lanes)))} 條、狹小巷道紅黃區 ${intText(p.narrow_lanes_n)} 條、火災搶救困難場所 ${intText(p.fire_rescue_sites_n)} 處。（原始清冊，2026-10-17 下載；跨里者按比例分攤）`);
    }

    // (e) listed cases
    {
      const clauses = [];
      if (has(p.sea_sand_cases_n, p.quake_listed_n)) {
        clauses.push(`海砂屋列管 ${intText(p.sea_sand_cases_n)} 案（建管處 115 年 3 月 25 日清冊）、地震黃單 ${intText(p.quake_listed_n)} 筆（115 年 3 月 18 日清冊）`);
      }
      if (has(p.town_weilao_active_n)) clauses.push(`所在${town}有效危老核准案 ${intText(p.town_weilao_active_n)} 件（1151002 版清冊）`);
      if (has(p.heritage_sites_n)) clauses.push(`登錄文化資產 ${intText(p.heritage_sites_n)} 處（文化部文資局開放資料）`);
      if (clauses.length) out.push(`${clauses.join('；')}。`);
    }

    // (f) fixed text on current subsidies
    out.push('現行補助：耐震初評每棟補助 1.2 萬元；補強工程補助 50%、每案上限 1,200 萬元（策略地區等 80%、2,000 萬元）；6 樓以下無電梯公寓增設電梯補助 50%、每座上限 300 萬元（戶內有 65 歲以上長者 80%、480 萬元）。（資料日期 2026-10-18，以主管機關公告為準）');
    return out;
  }

  function letterText(features) {
    return features.map((f) => {
      const p = f.properties;
      return `${p.town_name}${p.village_name}\n${letterSentences(p).join('\n')}`;
    }).join('\n\n');
  }

  // Appended to the copied text only (not shown on the page): browser local time, YYYY-MM-DD HH:mm.
  function stampNow(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function letterTextWithStamp(features) {
    return `${letterText(features)}\n（本段由原型於 ${stampNow()} 產生，資料版本見各句括號）`;
  }

  function renderLetter(features) {
    if (!letterRoot) return;
    if (!features.length) {
      letterRoot.innerHTML = '<p class="muted">網址少了里代碼，沒有可寫的段落。</p>';
      return;
    }
    const blocks = features.map((f) => {
      const p = f.properties;
      const sentences = letterSentences(p);
      return `<article class="letter-block">
        <h3>${escapeHtml(p.town_name)} ${escapeHtml(p.village_name)}</h3>
        ${sentences.map((s, i) => `<p class="${i === sentences.length - 1 ? 'letter-fixed' : ''}">${escapeHtml(s)}</p>`).join('')}
      </article>`;
    }).join('');
    letterRoot.innerHTML = `
      <div class="letter-toolbar">
        <span class="muted">只用原始統計與已確認清冊；不放推估類因子（1999 年前比例、一樓軟弱層候選、危老期望件數）。缺值的句子整句省略。</span>
        <span class="row" style="gap:8px">
          <span class="letter-copied" id="letter-copied" aria-live="polite"></span>
          <button type="button" class="btn btn-primary" id="btn-copy-letter">複製全部</button>
        </span>
      </div>
      <div id="letter-text">${blocks}</div>
      <p class="letter-note">依據：議會書面質詢答復最常寫日期與期程、法規條號、全市件數、既有措施、補助金額。本分頁不列印。按「複製全部」時會在文字最後附一行產生時間（瀏覽器當下時間）。</p>`;

    const btn = document.getElementById('btn-copy-letter');
    const copied = document.getElementById('letter-copied');
    // Built at click time so the stamp is the moment of copying.
    const text = () => letterTextWithStamp(features);
    const fallbackSelect = () => {
      const el = document.getElementById('letter-text');
      if (!el) return;
      try {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        if (copied) copied.textContent = '已選取文字，請按 Ctrl+C';
      } catch (e) { /* ignore */ }
    };
    if (btn) btn.addEventListener('click', () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text()).then(() => {
          if (copied) copied.textContent = '已複製';
          setTimeout(() => { if (copied) copied.textContent = ''; }, 2500);
        }).catch(fallbackSelect);
      } else {
        fallbackSelect();
      }
    });
  }

  function bindBriefTabs() {
    const tabs = document.getElementById('brief-tabs');
    if (!tabs) return;
    const panels = { brief: root, letter: letterRoot };
    const setTab = (key) => {
      tabs.querySelectorAll('[role="tab"]').forEach((b) => {
        const on = b.dataset.tab === key;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      Object.entries(panels).forEach(([k, el]) => { if (el) el.hidden = k !== key; });
      const printBtn = document.getElementById('btn-print');
      if (printBtn) printBtn.disabled = key !== 'brief';
    };
    tabs.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const keys = ['brief', 'letter'];
      const cur = tabs.querySelector('[role="tab"][aria-selected="true"]');
      const idx = keys.indexOf(cur ? cur.dataset.tab : 'brief');
      const next = keys[(idx + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
      setTab(next);
      tabs.querySelector(`[data-tab="${next}"]`).focus();
    });
    setTab('brief');
  }

  async function init() {
    let villages;
    let meta;
    try {
      [villages, meta] = await Promise.all([loadVillages(), loadMeta()]);
    } catch (err) {
      root.innerHTML = `<div class="callout callout-warn brief-error">資料載不進來：${escapeHtml(err.message)}。請從 prototype 目錄用 http 伺服器開啟。</div>`;
      return;
    }
    const byCode = indexVillages(villages);
    const n = villages.features.length;

    if (!codes.length) {
      root.innerHTML = `<div class="card brief-error">
        <p>網址少了里代碼。請從<a href="city.html">市府入口</a>選一個里，按「一頁里況說明」；或直接在網址加 <code>?v=&lt;village_code&gt;</code>，多個里用逗號分開。</p>
        <p class="muted small">例：<a href="brief.html?v=${escapeHtml(villages.features[0].properties.village_code)}">brief.html?v=${escapeHtml(villages.features[0].properties.village_code)}</a></p>
      </div>`;
      return;
    }

    const found = codes.filter((c) => byCode.has(c));
    const missing = codes.filter((c) => !byCode.has(c));
    const parts = [];
    if (missing.length) parts.push(`<div class="callout callout-warn brief-error no-print">找不到里代碼：${missing.map(escapeHtml).join('、')}</div>`);
    for (const c of found) parts.push(pageHtml(byCode.get(c).properties, meta, n));
    root.innerHTML = parts.join('');
    renderLetter(found.map((c) => byCode.get(c)));

    const titleEl = document.getElementById('brief-title');
    if (titleEl && found.length) {
      titleEl.textContent = found.length === 1
        ? `${byCode.get(found[0]).properties.town_name} ${byCode.get(found[0]).properties.village_name}`
        : `${found.length} 個里`;
      document.title = `里況說明 ${titleEl.textContent}`;
    }
    const back = document.getElementById('back-link');
    if (back && found.length) back.href = `city.html?v=${encodeURIComponent(found[0])}&liq=${encodeURIComponent(version)}`;
    const other = document.getElementById('other-version');
    if (other) {
      const u = new URL(window.location.href);
      u.searchParams.set('liq', otherVersion);
      other.href = u.toString();
      other.textContent = `改用${LIQ_VERSIONS[otherVersion].label}液化`;
    }
    renderFooter('#footer', meta);
  }

  const printBtn = document.getElementById('btn-print');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  bindBriefTabs();
  init();
})();

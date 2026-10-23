/* design-kit/quest.js — quest bar for MVP pages. No dependencies. Styles: theme-puma.css (.q-bar/.q-toast/.q-confetti).
 *
 * Usage:
 *   <link rel="stylesheet" href="../design-kit/theme-puma.css">
 *   <script src="../design-kit/quest.js"></script>
 *   <script>
 *     Quest.init({ page: 'a', role: '住戶', steps: ['找到你家', '調假設', '看結果'] });
 *     // call when the user really finishes a step (button click, address found, ...)
 *     Quest.done('找到你家');   // badge on, bar moves, toast "＋10 分　找到你家"
 *     Quest.done('看結果');     // last open step -> confetti (60 pieces)
 *     Quest.points();          // total points across all pages (key mvp-quest-total)
 *     Quest.pagePoints();      // points on this page
 *     Quest.reset();           // clear this page (dev / kiosk use)
 *   </script>
 *
 * Rules:
 *   - done() on a step that is already done does nothing (no double points).
 *   - Each step is worth 10 points. Change with init({ per: 20 }).
 *   - Progress is saved in localStorage key mvp-quest-<page>. Reload keeps the badges.
 *   - Confetti colors: init({ colors: ['#3b5b7a', ...] }). Default is the theme-puma palette.
 *   - Storage can be blocked (private mode); the bar still works for this visit.
 */
(function () {
  const COLORS = ['#db6a41', '#211d1d', '#fff8f4', '#7dbc91', '#fcea8b'];
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let cfg = null, done = [], bar = null, toastEl = null, toastT = 0;

  function init(opts) {
    cfg = Object.assign({ per: 10, role: '', colors: COLORS }, opts);
    done = get('mvp-quest-' + cfg.page, []).filter(s => cfg.steps.includes(s));
    if (bar) bar.remove();
    bar = document.createElement('div');
    bar.className = 'q-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = (cfg.role ? `<span class="q-role">🎖️ ${cfg.role}</span>` : '') +
      '<div class="q-track" aria-hidden="true"><i></i></div><b class="q-count"></b><div class="q-badges">' +
      cfg.steps.map((s, i) => `<span title="${s}">${i + 1}</span>`).join('') + '</div>';
    document.body.prepend(bar);
    draw(false);
  }

  function draw(animate) {
    const n = done.length, m = cfg.steps.length, fill = bar.querySelector('.q-track i');
    if (!animate) { fill.style.transition = 'none'; requestAnimationFrame(() => { fill.style.transition = ''; }); }
    fill.style.width = (n / m * 100) + '%';
    bar.querySelector('.q-count').textContent = `${n}/${m}`;
    bar.querySelectorAll('.q-badges span').forEach((b, i) => {
      const on = done.includes(cfg.steps[i]);
      b.classList.toggle('on', on); b.textContent = on ? '✓' : i + 1;
    });
    bar.setAttribute('aria-label', `任務進度 ${n}/${m}，${pagePoints()} 分`);
  }

  function markDone(step) {
    if (!cfg) return console.warn('Quest.done before Quest.init');
    if (!cfg.steps.includes(step)) return console.warn('Quest: unknown step', step);
    if (done.includes(step)) return;
    done.push(step);
    put('mvp-quest-' + cfg.page, done);
    put('mvp-quest-total', get('mvp-quest-total', 0) + cfg.per);
    draw(true);
    toast(`＋${cfg.per} 分　${step}`);
    if (done.length === cfg.steps.length) confetti();
  }

  function toast(text) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'q-toast'; toastEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastEl); }
    toastEl.textContent = text;
    toastEl.classList.remove('on'); void toastEl.offsetWidth; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 1800);
  }

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'q-confetti';
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = (cfg ? cfg.colors : COLORS)[i % (cfg ? cfg.colors : COLORS).length];
      p.style.animationDelay = (Math.random() * .5).toFixed(2) + 's';
      p.style.animationDuration = (1.2 + Math.random() * .8).toFixed(2) + 's';
      p.style.transform = `rotate(${Math.round(Math.random() * 360)}deg)`;
      if (p.style.background === 'rgb(255, 248, 244)') p.style.outline = '1px solid #db6a41';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2800);
  }

  const pagePoints = () => (cfg ? done.length * cfg.per : 0);
  const points = () => get('mvp-quest-total', 0);
  function reset() {
    if (!cfg) return;
    put('mvp-quest-total', Math.max(0, points() - pagePoints()));
    done = []; put('mvp-quest-' + cfg.page, done); draw(false);
  }

  window.Quest = { init, done: markDone, points, pagePoints, reset, toast, confetti };
})();

/*
 * sim.js  Agent-based consent model for one old walk-up building.
 *
 * One agent per owner household. Each round (one briefing meeting) every owner who has
 * not signed yet signs with probability sigmoid(utility + peer term). Signatures stick.
 * The peer term uses the share of owners who still had not signed after the last round,
 * with the odds ratio 0.347 reported for "share of opposing neighbours" in the retrofit
 * willingness study (gov-reports 1888939 p.40-44). Every other weight is an assumption,
 * listed in PARAMS with its source so the page can show it.
 *
 * The intercept b0 is calibrated so that the baseline scenario gives the 13% that the
 * dangerous-building facilitator funnel shows (3,698 filings -> 492 rebuild plans).
 * That funnel loses cases for reasons other than consent, so this is an anchor, not a fit.
 */
(function () {
  'use strict';

  const RULES = [
    { id: 'dl100', label: '危老重建', short: '全體同意', need: 1.0, strict: false, law: '危老條例 §5' },
    { id: 'ur45', label: '都更・自劃更新單元', short: '超過 4/5', need: 0.8, strict: true, law: '都更條例 §37' },
    { id: 'ur34', label: '都更・公劃更新地區', short: '超過 3/4', need: 0.75, strict: true, law: '都更條例 §37' },
    { id: 'ur12', label: '都更・§7 迅行劃定', short: '超過 1/2', need: 0.5, strict: true, law: '都更條例 §7、§37' },
  ];

  const PARAMS = {
    rounds: { v: 5, src: '假設：約 5 次說明會或協調會' },
    peerLogOR: { v: Math.log(0.347), src: '文件：同棟反對比例 勝算比 0.347（gov-reports 1888939 p.40～44，補強意願研究，借用到重建）' },
    damageLogOR: { v: Math.log(7.166), src: '文件：住宅已有損壞 勝算比 7.166（同上研究）' },
    riskInfo: { v: 0.1, src: '文件：風險知覺不顯著（同上研究），所以只給很小的效果' },
    elevator: { v: 1.2, src: '假設：三樓以上的高齡或行動不便住戶想要電梯' },
    trust: { v: 0.8, src: '假設：信任實施者高 +0.8、低 −0.8' },
    elderly: { v: 1.0, src: '假設：65 歲以上要搬出 3 年的負擔' },
    mobility: { v: 0.8, src: '假設：行動不便的額外負擔' },
    econ: { v: 0.9, src: '假設：經濟壓力高，付不起暫住租金' },
    shop: { v: 1.5, src: '假設：一樓店家停業 3 年的損失' },
    longStay: { v: 0.5, src: '假設：住很久，捨不得' },
    uncertainty: { v: 1.2, src: '假設：不知道分回多少、搬去哪，不信任' },
    noise: { v: 1.0, src: '假設：每戶個別差異（標準常態）' },
    buildingShock: { v: 1.5, src: '假設：每棟樓的共同條件不同（分回比例、實施者、地段），全棟一起加減' },
    unreachable: { v: 0.06, src: '假設：繼承未辦、失聯、住國外，找不到人簽' },
    mobilityShare: { v: 0.35, src: '假設：高齡者中行動不便的比例' },
    econShare: { v: 0.3, src: '假設' },
    trustShares: { v: [0.3, 0.45, 0.25], src: '假設：低、中、高' },
    refusedPenalty: { v: 2.0, src: '假設：已經明確拒絕的人，之後要改變心意比較難' },
    householdsMedian: { v: 16, src: '實測：都更審議平台 168 專案 396 案更新前戶數中位 16（四分位 8～28、P90 44），e3 uro-review-cases.csv' },
    calibrationTarget: { v: 0.13, src: '文件：危老推動師報備 3,698 → 重建計畫 492（建管處 115-10-01 統計表）' },
  };

  // preSigned / preRefused: starting state passed in from the consent progress board (variant E).
  const DEFAULTS = { n: 16, elderly: 0.35, transparency: 0.3, manager: false, damaged: false, riskInfo: false, shops: 0, floors: 4, preSigned: 0, preRefused: 0 };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(r) {
    const u = Math.max(r(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  }

  const sig = (x) => 1 / (1 + Math.exp(-x));
  const P = (k) => PARAMS[k].v;

  function makeBuilding(s, r) {
    const hh = [];
    const shock = gauss(r) * P('buildingShock');
    const perFloor = Math.max(1, Math.round(s.n / s.floors));
    for (let i = 0; i < s.n; i++) {
      const floor = Math.min(s.floors, 1 + Math.floor(i / perFloor));
      const elderly = r() < s.elderly;
      const mobility = elderly && r() < P('mobilityShare');
      const tr = r();
      const ts = P('trustShares');
      hh.push({
        floor,
        elderly,
        mobility,
        econ: r() < P('econShare'),
        shop: floor === 1 && i < s.shops,
        longStay: r() < (elderly ? 0.8 : 0.3),
        trust: tr < ts[0] ? -1 : tr < ts[0] + ts[1] ? 0 : 1,
        unreachable: r() < P('unreachable') * (s.manager ? 1 / 3 : 1),
        eps: gauss(r) * P('noise') + shock,
      });
    }
    return hh;
  }

  function utility(h, s, b0) {
    const relief = s.manager ? 0.5 : 1;
    let u = b0 + h.eps;
    if (h.floor >= 3 && (h.elderly || h.mobility)) u += P('elevator');
    u += P('trust') * h.trust;
    if (h.elderly) u -= P('elderly') * relief;
    if (h.mobility) u -= P('mobility') * relief;
    if (h.econ) u -= P('econ') * (1 - 0.5 * s.transparency);
    if (h.shop) u -= P('shop');
    if (h.longStay) u -= P('longStay');
    u -= P('uncertainty') * (1 - s.transparency);
    if (s.damaged) u += P('damageLogOR');
    if (s.riskInfo) u += P('riskInfo');
    return u;
  }

  // One run: returns the final share of owners who signed and per-household outcome.
  function runOnce(s, b0, r) {
    const hh = makeBuilding(s, r);
    const u = hh.map((h) => utility(h, s, b0));
    const signed = new Array(hh.length).fill(false);
    const pre = Math.min(s.preSigned || 0, hh.length);
    const ref = Math.min(s.preRefused || 0, hh.length - pre);
    for (let i = 0; i < pre; i++) { signed[i] = true; hh[i].unreachable = false; }
    for (let i = pre; i < pre + ref; i++) u[i] -= P('refusedPenalty');
    let notSigned = ref / hh.length;  // before the first meeting, neighbours only see explicit refusals
    for (let k = 0; k < P('rounds'); k++) {
      const peer = P('peerLogOR') * notSigned;
      for (let i = 0; i < hh.length; i++) {
        if (signed[i] || hh[i].unreachable) continue;
        if (r() < sig(u[i] + peer)) signed[i] = true;
      }
      notSigned = signed.filter((x) => !x).length / hh.length;
    }
    return { share: 1 - notSigned, signed, hh };
  }

  function passes(rule, share) {
    return rule.strict ? share > rule.need + 1e-9 : share >= rule.need - 1e-9;
  }

  function simulate(s, b0, runs, seed) {
    const r = rng(seed || 777);
    const wins = RULES.map(() => 0);
    let shareSum = 0;
    let sample = null;
    const shares = [];
    for (let k = 0; k < runs; k++) {
      const res = runOnce(s, b0, r);
      shareSum += res.share;
      shares.push(res.share);
      if (k === 0) sample = res;
      RULES.forEach((rule, j) => { if (passes(rule, res.share)) wins[j]++; });
    }
    return { p: wins.map((w) => w / runs), meanShare: shareSum / runs, sample, shares };
  }

  // Find b0 so that the baseline gives the calibration target for full consent.
  function calibrate() {
    let lo = -6, hi = 10;
    for (let it = 0; it < 24; it++) {
      const mid = (lo + hi) / 2;
      const p = simulate(DEFAULTS, mid, 2000, 777).p[0];
      if (p < P('calibrationTarget')) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  window.ConsentSim = { RULES, PARAMS, DEFAULTS, simulate, calibrate };
})();

'use strict';
// ==========================================================================
// 楽器トレーナー共通：タイミング（早い・遅い）の表示と、練習モードの設定の行
// 5つのアプリ（読譜・ギター・ベース・ドラム・ヴォーカル）で同じファイルを使う。直したら全部にコピー
// 使い方：
//   const meter = Timing.meter(el, { good: 150, perfect: 50 });  meter.push(dt); meter.reset();
//   Timing.label(dt, perfectMs) → 'ぴったり' / '早い 23ms' / '遅い 40ms'
//   Timing.stats([dt…]) → { n, mean, sd }、Timing.tendency(mean) → 'ほぼぴったり' など
//   Timing.practiceBar(el, { speeds, ranges, loop, wait, state, onChange })
// dt は「叩いた（弾いた・歌い出した）時刻 − 本来の時刻」（ミリ秒）。マイナスが早い
// ==========================================================================
const Timing = (() => {
  const css = `
.tm { width: 100%; max-width: 620px; margin: 0 auto; display: grid; gap: 4px; }
.tm[hidden], .pr[hidden] { display: none; }
.tm-bar { position: relative; height: 22px; border-radius: 999px; background: var(--panel2, #1f1f24); box-shadow: 0 0 0 1px var(--line, #2b2b31) inset; overflow: hidden; }
.tm-ok { position: absolute; top: 0; bottom: 0; background: rgba(92, 194, 138, .16); }
.tm-pf { position: absolute; top: 0; bottom: 0; background: rgba(201, 169, 110, .22); }
.tm-mid { position: absolute; left: 50%; top: 3px; bottom: 3px; width: 1px; background: rgba(255, 255, 255, .45); }
.tm-dot { position: absolute; top: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--gold, #c9a96e); transition: opacity .4s; }
.tm-dot.late { background: #e3a072; } .tm-dot.early { background: #7fb6e3; } .tm-dot.just { background: #e6cd97; box-shadow: 0 0 8px rgba(230, 205, 151, .8); }
.tm-mean { position: absolute; top: 1px; bottom: 1px; width: 3px; margin-left: -1.5px; border-radius: 2px; background: #fff; opacity: .85; }
.tm-lab { display: flex; justify-content: space-between; font-size: .72rem; color: var(--muted, #8f8b85); letter-spacing: .08em; }
.tm-lab b { color: var(--ink, #ece8e1); font-weight: 400; }
.pr { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: center; font-size: .86rem; color: var(--muted, #8f8b85); }
.pr-grp { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pr-grp > span { letter-spacing: .08em; }
.pr-sp { display: flex; gap: 3px; background: var(--panel2, #1f1f24); border-radius: 999px; padding: 3px; }
.pr-sp button { padding: 4px 9px; font-size: .78rem; border-radius: 999px; background: transparent; color: var(--muted, #8f8b85); box-shadow: none; letter-spacing: .02em; }
.pr-sp button[aria-pressed="true"] { background: var(--gold-grad, #c9a96e); color: #17130b; }
.pr-tg { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 10px; border-radius: 999px; box-shadow: 0 0 0 1px var(--line, #2b2b31) inset; user-select: none; }
.pr-tg input { accent-color: var(--gold, #c9a96e); margin: 0; }
.pr-tg.on { color: var(--gold, #c9a96e); box-shadow: 0 0 0 1px rgba(201, 169, 110, .5) inset; }
.pr select { padding: 3px 8px; font-size: .8rem; border-radius: 8px; }
.pr-note { flex-basis: 100%; text-align: center; font-size: .74rem; color: var(--muted, #8f8b85); }
`;
  let styled = false;
  const style = () => {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  };

  const signed = (ms) => `${ms >= 0 ? '+' : '−'}${Math.abs(Math.round(ms))}ms`;
  // ぴったりとみなす幅（これより小さいずれは「ぴったり」と言う）
  const JUST_MS = 12;
  const label = (dt, justMs = JUST_MS) => (Math.abs(dt) <= justMs ? 'ぴったり' : `${dt < 0 ? '早い' : '遅い'} ${Math.abs(Math.round(dt))}ms`);
  const stats = (offs) => {
    const xs = offs.filter((x) => Number.isFinite(x));
    if (!xs.length) return { n: 0, mean: null, sd: null };
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) : null;
    return { n: xs.length, mean, sd };
  };
  const tendency = (mean) => (mean === null ? '' : Math.abs(mean) < 10 ? 'ほぼぴったり' : mean < 0 ? (mean < -25 ? '早め' : '少し早め') : (mean > 25 ? '遅め' : '少し遅め'));
  // 結果に出す1行（例：平均のずれ +12ms（少し遅め）・ばらつき ±18ms）
  const summaryHtml = (offs) => {
    const s = stats(offs);
    if (!s.n) return '';
    return `<p class="tm-sum">平均のずれ <b>${signed(s.mean)}</b>（${tendency(s.mean)}）${s.sd !== null ? `・ばらつき ±${Math.round(s.sd)}ms` : ''}</p>`;
  };

  // 早い↔遅いの帯。直近の音を点で並べ、平均を白い線で示す
  const meter = (el, { good = 150, perfect = 50, keep = 12 } = {}) => {
    style();
    el.classList.add('tm');
    el.innerHTML = '<div class="tm-bar"><i class="tm-ok"></i><i class="tm-pf"></i><i class="tm-mid"></i><i class="tm-mean" hidden></i></div>'
      + '<div class="tm-lab"><span>← 早い</span><b class="tm-txt">&nbsp;</b><span>遅い →</span></div>';
    const bar = el.querySelector('.tm-bar');
    const meanEl = el.querySelector('.tm-mean');
    const txt = el.querySelector('.tm-txt');
    let range = { good, perfect };
    let dots = [];
    const xOf = (dt) => 50 + Math.max(-50, Math.min(50, (dt / (range.good * 1.15)) * 50));
    const layout = () => {
      const half = (w) => Math.min(50, (w / (range.good * 1.15)) * 50);
      Object.assign(el.querySelector('.tm-ok').style, { left: `${50 - half(range.good)}%`, width: `${2 * half(range.good)}%` });
      Object.assign(el.querySelector('.tm-pf').style, { left: `${50 - half(range.perfect)}%`, width: `${2 * half(range.perfect)}%` });
    };
    layout();
    const api = {
      setRange(g, p) { range = { good: g, perfect: p }; layout(); },
      reset() { dots.forEach((d) => d.el.remove()); dots = []; meanEl.hidden = true; txt.innerHTML = '&nbsp;'; },
      push(dt) {
        if (!Number.isFinite(dt)) return;
        const d = document.createElement('i');
        d.className = `tm-dot ${Math.abs(dt) <= JUST_MS ? 'just' : dt < 0 ? 'early' : 'late'}`;
        d.style.left = `${xOf(dt)}%`;
        bar.appendChild(d);
        dots.push({ el: d, dt });
        while (dots.length > keep) dots.shift().el.remove();
        dots.forEach((x, i) => { x.el.style.opacity = String(0.25 + (0.75 * (i + 1)) / dots.length); });
        const s = stats(dots.map((x) => x.dt));
        meanEl.hidden = s.n < 3;
        meanEl.style.left = `${xOf(s.mean)}%`;
        txt.textContent = label(dt);
      },
    };
    return api;
  };

  // 練習モードの設定の行：速さ・区間の繰り返し・待つ
  // opts.ranges: [{ value, label }]（区間の候補。なければ繰り返しの区間選びを出さない）
  // opts.state: { speed: 100, loop: false, from: 0, to: 0, wait: false }。変わるたびに onChange(state)
  const practiceBar = (el, opts) => {
    style();
    const st = { speed: 100, loop: false, from: 0, to: 0, wait: false, ...(opts.state || {}) };
    const speeds = opts.speeds ?? [50, 60, 70, 80, 90, 100];
    const rangeOpts = (sel) => (opts.ranges || []).map((r) => `<option value="${r.value}"${r.value === sel ? ' selected' : ''}>${r.label}</option>`).join('');
    const draw = () => {
      const hasRanges = opts.loop !== false && (opts.ranges || []).length > 1;
      el.classList.add('pr');
      el.innerHTML = (opts.speed === false ? '' : `<div class="pr-grp"><span>速さ</span><div class="pr-sp" role="group" aria-label="速さ">${speeds.map((p) => `<button type="button" data-sp="${p}" aria-pressed="${st.speed === p}">${p}%</button>`).join('')}</div></div>`)
        + (opts.loop === false ? '' : `<div class="pr-grp"><label class="pr-tg${st.loop ? ' on' : ''}"><input type="checkbox" data-k="loop"${st.loop ? ' checked' : ''}>繰り返す</label>${hasRanges && st.loop ? `<select data-k="from" aria-label="繰り返しのはじめ">${rangeOpts(st.from)}</select>〜<select data-k="to" aria-label="繰り返しのおわり">${rangeOpts(st.to)}</select>` : ''}</div>`)
        + (opts.wait === false ? '' : `<div class="pr-grp"><label class="pr-tg${st.wait ? ' on' : ''}"><input type="checkbox" data-k="wait"${st.wait ? ' checked' : ''}>${opts.waitLabel ?? '正しく弾くまで待つ'}</label></div>`)
        + (opts.note ? `<div class="pr-note">${opts.note(st)}</div>` : '');
    };
    el.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('[data-sp]') : null;
      if (!b) return;
      st.speed = Number(b.dataset.sp);
      draw();
      opts.onChange?.({ ...st });
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
      const k = t.dataset.k;
      if (k === 'loop' || k === 'wait') st[k] = t.checked;
      if (k === 'from' || k === 'to') st[k] = Number(t.value);
      if (st.to < st.from) { if (k === 'from') st.to = st.from; else st.from = st.to; }
      draw();
      opts.onChange?.({ ...st });
    });
    draw();
    return {
      get: () => ({ ...st }),
      set(next) { Object.assign(st, next); draw(); },
      update(next) { Object.assign(opts, next); draw(); },
      disable(on) { el.querySelectorAll('button, input, select').forEach((x) => { x.disabled = on; }); },
    };
  };

  return { signed, label, stats, tendency, summaryHtml, meter, practiceBar, JUST_MS };
})();

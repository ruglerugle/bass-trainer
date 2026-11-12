'use strict';
// ==========================================================================
// 楽器トレーナー共通：実力テスト（だんだん難しくなる出題でレベル1〜10を出す）
// 5つのアプリ（読譜・ギター・ベース・ドラム・ヴォーカル）で同じファイルを使う。直したら全部にコピー
// 使い方：
//   const st = Assess.staircase({ items: 20, start: 3 });  st.level（いま出すレベル）, st.record(ok, tags), st.done, st.result()
//   Assess.show({ title, level, levelText, parts, prev, recommend: { label, run }, note })
//   Assess.push(history, entry) → 新しい履歴（最新20件）
// 進め方：1問正解で1つ上、まちがえると1つ下。最初にまちがえるまでは2つずつ上げて、早く本人の高さへ近づける
// 結果：2問以上出して2/3以上正解したレベルのうち、いちばん高いもの（なければ1）
// ==========================================================================
const Assess = (() => {
  const MAX = 10;
  const staircase = ({ items = 20, start = 3, max = MAX } = {}) => {
    const log = [];
    let level = start;
    let missed = false;
    return {
      get level() { return level; },
      get count() { return log.length; },
      get items() { return items; },
      get done() { return log.length >= items; },
      log,
      record(ok, tags = []) {
        log.push({ level, ok, tags });
        if (ok) level = Math.min(max, level + (missed ? 1 : 2));
        else { missed = true; level = Math.max(1, level - 1); }
      },
      result() {
        let best = 1;
        for (let L = 1; L <= max; L++) {
          const xs = log.filter((x) => x.level === L);
          if (xs.length >= 2 && xs.filter((x) => x.ok).length / xs.length >= 2 / 3) best = L;
          // 1問だけで正解し、その上でも正解しているなら通ったとみなす
          else if (xs.length === 1 && xs[0].ok && log.some((x) => x.level > L && x.ok)) best = Math.max(best, L);
        }
        return best;
      },
      // タグごとの正解の割合（{ タグ: { ok, n } }）
      parts() {
        const out = {};
        log.forEach((x) => x.tags.forEach((t) => {
          out[t] ??= { ok: 0, n: 0 };
          out[t].n += 1;
          if (x.ok) out[t].ok += 1;
        }));
        return out;
      },
    };
  };

  const css = `
.as-dlg { border: 0; padding: 0; width: min(560px, calc(100vw - 24px)); max-height: 92vh; border-radius: 22px; color: var(--ink, #ece8e1); background: var(--paper, #17171b);
  box-shadow: 0 0 0 1px var(--line, #2b2b31), 0 30px 80px rgba(0, 0, 0, .7); }
.as-dlg::backdrop { background: rgba(0, 0, 0, .65); }
.as-in { padding: 24px 22px 22px; display: grid; gap: 14px; text-align: center; }
.as-k { font-size: .76rem; letter-spacing: .3em; color: var(--gold, #c9a96e); }
.as-lv { font-size: 3.4rem; font-weight: 200; line-height: 1; letter-spacing: .02em; }
.as-lv small { font-size: 1rem; color: var(--muted, #8f8b85); margin-left: 4px; }
.as-bar { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
.as-bar i { height: 6px; border-radius: 3px; background: var(--line, #2b2b31); }
.as-bar i.on { background: var(--gold-grad, #c9a96e); }
.as-txt { margin: 0; font-size: .92rem; color: var(--ink, #ece8e1); }
.as-prev { margin: 0; font-size: .84rem; color: var(--muted, #8f8b85); }
.as-parts { display: grid; gap: 8px; text-align: left; }
.as-part { display: grid; grid-template-columns: 7.5em 1fr 3.4em; gap: 10px; align-items: center; font-size: .86rem; }
.as-part .t { height: 6px; border-radius: 3px; background: var(--line, #2b2b31); overflow: hidden; }
.as-part .t i { display: block; height: 100%; background: var(--gold, #c9a96e); }
.as-part b { font-weight: 400; text-align: right; color: var(--muted, #8f8b85); }
.as-note { margin: 0; font-size: .8rem; color: var(--muted, #8f8b85); }
.as-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.as-banner { display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; font-size: .86rem; color: var(--gold, #c9a96e); letter-spacing: .04em; }
.as-banner b { font-weight: 500; }
`;
  let dlg = null;
  const style = () => {
    if (dlg) return;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
    dlg = document.createElement('dialog');
    dlg.className = 'as-dlg';
    dlg.setAttribute('aria-label', '実力テストの結果');
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  };
  const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // parts: [{ label, ok, n }]、prev: 前回の { level, date }、recommend: { label, run }
  const show = ({ title = '実力テストの結果', level, levelText = '', parts = [], prev = null, recommend = null, note = '' }) => {
    style();
    const diff = prev ? level - prev.level : 0;
    dlg.innerHTML = `<div class="as-in">
  <div class="as-k">${esc(title)}</div>
  <div class="as-lv">レベル ${level}<small>/ 10</small></div>
  <div class="as-bar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</div>
  ${levelText ? `<p class="as-txt">${esc(levelText)}</p>` : ''}
  ${prev ? `<p class="as-prev">前回（${esc(prev.date)}）はレベル ${prev.level}${diff > 0 ? `。<b style="color:var(--gold,#c9a96e)">${diff}つ上がりました</b>` : diff < 0 ? '。今日は少し下がりました' : '。前回と同じです'}</p>` : ''}
  ${parts.length ? `<div class="as-parts">${parts.map((p) => `<div class="as-part"><span>${esc(p.label)}</span><span class="t"><i style="width:${p.n ? Math.round((p.ok / p.n) * 100) : 0}%"></i></span><b>${p.n ? `${Math.round((p.ok / p.n) * 100)}%` : '—'}</b></div>`).join('')}</div>` : ''}
  ${note ? `<p class="as-note">${esc(note)}</p>` : ''}
  <div class="as-btns">${recommend ? `<button type="button" data-as="rec">${esc(recommend.label)}</button>` : ''}<button type="button" class="ghost" data-as="close">閉じる</button></div>
</div>`;
    dlg.querySelector('[data-as="close"]').addEventListener('click', () => dlg.close());
    const rb = dlg.querySelector('[data-as="rec"]');
    if (rb) rb.addEventListener('click', () => { dlg.close(); recommend.run(); });
    dlg.showModal();
  };

  const today = () => { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
  const push = (history, entry) => [...(Array.isArray(history) ? history : []), { date: today(), ...entry }].slice(-20);
  const last = (history) => (Array.isArray(history) && history.length ? history[history.length - 1] : null);

  // テスト中に出す1行（何問目か・やめるボタン）
  const banner = (el, { count, items, onQuit }) => {
    style();
    el.classList.add('as-banner');
    el.innerHTML = `<b>実力テスト</b><span>${Math.min(count + 1, items)} / ${items}問</span><button type="button" class="ghost">やめる</button>`;
    el.querySelector('button').addEventListener('click', onQuit);
  };

  return { staircase, show, push, last, banner, MAX };
})();

'use strict';
// ==========================================================================
// 楽器トレーナー共通：線のアイコン・ホームの「道」を短く・空の星を出さない
// 5つのアプリ（読譜・ギター・ベース・ドラム・ヴォーカル）で同じファイルを使う。直したら全部にコピー
// 画面の絵文字アイコン（.ic・.dot・.mini span などの中の 🎯 🎼 🔒 🔥 …）を、細い線の SVG に自動で置き換える。
// 使い方：<script src="studio.js?v=1"></script> を読み込むだけ。Icons.svg('target') で SVG の文字列も作れる
// ==========================================================================
const Icons = (() => {
  // 24×24・線の太さ 1.5・色は currentColor
  const P = {
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    staff: '<path d="M3 6.5h18M3 10h18M3 13.5h18M3 17h18"/><ellipse cx="10" cy="15.2" rx="2.4" ry="1.8" fill="currentColor" stroke="none" transform="rotate(-20 10 15.2)"/><path d="M12.2 14.6V4.5"/>',
    guitar: '<path d="M13.5 10.5l6-6M18 3l3 3"/><path d="M11.3 8.7c-1.7-.6-3.6-.3-4.8.9-1 1-1.1 2.4-.7 3.6-1.5.1-2.6.8-3 1.9-.7 1.8.6 4.2 2.6 5.2 2 1 4.4.2 5-1.6.4-1.1.1-2.2-.6-3.2 1.2.3 2.6.1 3.5-.8 1.2-1.2 1.5-3.1.9-4.8"/><circle cx="9.5" cy="14.5" r="1.3"/>',
    ladder: '<path d="M7 3v18M17 3v18M7 7h10M7 11h10M7 15h10M7 19h10"/>',
    breath: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h6"/>',
    notes: '<path d="M9 17V5l11-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M9 9l11-2"/>',
    note: '<path d="M10 17V4l7 2.5"/><circle cx="7" cy="17.5" r="3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    studio: '<circle cx="12" cy="8" r="5"/><path d="M8.5 8h7M9.2 5.5h5.6M9.2 10.5h5.6M12 13v5M8 21h8M12 18v3"/>',
    chart: '<path d="M3.5 3.5v17h17"/><path d="M7 15l3.5-4 3 2.5L19 7"/>',
    wave: '<path d="M2.5 12h2l2-6 3 12 3-15 3 15 3-9 1.5 3h1.5"/>',
    book: '<path d="M12 6.5c-2-1.5-5-2-8.5-1.5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5v-13c-3.5-.5-6.5 0-8.5 1.5z"/><path d="M12 6.5v13"/>',
    infinity: '<path d="M12 12c-1.8-2.4-3.3-3.5-5-3.5a3.5 3.5 0 0 0 0 7c1.7 0 3.2-1.1 5-3.5s3.3-3.5 5-3.5a3.5 3.5 0 0 1 0 7c-1.7 0-3.2-1.1-5-3.5z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h2M12 13.5h2M16 13.5h.5M8 16.5h2M12 16.5h2"/>',
    sprout: '<path d="M12 21v-9"/><path d="M12 12c0-3.5-2.5-6-7-6 0 3.5 2.5 6 7 6z"/><path d="M12 14c0-3 2-5.5 6.5-5.5 0 3-2 5.5-6.5 5.5z"/>',
    keys: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M7.5 5v14M12 5v14M16.5 5v14"/><path d="M6 5h3v7.5H6zM10.5 5h3v7.5h-3zM15 5h3v7.5h-3z" fill="currentColor" stroke="none"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    rise: '<path d="M4 18l6-6 4 3 6-7"/><path d="M15 8h5v5"/>',
    drum: '<ellipse cx="12" cy="10" rx="8" ry="3"/><path d="M4 10v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><path d="M7 3.5l4 5M17 3.5l-4 5"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.5 6.5l1.5-1.5"/>',
    bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    flame: '<path d="M12 21c3.6 0 6-2.4 6-5.8 0-3.6-2.6-5.5-3.6-9.2-1.6 1.6-2 3.4-1.8 5-1.3-1-2.1-2.4-2.3-4.3C8 8.5 6 11.5 6 15.2 6 18.6 8.4 21 12 21z"/>',
    flag: '<path d="M5 21V3.5"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.7L5.5 3h4l2.5 6M15.5 10.7l3-7.7h-4l-2.5 6"/><path d="M12 12.8l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z"/>',
  };
  // 絵文字 → アイコン名（異体字セレクタ U+FE0F は外して比べる）
  const EMOJI = {
    '🎯': 'target', '🔎': 'search', '🔍': 'search', '🎼': 'staff', '🎸': 'guitar', '🪜': 'ladder', '🌬': 'breath',
    '🎶': 'notes', '🎵': 'note', '🎤': 'mic', '🎙': 'studio', '📈': 'chart', '📖': 'book', '∞': 'infinity', '📅': 'calendar',
    '🌱': 'sprout', '🎹': 'keys', '📱': 'phone', '🚀': 'rise', '🥁': 'drum', '⏱': 'timer', '⚡': 'bolt', '🔒': 'lock',
    '🔥': 'flame', '🏁': 'flag', '🏅': 'medal', '🥇': 'medal',
  };
  const svg = (name, cls = '') => (P[name]
    ? `<svg class="li ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`
    : '');
  const css = `
.li { width: 1em; height: 1em; display: inline-block; vertical-align: -.14em; flex: none; }
.ic.has-li { filter: none !important; color: var(--gold, #c9a96e); font-size: 1.45rem; }
.dot.has-li { font-size: 1rem; }
.node.locked .dot.has-li, .node.later .dot.has-li { color: #6d6964; }
.li-lead { width: 1.15em; height: 1.15em; vertical-align: -.22em; margin-right: .3em; color: var(--gold, #c9a96e); }
.st-empty { display: none !important; }
.node.more { display: none !important; }
.lane-more { display: block; margin: 6px auto 0; padding: 6px 16px; font-size: .82rem; letter-spacing: .08em; border-radius: 999px; background: transparent; color: var(--muted, #8f8b85); box-shadow: 0 0 0 1px var(--line, #2b2b31) inset; }
.lane-more:hover:not(:disabled) { background: rgba(255, 255, 255, .04); color: var(--gold, #c9a96e); filter: none; }
`;
  const strip = (s) => s.replace(/️/g, '').trim();
  // 1つの要素の中身が絵文字1つだけなら、SVG に置き換える
  const swapBox = (el) => {
    if (el.classList.contains('has-li') || el.children.length) return;
    const name = EMOJI[strip(el.textContent)];
    if (!name) return;
    el.innerHTML = svg(name);
    el.classList.add('has-li');
  };
  // 「🔥 連続日数」のように、文の先頭の絵文字だけを SVG に置き換える
  const swapLead = (el) => {
    if (el.dataset.li || el.children.length) return;
    const m = /^(\S+?)️?\s+/.exec(el.textContent);
    const name = m && EMOJI[strip(m[1])];
    if (!name) return;
    el.dataset.li = '1';
    const rest = el.textContent.slice(m[0].length);
    el.textContent = rest;
    el.insertAdjacentHTML('afterbegin', svg(name, 'li-lead'));
  };
  // まだ星のないステージの「☆☆☆」は出さない（取れた星だけ見せる）
  const hideEmptyStars = (root) => {
    root.querySelectorAll('.node span, .stars-line, .continue .st').forEach((el) => {
      if (el.children.length) return;
      el.classList.toggle('st-empty', /^☆+$/.test(el.textContent.trim()));
    });
  };
  // ホームの「道」は、次に進むステージとその前後だけを見せ、残りは「すべて見る」で開く
  const opened = new Set();
  const laneKey = (path) => path.closest('.lane')?.querySelector('h3')?.textContent.trim() || '';
  const compactLanes = (root) => {
    root.querySelectorAll('.lane .path').forEach((path) => {
      const nodes = [...path.children].filter((n) => n.classList.contains('node'));
      if (nodes.length <= 4) return;
      let at = nodes.findIndex((n) => n.classList.contains('next'));
      if (at < 0) at = nodes.findIndex((n) => !n.classList.contains('done'));
      if (at < 0) at = nodes.length - 1;
      const from = Math.max(0, Math.min(at - 1, nodes.length - 3));
      const key = laneKey(path);
      const open = opened.has(key);
      nodes.forEach((n, i) => n.classList.toggle('more', !open && (i < from || i > from + 2)));
      let btn = path.nextElementSibling;
      if (!btn || !btn.classList.contains('lane-more')) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lane-more';
        path.after(btn);
      }
      const label = open ? 'たたむ' : `すべて見る（全${nodes.length}）`;
      if (btn.textContent !== label) btn.textContent = label;
      btn.dataset.key = key;
    });
  };
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('.lane-more') : null;
    if (!b) return;
    const key = b.dataset.key || '';
    if (opened.has(key)) opened.delete(key); else opened.add(key);
    compactLanes(document.body);
  });
  const swap = (root) => {
    if (!(root instanceof Element)) return;
    root.querySelectorAll('.ic, .dot, .ob-ic').forEach(swapBox);
    root.querySelectorAll('.mini span, .stat span').forEach(swapLead);
    hideEmptyStars(root);
    compactLanes(root);
  };
  const start = () => {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
    swap(document.body);
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; swap(document.body); });
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  return { svg, swap, EMOJI };
})();

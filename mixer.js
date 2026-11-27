'use strict';
// ==========================================================================
// 楽器トレーナー共通：曲の音源のマルチトラック・プレーヤー（Moises のように、パートごとに音量を変えて重ねて練習する）
// 5つのアプリ（読譜・ギター・ベース・ドラム・ヴォーカル）で同じファイルを使う。直したら全部にコピー
// 元は genre-songs/mixer.js
// 使い方：
//   const mx = Mixer.create(el, {
//     id: 'my-song',                 // 音量の設定を覚えるキー
//     base: 'audio/songs/my-song/',   // トラックの置き場所
//     tracks: [{ id: 'vocal', label: '歌' }, …], // base + id + '.mp3'
//     mine: 'guitar',                           // このアプリの楽器（「自分のパートを消す」で消す）
//     bar1: 0.876, spb: 0.5042,                 // 小節1の頭の秒・1拍の秒（区間の頭出しに使う）
//     sections: [{ name: 'イントロ', from: 0, to: 8 }, …], // 小節（0から数える）[from, to)
//     ver: '20261124',                          // 音源を作り直したら変える（URL に ?v= を付けて読み直させる）
//     alt: { label: '原曲（Suno）', bar1: 0.095, spb: 0.4652, tracks: [{ id: 'original-drums', label: 'ドラム', part: 'drums' }, …] }, // あれば：元の録音（AI でパートに分けたもの）に切り替えられる。最初はこちらを流す
//   });
//   mx.play(); mx.stop(); mx.destroy(); mx.position（曲の秒。元の録音を鳴らしているときも、パート別の音源の秒に直して返す）
// opt.onState(playing) を渡すと、再生・一時停止・停止のたびに呼ぶ
// ==========================================================================
const Mixer = (() => {
  const css = `
.mx { display: grid; gap: 12px; padding: 14px; border-radius: 16px; background: var(--panel2, #1f1f24); box-shadow: 0 0 0 1px var(--line, #2b2b31) inset; }
.mx-top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.mx-top button { padding: 7px 14px; font-size: .9rem; }
.mx-time { font-variant-numeric: tabular-nums; color: var(--muted, #8f8b85); font-size: .85rem; min-width: 7.5em; }
.mx-seek { flex: 1 1 200px; accent-color: var(--gold, #c9a96e); }
.mx-secs { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: .82rem; color: var(--muted, #8f8b85); }
.mx-secs button { padding: 4px 11px; font-size: .8rem; border-radius: 999px; background: transparent; color: var(--muted, #8f8b85); box-shadow: 0 0 0 1px var(--line, #2b2b31) inset; }
.mx-secs button[aria-pressed="true"] { background: var(--gold-grad, #c9a96e); color: #17130b; box-shadow: none; }
.mx-secs label { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
.mx-rows { display: grid; gap: 6px; }
.mx-row { display: grid; grid-template-columns: 6.5em 1fr auto auto; gap: 8px; align-items: center; font-size: .86rem; }
.mx-row input[type=range] { width: 100%; accent-color: var(--gold, #c9a96e); }
.mx-row button { padding: 3px 9px; font-size: .75rem; min-width: 2.2em; border-radius: 8px; background: transparent; color: var(--muted, #8f8b85); box-shadow: 0 0 0 1px var(--line, #2b2b31) inset; }
.mx-row button[aria-pressed="true"] { color: #17130b; background: var(--gold, #c9a96e); box-shadow: none; }
.mx-row.mine .mx-name { color: var(--gold, #c9a96e); }
.mx-presets { display: flex; flex-wrap: wrap; gap: 6px; }
.mx-presets button { padding: 4px 12px; font-size: .8rem; border-radius: 999px; }
.mx-src { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: .82rem; color: var(--muted, #8f8b85); }
.mx-src button { padding: 4px 11px; font-size: .8rem; border-radius: 999px; background: transparent; color: var(--muted, #8f8b85); box-shadow: 0 0 0 1px var(--line, #2b2b31) inset; }
.mx-src button[aria-pressed="true"] { background: var(--gold-grad, #c9a96e); color: #17130b; box-shadow: none; }

.mx-note { font-size: .78rem; color: var(--muted, #8f8b85); margin: 0; }
.mx[aria-busy="true"] .mx-rows, .mx[aria-busy="true"] .mx-top button { opacity: .5; pointer-events: none; }
`;
  let styled = false;
  const style = () => {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  };
  let ctx = null;
  const audio = () => {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
    return ctx;
  };
  const cache = new Map(); // url → Promise<AudioBuffer>
  const load = (url) => {
    if (!cache.has(url)) {
      cache.set(url, fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`音源を読めませんでした（${r.status}）: ${url}`))))
        .then((b) => audio().decodeAudioData(b)));
    }
    return cache.get(url);
  };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const storeKey = (id) => `trainerMixer_${id}`;
  const readStore = (id) => { try { return JSON.parse(localStorage.getItem(storeKey(id)) || 'null'); } catch (e) { return null; } };
  const writeStore = (id, v) => { try { localStorage.setItem(storeKey(id), JSON.stringify(v)); } catch (e) { console.warn('ミキサーの設定を保存できませんでした', e); } };


  const create = (el, opt) => {
    style();
    const saved = readStore(opt.id) || {};
    // 音源は2組：parts = 練習用（譜面から作ったパート別の音）、alt = 元の録音（AI でパートに分けたもの、または1本）
    // alt.tracks がなければ、alt.id の1本だけ（前の形）
    const altTracks = opt.alt ? (opt.alt.tracks ?? [{ id: opt.alt.id, label: opt.alt.label }]) : [];
    const SETS = {
      parts: { tracks: opt.tracks, bar1: opt.bar1, spb: opt.spb, key: (id) => id },
      ...(opt.alt ? { alt: { tracks: altTracks, bar1: opt.alt.bar1, spb: opt.alt.spb, key: (id) => `alt:${id}` } } : {}),
    };
    // 自分のパート：元の録音の分けた音は part で練習用のパート名に対応させる
    const isMine = (t) => !!opt.mine && (t.part ?? t.id) === opt.mine;
    const allKeys = Object.values(SETS).flatMap((s) => s.tracks.map((t) => s.key(t.id)));
    const st = {
      vol: Object.fromEntries(allKeys.map((k) => [k, saved.vol?.[k] ?? 80])),
      mute: Object.fromEntries(allKeys.map((k) => [k, !!saved.mute?.[k]])),
      solo: Object.fromEntries(allKeys.map((k) => [k, false])),
      sec: -1, // -1 = 曲全体
      loop: !!saved.loop,
      // 元の録音があれば、それを最初に流す（自分で切り替えたことがあれば、そのとき選んだほう）
      src: opt.alt && (saved.srcPicked ? saved.src === 'alt' : true) ? 'alt' : 'parts',
      srcPicked: !!saved.srcPicked,
    };
    const save = () => writeStore(opt.id, { vol: st.vol, mute: st.mute, loop: st.loop, src: st.src, srcPicked: st.srcPicked });
    const cur = () => SETS[st.src];
    // 元の録音はテンポと頭の位置が練習用と違うので、拍を通して秒を直す
    const toParts = (sec) => (st.src === 'alt' ? opt.bar1 + ((sec - opt.alt.bar1) / opt.alt.spb) * opt.spb : sec);
    const fromParts = (sec) => (st.src === 'alt' ? opt.alt.bar1 + ((sec - opt.bar1) / opt.spb) * opt.alt.spb : sec);
    const bufs = {}; // src → AudioBuffer[]（tracks の順）
    const durs = {}; // src → 秒
    let sources = [];
    const gains = {}; // 状態のキー → GainNode
    let master = null;
    let startedAt = 0; // ctx 時刻で、曲の 0 秒にあたる時刻
    let pausedAt = 0;  // 一時停止した曲の秒
    let playing = false;
    let raf = 0;
    const curDur = () => durs[st.src] ?? 0;
    const range = () => {
      if (st.sec < 0 || !opt.sections) return [0, curDur()];
      const s = opt.sections[st.sec];
      const { bar1, spb } = cur();
      const barSec = 4 * spb;
      return [Math.max(0, bar1 + s.from * barSec - (s.from === 0 ? bar1 : 0)), Math.min(curDur(), bar1 + s.to * barSec)];
    };
    const noteText = () => (st.src === 'alt'
      ? `${opt.alt.label}：元の録音を、AI で楽器ごとの音に分けたものです。自分のパートを小さくして、重ねて練習できます。`
      : '練習用：譜面から作った、楽器ごとの音です。テンポが譜面どおりなので、ゆっくりの練習や判定に合います。');
    const rowsHtml = () => cur().tracks.map((t) => {
      const k = cur().key(t.id);
      return `<div class="mx-row${isMine(t) ? ' mine' : ''}" data-tr="${k}"><span class="mx-name">${t.label}</span><input type="range" min="0" max="100" value="${st.vol[k]}" aria-label="${t.label}の音量"><button type="button" data-m="mute" aria-pressed="${st.mute[k]}" title="消す">M</button><button type="button" data-m="solo" aria-pressed="${st.solo[k]}" title="これだけ鳴らす">S</button></div>`;
    }).join('');
    const hasMine = () => cur().tracks.some(isMine);
    const presetsHtml = () => `<button type="button" class="ghost" data-pre="all">全部の音</button>${hasMine() ? '<button type="button" class="ghost" data-pre="minus">自分のパートを消す</button><button type="button" class="ghost" data-pre="only">自分のパートだけ</button>' : ''}`;
    el.classList.add('mx');
    el.setAttribute('aria-busy', 'true');
    el.innerHTML = `<div class="mx-top">
        <button type="button" class="gold" data-mx="play">▶ 再生</button>
        <button type="button" class="ghost" data-mx="stop" hidden>■ 停止</button>
        <span class="mx-time">0:00 / 0:00</span>
        <input class="mx-seek" type="range" min="0" max="1000" value="0" aria-label="再生の位置">
      </div>
      ${opt.alt ? `<div class="mx-src"><span>音源</span><button type="button" data-src="alt" aria-pressed="${st.src === 'alt'}">${opt.alt.label}</button><button type="button" data-src="parts" aria-pressed="${st.src === 'parts'}">練習用（譜面から）</button></div>` : ''}
      ${opt.sections ? `<div class="mx-secs"><span>区間</span><button type="button" data-sec="-1" aria-pressed="true">全部</button>${opt.sections.map((s, i) => `<button type="button" data-sec="${i}" aria-pressed="false">${s.name}</button>`).join('')}<label><input type="checkbox" data-mx="loop"${st.loop ? ' checked' : ''}>くり返す</label></div>` : ''}
      <div class="mx-presets">${presetsHtml()}</div>
      <div class="mx-rows">${rowsHtml()}</div>
      <p class="mx-note">読み込み中…</p>`;
    const $ = (s) => el.querySelector(s);
    const gainOf = (k) => {
      const keys = cur().tracks.map((t) => cur().key(t.id));
      const anySolo = keys.some((x) => st.solo[x]);
      if (anySolo) return st.solo[k] ? st.vol[k] / 100 : 0;
      return st.mute[k] ? 0 : st.vol[k] / 100;
    };
    const applyGains = () => {
      cur().tracks.forEach((t) => { const k = cur().key(t.id); if (gains[k]) gains[k].gain.setTargetAtTime(gainOf(k) ** 1.6, audio().currentTime, 0.02); });
      el.querySelectorAll('.mx-row').forEach((r) => {
        const k = r.dataset.tr;
        r.querySelector('input').value = st.vol[k];
        r.querySelector('[data-m=mute]').setAttribute('aria-pressed', String(st.mute[k]));
        r.querySelector('[data-m=solo]').setAttribute('aria-pressed', String(st.solo[k]));
      });
    };
    const pos = () => (playing ? audio().currentTime - startedAt : pausedAt);
    const draw = () => {
      const d = curDur();
      const p = Math.min(pos(), d);
      $('.mx-time').textContent = `${fmt(p)} / ${fmt(d)}`;
      $('.mx-seek').value = d ? Math.round((p / d) * 1000) : 0;
      $('[data-mx=play]').textContent = playing ? '❚❚ 一時停止' : '▶ 再生';
      $('[data-mx=stop]').hidden = !playing && pausedAt <= range()[0] + 0.01;
    };
    const killSources = () => { sources.forEach((s) => { try { s.stop(); } catch (e) { /* もう止まっている */ } s.disconnect(); }); sources = []; };
    const tick = () => {
      if (!playing) return;
      const [a, b] = range();
      if (pos() >= b - 0.005) {
        if (st.loop) { startAt(a); } else { stop(); return; }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    const startAt = (from) => {
      const bs = bufs[st.src];
      if (!bs) return;
      const c = audio();
      killSources();
      master = master || c.createGain();
      master.connect(c.destination);
      const when = c.currentTime + 0.05;
      cur().tracks.forEach((t, i) => {
        const k = cur().key(t.id);
        if (!gains[k]) { gains[k] = c.createGain(); gains[k].connect(master); }
        gains[k].gain.value = gainOf(k) ** 1.6;
        const s = c.createBufferSource();
        s.buffer = bs[i];
        s.connect(gains[k]);
        s.start(when, from);
        sources.push(s);
      });
      startedAt = when - from;
      playing = true;
      if (opt.onState) opt.onState(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
      draw();
    };
    const pause = () => { if (!playing) return; pausedAt = pos(); playing = false; killSources(); cancelAnimationFrame(raf); draw(); if (opt.onState) opt.onState(false); };
    function stop() { const was = playing; playing = false; killSources(); cancelAnimationFrame(raf); pausedAt = range()[0]; draw(); if (was && opt.onState) opt.onState(false); }
    // 音源の組を読む（練習用は position の換算に長さを使うので、いつも読む）
    // ver：音源を作り直したときに変える（ブラウザが前の音源を数時間覚えているため、URL を変えて読み直させる）
    const loadSet = (src) => Promise.all(SETS[src].tracks.map((t) => load(`${opt.base}${t.id}.mp3${opt.ver ? `?v=${encodeURIComponent(opt.ver)}` : ''}`)))
      .then((bs) => { bufs[src] = bs; durs[src] = Math.max(...bs.map((b) => b.duration)); });
    const loading = {};
    const ready = () => {
      const need = ['parts', st.src].filter((s, i, a) => a.indexOf(s) === i);
      return Promise.all(need.map((s) => (loading[s] ??= loadSet(s))));
    };
    function failed(err) {
      console.error(err);
      $('.mx-note').textContent = `音源を読み込めませんでした。通信の状態を確かめて、もう一度開いてください。（${err.message}）`;
    }
    el.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('button') : null;
      if (!b || !el.contains(b)) return;
      if (b.dataset.mx === 'play') { if (playing) pause(); else startAt(Math.max(range()[0], Math.min(pausedAt, range()[1] - 0.05))); }
      else if (b.dataset.mx === 'stop') stop();
      else if (b.dataset.src && SETS[b.dataset.src]) {
        if (b.dataset.src === st.src) return;
        const at = toParts(pos()); // いまの位置を、切り替えたあとの音源でも同じ拍から鳴らす
        const was = playing;
        if (was) { playing = false; killSources(); cancelAnimationFrame(raf); }
        st.src = b.dataset.src;
        st.srcPicked = true;
        save();
        el.dataset.src = st.src;
        el.querySelectorAll('[data-src]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.src === st.src)));
        $('.mx-rows').innerHTML = rowsHtml();
        $('.mx-presets').innerHTML = presetsHtml();
        $('.mx-note').textContent = '読み込み中…';
        el.setAttribute('aria-busy', 'true');
        ready().then(() => {
          el.setAttribute('aria-busy', 'false');
          $('.mx-note').textContent = noteText();
          const p = Math.max(0, Math.min(fromParts(at), curDur() - 0.05));
          if (was) startAt(p); else { pausedAt = p; draw(); }
          if (!was && opt.onState) opt.onState(false);
        }).catch(failed);
      } else if (b.dataset.sec !== undefined) {
        st.sec = Number(b.dataset.sec);
        el.querySelectorAll('[data-sec]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        const was = playing;
        stop();
        if (was) startAt(range()[0]);
      } else if (b.dataset.pre) {
        cur().tracks.forEach((t) => {
          const k = cur().key(t.id);
          st.solo[k] = false;
          st.mute[k] = b.dataset.pre === 'minus' ? isMine(t) : b.dataset.pre === 'only' ? !isMine(t) : false;
        });
        applyGains(); save();
      } else if (b.dataset.m) {
        const k = b.closest('.mx-row').dataset.tr;
        st[b.dataset.m][k] = !st[b.dataset.m][k];
        applyGains(); save();
      }
    });
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.classList.contains('mx-seek')) {
        const p = (Number(t.value) / 1000) * curDur();
        if (playing) startAt(p); else { pausedAt = p; draw(); }
      } else if (t.type === 'range' && t.closest('.mx-row')) {
        st.vol[t.closest('.mx-row').dataset.tr] = Number(t.value);
        applyGains(); save();
      } else if (t.dataset.mx === 'loop') { st.loop = t.checked; save(); }
    });
    el.dataset.src = st.src;
    ready()
      .then(() => {
        el.setAttribute('aria-busy', 'false');
        $('.mx-note').textContent = noteText();
        draw();
      })
      .catch(failed);
    return {
      stop,
      pause,
      get playing() { return playing; },
      // 曲の何秒を鳴らしているか（練習用の音源の秒に直す。スピーカーまでの遅れ outputLatency は含まない）・練習用の曲の長さ・出力の遅れ（秒）
      get position() { return Math.min(toParts(Math.min(pos(), curDur())), durs.parts ?? 0); },
      get duration() { return durs.parts ?? 0; },
      get outLatency() { return ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0; },
      play() { if (!playing) startAt(Math.max(range()[0], Math.min(pausedAt, range()[1] - 0.05))); },
      destroy() { stop(); if (master) master.disconnect(); el.innerHTML = ''; el.classList.remove('mx'); delete el.dataset.src; },
    };
  };
  return { create };
})();

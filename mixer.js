'use strict';
// ==========================================================================
// 楽器トレーナー共通：曲の音源のマルチトラック・プレーヤー（Moises のように、パートごとに音量を変えて重ねて練習する）
// 5つのアプリ（読譜・ギター・ベース・ドラム・ヴォーカル）で同じファイルを使う。直したら全部にコピー
// 元は genre-songs/mixer.js
// 使い方：
//   const mx = Mixer.create(el, {
//     id: 'hr-leave-the-bill',                 // 音量の設定を覚えるキー
//     base: 'audio/songs/hr-leave-the-bill/',   // トラックの置き場所
//     tracks: [{ id: 'vocal', label: '歌' }, …], // base + id + '.mp3'
//     mine: 'guitar',                           // このアプリの楽器（「自分のパートを消す」で消す）
//     bar1: 0.876, spb: 0.5042,                 // 小節1の頭の秒・1拍の秒（区間の頭出しに使う）
//     sections: [{ name: 'イントロ', from: 0, to: 8 }, …], // 小節（0から数える）[from, to)
//   });
//   mx.stop(); mx.destroy();
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
    if (ctx.state === 'suspended') ctx.resume();
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
    const st = {
      vol: Object.fromEntries(opt.tracks.map((t) => [t.id, saved.vol?.[t.id] ?? 80])),
      mute: Object.fromEntries(opt.tracks.map((t) => [t.id, !!saved.mute?.[t.id]])),
      solo: Object.fromEntries(opt.tracks.map((t) => [t.id, false])),
      sec: -1, // -1 = 曲全体
      loop: !!saved.loop,
    };
    const save = () => writeStore(opt.id, { vol: st.vol, mute: st.mute, loop: st.loop });
    let buffers = null;
    let sources = [];
    let gains = {};
    let master = null;
    let startedAt = 0; // ctx 時刻で、曲の 0 秒にあたる時刻
    let pausedAt = 0;  // 一時停止した曲の秒
    let playing = false;
    let raf = 0;
    let dur = 0;
    const range = () => {
      if (st.sec < 0 || !opt.sections) return [0, dur];
      const s = opt.sections[st.sec];
      const barSec = 4 * opt.spb;
      return [Math.max(0, opt.bar1 + s.from * barSec - (s.from === 0 ? opt.bar1 : 0)), Math.min(dur, opt.bar1 + s.to * barSec)];
    };
    el.classList.add('mx');
    el.setAttribute('aria-busy', 'true');
    el.innerHTML = `<div class="mx-top">
        <button type="button" class="gold" data-mx="play">▶ 再生</button>
        <button type="button" class="ghost" data-mx="stop" hidden>■ 停止</button>
        <span class="mx-time">0:00 / 0:00</span>
        <input class="mx-seek" type="range" min="0" max="1000" value="0" aria-label="再生の位置">
      </div>
      ${opt.sections ? `<div class="mx-secs"><span>区間</span><button type="button" data-sec="-1" aria-pressed="true">全部</button>${opt.sections.map((s, i) => `<button type="button" data-sec="${i}" aria-pressed="false">${s.name}</button>`).join('')}<label><input type="checkbox" data-mx="loop"${st.loop ? ' checked' : ''}>くり返す</label></div>` : ''}
      <div class="mx-presets"><button type="button" class="ghost" data-pre="all">全部の音</button>${opt.mine ? '<button type="button" class="ghost" data-pre="minus">自分のパートを消す</button><button type="button" class="ghost" data-pre="only">自分のパートだけ</button>' : ''}</div>
      <div class="mx-rows">${opt.tracks.map((t) => `<div class="mx-row${t.id === opt.mine ? ' mine' : ''}" data-tr="${t.id}"><span class="mx-name">${t.label}</span><input type="range" min="0" max="100" value="${st.vol[t.id]}" aria-label="${t.label}の音量"><button type="button" data-m="mute" aria-pressed="${st.mute[t.id]}" title="消す">M</button><button type="button" data-m="solo" aria-pressed="false" title="これだけ鳴らす">S</button></div>`).join('')}</div>
      <p class="mx-note">元の曲の音を楽器ごとに分けたものです。自分のパートを小さくして、重ねて練習できます。読み込み中…</p>`;
    const $ = (s) => el.querySelector(s);
    const gainOf = (id) => {
      const anySolo = Object.values(st.solo).some(Boolean);
      if (anySolo) return st.solo[id] ? st.vol[id] / 100 : 0;
      return st.mute[id] ? 0 : st.vol[id] / 100;
    };
    const applyGains = () => {
      opt.tracks.forEach((t) => { if (gains[t.id]) gains[t.id].gain.setTargetAtTime(gainOf(t.id) ** 1.6, audio().currentTime, 0.02); });
      el.querySelectorAll('.mx-row').forEach((r) => {
        const id = r.dataset.tr;
        r.querySelector('input').value = st.vol[id];
        r.querySelector('[data-m=mute]').setAttribute('aria-pressed', String(st.mute[id]));
        r.querySelector('[data-m=solo]').setAttribute('aria-pressed', String(st.solo[id]));
      });
    };
    const pos = () => (playing ? audio().currentTime - startedAt : pausedAt);
    const draw = () => {
      const p = Math.min(pos(), dur);
      $('.mx-time').textContent = `${fmt(p)} / ${fmt(dur)}`;
      $('.mx-seek').value = dur ? Math.round((p / dur) * 1000) : 0;
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
      if (!buffers) return;
      const c = audio();
      killSources();
      master = master || c.createGain();
      master.connect(c.destination);
      const when = c.currentTime + 0.05;
      opt.tracks.forEach((t, i) => {
        if (!gains[t.id]) { gains[t.id] = c.createGain(); gains[t.id].connect(master); }
        gains[t.id].gain.value = gainOf(t.id) ** 1.6;
        const s = c.createBufferSource();
        s.buffer = buffers[i];
        s.connect(gains[t.id]);
        s.start(when, from);
        sources.push(s);
      });
      startedAt = when - from;
      playing = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
      draw();
    };
    const pause = () => { if (!playing) return; pausedAt = pos(); playing = false; killSources(); cancelAnimationFrame(raf); draw(); };
    function stop() { playing = false; killSources(); cancelAnimationFrame(raf); pausedAt = range()[0]; draw(); }
    el.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('button') : null;
      if (!b || !el.contains(b)) return;
      if (b.dataset.mx === 'play') { if (playing) pause(); else startAt(Math.max(range()[0], Math.min(pausedAt, range()[1] - 0.05))); }
      else if (b.dataset.mx === 'stop') stop();
      else if (b.dataset.sec !== undefined) {
        st.sec = Number(b.dataset.sec);
        el.querySelectorAll('[data-sec]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        const was = playing;
        stop();
        if (was) startAt(range()[0]);
      } else if (b.dataset.pre) {
        opt.tracks.forEach((t) => { st.solo[t.id] = false; st.mute[t.id] = b.dataset.pre === 'minus' ? t.id === opt.mine : b.dataset.pre === 'only' ? t.id !== opt.mine : false; });
        applyGains(); save();
      } else if (b.dataset.m) {
        const id = b.closest('.mx-row').dataset.tr;
        st[b.dataset.m][id] = !st[b.dataset.m][id];
        applyGains(); save();
      }
    });
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.classList.contains('mx-seek')) {
        const p = (Number(t.value) / 1000) * dur;
        if (playing) startAt(p); else { pausedAt = p; draw(); }
      } else if (t.type === 'range' && t.closest('.mx-row')) {
        st.vol[t.closest('.mx-row').dataset.tr] = Number(t.value);
        applyGains(); save();
      } else if (t.dataset.mx === 'loop') { st.loop = t.checked; save(); }
    });
    Promise.all(opt.tracks.map((t) => load(`${opt.base}${t.id}.mp3`)))
      .then((bs) => {
        buffers = bs;
        dur = Math.max(...bs.map((b) => b.duration));
        el.setAttribute('aria-busy', 'false');
        $('.mx-note').textContent = '元の曲の音を楽器ごとに分けたものです。自分のパートを小さくして、重ねて練習できます。';
        draw();
      })
      .catch((err) => {
        console.error(err);
        $('.mx-note').textContent = `音源を読み込めませんでした。通信の状態を確かめて、もう一度開いてください。（${err.message}）`;
      });
    return {
      stop,
      pause,
      get playing() { return playing; },
      destroy() { stop(); if (master) master.disconnect(); el.innerHTML = ''; el.classList.remove('mx'); },
    };
  };
  return { create };
})();

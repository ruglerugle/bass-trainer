'use strict';
// ==========================================================================
// 楽器トレーナー共通：お手本の再生を、途中で一時停止・停止できるようにする
// 5つのアプリ（読譜・ギター・ベース・ドラム・ヴォーカル）で同じファイルを使う。直したら全部にコピー
// 元は genre-songs/demo.js
// お手本のボタンを押すと、そのボタンが「一時停止」「停止」の2つに入れ替わる。
// 一時停止は「再開」に変わる。停止か、最後まで鳴ったら元のボタンに戻る。
//
// 使い方1：音をまとめて予約するお手本（読譜・ギター・ベース・ヴォーカル）
//   Demo.play(btn, {
//     ctx,                                  // AudioContext
//     out,                                  // つなぐ先（アプリの master など）
//     len,                                  // お手本の長さ（秒）
//     schedule: (bus, t0, from) => { … },   // お手本の from 秒より後の音を、ctx の時刻 t0 を from 秒として bus へ予約する
//     onEnd,                                // 止めた・終わったとき（省略可）
//   });
//   お手本の音は、毎回つくる GainNode（bus）だけを通す。止めるときは bus を切り離すので、予約済みの音も消える。
//   一時停止は「止めて、どこまで鳴ったかを覚える」。再開すると、その位置から予約し直す（AudioContext は止めない）。
// 使い方2：アプリが自分で進めるお手本（ドラム）
//   const h = Demo.bind(btn, { pause, resume, stop });  // 最後まで鳴ったら h.done()
// Demo.stop()：いま鳴っているお手本を止める（練習を始めるとき・画面や曲を変えるとき）
// ==========================================================================
const Demo = (() => {
  let styled = false;
  const style = () => {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.textContent = '.demo-ctl { display: inline-flex; flex-wrap: wrap; gap: 8px; }';
    document.head.appendChild(s);
  };
  let cur = null; // いま鳴っているお手本 { done, halt }

  // ボタンを「一時停止」「停止」の組に入れ替える
  const bind = (btn, h) => {
    stop();
    style();
    const box = document.createElement('span');
    box.className = 'demo-ctl';
    const mk = (text, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = btn.className;
      b.textContent = text;
      b.addEventListener('click', fn);
      box.appendChild(b);
      return b;
    };
    let paused = false;
    const pb = mk('一時停止', () => {
      paused = !paused;
      pb.textContent = paused ? '再開' : '一時停止';
      if (paused) h.pause(); else h.resume();
    });
    pb.dataset.demo = 'pause';
    mk('停止', () => stop()).dataset.demo = 'stop';
    const wasHidden = btn.hidden;
    btn.hidden = true;
    btn.after(box);
    const me = {
      // 元のボタンに戻す（音を止めるのは呼んだ側）
      done: () => {
        if (cur !== me) return;
        cur = null;
        box.remove();
        btn.hidden = wasHidden;
      },
      halt: h.stop,
      get paused() { return paused; },
    };
    cur = me;
    return me;
  };

  function stop() {
    const c = cur;
    if (!c) return;
    c.done();
    c.halt();
  }

  const play = (btn, { ctx, out, len, schedule, onEnd }) => {
    let bus = null;
    let t0 = 0;   // ctx の時刻で、お手本の from 秒にあたる時刻
    let from = 0; // どこから鳴らすか（秒）
    let timer = 0;
    // 予約した音を消す（ぷつっと鳴らないように、ごく短く小さくしてから切り離す）
    const cut = () => {
      clearTimeout(timer);
      if (!bus) return;
      const b = bus;
      bus = null;
      b.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      setTimeout(() => b.disconnect(), 80);
    };
    const end = () => { cut(); h.done(); onEnd?.(); };
    const begin = () => {
      if (ctx.state === 'suspended') ctx.resume().catch((e) => console.warn('音を出せません', e));
      bus = ctx.createGain();
      bus.connect(out);
      t0 = ctx.currentTime + 0.06;
      schedule(bus, t0, from);
      timer = setTimeout(end, (len - from) * 1000 + 400);
    };
    const h = bind(btn, {
      pause: () => { from = Math.min(len, from + Math.max(0, ctx.currentTime - t0)); cut(); },
      resume: begin,
      stop: () => { cut(); onEnd?.(); },
    });
    begin();
    return h;
  };

  return { play, bind, stop, get active() { return !!cur; } };
})();

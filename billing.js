'use strict';
// ---- 有料版（月額480円）：パスキーの会員・Stripe の支払い・有料のステージ ----
// サーバーは bass-billing（このサイトの /api/*）。index.html の本体より先に読み込み、本体の定数・関数は関数の中でだけ使う
// 無料：各モードのステージ1〜3と、その範囲の自由練習。有料：ステージ4から先（TAB譜のフレーズは /api/tab から受け取る）

// 有料版の案内を出すか。止めるときは false にする（全ステージが無料で開く）
const BILLING_ON = true;
const PRICE_LABEL = '月480円';
/** 各モードで無料のステージの数 */
const FREE_STAGES = 3;

let account = { signedIn: false, paid: false, name: '', customer: false, periodEnd: 0, cancelAtEnd: false };

/** そのステージに鍵がかかっているか（i は STAGES[m] の添字。自由練習は FREE＝-1） */
const isLockedStage = (m, i) => BILLING_ON && !account.paid && i >= FREE_STAGES;

const apiPost = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー（${res.status}）`);
  return data;
};
const apiGet = async (url) => {
  const res = await fetch(url, { credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー（${res.status}）`);
  return data;
};

// ---- パスキー（学習記録 my.habatakijuku.com の app.js と同じ変換） ----
const toBytes = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const toB64url = (buf) => {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const creationOptions = (o) => ({
  ...o,
  challenge: toBytes(o.challenge),
  user: { ...o.user, id: toBytes(o.user.id) },
  excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: toBytes(c.id) })),
});
const requestOptions = (o) => ({
  ...o,
  challenge: toBytes(o.challenge),
  allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: toBytes(c.id) })),
});
const registrationJSON = (cred) => ({
  id: cred.id,
  rawId: toB64url(cred.rawId),
  type: cred.type,
  response: {
    clientDataJSON: toB64url(cred.response.clientDataJSON),
    attestationObject: toB64url(cred.response.attestationObject),
    transports: cred.response.getTransports ? cred.response.getTransports() : [],
  },
  clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
  authenticatorAttachment: cred.authenticatorAttachment || undefined,
});
const authenticationJSON = (cred) => ({
  id: cred.id,
  rawId: toB64url(cred.rawId),
  type: cred.type,
  response: {
    clientDataJSON: toB64url(cred.response.clientDataJSON),
    authenticatorData: toB64url(cred.response.authenticatorData),
    signature: toB64url(cred.response.signature),
    userHandle: cred.response.userHandle ? toB64url(cred.response.userHandle) : undefined,
  },
  clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
  authenticatorAttachment: cred.authenticatorAttachment || undefined,
});
const explainPasskey = (e) =>
  e && e.name === 'NotAllowedError' ? 'パスキーの操作が取り消されたか、時間切れになりました。' :
  e && e.name === 'InvalidStateError' ? 'この端末のパスキーは、もう登録してあります。' :
  (e && e.message) || 'パスキーを使えませんでした。';

// ---- 会員の状態と有料のフレーズ ----
const refreshAccount = async () => {
  account = await apiGet('/api/me');
  if (account.paid) await loadPaidTab();
  renderPlan();
};

// 有料版の人は、TAB譜のステージ4から先のフレーズを受け取る
const loadPaidTab = async () => {
  if (!TAB_STAGES.some((s) => s.phrases.length === 0)) return;
  const { tab } = await apiGet('/api/tab');
  Object.entries(tab).forEach(([i, phrases]) => {
    const st = TAB_STAGES[Number(i)];
    if (st && Array.isArray(phrases)) st.phrases = phrases;
  });
};

const dateLabel = (secs) => {
  const d = new Date(secs * 1000);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

let toastTimer = 0;
const billingToast = (text) => {
  const el = $('billingToast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
};

const lockedCount = () => MODES.reduce((a, m) => a + Math.max(0, STAGES[m].length - FREE_STAGES), 0);

const renderPlan = () => {
  if (!BILLING_ON) return;
  $('planField').hidden = false;
  const btn = (id, label, ghost) => `<button type="button" data-plan="${id}"${ghost ? ' class="ghost"' : ''}>${label}</button>`;
  let status;
  let btns;
  if (account.paid) {
    status = `有料版をお使いです（${account.name}）。${account.cancelAtEnd ? `${dateLabel(account.periodEnd)}で終了します` : `次の更新日は${dateLabel(account.periodEnd)}です`}。`;
    btns = btn('portal', 'お支払い・解約', true) + btn('pair', '別の端末でログイン', true) + btn('logout', 'ログアウト', true);
  } else if (account.signedIn) {
    status = `${account.name} でログイン中。有料版にすると、ステージ4から先の${lockedCount()}ステージも練習できます（${PRICE_LABEL}）。`;
    btns = btn('buy', `有料版にする（${PRICE_LABEL}）`) + (account.customer ? btn('portal', 'お支払いの履歴', true) : '') + btn('pair', '別の端末でログイン', true) + btn('logout', 'ログアウト', true);
  } else {
    status = `各モードのステージ1〜3は無料です。有料版（${PRICE_LABEL}）にすると、ステージ4から先の${lockedCount()}ステージも練習できます。`;
    btns = btn('buy', `有料版にする（${PRICE_LABEL}）`) + btn('login', 'ログイン（申し込んだ方）', true);
  }
  $('planStatus').textContent = status;
  $('planBtns').innerHTML = btns;
  renderHome();
};

// 有料版の案内（鍵のかかったステージを押したときなど）
const openPay = (m, i) => {
  if (!BILLING_ON) return;
  const st = m && i >= 0 ? STAGES[m][i] : null;
  $('payLead').textContent = st
    ? `「${MODE_INFO[m].lane}」ステージ${i + 1}「${st.short}」から先は有料版です。`
    : '指板を地図にして、ベースラインまで。';
  $('payBenefits').innerHTML = [
    [`ステージ4から先の${lockedCount()}ステージ`, '指板・音名・五線譜の高いポジションと♯♭、TAB譜はオクターブ・スケール・ペンタ・アルペジオ・ウォーキング'],
    ['自由練習が全範囲に', '0〜12フレット・全音域から、苦手を多めに出します'],
    ['ステージ1〜3はそのまま', '無料の練習は、これまでどおりすべて使えます'],
  ].map(([b, s]) => `<li><span><b>${b}</b><small>${s}</small></span></li>`).join('');
  $('payDlg').showModal();
};

// ---- 申し込み・ログインの画面 ----
const openAcct = (view, message = '') => {
  const dlg = $('acctDlg');
  dlg.querySelectorAll('[data-view]').forEach((el) => { el.hidden = el.dataset.view !== view; });
  $('acctMsg').textContent = message;
  $('acctError').hidden = true;
  if (!dlg.open) dlg.showModal();
};
const acctError = (msg) => {
  $('acctError').textContent = msg;
  $('acctError').hidden = false;
};
const closeAcct = () => { if ($('acctDlg').open) $('acctDlg').close(); };

let afterSignIn = null; // ログインできたら続けてすること（申し込みなど）

const startCheckout = async () => {
  const { url } = await apiPost('/api/checkout');
  location.href = url;
};

const buyPlan = async () => {
  if (!account.signedIn) {
    afterSignIn = startCheckout;
    openAcct('register', '有料版の申し込みには、ベーストレーナー用のパスキー（指紋・顔・PINでログインするしくみ）を使います。パスワードやメールアドレスは要りません。');
    return;
  }
  try {
    await startCheckout();
  } catch (e) {
    alert(e.message);
  }
};

const signedInDone = async (recovery) => {
  await refreshAccount();
  const next = () => {
    closeAcct();
    const fn = afterSignIn;
    afterSignIn = null;
    if (fn) fn().catch((e) => alert(e.message));
  };
  if (!recovery) return next();
  // 復旧コードは1回だけ見せる
  $('acctRecovery').textContent = recovery;
  openAcct('recovery');
  $('acctRecoveryDone').onclick = next;
};

const registerPasskey = async () => {
  if (!window.PublicKeyCredential) return acctError('このブラウザはパスキーに対応していません。新しいブラウザで開いてください。');
  try {
    const opt = await apiPost('/api/register/options', { name: $('acctName').value });
    const cred = await navigator.credentials.create({ publicKey: creationOptions(opt) });
    const done = await apiPost('/api/register/verify', { response: registrationJSON(cred) });
    await signedInDone(done.recovery);
  } catch (e) {
    acctError(explainPasskey(e));
  }
};

const loginPasskey = async () => {
  if (!window.PublicKeyCredential) return acctError('このブラウザはパスキーに対応していません。');
  try {
    const opt = await apiPost('/api/login/options');
    const cred = await navigator.credentials.get({ publicKey: requestOptions(opt) });
    await apiPost('/api/login/verify', { response: authenticationJSON(cred) });
    await signedInDone('');
  } catch (e) {
    acctError(explainPasskey(e));
  }
};

const recoverAccount = async () => {
  try {
    const done = await apiPost('/api/recover', { code: $('acctCode').value });
    // 使った復旧コードは無効になるので新しいコードを見せ、この端末のパスキーを作ってもらう
    afterSignIn = async () => {
      const opt = await apiPost('/api/passkey/options');
      const cred = await navigator.credentials.create({ publicKey: creationOptions(opt) });
      await apiPost('/api/passkey/verify', { response: registrationJSON(cred) });
    };
    await signedInDone(done.recovery);
  } catch (e) {
    acctError(e.message);
  }
};

const pairNote = (m) => (typeof toast === 'function' ? toast(m) : console.info(m));
// ---- 別の端末でログイン：ログイン中の端末に8けたの番号を出し、新しい端末で入れる ----
let pairTimer = 0;
const showPairCode = async () => {
  clearTimeout(pairTimer);
  openAcct('pairOut');
  $('pairShow').textContent = '…';
  $('pairLeft').textContent = '';
  const { code, expiresIn } = await apiPost('/api/pair/start');
  $('pairShow').textContent = `${code.slice(0, 4)} ${code.slice(4)}`;
  const end = Date.now() + expiresIn * 1000;
  const tick = () => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    if (!$('acctDlg').open) return;
    if (!left) { $('pairShow').textContent = '時間切れ'; $('pairLeft').textContent = '「番号を出し直す」を押してください。'; return; }
    $('pairLeft').textContent = `あと ${Math.floor(left / 60)}分${String(left % 60).padStart(2, '0')}秒有効・1回だけ使えます`;
    pairTimer = setTimeout(tick, 1000);
  };
  tick();
};

const claimPair = async () => {
  try {
    await apiPost('/api/pair/claim', { code: $('pairCode').value });
    // ログインできたら、次からは番号なしで入れるように、この端末にもパスキーを作る
    afterSignIn = async () => {
      if (!window.PublicKeyCredential) return;
      try {
        const opt = await apiPost('/api/passkey/options');
        const cred = await navigator.credentials.create({ publicKey: creationOptions(opt) });
        await apiPost('/api/passkey/verify', { response: registrationJSON(cred) });
        pairNote('この端末にもパスキーを作りました');
      } catch (e) {
        pairNote(`ログインしました（パスキーは作れませんでした：${explainPasskey(e)}）`);
      }
    };
    $('pairCode').value = '';
    await signedInDone('');
  } catch (e) {
    acctError(e.message);
  }
};

const onPlanButton = async (what) => {
  try {
    if (what === 'buy') await buyPlan();
    else if (what === 'login') { afterSignIn = null; openAcct('login'); }
    else if (what === 'pair') await showPairCode();
    else if (what === 'portal') location.href = (await apiPost('/api/portal')).url;
    else if (what === 'logout') {
      await apiPost('/api/logout');
      location.reload();
    }
  } catch (e) {
    alert(e.message);
  }
};

// 支払い画面から戻ってきたとき
const handleCheckoutReturn = async () => {
  const q = new URLSearchParams(location.search);
  const result = q.get('checkout');
  if (!result) return;
  history.replaceState(null, '', location.pathname);
  if (result === 'cancel') {
    billingToast('申し込みは取り消されました');
    return;
  }
  const sessionId = q.get('session_id');
  if (result === 'done' && sessionId) {
    account = await apiPost('/api/checkout/confirm', { sessionId });
    if (account.paid) {
      await loadPaidTab();
      billingToast('ありがとうございます。有料版になりました。すべてのステージを練習できます');
    } else {
      billingToast('お支払いの確認に時間がかかっています。少ししてから開き直してください');
    }
    renderPlan();
  }
};

const initBilling = () => {
  if (!BILLING_ON) return;
  $('planBtns').addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button[data-plan]') : null;
    if (b) onPlanButton(b.dataset.plan);
  });
  $('payBuy').addEventListener('click', () => {
    $('payDlg').close();
    if (account.paid) return;
    buyPlan();
  });
  $('payLogin').addEventListener('click', () => {
    $('payDlg').close();
    afterSignIn = null;
    openAcct('login');
  });
  $('acctRegisterBtn').addEventListener('click', registerPasskey);
  $('acctLoginBtn').addEventListener('click', loginPasskey);
  $('acctRecoverBtn').addEventListener('click', recoverAccount);
  $('pairClaimBtn').addEventListener('click', claimPair);
  $('pairCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') claimPair(); });
  $('pairNewBtn').addEventListener('click', () => showPairCode().catch((e) => acctError(e.message)));
  $('acctDlg').addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-goto]') : null;
    if (b) openAcct(b.dataset.goto);
  });
  $('acctClose').addEventListener('click', () => { afterSignIn = null; closeAcct(); });
  renderPlan();
  refreshAccount()
    .then(handleCheckoutReturn)
    .catch((e) => console.warn('有料版の状態を確かめられませんでした', e));
};

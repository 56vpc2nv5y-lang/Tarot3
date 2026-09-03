/* ============================================================
   VELA Cloud
   - Firebase email/password authentication
   - secure callable Cloud Functions for points, purchases and admin
   - Firestore sync for personal app state
   ============================================================ */
(function() {
  const cfg = window.VELA_FIREBASE_CONFIG;
  const enabled = !!(cfg?.apiKey && cfg?.projectId && window.firebase);
  let auth = null, db = null, funcs = null, user = null, admin = false, profileUnsub = null;
  let syncTimer = null, applyingCloud = false, authRendered = false;

  const cloud = {
    enabled, user: null, isAdmin: false,
    isSignedIn: () => !!user,
    isApplyingCloud: () => applyingCloud,
    openAuth, openAdmin, signOut, scheduleSync, awardPoints, purchaseSkin,
    redeemCode, submitFeedback, adminGrantPoints
  };
  window.VELA_CLOUD = cloud;

  if (!enabled) return;

  firebase.initializeApp(cfg);
  auth = firebase.auth();
  db = firebase.firestore();
  funcs = firebase.app().functions('asia-east1');
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  auth.onAuthStateChanged(handleAuth);

  async function handleAuth(nextUser) {
    user = nextUser;
    cloud.user = user;
    profileUnsub?.();
    profileUnsub = null;
    admin = false;
    if (user) {
      const token = await user.getIdTokenResult(true).catch(() => null);
      admin = token?.claims?.admin === true;
      cloud.isAdmin = admin;
      if (!admin && !user.emailVerified) {
        await auth.signOut();
        return;
      }
      if (!admin) await funcs.httpsCallable('bootstrapUser')({}).catch(console.warn);
      await loadCloudState();
      startProfileListener();
      if (!admin && window.VELA?.prefs?.gestureControl) {
        window.VELA_GESTURES?.setGestureEnabled?.(true).catch(() => {});
      }
      document.getElementById('auth-modal')?.classList.remove('visible');
    } else {
      cloud.isAdmin = false;
      if (window.VELA_UTIL?.isTestAccessEnabled?.()) {
        window.VELA_UTIL.enableTestAccess({ persist: false, silent: true });
        document.getElementById('auth-modal')?.classList.remove('visible');
      } else {
        openAuth(true);
      }
    }
    updateAccountLabel();
  }

  function updateAccountLabel() {
    const label = document.getElementById('account-label');
    if (label) label.textContent = admin ? '管理后台' : (user?.email || (window.VELA_UTIL?.isTestAccessEnabled?.() ? '本地测试' : '登录'));
  }

  function friendlyError(e) {
    const code = e?.code || '';
    if (code.includes('invalid-credential')) return '邮箱或密码不正确';
    if (code.includes('email-already-in-use')) return '这个邮箱已经注册';
    if (code.includes('weak-password')) return '密码至少需要 6 位';
    if (code.includes('invalid-email')) return '邮箱格式不正确';
    if (code.includes('too-many-requests')) return '尝试次数过多，请稍后再试';
    return e?.message || '操作失败，请稍后再试';
  }

  function openAuth(required = false) {
    if (window.VELA_UTIL?.isTestAccessEnabled?.() && !user) return renderLocalTestAccount();
    if (!enabled) {
      if (window.VELA_UTIL?.isLocalPreview?.()) {
        window.VELA_UTIL.enableTestAccess();
        return renderLocalTestAccount();
      }
      window.VELA_GESTURES?.showTopToast?.('Firebase 尚未配置，当前使用本地模式');
      return;
    }
    if (user) {
      if (admin) return openAdmin();
      return renderAccount();
    }
    required = true;
    const m = document.getElementById('auth-modal');
    const card = m.querySelector('.modal-card');
    card.innerHTML = `
      ${required ? '' : '<button class="modal-close" data-close>×</button>'}
      <h2>登录 VELA</h2>
      <div class="modal-sub">登录后，积分、解读日志与皮肤会安全同步到云端</div>
      <div class="tabs">
        <button class="tab active" data-auth-tab="login">登录</button>
        <button class="tab" data-auth-tab="register">注册</button>
        <button class="tab" data-auth-tab="admin">管理入口</button>
      </div>
      <div id="auth-body"></div>
      <div id="auth-error" style="min-height:18px;margin-top:12px;color:#c55;font-family:var(--font-ui);font-size:12px;"></div>
    `;
    card.querySelector('[data-close]')?.addEventListener('click', () => m.classList.remove('visible'));
    card.querySelectorAll('[data-auth-tab]').forEach(t => t.onclick = () => {
      card.querySelectorAll('[data-auth-tab]').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderAuthTab(t.dataset.authTab);
    });
    renderAuthTab('login');
    m.classList.add('visible');
    authRendered = true;

    function renderAuthTab(tab) {
      const body = card.querySelector('#auth-body');
      const err = card.querySelector('#auth-error');
      err.textContent = '';
      if (tab === 'admin') {
        body.innerHTML = `
          <div class="field"><label>管理员口令</label><input id="admin-passcode" type="password" autocomplete="current-password" placeholder="输入后台口令"></div>
          <button class="btn-primary" id="admin-login" style="width:100%;">进入后台</button>
        `;
        body.querySelector('#admin-login').onclick = async () => {
          try {
            const passcode = body.querySelector('#admin-passcode').value;
            const result = await funcs.httpsCallable('adminLogin')({ passcode });
            await auth.signInWithCustomToken(result.data.token);
            const token = await auth.currentUser.getIdTokenResult(true);
            user = auth.currentUser;
            admin = token.claims.admin === true;
            cloud.user = user;
            cloud.isAdmin = admin;
            openAdmin();
          } catch (e) { err.textContent = friendlyError(e); }
        };
        return;
      }
      body.innerHTML = `
        <div class="field"><label>邮箱</label><input id="auth-email" type="email" autocomplete="email" placeholder="name@example.com"></div>
        <div class="field"><label>密码</label><input id="auth-password" type="password" autocomplete="${tab === 'register' ? 'new-password' : 'current-password'}" placeholder="至少 6 位"></div>
        <button class="btn-primary" id="auth-submit" style="width:100%;">${tab === 'register' ? '创建账号' : '登录'}</button>
        ${tab === 'login' ? '<button class="topbar-btn" id="auth-reset" style="width:100%;justify-content:center;margin-top:8px;">忘记密码</button>' : ''}
        ${tab === 'login' && window.VELA_UTIL?.isLocalPreview?.() ? '<button class="topbar-btn" id="auth-local-test" style="width:100%;justify-content:center;margin-top:8px;">本地测试模式：解锁全部皮肤</button>' : ''}
      `;
      body.querySelector('#auth-submit').onclick = async () => {
        const email = body.querySelector('#auth-email').value.trim();
        const password = body.querySelector('#auth-password').value;
        try {
          if (tab === 'register') {
            const credential = await auth.createUserWithEmailAndPassword(email, password);
            await credential.user.sendEmailVerification();
            await auth.signOut();
            err.style.color = 'var(--accent)';
            err.textContent = '验证邮件已发送。请验证邮箱后再登录。';
          } else {
            const credential = await auth.signInWithEmailAndPassword(email, password);
            if (!credential.user.emailVerified) {
              await credential.user.sendEmailVerification().catch(() => {});
              await auth.signOut();
              throw new Error('请先完成邮箱验证。新的验证邮件已发送。');
            }
          }
        } catch (e) { err.textContent = friendlyError(e); }
      };
      body.querySelector('#auth-local-test')?.addEventListener('click', async () => {
        window.VELA_UTIL?.enableTestAccess?.();
        m.classList.remove('visible');
        updateAccountLabel();
        if (window.VELA.prefs.gestureControl) await window.VELA_GESTURES?.setGestureEnabled?.(true);
      });
      body.querySelector('#auth-reset')?.addEventListener('click', async () => {
        const email = body.querySelector('#auth-email').value.trim();
        if (!email) { err.textContent = '请先输入邮箱'; return; }
        try {
          await auth.sendPasswordResetEmail(email);
          err.style.color = 'var(--accent)';
          err.textContent = '密码重置邮件已发送';
        } catch (e) { err.textContent = friendlyError(e); }
      });
    }
  }

  function renderLocalTestAccount() {
    const m = document.getElementById('auth-modal');
    const card = m.querySelector('.modal-card');
    card.innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>本地测试模式</h2>
      <div class="modal-sub">已解锁全部主题、牌面、牌背，并提供足够积分用于测试。</div>
      <button class="btn-primary" data-open-store style="width:100%;margin-bottom:10px;">打开皮肤商店</button>
      <button class="topbar-btn" data-disable-test style="width:100%;justify-content:center;">关闭测试模式并刷新</button>
    `;
    card.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    card.querySelector('[data-open-store]').onclick = () => {
      m.classList.remove('visible');
      window.VELA_MODALS?.openStore?.('faces');
    };
    card.querySelector('[data-disable-test]').onclick = () => {
      window.VELA_UTIL?.storage?.remove?.('vela_test_access');
      location.reload();
    };
    m.classList.add('visible');
  }
  function renderAccount() {
    const m = document.getElementById('auth-modal');
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>云端账号</h2>
      <div class="modal-sub">${user.email || '管理员账号'}</div>
      <div style="font-family:var(--font-body);line-height:1.8;margin-bottom:18px;">
        当前积分：<strong style="color:var(--accent);">✦ ${window.VELA.points.toLocaleString()}</strong><br>
        云端同步：已开启
      </div>
      ${admin ? '<button class="btn-primary" data-admin style="width:100%;margin-bottom:10px;">打开管理后台</button>' : ''}
      <button class="topbar-btn" data-signout style="width:100%;justify-content:center;">退出登录</button>
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    m.querySelector('[data-admin]')?.addEventListener('click', openAdmin);
    m.querySelector('[data-signout]').onclick = signOut;
    m.classList.add('visible');
  }

  async function signOut() {
    await auth?.signOut();
    document.getElementById('auth-modal')?.classList.remove('visible');
  }

  function privateState() {
    const v = window.VELA;
    return {
      history: v.history, achievements: v.achievements, viewedCards: v.viewedCards,
      prefs: { ...v.prefs, apiKey: '' }, currentSpread: v.currentSpread, currentTheme: v.currentTheme,
      currentTone: v.currentTone, cardBack: v.cardBack, cardFace: v.cardFace,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function loadCloudState() {
    if (!user || !window.VELA) return;
    const [profileSnap, stateSnap] = await Promise.all([
      db.doc(`users/${user.uid}`).get(),
      db.doc(`users/${user.uid}/private/state`).get()
    ]);
    applyingCloud = true;
    try {
      const profile = profileSnap.data() || {};
      const state = stateSnap.data() || {};
      if (typeof profile.points === 'number') window.VELA.points = profile.points;
      if (profile.unlocked) window.VELA.unlocked = profile.unlocked;
      if ((profile.approvedFeedbackCount || 0) > 0) {
        window.VELA_UTIL.storage.set('vela_feedback_approved', true);
      }
      const localApiKey = window.VELA.prefs?.apiKey || '';
      ['history','achievements','viewedCards','currentSpread','currentTheme','currentTone','cardBack','cardFace']
        .forEach(k => { if (state[k] !== undefined) window.VELA[k] = state[k]; });
      window.VELA_UTIL?.normalizeVelaState?.();
      window.VELA_UTIL?.ensurePreviewPoints?.();
      if (window.VELA_UTIL?.isTestAccessEnabled?.()) window.VELA_UTIL.enableTestAccess({ persist: false, silent: true });
      if (state.prefs) window.VELA.prefs = { ...window.VELA.prefs, ...state.prefs, apiKey: localApiKey };
      if (Array.isArray(profile.achievementIds)) {
        profile.achievementIds.forEach(id => {
          window.VELA.achievements[id] ||= { ts: Date.now(), cloud: true };
        });
      }
      window.VELA_POINTS?.updatePointsDisplay?.();
      document.body.setAttribute('data-cardback', window.VELA.cardBack || 'classic');
      window.VELA_THEMES?.applyTheme?.(window.VELA.currentTheme);
    } finally {
      applyingCloud = false;
    }
  }

  function startProfileListener() {
    if (!user || admin) return;
    profileUnsub = db.doc(`users/${user.uid}`).onSnapshot(snap => {
      const profile = snap.data();
      if (!profile) return;
      applyingCloud = true;
      try {
        if (typeof profile.points === 'number') window.VELA.points = profile.points;
        if (profile.unlocked) window.VELA.unlocked = profile.unlocked;
        window.VELA_UTIL?.normalizeVelaState?.();
        window.VELA_UTIL?.ensurePreviewPoints?.();
        if (window.VELA_UTIL?.isTestAccessEnabled?.()) window.VELA_UTIL.enableTestAccess({ persist: false, silent: true });
        if (Array.isArray(profile.achievementIds)) {
          profile.achievementIds.forEach(id => {
            window.VELA.achievements[id] ||= { ts: Date.now(), cloud: true };
          });
        }
        if (Array.isArray(profile.achievementIds)) {
          profile.achievementIds.forEach(id => {
            window.VELA.achievements[id] ||= { ts: Date.now(), cloud: true };
          });
        }
        if ((profile.approvedFeedbackCount || 0) > 0) {
          window.VELA_UTIL.storage.set('vela_feedback_approved', true);
          window.VELA_POINTS?.checkProgressAchievements?.();
        }
        window.VELA_POINTS?.updatePointsDisplay?.();
      } finally { applyingCloud = false; }
    }, console.warn);
  }

  function scheduleSync() {
    if (!enabled || !user || applyingCloud) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      db.doc(`users/${user.uid}/private/state`).set(privateState(), { merge: true }).catch(console.warn);
    }, 700);
  }

  async function call(name, data) {
    if (!user) return null;
    const result = await funcs.httpsCallable(name)(data);
    return result.data;
  }

  async function awardPoints(action, eventId) {
    const result = await call('awardPoints', { action, eventId });
    if (result?.points !== undefined) applyServerWallet(result);
    return result;
  }

  async function purchaseSkin(kind, skinId) {
    const result = await call('purchaseSkin', { kind, skinId });
    if (result?.points !== undefined) applyServerWallet(result);
    return result;
  }

  async function redeemCode(code) {
    const result = await call('redeemCode', { code });
    if (result?.points !== undefined) applyServerWallet(result);
    return result;
  }

  async function submitFeedback(text) {
    return call('submitFeedback', { text });
  }

  async function adminGrantPoints(uid, amount, reason) {
    return call('adminGrantPoints', { uid, amount, reason });
  }

  function applyServerWallet(result) {
    window.VELA.points = result.points;
    if (result.unlocked) window.VELA.unlocked = result.unlocked;
    window.VELA_UTIL?.normalizeVelaState?.();
    window.VELA_UTIL?.ensurePreviewPoints?.();
    if (window.VELA_UTIL?.isTestAccessEnabled?.()) window.VELA_UTIL.enableTestAccess({ persist: false, silent: true });
    window.VELA_POINTS?.updatePointsDisplay?.();
    window.VELA.save();
  }

  async function openAdmin() {
    if (!admin) return openAuth();
    const m = document.getElementById('admin-modal');
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>VELA 管理后台</h2>
      <div class="modal-sub">用户积分与反馈采纳由服务器执行</div>
      <div class="tabs">
        <button class="tab active" data-admin-tab="feedback">反馈</button>
        <button class="tab" data-admin-tab="users">用户与积分</button>
        <button class="tab" data-admin-tab="codes">兑换码</button>
      </div>
      <div id="admin-body">加载中…</div>
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    m.querySelectorAll('[data-admin-tab]').forEach(t => t.onclick = () => {
      m.querySelectorAll('[data-admin-tab]').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderAdminTab(t.dataset.adminTab);
    });
    m.classList.add('visible');
    renderAdminTab('feedback');

    async function renderAdminTab(tab) {
      const body = m.querySelector('#admin-body');
      body.textContent = '加载中…';
      try {
        if (tab === 'feedback') {
          const result = await call('adminListFeedback', {});
          body.innerHTML = (result.items || []).map(f => `
            <div class="admin-row">
              <div><strong>${f.email || f.uid}</strong><div>${escapeHtml(f.text)}</div><small>${f.status || 'pending'}</small></div>
              ${f.status === 'approved' ? '<span>已采纳 +150</span>' : `<button class="topbar-btn" data-approve="${f.id}">采纳并奖励</button>`}
            </div>
          `).join('') || '<div class="modal-sub">暂无反馈</div>';
          body.querySelectorAll('[data-approve]').forEach(b => b.onclick = async () => {
            await call('adminApproveFeedback', { feedbackId: b.dataset.approve });
            renderAdminTab('feedback');
          });
        } else if (tab === 'users') {
          const result = await call('adminListUsers', {});
          body.innerHTML = (result.items || []).map(u => `
            <div class="admin-row">
              <div><strong>${u.email || u.uid}</strong><small>积分 ${u.points || 0}</small></div>
              <div style="display:flex;gap:6px;"><input data-amount="${u.uid}" type="number" value="100" style="width:85px;"><button class="topbar-btn" data-grant="${u.uid}">加分</button></div>
            </div>
          `).join('');
          body.querySelectorAll('[data-grant]').forEach(b => b.onclick = async () => {
            const amount = Number(body.querySelector(`[data-amount="${b.dataset.grant}"]`).value);
            await adminGrantPoints(b.dataset.grant, amount, '管理员奖励');
            renderAdminTab('users');
          });
        } else {
          body.innerHTML = `
            <div class="field"><label>兑换码</label><input id="admin-code" placeholder="VELA-XXXX"></div>
            <div class="field"><label>积分</label><input id="admin-code-points" type="number" value="100" min="1" max="10000"></div>
            <button class="btn-primary" id="admin-code-create" style="width:100%;">创建或更新兑换码</button>
          `;
          body.querySelector('#admin-code-create').onclick = async () => {
            const code = body.querySelector('#admin-code').value.trim();
            const points = Number(body.querySelector('#admin-code-points').value);
            await call('adminCreateRedeemCode', { code, points });
            window.VELA_GESTURES?.showTopToast?.('兑换码已保存');
          };
        }
      } catch (e) { body.textContent = friendlyError(e); }
    }
  }

  function escapeHtml(t) {
    return String(t || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();

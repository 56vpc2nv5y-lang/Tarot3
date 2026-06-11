/* ============================================================
   VELA · 主程序
   - state machine
   - loading screen
   - egg + tweaks
   - event wiring
   ============================================================ */
(function() {
  const { $, $$, el, storage } = window.VELA_UTIL;
  const { DECK, SPREADS } = window.VELA_DATA;
  const T = window.VELA_THEMES;
  const C = window.VELA_CAROUSEL;
  const G = window.VELA_GESTURES;
  const M = window.VELA_MODALS;
  const P = window.VELA_POINTS;

  // ----- State transitions -----
  function setState(s) {
    window.VELA.state = s;
    document.body.setAttribute('data-state', s);
  }

  const IDLE_TEXTS = [
    { h: 'VELA', p: '大航海时代，水手们靠星辰导航。<br/>把你的迷雾交给牌，它只是一面镜子。' },
    { h: 'VELA', p: '没有人能替你决定，<br/>但有一些时刻，值得安静地问问自己。' },
    { h: 'VELA', p: '你来到这里，不是为了答案，<br/>是为了听见你心里早就有的那个声音。' },
    { h: 'VELA', p: '78 张牌是 78 面镜子。<br/>今晚的那一面，会照见你哪一部分？' },
    { h: 'VELA', p: '把今天的疲惫放下来一会儿。<br/>让牌替你说出难以开口的话。' },
    { h: 'VELA', p: '你不需要相信塔罗，<br/>只需要相信此刻你愿意安静下来这件事。' },
    { h: 'VELA', p: '愿你今夜不再独自面对那些问题。<br/>星辰一直在听。' }
  ];

  function renderIdle() {
    setState('IDLE');
    const scene = document.getElementById('scene');
    C.clearSlots();
    T.showMandala(false);
    const txt = IDLE_TEXTS[Math.floor(Math.random() * IDLE_TEXTS.length)];
    scene.innerHTML = `
      <div class="idle-hero">
        <h1>${txt.h}</h1>
        <p>${txt.p}</p>
        <button class="btn-primary" id="start-btn">开始占卜</button>
      </div>
    `;
    document.getElementById('start-btn').onclick = startFlow;
    G.setStatus('握拳 · 或点击开始');
    M.updateSpreadHint();
  }

  function startFlow() {
    // Mood selection
    setState('MOOD');
    M.openMood((mood, cancelled) => {
      if (cancelled) { renderIdle(); return; }
      // After mood (whether picked or skipped), go to question
      M.openQuestion((q, intent) => {
        // Stash the question for later when AI panel opens
        window.VELA.currentQuestion = q;
        window.VELA.currentIntent = intent;
        beginPicking();
      });
    });
  }

  function beginPicking() {
    setState('PICKING');
    window.VELA.picked = [];
    const scene = document.getElementById('scene');
    C.initSlots();
    T.showMandala(true);
    C.initCarousel(scene, (picked, total) => {
      G.setStatus(`已选 ${picked} / ${total} 张`);
    });
    C.onComplete(() => {
      setTimeout(() => beginReveal(), 600);
    });
    G.setStatus('张开手掌 · 在中央悬停选牌');
  }

  async function beginReveal() {
    setState('REVEALING');
    T.showMandala(false);
    const scene = document.getElementById('scene');
    C.clearSlots();
    G.setStatus('正在揭示…');
    await C.showReveal(scene);
    setState('INTERPRETING');
    G.setStatus('握拳 · 或点击「解读」开启 AI 占卜');

    // add a "interpret now" button below
    const board = scene.querySelector('.spread-board');
    if (board && !document.getElementById('interpret-btn')) {
      const btn = el('button', { class: 'btn-primary', id: 'interpret-btn', style: { marginTop: '32px' } }, '✦ 开启解读');
      btn.onclick = () => triggerInterpret();
      scene.appendChild(btn);
    }
  }

  function triggerInterpret() {
    if (window.VELA.state !== 'INTERPRETING') return;
    M.openAIPanel(window.VELA.currentQuestion || '', window.VELA.currentIntent || null);
  }

  // ----- Loading screen -----
  function preloadAssets() {
    return new Promise((resolve) => {
      const loading = document.getElementById('loading');
      const fill = document.getElementById('loading-fill');
      const pct = document.getElementById('loading-pct');
      const force = document.getElementById('loading-force');
      const total = DECK.length;
      let done = 0, fail = 0;

      const forceTimer = setTimeout(() => force?.classList.add('visible'), 4000);
      force.onclick = () => { clearTimeout(forceTimer); finish(); };

      const update = () => {
        const p = Math.round(((done + fail) / total) * 100);
        if (fill) fill.style.width = p + '%';
        if (pct) pct.textContent = p + '%';
        if (done + fail >= total) finish();
      };
      let finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(forceTimer);
        loading?.classList.add('fading');
        setTimeout(() => { loading?.remove(); resolve(); }, 700);
      }
      DECK.forEach(c => {
        const img = new Image();
        img.onload = () => { done++; update(); };
        img.onerror = () => { fail++; update(); };
        img.src = c.img;
      });
      // safety
      setTimeout(finish, 12000);
    });
  }

  // ----- VELA Easter Egg -----
  let velaClicks = [];
  function bindVelaEgg() {
    const brand = document.getElementById('topbar-brand');
    brand?.addEventListener('click', () => {
      const now = Date.now();
      velaClicks = velaClicks.filter(t => now - t < 2000);
      velaClicks.push(now);
      if (velaClicks.length >= 3) {
        velaClicks = [];
        document.getElementById('vela-egg')?.classList.add('visible');
      }
    });
    document.getElementById('vela-egg-close')?.addEventListener('click', () => {
      document.getElementById('vela-egg')?.classList.remove('visible');
    });
  }

  // ----- Tweaks Panel -----
  function bindTweaksPanel() {
    let active = false;
    const TWEAKS = /*EDITMODE-BEGIN*/{
      "themeAVariant": "stars",
      "themeBVariant": "shafts",
      "themeCVariant": "grid",
      "themeDVariant": "blobs",
      "carouselDensity": "normal"
    }/*EDITMODE-END*/;
    // load saved
    const saved = storage.get('vela_tweaks', {});
    Object.assign(TWEAKS, saved);
    applyTweaks(TWEAKS);

    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === '__activate_edit_mode') {
        document.getElementById('tweaks-panel').classList.add('visible');
        document.getElementById('tweaks-fab').classList.add('visible');
        active = true;
      } else if (d.type === '__deactivate_edit_mode') {
        document.getElementById('tweaks-panel').classList.remove('visible');
        document.getElementById('tweaks-fab').classList.remove('visible');
        active = false;
      }
    });
    window.parent?.postMessage({ type: '__edit_mode_available' }, '*');

    // Render tweaks panel content
    function render() {
      const panel = document.getElementById('tweaks-panel');
      const themeNames = { A: 'A·暗色', B: 'B·圣光', C: 'C·禅', D: 'D·梦幻' };
      const variants = {
        A: [['stars','星海'], ['nebula','星云'], ['void','虚空']],
        B: [['shafts','光柱'], ['halo','光晕'], ['mist','薄雾']],
        C: [['grid','网格'], ['void','空白'], ['lines','细线']],
        D: [['blobs','水彩'], ['flow','流光'], ['petal','花瓣']]
      };
      const curTheme = window.VELA.currentTheme;
      const variantList = variants[curTheme];
      const variantKey = { A: 'themeAVariant', B: 'themeBVariant', C: 'themeCVariant', D: 'themeDVariant' }[curTheme];
      panel.innerHTML = `
        <h3>Tweaks · 调整</h3>
        <div class="tweak-row">
          <label>主题 · ${themeNames[curTheme]}</label>
          <div class="segments">
            ${variantList.map(([id, n]) => `<div class="seg ${TWEAKS[variantKey] === id ? 'active' : ''}" data-vk="${variantKey}" data-v="${id}">${n}</div>`).join('')}
          </div>
        </div>
        <div class="tweak-row">
          <label>卡牌密度</label>
          <div class="segments">
            ${[['compact','紧凑'],['normal','标准'],['spacious','宽松']].map(([id,n]) => `<div class="seg ${TWEAKS.carouselDensity === id ? 'active' : ''}" data-vk="carouselDensity" data-v="${id}">${n}</div>`).join('')}
          </div>
        </div>
      `;
      panel.querySelectorAll('.seg').forEach(s => s.onclick = () => {
        TWEAKS[s.dataset.vk] = s.dataset.v;
        storage.set('vela_tweaks', TWEAKS);
        applyTweaks(TWEAKS);
        render();
        window.parent?.postMessage({ type: '__edit_mode_set_keys', edits: { [s.dataset.vk]: s.dataset.v } }, '*');
      });
    }

    // Update tweaks panel content when theme changes too
    const origApply = T.applyTheme;
    T.applyTheme = function(t) {
      origApply(t);
      if (active) render();
      applyTweaks(TWEAKS);
    };
    render();
  }

  function applyTweaks(t) {
    const body = document.body;
    // density
    if (t.carouselDensity === 'compact')   body.style.setProperty('--cw', 'clamp(70px, 11vw, 130px)');
    else if (t.carouselDensity === 'spacious') body.style.setProperty('--cw', 'clamp(90px, 16vw, 200px)');
    else body.style.removeProperty('--cw');

    // variant — apply class on bg-layer
    document.querySelectorAll('.bg-variant').forEach(n => n.remove());
    const cur = window.VELA.currentTheme;
    const key = { A: 'themeAVariant', B: 'themeBVariant', C: 'themeCVariant', D: 'themeDVariant' }[cur];
    body.setAttribute('data-variant', t[key] || '');
  }

  // ----- Init / Wire UI -----
  function wire() {
    document.getElementById('btn-settings')?.addEventListener('click', M.openSettings);
    document.getElementById('btn-log')?.addEventListener('click', M.openLog);
    document.getElementById('btn-points')?.addEventListener('click', M.openPointsHistory);
    document.getElementById('btn-account')?.addEventListener('click', () => window.VELA_CLOUD?.openAuth?.());
    document.getElementById('checkin-claim')?.addEventListener('click', (e) => P.doCheckin(e));
    document.getElementById('help-btn')?.addEventListener('click', () => G.showOnboarding(true));
    document.getElementById('onboard-ok')?.addEventListener('click', () => {
      G.dismissOnboarding();
      document.getElementById('help-btn').classList.add('visible');
    });

    document.addEventListener('keydown', (e) => {
      if (window.VELA.state === 'PICKING') {
        if (e.key === 'ArrowLeft')  C.scrollBy(-0.4);
        if (e.key === 'ArrowRight') C.scrollBy(0.4);
        if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); C.selectCenter(); }
      }
      if (e.key === 'Escape') M.closeAllModals();
    });

    // Mouse wheel = scroll carousel
    document.getElementById('scene')?.addEventListener('wheel', (e) => {
      if (window.VELA.state === 'PICKING') {
        e.preventDefault();
        C.scrollBy(e.deltaY * 0.01);
      }
    }, { passive: false });

    // touch swipe
    let touchX = null;
    document.getElementById('scene')?.addEventListener('touchstart', (e) => {
      if (window.VELA.state === 'PICKING') touchX = e.touches[0].clientX;
    }, { passive: true });
    document.getElementById('scene')?.addEventListener('touchmove', (e) => {
      if (touchX != null) {
        const dx = e.touches[0].clientX - touchX;
        C.scrollBy(-dx * 0.005);
        touchX = e.touches[0].clientX;
      }
    }, { passive: true });
    document.getElementById('scene')?.addEventListener('touchend', () => touchX = null);

    document.addEventListener('visibilitychange', () => {
      window.VELA.isPaused = document.visibilityState === 'hidden';
    });

    G.setOnChargeComplete(() => {
      if (window.VELA.state === 'IDLE') startFlow();
      else if (window.VELA.state === 'INTERPRETING') triggerInterpret();
    });
  }

  async function init() {
    // theme + canvas
    T.applyTheme(window.VELA.currentTheme);
    document.body.setAttribute('data-cardback', window.VELA.cardBack || 'classic');
    document.body.classList.toggle('simple-anim', !!window.VELA.prefs.simpleAnim);
    T.initStarsCanvas();
    T.buildMandala();
    G.initGestureUI();

    P.updatePointsDisplay();
    P.maybeShowCheckin();
    M.updateSpreadHint();
    updateLogBadge();

    wire();
    bindVelaEgg();
    bindTweaksPanel();

    // help button visible after onboarding
    if (storage.get('vela_gesture_seen', false)) {
      document.getElementById('help-btn').classList.add('visible');
    }

    await preloadAssets();
    renderIdle();
    const authReady = !window.VELA_CLOUD?.enabled || window.VELA_CLOUD?.isSignedIn?.();
    if (window.VELA.prefs.gestureControl && authReady) G.showOnboarding();

    // Start camera in background (don't block UI)
    if (window.VELA.prefs.gestureControl && authReady) G.startCamera().catch(() => {});
  }

  function updateLogBadge() {
    const btn = document.getElementById('btn-log');
    if (!btn) return;
    const pending = window.VELA.history.filter(h => !h.outcome && (Date.now() - h.ts) > 86400000).length;
    let badge = btn.querySelector('.log-badge');
    if (pending > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'log-badge';
        btn.appendChild(badge);
      }
      badge.textContent = pending > 9 ? '9+' : pending;
    } else if (badge) {
      badge.remove();
    }
  }

  window.VELA_APP = { init, renderIdle, startFlow, beginPicking, beginReveal, triggerInterpret, updateLogBadge };
  document.addEventListener('DOMContentLoaded', init);
})();

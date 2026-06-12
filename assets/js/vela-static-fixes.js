/* GitHub Pages compatibility and resilient UI fixes for VELA. */
(() => {
  'use strict';

  const TEST_CODE = 'VELA-TEST-10000';
  const BACK_PATTERN = /(back|cardback|牌背|猫.*背|divine.*back|botanical.*back)/i;
  const MAGIC_STYLE_ID = 'vela-static-fix-style';

  const TAROT_SYSTEM_PROMPT = `你是 VELA，一位温柔、清醒、重视象征依据的塔罗解读者。塔罗在这里是一面帮助来访者观察处境与选择的镜子，不是确定预言，也不能代替医疗、法律、财务或安全方面的专业意见。

请按以下顺序思考并组织回答：
1. 确认问题边界；资料不足时明确假设，绝不虚构事实。
2. 先理解每个牌位的职责，再解释该位置上的牌，不脱离牌位罗列关键词。
3. 结合传统核心含义、图像象征、数字或元素，以及它与用户问题的关系。
4. 逆位从受阻、内化、过度、延迟、重新审视中选择最符合上下文的一种，不机械写成正位反义词。
5. 综合观察重复、对照、因果、元素分布、大牌比例和人物朝向，指出最关键的牌间联系。
6. 区分牌面支持的判断、仍不确定的部分和用户可以影响的部分；不声称知道第三方内心，不保证未来。
7. 最后给出一至三条具体、温和、可在现实中验证的行动建议。

输出包含：核心讯息、牌位解读、牌间关系、可行建议。保持诗意但不含糊，重要判断说明来自哪张牌、哪个牌位或哪组关系。`;

  window.VELA_TAROT_SYSTEM_PROMPT = TAROT_SYSTEM_PROMPT;
  window.VELA_TEST_REDEEM_CODE = TEST_CODE;

  function addStyles() {
    if (document.getElementById(MAGIC_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MAGIC_STYLE_ID;
    style.textContent = `
      .vela-magic-orb{position:fixed;z-index:100000;width:34px;height:34px;border:1px solid rgba(255,255,255,.92);border-radius:50%;pointer-events:none;display:none;transform:translate(-50%,-50%);box-shadow:0 0 10px #fff,0 0 24px #a88cff,0 0 46px #7c5cff;background:radial-gradient(circle,rgba(255,255,255,.92) 0 8%,rgba(180,146,255,.42) 28%,rgba(120,84,255,.08) 66%,transparent 70%)}
      .vela-magic-orb::after{content:"✦";position:absolute;inset:0;display:grid;place-items:center;color:#fff;text-shadow:0 0 8px #805cff;animation:vela-orb-spin 2.8s linear infinite}
      @keyframes vela-orb-spin{to{transform:rotate(360deg)}}
      .vela-static-dialog{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px;background:rgba(31,22,55,.48);backdrop-filter:blur(10px)}
      .vela-static-panel{width:min(660px,100%);max-height:min(760px,88dvh);overflow:auto;border:1px solid rgba(162,132,225,.34);border-radius:24px;padding:24px;background:rgba(250,247,255,.97);color:#574570;box-shadow:0 24px 80px rgba(59,35,99,.26)}
      .vela-static-panel h2{margin:0 0 14px;color:#8d6bc2}.vela-static-panel h3{color:#8262b2}.vela-static-panel button{cursor:pointer;border:1px solid #b79be2;border-radius:999px;padding:9px 16px;background:#f6f0ff;color:#684991}.vela-static-panel .primary{background:#8d6bc2;color:#fff}.vela-static-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
      .vela-static-toast{position:fixed;z-index:100001;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:10px 18px;border-radius:999px;background:#574570;color:#fff;box-shadow:0 8px 28px rgba(54,35,82,.28)}
      .flipped.reversed [class*="card-inner"],.flipped.reverse [class*="card-inner"],.revealed.reversed [class*="card-inner"],.revealed.reverse [class*="card-inner"],.is-flipped.is-reversed [class*="card-inner"],[data-flipped="true"][data-reversed="true"] [class*="card-inner"]{transform:rotateY(180deg)!important}
      .reversed [class*="card-front"] img,.reverse [class*="card-front"] img,.is-reversed [class*="card-front"] img,[data-reversed="true"] [class*="card-front"] img,.reversed .card-face img,.reverse .card-face img{transform:rotate(180deg)!important}
      .card-front,.tarot-card-front,[class*="card-front"]{background-image:none!important}
      .card-front img,.tarot-card-front img,[class*="card-front"] img{opacity:1!important;visibility:visible!important;object-fit:contain!important}
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    const old = document.querySelector('.vela-static-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'vela-static-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  function openDialog(title, html, actions = []) {
    const dialog = document.createElement('div');
    dialog.className = 'vela-static-dialog';
    dialog.innerHTML = `<section class="vela-static-panel" role="dialog" aria-modal="true"><h2></h2><div class="vela-static-content"></div><div class="vela-static-actions"></div></section>`;
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('.vela-static-content').innerHTML = html;
    const actionBox = dialog.querySelector('.vela-static-actions');
    actions.forEach(({ label, primary, run }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      if (primary) button.className = 'primary';
      button.addEventListener('click', () => run(dialog));
      actionBox.appendChild(button);
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '关闭';
    close.addEventListener('click', () => dialog.remove());
    actionBox.appendChild(close);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.remove();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function openGestureGuide() {
    openDialog('魔法手势示意', `
      <p>摄像头只在你主动启用后工作，画面留在当前设备中。GitHub Pages 使用 HTTPS，可以请求摄像头权限。</p>
      <h3>手势</h3>
      <p><b>张开手掌</b>：移动星光指针，选择想触碰的按钮或卡牌。</p>
      <p><b>拇指与食指捏合</b>：确认点击。</p>
      <p><b>握拳</b>：寻找并启动“开始 / 抽牌”。</p>
      <p><b>V 手势</b>：寻找并启动“解读”。</p>
      <p>请让手掌完整进入画面，并给浏览器摄像头权限。若设备不支持，触控和鼠标始终可以正常使用。</p>
    `, [{ label: '启用魔法手势', primary: true, run: dialog => { dialog.remove(); startMagicGestures(); } }]);
  }

  function openSkinStories() {
    openDialog('皮肤设计故事', `
      <h3>猫咪星图</h3><p>以猫、月相和安静的好奇心重新讲述牌面。适合日常问题、自我关怀与关系中的细微感受。</p>
      <h3>神谕微光</h3><p>用光、神殿和仪式感突出命运转折。适合人生方向、阶段变化与价值选择。</p>
      <h3>植物秘境</h3><p>用萌芽、盛放、修剪和休眠表达能量变化。适合长期成长、工作节奏与恢复。</p>
      <p><b>共通规则：</b>牌背与牌面独立装备；缺失的专属牌面自动回退经典牌面；皮肤不会改变牌义、概率或积分。</p>
      <p>完整说明见 <code>docs/SKIN-STORIES.md</code>。</p>
    `);
  }

  function cardFromContext(element) {
    if (typeof DECK === 'undefined' || !Array.isArray(DECK)) return null;
    let node = element;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      const text = node.textContent || '';
      const card = DECK.find(item => item && item.name && text.includes(item.name));
      if (card) return card;
    }
    return null;
  }

  function isBackImageSrc(src) {
    if (BACK_PATTERN.test(src || '')) return true;
    try {
      if (typeof BACK_SKINS === 'undefined') return false;
      const values = [];
      const collect = value => {
        if (typeof value === 'string') values.push(value);
        else if (value && typeof value === 'object') Object.values(value).forEach(collect);
      };
      collect(BACK_SKINS);
      const absolute = new URL(src, location.href).href;
      return values.some(value => {
        if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(value)) return false;
        return absolute === new URL(value, location.href).href;
      });
    } catch (_) {
      return false;
    }
  }

  function repairRevealedFaces(root = document) {
    root.querySelectorAll?.('img').forEach(img => {
      if (!isBackImageSrc(img.currentSrc || img.src || '')) return;
      const card = cardFromContext(img);
      if (!card) return;
      let desired = '';
      try {
        if (typeof getCardImage === 'function') desired = getCardImage(card);
      } catch (_) {}
      if (!desired || isBackImageSrc(desired)) desired = card.img || card.image || '';
      if (!desired || isBackImageSrc(desired)) return;
      img.src = desired;
      img.alt = card.name;
    });
  }

  function injectSkinStoryButton(root = document) {
    root.querySelectorAll?.('button,a').forEach(element => {
      if (!/皮肤|牌背|牌面/.test(element.textContent || '')) return;
      const host = element.closest('[role="dialog"],.modal,.store-modal,.shop-modal') || element.parentElement;
      if (!host || host.querySelector('[data-vela-skin-story]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.velaSkinStory = 'true';
      button.textContent = '查看皮肤设计故事';
      button.addEventListener('click', openSkinStories);
      host.appendChild(button);
    });
  }

  function injectRedeemHint(root = document) {
    root.querySelectorAll?.('input').forEach(input => {
      const identity = `${input.placeholder} ${input.name} ${input.id} ${input.getAttribute('aria-label') || ''}`;
      if (!/兑换|redeem|code|兑换码/i.test(identity) || input.parentElement?.querySelector('[data-vela-test-code-hint]')) return;
      const hint = document.createElement('small');
      hint.dataset.velaTestCodeHint = 'true';
      hint.style.display = 'block';
      hint.style.marginTop = '7px';
      hint.style.opacity = '.72';
      hint.textContent = `GitHub Pages 本地测试码：${TEST_CODE}（+10000）`;
      input.insertAdjacentElement('afterend', hint);
    });
  }

  function mutatePointFields(value, amount) {
    if (!value || typeof value !== 'object') return false;
    let changed = false;
    Object.keys(value).forEach(key => {
      if (/^(points|point|score|stardust|credits|coins)$/i.test(key) && Number.isFinite(Number(value[key]))) {
        value[key] = Number(value[key]) + amount;
        changed = true;
      }
    });
    return changed;
  }

  function grantLocalPoints(amount) {
    let changed = false;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const raw = localStorage.getItem(key);
      try {
        const value = JSON.parse(raw);
        if (mutatePointFields(value, amount)) {
          localStorage.setItem(key, JSON.stringify(value));
          changed = true;
        }
      } catch (_) {
        if (/^(points|vela.?points|stardust)$/i.test(key) && Number.isFinite(Number(raw))) {
          localStorage.setItem(key, String(Number(raw) + amount));
          changed = true;
        }
      }
    }
    try {
      ['state', 'appState', 'velaState', 'VELA_STATE'].forEach(name => {
        if (mutatePointFields(window[name], amount)) changed = true;
      });
      if (window.VELA && mutatePointFields(window.VELA.state, amount)) changed = true;
      if (typeof state !== 'undefined' && mutatePointFields(state, amount)) changed = true;
      if (typeof State !== 'undefined' && mutatePointFields(State, amount)) changed = true;
      if (typeof saveState === 'function') saveState();
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('vela:points-changed', { detail: { amount } }));
    return changed;
  }

  function tryRedeemFrom(target) {
    let input = null;
    let host = target;
    while (host && host !== document.body && !input) {
      const inputs = [...host.querySelectorAll('input')];
      input = inputs.find(item => /兑换|redeem|code|兑换码/i.test(`${item.placeholder} ${item.name} ${item.id} ${item.getAttribute('aria-label') || ''}`)) ||
        inputs.find(item => String(item.value || '').trim().toUpperCase() === TEST_CODE);
      host = host.parentElement;
    }
    if (!input) {
      const inputs = [...document.querySelectorAll('input')];
      input = inputs.find(item => String(item.value || '').trim().toUpperCase() === TEST_CODE);
    }
    if (!input || String(input.value || '').trim().toUpperCase() !== TEST_CODE) return false;
    if (localStorage.getItem('vela-test-code-used') === 'true') {
      showToast('这个测试兑换码已经使用过了');
      return true;
    }
    const changed = grantLocalPoints(10000);
    localStorage.setItem('vela-test-code-used', 'true');
    showToast(changed ? '测试兑换成功：+10000 积分' : '已记录测试积分；刷新页面后查看');
    setTimeout(() => location.reload(), 900);
    return true;
  }

  function findAction(pattern) {
    return [...document.querySelectorAll('button,a,[role="button"],.card')].find(element => {
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height && pattern.test((element.textContent || '').trim());
    });
  }

  let gestureRunning = false;
  async function loadScript(src) {
    if ([...document.scripts].some(script => script.src === src)) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function startMagicGestures() {
    if (gestureRunning) {
      showToast('魔法手势已经启用');
      return;
    }
    if (!window.isSecureContext) {
      showToast('摄像头手势需要 HTTPS；请在 GitHub Pages 地址中使用');
      return;
    }
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      const orb = document.createElement('div');
      orb.className = 'vela-magic-orb';
      document.body.appendChild(orb);
      const hands = new window.Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: .62, minTrackingConfidence: .58 });
      let lastAction = 0;
      let busy = false;
      hands.onResults(results => {
        const points = results.multiHandLandmarks?.[0];
        if (!points) {
          orb.style.display = 'none';
          return;
        }
        const x = (1 - points[8].x) * innerWidth;
        const y = points[8].y * innerHeight;
        orb.style.display = 'block';
        orb.style.left = `${x}px`;
        orb.style.top = `${y}px`;
        const distance = (a, b) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
        const extended = tip => points[tip].y < points[tip - 2].y;
        const now = Date.now();
        const cooldown = now - lastAction > 1000;
        const pinch = distance(4, 8) < .055;
        const fist = [8, 12, 16, 20].every(tip => !extended(tip));
        const victory = extended(8) && extended(12) && !extended(16) && !extended(20);
        if (cooldown && pinch) {
          document.elementFromPoint(x, y)?.closest('button,a,[role="button"],.card')?.click();
          lastAction = now;
        } else if (cooldown && fist) {
          findAction(/开始|抽牌|洗牌/)?.click();
          lastAction = now;
        } else if (cooldown && victory) {
          findAction(/解读|诠释|interpret/i)?.click();
          lastAction = now;
        }
      });
      gestureRunning = true;
      showToast('魔法手势已启用');
      const loop = async () => {
        if (!gestureRunning) return;
        if (!busy && video.readyState >= 2) {
          busy = true;
          await hands.send({ image: video }).catch(() => {});
          busy = false;
        }
        requestAnimationFrame(loop);
      };
      loop();
    } catch (error) {
      console.error('[VELA gestures]', error);
      showToast('无法启用摄像头，请检查权限或网络后重试');
    }
  }

  function patchAiFetch() {
    if (window.__VELA_AI_FETCH_PATCHED__) return;
    window.__VELA_AI_FETCH_PATCHED__ = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (/deepseek|chat\/completions/i.test(url) && typeof init.body === 'string') {
        try {
          const body = JSON.parse(init.body);
          if (Array.isArray(body.messages)) {
            const system = body.messages.find(message => message.role === 'system');
            if (system) system.content = TAROT_SYSTEM_PROMPT;
            else body.messages.unshift({ role: 'system', content: TAROT_SYSTEM_PROMPT });
            init = { ...init, body: JSON.stringify(body) };
          }
        } catch (_) {}
      }
      return originalFetch(input, init);
    };
  }

  function bindGlobalClicks() {
    document.addEventListener('click', event => {
      const target = event.target.closest?.('button,a,[role="button"]') || event.target;
      const text = (target.textContent || '').trim();
      if (/查看示意|手势示意|魔法手势说明/.test(text)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openGestureGuide();
        return;
      }
      if (/兑换|redeem/i.test(text) && target.closest && tryRedeemFrom(target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (/皮肤|牌背|牌面|使用|装备/.test(text) || Object.keys(target.dataset || {}).some(key => /skin|face|back/i.test(key))) {
        setTimeout(() => repairRevealedFaces(document), 80);
      }
    }, true);
  }

  function boot() {
    addStyles();
    patchAiFetch();
    bindGlobalClicks();
    repairRevealedFaces();
    injectSkinStoryButton();
    injectRedeemHint();
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'attributes') repairRevealedFaces(record.target.parentElement || document);
        record.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          repairRevealedFaces(node);
          injectSkinStoryButton(node);
          injectRedeemHint(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class'] });
    console.info(`[VELA] GitHub Pages test mode ready. Test redeem code: ${TEST_CODE}`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

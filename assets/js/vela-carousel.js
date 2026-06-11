/* ============================================================
   VELA · 卡牌轮播 + 翻牌 + 牌阵展示
   ============================================================ */
(function() {
  const { $, $$, el } = window.VELA_UTIL;
  const { DECK, CN_NAMES, SPREADS, MEANINGS, getCardImage, hasCustomCardImage } = window.VELA_DATA;

  // shuffle helper
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ----- Card back SVG (per theme) -----
  function backSVG() {
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <g stroke-width="0.5">
        <circle cx="50" cy="50" r="44" fill="none"/>
        <circle cx="50" cy="50" r="36" fill="none"/>
        <circle cx="50" cy="50" r="20" fill="none"/>
        <circle cx="50" cy="50" r="3" fill="currentColor" stroke="none"/>
        ${[0,60,120,180,240,300].map(d => {
          const a = d * Math.PI / 180;
          const x = 50 + Math.cos(a) * 20, y = 50 + Math.sin(a) * 20;
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="none"/>`;
        }).join('')}
        ${[0,1,2,3,4,5,6,7].map(i => {
          const a = (i / 8) * Math.PI * 2;
          const x1 = 50 + Math.cos(a) * 36, y1 = 50 + Math.sin(a) * 36;
          const x2 = 50 + Math.cos(a) * 44, y2 = 50 + Math.sin(a) * 44;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
        }).join('')}
        <polygon points="${(() => {
          const pts = [];
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? 14 : 7;
            const a = (i / 10) * Math.PI * 2 - Math.PI/2;
            pts.push(`${(50 + Math.cos(a)*r).toFixed(1)},${(50 + Math.sin(a)*r).toFixed(1)}`);
          }
          return pts.join(' ');
        })()}" fill="none"/>
      </g>
    </svg>`;
  }

  function makeCardEl(card, opts = {}) {
    const shell = el('div', { class: 'card-shell' + (opts.reversed ? ' reversed' : '') });
    const back = el('div', { class: 'card-face back' },
      el('div', { class: 'card-back' },
        el('div', { class: 'card-back-inner', html: backSVG() })
      )
    );
    const front = el('div', { class: 'card-face front' });
    const img = el('img', { class: 'card-front-img', src: getCardImage(card), alt: card.n });
    img.onerror = () => {
      const fb = el('div', { class: 'card-front-fallback' },
        el('div', {}, CN_NAMES[card.id] || card.n),
        el('div', { style: { fontSize: '11px', opacity: 0.7 } }, card.suit || '')
      );
      front.replaceChild(fb, img);
    };
    front.appendChild(img);
    if (opts.reversed) front.appendChild(el('div', { class: 'reversed-marker' }, '↻ 逆位'));
    if (!hasCustomCardImage(card) && window.VELA.cardFace !== 'classic') {
      front.appendChild(el('div', { class: 'classic-fallback-marker', title: '此牌面尚未完成，暂用经典牌' }, '经典补位'));
    }
    shell.appendChild(back);
    shell.appendChild(front);
    return shell;
  }

  // ----- 3D Carousel -----
  let carouselEls = [];
  let stage; // .scene element
  let centerIdx = 0;
  let scrollVel = 0;
  let scrollPos = 0;
  let lastScrollTime = performance.now();
  let onSelectCb = null;
  let lockedIdx = -1;
  let introAnimating = false;

  function initCarousel(sceneEl, onSelect) {
    stage = sceneEl;
    onSelectCb = onSelect;
    stage.innerHTML = '';
    const carousel = el('div', { class: 'carousel' });
    stage.appendChild(carousel);

    window.VELA.deck = shuffle(DECK);
    carouselEls = window.VELA.deck.map((c, i) => {
      const wrapper = el('div', { class: 'carousel-card', 'data-i': i },
        makeCardEl(c, { reversed: false })
      );
      wrapper.addEventListener('click', () => {
        if (Math.abs(scrollVel) < 0.3 && i === centerIdx) {
          selectCenter();
        } else {
          scrollPos = i;
          scrollVel = 0;
        }
      });
      carousel.appendChild(wrapper);
      return wrapper;
    });

    scrollPos = window.VELA.deck.length / 2;
    centerIdx = Math.round(scrollPos);
    scrollVel = 0;

    // INTRO animation: start cards stacked at center, then fan out
    introAnimating = true;
    const introStart = performance.now();
    const INTRO_MS = 1100;

    function introTick() {
      const elapsed = performance.now() - introStart;
      const t = Math.min(1, elapsed / INTRO_MS);
      // ease-out cubic
      const e = 1 - Math.pow(1 - t, 3);

      for (let i = 0; i < carouselEls.length; i++) {
        const wrapper = carouselEls[i];
        const offset = i - scrollPos;
        const absOff = Math.abs(offset);
        // Start position: all stacked at center with slight random rotation
        const startX = 0, startZ = -200, startRotY = (Math.random() - 0.5) * 20, startScale = 0.4;
        // Target position
        const tx = offset * 64, tz = -absOff * 80, tRotY = -offset * 18;
        const tScale = i === centerIdx ? 1.15 : Math.max(0.5, 1 - absOff * 0.08);
        // Per-card stagger: spread cards from center outward
        const stagger = Math.min(1, Math.max(0, (t - absOff * 0.005) / (1 - absOff * 0.005)));
        const se = 1 - Math.pow(1 - stagger, 3);
        const x = startX + (tx - startX) * se;
        const z = startZ + (tz - startZ) * se;
        const r = startRotY + (tRotY - startRotY) * se;
        const sc = startScale + (tScale - startScale) * se;
        const op = Math.min(1, se * 1.5) * (absOff > 8 ? 0 : Math.max(0.2, 1 - absOff * 0.12));
        if (absOff > 8) { wrapper.style.display = 'none'; continue; }
        wrapper.style.display = '';
        wrapper.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${r}deg) scale(${sc})`;
        wrapper.style.opacity = op;
        wrapper.style.zIndex = 100 - Math.abs(offset);
      }
      if (t < 1) requestAnimationFrame(introTick);
      else { introAnimating = false; requestAnimationFrame(renderCarousel); }
    }
    requestAnimationFrame(introTick);
  }

  function renderCarousel() {
    if (window.VELA.state !== 'PICKING') {
      requestAnimationFrame(renderCarousel);
      return;
    }
    // physics
    scrollPos += scrollVel;
    scrollVel *= 0.92;
    if (Math.abs(scrollVel) < 0.0015) scrollVel = 0;
    if (scrollPos < 0) { scrollPos = 0; scrollVel *= -0.3; }
    if (scrollPos > carouselEls.length - 1) { scrollPos = carouselEls.length - 1; scrollVel *= -0.3; }

    const newCenter = Math.round(scrollPos);
    if (newCenter !== centerIdx) {
      centerIdx = newCenter;
    }

    // layout cards
    for (let i = 0; i < carouselEls.length; i++) {
      const wrapper = carouselEls[i];
      const offset = i - scrollPos;
      const absOff = Math.abs(offset);
      if (absOff > 8) { wrapper.style.display = 'none'; continue; }
      wrapper.style.display = '';
      const x = offset * 64;
      const z = -Math.abs(offset) * 80;
      const rotY = -offset * 18;
      const scale = i === centerIdx ? 1.15 : Math.max(0.5, 1 - absOff * 0.08);
      const opacity = Math.max(0.2, 1 - absOff * 0.12);
      wrapper.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${rotY}deg) scale(${scale})`;
      wrapper.style.opacity = opacity;
      wrapper.style.zIndex = 100 - Math.abs(offset);
      wrapper.classList.toggle('center', i === centerIdx);
      wrapper.classList.toggle('locked', i === lockedIdx);
    }
    requestAnimationFrame(renderCarousel);
  }

  // External controls
  function scrollBy(d) {
    if (window.VELA.state !== 'PICKING') return;
    scrollVel += d;
  }
  function setLockedIndex(i) {
    lockedIdx = i;
  }
  function getCenterIndex() { return centerIdx; }

  function selectCenter() {
    if (window.VELA.state !== 'PICKING') return;
    const cfg = SPREADS[window.VELA.currentSpread];
    if (window.VELA.picked.length >= cfg.count) return;

    const selectedIdx = lockedIdx >= 0 ? lockedIdx : centerIdx;
    const card = window.VELA.deck[selectedIdx];
    if (!card) return false;
    if (window.VELA.picked.find(p => p.card.id === card.id)) {
      window.VELA_GESTURES?.showTopToast?.('这张牌已经选过了，请换一张');
      lockedIdx = -1;
      return false;
    }
    const rev = Math.random() < 0.3;
    const pos = cfg.positions[window.VELA.picked.length];
    window.VELA.picked.push({ card, rev, pos });

    // bounce + flash on selected card
    const wrap = carouselEls[selectedIdx];
    if (wrap) {
      wrap.classList.add('charged-flash');
      wrap.animate(
        [{ transform: wrap.style.transform }, { transform: wrap.style.transform + ' scale(1.08)' }, { transform: wrap.style.transform }],
        { duration: 200, easing: 'cubic-bezier(.34,1.56,.64,1)' }
      );
      setTimeout(() => {
        wrap.style.opacity = '0';
        wrap.style.pointerEvents = 'none';
      }, 400);
    }

    if (navigator.vibrate && window.VELA.prefs.haptics) navigator.vibrate(60);
    addToSlot(card, rev, pos, window.VELA.picked.length - 1);
    onSelectCb?.(window.VELA.picked.length, cfg.count);

    if (window.VELA.picked.length >= cfg.count) {
      onCompleteCb?.();
    }
    lockedIdx = -1;
    return true;
  }

  let onCompleteCb = null;
  function onComplete(cb) { onCompleteCb = cb; }

  function addToSlot(card, rev, pos, idx) {
    const slots = document.getElementById('slots');
    if (!slots) return;
    const s = el('div', { class: 'slot filled slot-anim' });
    const img = el('img', { src: getCardImage(card), alt: card.n });
    img.onerror = () => {
      const fb = el('div', { class: 'card-front-fallback', style: { fontSize: '10px' } }, CN_NAMES[card.id] || card.n);
      s.innerHTML = ''; s.appendChild(fb); s.appendChild(el('div', { class: 'pos-tag' }, pos));
    };
    if (rev) {
      img.style.transform = 'rotate(180deg)';
      s.classList.add('reversed');
    }
    s.appendChild(img);
    s.appendChild(el('div', { class: 'pos-tag' }, pos + (rev ? ' · 逆位' : '')));
    // replace placeholder
    const placeholder = slots.querySelector('.slot:not(.filled)');
    if (placeholder) slots.replaceChild(s, placeholder);
    else slots.appendChild(s);
  }

  function initSlots() {
    const slots = document.getElementById('slots');
    if (!slots) return;
    slots.innerHTML = '';
    const cfg = SPREADS[window.VELA.currentSpread];
    for (let i = 0; i < cfg.count; i++) {
      slots.appendChild(el('div', { class: 'slot' }, cfg.positions[i]));
    }
  }

  function clearSlots() {
    const slots = document.getElementById('slots');
    if (slots) slots.innerHTML = '';
  }

  // ----- Reveal stage -----
  async function showReveal(sceneEl) {
    sceneEl.innerHTML = '';
    const cfg = SPREADS[window.VELA.currentSpread];
    const board = el('div', { class: 'spread-board layout-' + cfg.layout });
    sceneEl.appendChild(board);

    for (let i = 0; i < window.VELA.picked.length; i++) {
      const p = window.VELA.picked[i];
      const wrap = el('div', { class: 'reveal-card reveal-enter' });
      wrap.style.animationDelay = `${i * 0.08}s`;
      wrap.appendChild(el('div', { class: 'pos-label' }, p.pos));
      const shell = makeCardEl(p.card, { reversed: p.rev });
      wrap.appendChild(shell);
      wrap.appendChild(el('div', { class: 'card-name' }, `${CN_NAMES[p.card.id] || p.card.n}${p.rev ? ' · 逆位' : ''}`));
      wrap.addEventListener('click', () => {
        window.VELA_MODALS?.openCardDetail?.(p.card, p.rev);
      });
      board.appendChild(wrap);
      // delayed flip
      await new Promise(r => setTimeout(r, 380));
      shell.classList.add('flipped');
    }
  }

  window.VELA_CAROUSEL = {
    initCarousel, scrollBy, setLockedIndex, getCenterIndex, selectCenter,
    initSlots, clearSlots, showReveal, onComplete, makeCardEl
  };
})();

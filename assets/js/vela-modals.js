/* ============================================================
   VELA · Modals & Panels
   - settings, log, deck library, card detail, points history
   - question modal (with mood + tone + spread)
   - AI reading panel
   ============================================================ */
(function() {
  const { $, $$, el, fmtTime, storage } = window.VELA_UTIL;
  const {
    DECK, CN_NAMES, SPREADS, MEANINGS, MOODS,
    getCardImage, getCardBackImage,
    detectIntent, getMoonPhase, getSys, buildPmt, getFuSys
  } = window.VELA_DATA;

  // ===== Generic backdrop helpers =====
  function openModal(modal) {
    modal.classList.add('visible');
  }
  function closeAllModals() {
    $$('.modal-backdrop, .panel, .ai-panel').forEach(m => m.classList.remove('visible'));
  }

  // ===== Settings Panel =====
  function buildSettings() {
    const panel = document.getElementById('settings-panel');
    panel.innerHTML = `
      <button class="modal-close" id="settings-close">×</button>
      <h2>设置 · Settings</h2>

      <div class="panel-section">
        <h3>当前积分</h3>
        <div style="font-family:var(--font-head); font-size:28px; color:var(--accent); letter-spacing:.08em;">
          ✦ <span id="settings-points">${window.VELA.points.toLocaleString()}</span>
        </div>
        <button class="topbar-btn" id="open-store" style="margin-top:8px;">皮肤商店</button>
      </div>

      <div class="panel-section">
        <h3>界面主题</h3>
        <div class="theme-swatch-row">
          ${['A','B','C','D'].map(t => {
            const names = { A: '神秘暗色', B: '圣洁光辉', C: '极简禅意', D: '梦幻水彩' };
            const locked = !window.VELA.unlocked.themes.includes(t);
            return `<div class="theme-swatch ${window.VELA.currentTheme === t ? 'active' : ''}" data-t="${t}">
              <div class="label">${names[t]}${locked ? ' 🔒' : ''}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="panel-section">
        <h3>DeepSeek API Key</h3>
        <div class="field">
          <input type="password" id="api-key-input" value="${(window.VELA.prefs.apiKey || '').replace(/"/g,'&quot;')}" placeholder="sk-..." />
        </div>
        <div style="font-family:var(--font-ui); font-size:11px; color:var(--text-dim); letter-spacing:.05em;">仅存于本地浏览器</div>
      </div>

      <div class="panel-section">
        <h3>解读语气</h3>
        <div class="choice-grid">
          ${[
            ['balanced','温柔疗愈','✉'],
            ['practical','直接实用','⚡'],
            ['poetic','心理深探','◎']
          ].map(([id,n,i]) => `
            <div class="choice-card ${window.VELA.currentTone === id ? 'active' : ''}" data-tone="${id}">
              <span class="ico">${i}</span>${n}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="panel-section">
        <h3>牌阵选择</h3>
        <div class="choice-grid">
          ${Object.entries(SPREADS).map(([id,s]) => `
            <div class="choice-card ${window.VELA.currentSpread === id ? 'active' : ''}" data-spread="${id}">
              <span class="ico">${s.icon}</span>${s.name}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="panel-section">
        <h3>偏好</h3>
        <div class="checkbox-row">
          <span>摄像头预览</span>
          <label class="toggle"><input type="checkbox" id="pref-camera" ${window.VELA.prefs.cameraPreview ? 'checked' : ''}><span class="toggle-track"></span></label>
        </div>
        <div class="checkbox-row">
          <span>触感反馈</span>
          <label class="toggle"><input type="checkbox" id="pref-haptics" ${window.VELA.prefs.haptics ? 'checked' : ''}><span class="toggle-track"></span></label>
        </div>
        <div class="checkbox-row">
          <span>简化动画</span>
          <label class="toggle"><input type="checkbox" id="pref-simple" ${window.VELA.prefs.simpleAnim ? 'checked' : ''}><span class="toggle-track"></span></label>
        </div>
      </div>

      <div class="panel-section">
        <button class="topbar-btn" id="open-deck" style="width:100%; justify-content:center; margin-bottom:8px;">📚 浏览完整牌库</button>
        <button class="topbar-btn" id="open-feedback" style="width:100%; justify-content:center; margin-bottom:8px;">✉ 给星辰写信</button>
        <button class="topbar-btn" id="open-redeem" style="width:100%; justify-content:center;">🔑 兑换码</button>
      </div>

      <div class="panel-section">
        <h3>成就 · ${Object.keys(window.VELA.achievements).length} / ${Object.keys(window.VELA_POINTS.ACHIEVEMENTS).length}</h3>
        <div class="ach-grid">
          ${Object.entries(window.VELA_POINTS.ACHIEVEMENTS).map(([id, a]) => {
            const got = !!window.VELA.achievements[id];
            const safeDesc = a.desc.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
            return `<div class="ach-card ${got ? 'unlocked' : 'locked'}" title="${safeDesc}">
              <div class="ach-ico">${a.name.split(' ')[0]}</div>
              <div class="ach-meta">
                <div class="ach-name">${a.name.split(' ').slice(1).join(' ')}</div>
                <div class="ach-desc">${a.desc}</div>
              </div>
              <div class="ach-pts">+${a.pts}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    panel.querySelector('#settings-close').onclick = () => panel.classList.remove('visible');
    panel.querySelectorAll('.theme-swatch').forEach(sw => sw.onclick = () => {
      const t = sw.dataset.t;
      if (!window.VELA.unlocked.themes.includes(t)) {
        const need = { C: 100, D: 200 }[t] || 0;
        if (window.VELA.points >= need) {
          window.VELA.unlocked.themes.push(t);
          window.VELA_POINTS.addPoints(-need, `解锁主题`);  // negative skipped; use direct
          window.VELA.points -= need;
          window.VELA_POINTS.updatePointsDisplay();
          window.VELA.save();
          buildSettings();
        } else {
          window.VELA_GESTURES.showTopToast(`需要 ${need} 积分解锁此主题`);
          return;
        }
      }
      window.VELA_THEMES.applyTheme(t);
      buildSettings();
    });
    panel.querySelectorAll('[data-tone]').forEach(c => c.onclick = () => {
      window.VELA.currentTone = c.dataset.tone;
      window.VELA.save();
      buildSettings();
    });
    panel.querySelectorAll('[data-spread]').forEach(c => c.onclick = () => {
      window.VELA.currentSpread = c.dataset.spread;
      window.VELA.save();
      buildSettings();
      updateSpreadHint();
    });
    panel.querySelector('#api-key-input').oninput = (e) => {
      window.VELA.prefs.apiKey = e.target.value.trim();
      window.VELA.save();
    };
    panel.querySelector('#pref-camera').onchange = (e) => {
      window.VELA.prefs.cameraPreview = e.target.checked;
      window.VELA.save();
      window.VELA_GESTURES.setCameraPreview(e.target.checked);
    };
    panel.querySelector('#pref-haptics').onchange = (e) => {
      window.VELA.prefs.haptics = e.target.checked;
      window.VELA.save();
    };
    panel.querySelector('#pref-simple').onchange = (e) => {
      window.VELA.prefs.simpleAnim = e.target.checked;
      window.VELA.save();
    };
    panel.querySelector('#open-deck').onclick = () => { panel.classList.remove('visible'); openDeckLibrary(); };
    panel.querySelector('#open-feedback').onclick = () => { openFeedback(); };
    panel.querySelector('#open-redeem').onclick = () => { openRedeem(); };
    panel.querySelector('#open-store').onclick = () => { openStore(); };
  }

  function openSettings() {
    buildSettings();
    document.getElementById('settings-panel').classList.add('visible');
  }

  // ===== Deck Library =====
  function openDeckLibrary() {
    const modal = document.getElementById('deck-modal');
    const groups = [
      { id: 'all',   label: '全部' },
      { id: 'major', label: '大阿尔卡纳' },
      { id: 'Wands', label: '权杖' },
      { id: 'Cups',  label: '圣杯' },
      { id: 'Swords',label: '宝剑' },
      { id: 'Pentacles', label: '星币' }
    ];
    modal.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>完整牌库</h2>
      <div class="modal-sub">78 张韦特塔罗 · 点击查看含义</div>
      <div class="deck-filter">${groups.map(g => `<button data-suit="${g.id}" class="${g.id === 'all' ? 'active' : ''}">${g.label}</button>`).join('')}</div>
      <div class="deck-grid" id="deck-grid"></div>
    `;
    renderDeck('all');
    modal.querySelector('[data-close]').onclick = () => modal.classList.remove('visible');
    modal.querySelectorAll('.deck-filter button').forEach(b => b.onclick = () => {
      modal.querySelectorAll('.deck-filter button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderDeck(b.dataset.suit);
    });
    modal.classList.add('visible');
  }
  function renderDeck(suit) {
    const grid = document.getElementById('deck-grid');
    if (!grid) return;
    grid.innerHTML = '';
    DECK.filter(c => suit === 'all' || c.suit === suit).forEach(card => {
      const item = el('div', { class: 'deck-grid-item' });
      const img = el('img', { src: getCardImage(card), alt: card.n });
      img.onerror = () => {
        item.innerHTML = `<div class="card-front-fallback" style="font-size:11px;">${CN_NAMES[card.id] || card.n}</div>`;
        item.appendChild(el('div', { class: 'cn' }, CN_NAMES[card.id] || ''));
      };
      item.appendChild(img);
      item.appendChild(el('div', { class: 'cn' }, CN_NAMES[card.id] || card.n));
      item.onclick = () => {
        // mark viewed
        if (!window.VELA.viewedCards.includes(card.id)) {
          window.VELA.viewedCards.push(card.id);
          window.VELA.save();
          window.VELA_POINTS.checkProgressAchievements();
        }
        openCardDetail(card, false);
      };
      grid.appendChild(item);
    });
  }

  // ===== Card detail =====
  function openCardDetail(card, isRev) {
    const m = document.getElementById('card-detail-modal');
    const meaning = MEANINGS[card.id] || { up: '—', rev: '—', kw: '' };
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <div style="display:flex; gap:24px; flex-wrap:wrap; align-items:flex-start;">
        <div style="flex:0 0 200px;">
          <div style="aspect-ratio:0.65; background:var(--surface-2); border-radius:var(--radius-md); overflow:hidden;">
            <img src="${getCardImage(card)}" alt="${card.n}" style="width:100%; height:100%; object-fit:cover; ${isRev ? 'transform:rotate(180deg);' : ''}" onerror="this.outerHTML='<div class=&quot;card-front-fallback&quot;>${(CN_NAMES[card.id]||card.n).replace(/'/g,'')}</div>'">
          </div>
        </div>
        <div style="flex:1; min-width:200px;">
          <h2>${CN_NAMES[card.id] || card.n}</h2>
          <div class="modal-sub">${card.n} · ${card.suit === 'major' ? '大阿尔卡纳' : card.suit}</div>
          ${meaning.kw ? `<div style="font-family:var(--font-head); font-size:16px; color:var(--accent); letter-spacing:.1em; margin-bottom:16px;">「${meaning.kw}」</div>` : ''}
          <div style="margin-bottom:16px;">
            <div style="font-family:var(--font-ui); font-size:11px; letter-spacing:.15em; color:var(--text-dim); text-transform:uppercase; margin-bottom:6px;">正位</div>
            <div style="font-family:var(--font-body); font-size:16px; line-height:1.7;">${meaning.up}</div>
          </div>
          <div>
            <div style="font-family:var(--font-ui); font-size:11px; letter-spacing:.15em; color:var(--text-dim); text-transform:uppercase; margin-bottom:6px;">逆位</div>
            <div style="font-family:var(--font-body); font-size:16px; line-height:1.7;">${meaning.rev}</div>
          </div>
        </div>
      </div>
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    m.classList.add('visible');
  }

  // ===== Log Modal =====
  function openLog() {
    const m = document.getElementById('log-modal');
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>命运日志</h2>
      <div class="modal-sub">已记录 ${window.VELA.history.length} 次解读</div>
      <div class="tabs">
        <div class="tab active" data-tab="entries">解读</div>
        <div class="tab" data-tab="stats">统计</div>
      </div>
      <div id="log-body"></div>
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    const renderTab = (which) => {
      const body = m.querySelector('#log-body');
      if (which === 'entries') {
        if (!window.VELA.history.length) {
          body.innerHTML = `<div style="text-align:center; padding:60px 20px; color:var(--text-dim); font-family:var(--font-body); font-size:16px;">还没有记录。开始你的第一次解读吧。</div>`;
          return;
        }
        body.innerHTML = window.VELA.history.map((h, i) => {
          const phase = h.moon ? `${h.moon.emoji} ${h.moon.name}` : '';
          const intent = h.intent ? `<span class="log-entry-badge">${h.intent.emoji} ${h.intent.label}</span>` : '';
          const ageDays = (Date.now() - h.ts) / 86400000;
          const looking = ageDays > 7 && !h.outcome ? `<span class="log-entry-badge">✦ 回望</span>` : '';
          const outcomeBadge = h.outcome ? `<span class="log-entry-badge" style="color:var(--accent);">${({confirmed:'✦ 应验',partial:'◈ 部分',rebellion:'⚡ 改命',missed:'✕ 未中'})[h.outcome]}</span>` : '';
          const needsOutcome = !h.outcome;
          return `<div class="log-entry" data-i="${i}">
            <div class="log-entry-head"><span>${phase} · ${fmtTime(h.ts)}</span>${intent}${looking}${outcomeBadge}</div>
            <div class="log-entry-q">${h.question || '（无具体问题）'}</div>
            <div class="log-entry-cards">${(h.picked || []).map(p => `${p.pos}·${CN_NAMES[p.cardId] || p.cardId}${p.rev ? '(逆)' : ''}`).join(' / ')}</div>
            ${needsOutcome ? `<button class="log-entry-record" data-record="${i}" style="margin-top:10px; padding:6px 14px; font-family:var(--font-ui); font-size:11px; letter-spacing:.05em; color:var(--accent); border:1px solid var(--border-strong); border-radius:var(--radius-sm); background:transparent; cursor:pointer;">${ageDays > 7 ? '✦ 记录预言结果' : '回评这次预言'}</button>` : ''}
          </div>`;
        }).join('') + `
          <div style="display:flex; gap:8px; margin-top:16px;">
            <button class="topbar-btn" id="log-export">导出 JSON</button>
            <button class="topbar-btn" id="log-clear" style="color:#c44;">清空全部</button>
          </div>
        `;
        body.querySelectorAll('.log-entry').forEach(le => le.onclick = (e) => {
          if (e.target.closest('[data-record]')) return;
          const h = window.VELA.history[parseInt(le.dataset.i)];
          openLogDetail(h);
        });
        body.querySelectorAll('[data-record]').forEach(b => b.onclick = (e) => {
          e.stopPropagation();
          const h = window.VELA.history[parseInt(b.dataset.record)];
          openOutcome(h);
        });
        body.querySelector('#log-export')?.addEventListener('click', () => {
          const blob = new Blob([JSON.stringify(window.VELA.history, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `vela-log-${Date.now()}.json`;
          a.click();
        });
        body.querySelector('#log-clear')?.addEventListener('click', () => {
          if (confirm('确定清空全部日志？此操作不可撤销。')) {
            window.VELA.history = [];
            window.VELA.save();
            openLog();
          }
        });
      } else {
        const total = window.VELA.history.length;
        const outcomes = window.VELA.history.filter(h => h.outcome);
        const outcomeCnt = {
          confirmed: outcomes.filter(h => h.outcome === 'confirmed').length,
          partial:   outcomes.filter(h => h.outcome === 'partial').length,
          rebellion: outcomes.filter(h => h.outcome === 'rebellion').length,
          missed:    outcomes.filter(h => h.outcome === 'missed').length
        };
        const cardCount = {};
        window.VELA.history.forEach(h => (h.picked || []).forEach(p => {
          cardCount[p.cardId] = (cardCount[p.cardId] || 0) + 1;
        }));
        const topCards = Object.entries(cardCount).sort((a,b) => b[1] - a[1]).slice(0, 3);

        // conic-gradient for pie
        const ot = outcomes.length || 1;
        const c = outcomeCnt;
        const stops = `var(--accent) 0 ${(c.confirmed/ot*100).toFixed(1)}%,
                       var(--accent-glow) ${(c.confirmed/ot*100).toFixed(1)}% ${((c.confirmed+c.partial)/ot*100).toFixed(1)}%,
                       var(--accent-lt)  ${((c.confirmed+c.partial)/ot*100).toFixed(1)}% ${((c.confirmed+c.partial+c.rebellion)/ot*100).toFixed(1)}%,
                       var(--text-dim) ${((c.confirmed+c.partial+c.rebellion)/ot*100).toFixed(1)}% 100%`;
        body.innerHTML = `
          <div style="display:grid; grid-template-columns:200px 1fr; gap:24px; align-items:start;">
            <div>
              <div style="aspect-ratio:1; border-radius:50%; background: conic-gradient(${stops}); position:relative;">
                <div style="position:absolute; inset:30%; border-radius:50%; background:var(--bg-base); display:flex; align-items:center; justify-content:center; font-family:var(--font-head); color:var(--accent); font-size:20px;">${outcomes.length}</div>
              </div>
              <div style="margin-top:14px; font-family:var(--font-ui); font-size:11px; color:var(--text-mid); display:flex; flex-direction:column; gap:4px;">
                <div><span style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px;margin-right:6px;"></span>星辰所料 ${c.confirmed}</div>
                <div><span style="display:inline-block;width:10px;height:10px;background:var(--accent-glow);border-radius:2px;margin-right:6px;"></span>部分应验 ${c.partial}</div>
                <div><span style="display:inline-block;width:10px;height:10px;background:var(--accent-lt);border-radius:2px;margin-right:6px;"></span>我改命运 ${c.rebellion}</div>
                <div><span style="display:inline-block;width:10px;height:10px;background:var(--text-dim);border-radius:2px;margin-right:6px;"></span>完全没有 ${c.missed}</div>
              </div>
            </div>
            <div>
              <div style="margin-bottom:18px;">
                <div style="font-family:var(--font-ui); font-size:11px; color:var(--text-dim); letter-spacing:.15em; text-transform:uppercase; margin-bottom:6px;">总解读</div>
                <div style="font-family:var(--font-head); font-size:32px; color:var(--accent);">${total}</div>
              </div>
              <div style="margin-bottom:18px;">
                <div style="font-family:var(--font-ui); font-size:11px; color:var(--text-dim); letter-spacing:.15em; text-transform:uppercase; margin-bottom:6px;">连续签到</div>
                <div style="font-family:var(--font-head); font-size:24px; color:var(--accent);">${window.VELA_POINTS.getStreak()} 天</div>
              </div>
              <div>
                <div style="font-family:var(--font-ui); font-size:11px; color:var(--text-dim); letter-spacing:.15em; text-transform:uppercase; margin-bottom:6px;">最常出现的牌</div>
                ${topCards.length ? topCards.map(([id, n]) => `<div style="font-family:var(--font-body); font-size:15px; color:var(--text-main); margin-bottom:2px;">${CN_NAMES[id] || id} <span style="color:var(--text-dim); font-size:12px;">· ${n}次</span></div>`).join('') : '<div style="color:var(--text-dim); font-size:13px;">暂无</div>'}
              </div>
            </div>
          </div>
        `;
      }
    };
    m.querySelectorAll('.tab').forEach(t => t.onclick = () => {
      m.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderTab(t.dataset.tab);
    });
    renderTab('entries');
    m.classList.add('visible');
  }

  function openLogDetail(h) {
    const m = document.getElementById('card-detail-modal');
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>${h.question || '（无具体问题）'}</h2>
      <div class="modal-sub">${h.moon ? `${h.moon.emoji} ${h.moon.name} · ` : ''}${fmtTime(h.ts)} · ${SPREADS[h.spread]?.name || ''}</div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:18px;">
        ${(h.picked || []).map(p => `
          <div style="text-align:center;">
            <div style="font-family:var(--font-ui); font-size:10px; color:var(--text-dim); margin-bottom:4px; letter-spacing:.05em;">${p.pos}</div>
            <div style="width:80px; height:128px; background:var(--surface); border-radius:var(--radius-sm); overflow:hidden; margin:0 auto;">
              <img src="${getCardImage(DECK.find(c => c.id === p.cardId))}" style="width:100%;height:100%;object-fit:cover;${p.rev ? 'transform:rotate(180deg);' : ''}" onerror="this.outerHTML='<div class=&quot;card-front-fallback&quot; style=&quot;font-size:10px;&quot;>${CN_NAMES[p.cardId] || p.cardId}</div>'">
            </div>
            <div style="font-family:var(--font-head); font-size:11px; color:var(--accent); margin-top:4px;">${CN_NAMES[p.cardId] || p.cardId}${p.rev ? '(逆)' : ''}</div>
          </div>
        `).join('')}
      </div>
      <div style="max-height:300px; overflow-y:auto; padding:12px; background:var(--surface); border-radius:var(--radius-sm); font-family:var(--font-body); font-size:15px; line-height:1.7; white-space:pre-wrap;">${(h.answer || '').replace(/</g,'&lt;')}</div>
      ${!h.outcome ? `
        <button class="topbar-btn" data-outcome style="margin-top:14px; width:100%; justify-content:center;">${(Date.now() - h.ts) / 86400000 > 7 ? '✦ 回望 · ' : ''}记录这次预言的结果</button>
      ` : `
        <div style="margin-top:14px; font-family:var(--font-ui); font-size:12px; color:var(--accent); letter-spacing:.1em;">已记录：${({confirmed:'✦ 星辰所料',partial:'◈ 部分应验',rebellion:'⚡ 我改变了命运',missed:'✕ 完全没有'})[h.outcome]}${h.outcomeNote ? ` · 「${h.outcomeNote}」` : ''}</div>
      `}
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    const ob = m.querySelector('[data-outcome]');
    if (ob) ob.onclick = () => openOutcome(h);
    m.classList.add('visible');
  }

  function openOutcome(h) {
    const m = document.getElementById('card-detail-modal');
    const summary = (h.answer || '').slice(0, 80) + '…';
    const days = Math.floor((Date.now() - h.ts) / 86400000);
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>记录结果</h2>
      <div class="modal-sub">距今 ${days} 天</div>
      <div style="font-family:var(--font-body); font-size:15px; line-height:1.6; margin-bottom:8px;">
        <strong style="color:var(--text-mid);">你当时的问题：</strong>「${h.question || '（无）'}」
      </div>
      <div style="font-family:var(--font-body); font-size:14px; line-height:1.6; color:var(--text-mid); margin-bottom:24px; padding:12px; background:var(--surface); border-radius:var(--radius-sm);">
        <strong>塔罗的指引：</strong>${summary}
      </div>
      <div class="choice-grid" style="grid-template-columns:1fr;">
        ${[
          ['confirmed','✦ 星辰所料','基本都应验了','+55'],
          ['partial','◈ 部分应验','有些准有些没有','+25'],
          ['rebellion','⚡ 我改变了命运','我用行动改写了结果','+55'],
          ['missed','✕ 完全没有','这次牌说错了','+25']
        ].map(([id,n,d,p]) => `
          <div class="choice-card" data-out="${id}" style="justify-content:space-between;">
            <div><div style="margin-bottom:2px;">${n}</div><div style="font-family:var(--font-ui); font-size:11px; color:var(--text-dim);">${d}</div></div>
            <div style="font-family:var(--font-ui); font-size:13px; color:var(--accent); font-weight:600;">${p}</div>
          </div>
        `).join('')}
      </div>
      <div class="field" style="margin-top:16px;">
        <textarea id="outcome-note" placeholder="可选备注，最多200字" maxlength="200"></textarea>
      </div>
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    m.querySelectorAll('[data-out]').forEach(b => b.onclick = (e) => {
      h.outcome = b.dataset.out;
      h.outcomeNote = m.querySelector('#outcome-note').value;
      h.outcomeTs = Date.now();
      window.VELA.save();
      const base = (b.dataset.out === 'confirmed' || b.dataset.out === 'rebellion') ? 55 : 25;
      window.VELA_POINTS.addPoints(base, '记录预言结果', { x: e.clientX, y: e.clientY });
      if (b.dataset.out === 'confirmed') window.VELA_POINTS.unlock('first_outcome');
      window.VELA_POINTS.checkProgressAchievements();
      window.VELA_APP?.updateLogBadge?.();
      m.classList.remove('visible');
    });
    m.classList.add('visible');
  }

  // ===== Question Modal =====
  function openQuestion(onSubmit) {
    const m = document.getElementById('question-modal');
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>关于你的问题</h2>
      <div class="modal-sub">说出你想知道的，或留空让牌自然说话</div>

      <div class="field">
        <label>牌阵</label>
        <div class="choice-grid">
          ${Object.entries(SPREADS).map(([id,s]) => `
            <div class="choice-card ${window.VELA.currentSpread === id ? 'active' : ''}" data-spread="${id}">
              <span class="ico">${s.icon}</span>${s.name}<span style="margin-left:auto; font-size:11px; color:var(--text-dim);">${s.count}张</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="field">
        <label>解读语气</label>
        <div class="choice-grid" style="grid-template-columns:repeat(3,1fr);">
          ${[
            ['balanced','温柔','✉'],
            ['practical','直接','⚡'],
            ['poetic','深探','◎']
          ].map(([id,n,i]) => `
            <div class="choice-card ${window.VELA.currentTone === id ? 'active' : ''}" data-tone="${id}" style="justify-content:center;">
              <span class="ico">${i}</span>${n}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="field">
        <label>你的问题</label>
        <textarea id="q-text" placeholder="例如：这段关系还要继续吗？我该接受这个 offer 吗？" maxlength="200"></textarea>
        <div id="q-intent" style="margin-top:8px; font-family:var(--font-ui); font-size:11px; color:var(--text-dim); letter-spacing:.05em; min-height:18px;"></div>
      </div>

      <div style="display:flex; gap:10px; margin-top:20px;">
        <button class="btn-primary" id="q-submit" style="flex:1;">开启解读</button>
        <button class="topbar-btn" id="q-skip" style="flex:0 0 auto;">跳过问题</button>
      </div>
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    m.querySelectorAll('[data-spread]').forEach(b => b.onclick = () => {
      m.querySelectorAll('[data-spread]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      window.VELA.currentSpread = b.dataset.spread;
      window.VELA.save();
    });
    m.querySelectorAll('[data-tone]').forEach(b => b.onclick = () => {
      m.querySelectorAll('[data-tone]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      window.VELA.currentTone = b.dataset.tone;
      window.VELA.save();
    });
    const qIntent = m.querySelector('#q-intent');
    m.querySelector('#q-text').oninput = (e) => {
      const intent = detectIntent(e.target.value);
      qIntent.innerHTML = intent ? `<span class="ai-tag">${intent.emoji} ${intent.label}</span>` : '';
    };
    const submit = (q) => {
      const intent = detectIntent(q);
      m.classList.remove('visible');
      onSubmit(q, intent);
    };
    m.querySelector('#q-submit').onclick = () => submit(m.querySelector('#q-text').value.trim());
    m.querySelector('#q-skip').onclick = () => submit('');
    m.classList.add('visible');
  }

  // ===== Mood Modal =====
  function openMood(onPick) {
    const m = document.getElementById('mood-modal');
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>此刻你的心情</h2>
      <div class="modal-sub">让牌知道你带着什么来到这里</div>
      <div class="mood-grid">
        ${MOODS.map(mo => `<button class="mood-chip" data-id="${mo.id}">${mo.emoji} ${mo.label}</button>`).join('')}
      </div>
      <div style="margin-top:18px; text-align:right;">
        <button class="topbar-btn" data-skip>跳过 →</button>
      </div>
    `;
    const close = () => m.classList.remove('visible');
    m.querySelector('[data-close]').onclick = () => { close(); onPick(null, true); };
    m.querySelectorAll('.mood-chip').forEach(c => c.onclick = () => {
      const mo = MOODS.find(x => x.id === c.dataset.id);
      window.VELA.currentMood = mo;
      close();
      onPick(mo, false);
    });
    m.querySelector('[data-skip]').onclick = () => { window.VELA.currentMood = null; close(); onPick(null, false); };
    m.classList.add('visible');
  }

  // ===== AI Reading Panel =====
  let aiHistory = [];
  async function openAIPanel(question, intent) {
    const panel = document.getElementById('ai-panel');
    const cfg = SPREADS[window.VELA.currentSpread];
    const moonP = getMoonPhase(new Date());
    const tags = [
      intent ? { label: intent.label, emoji: intent.emoji } : null,
      window.VELA.currentMood ? { label: window.VELA.currentMood.label, emoji: window.VELA.currentMood.emoji } : null,
      { label: cfg.name, emoji: cfg.icon },
      { label: moonP.name, emoji: moonP.emoji }
    ].filter(Boolean);

    panel.innerHTML = `
      <div class="ai-panel-header">
        <div>
          <h2>${cfg.name} · 解读</h2>
          <div class="ai-panel-tags">${tags.map(t => `<span class="ai-tag">${t.emoji} ${t.label}</span>`).join('')}</div>
        </div>
        <button class="modal-close" id="ai-close">×</button>
      </div>
      <div class="ai-card-strip" id="ai-card-strip">
        ${window.VELA.picked.map(p => `
          <div class="ai-card-thumb" data-card-id="${p.card.id}" data-rev="${p.rev}">
            <div class="ai-card-thumb-pos">${p.pos}</div>
            <div class="ai-card-thumb-img${p.rev ? ' reversed' : ''}">
              <img src="${getCardImage(p.card)}" alt="${p.card.n}" onerror="this.outerHTML='<div class=&quot;card-front-fallback&quot; style=&quot;font-size:9px;&quot;>${(CN_NAMES[p.card.id]||p.card.n).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}</div>'">
            </div>
            <div class="ai-card-thumb-name">${CN_NAMES[p.card.id] || p.card.n}${p.rev ? '·逆' : ''}</div>
          </div>
        `).join('')}
      </div>
      <div class="ai-content" id="ai-content"></div>
      <div class="ai-panel-footer">
        <input id="ai-followup" placeholder="追问…(回车发送)" />
        <button id="ai-send" class="primary">追问</button>
        <button id="ai-copy">复制</button>
        <button id="ai-save">保存</button>
        <button id="ai-share">分享</button>
        <button id="ai-restart">再占一次</button>
      </div>
    `;
    // wire card thumb click to open detail
    panel.querySelectorAll('.ai-card-thumb').forEach(t => t.onclick = () => {
      const c = DECK.find(x => x.id === t.dataset.cardId);
      openCardDetail(c, t.dataset.rev === 'true');
    });
    const content = panel.querySelector('#ai-content');
    panel.querySelector('#ai-close').onclick = () => { panel.classList.remove('visible'); resetToIdle(); };

    panel.classList.add('visible');

    // Run AI
    const sys = getSys(window.VELA.currentTone);
    const userPrompt = buildPmt(question, window.VELA.currentTone, window.VELA.picked, window.VELA.currentMood);
    aiHistory = [{ role: 'system', content: sys }, { role: 'user', content: userPrompt }];

    let answer = '';
    if (!window.VELA.prefs.apiKey) {
      // Local interpretation using MEANINGS + tone templates
      answer = generateLocalReading(question, window.VELA.currentTone, window.VELA.picked, window.VELA.currentMood);
      content.innerHTML = `
        <div style="margin-bottom:18px; padding:10px 14px; background:var(--surface); border:1px dashed var(--border); border-radius:var(--radius-sm); font-family:var(--font-ui); font-size:11px; color:var(--text-dim); letter-spacing:.05em;">
          ✦ 本地解读模式 · 想要更深入的对话？在 <strong style="color:var(--accent);">设置</strong> 中填入 DeepSeek API Key 启用流式 AI 解读 + 追问
        </div>
        ${renderMarkdown(answer)}
      `;
    } else {
      try {
        answer = await streamDeepSeek(aiHistory, content);
      } catch (e) {
        content.innerHTML = `<div style="color:#c44;">解读失败：${e.message}</div>`;
        answer = `[error] ${e.message}`;
      }
    }
    aiHistory.push({ role: 'assistant', content: answer });

    // Save to history
    const moon = getMoonPhase(new Date());
    const entry = {
      ts: Date.now(),
      question, intent,
      mood: window.VELA.currentMood,
      moon,
      spread: window.VELA.currentSpread,
      tone: window.VELA.currentTone,
      picked: window.VELA.picked.map(p => ({ cardId: p.card.id, rev: p.rev, pos: p.pos })),
      answer
    };
    window.VELA.history.unshift(entry);
    window.VELA.save();
    window.VELA_POINTS.addPoints(window.VELA.currentSpread === 'daily' ? 15 : 20,
      window.VELA.currentSpread === 'daily' ? '完成每日一牌' : '完成解读');
    window.VELA_POINTS.checkProgressAchievements();

    // Closing block: 柔和的收尾话 + 显著的回评入口
    appendClosingBlock(content, entry);
    window.VELA_APP?.updateLogBadge?.();

    // Footer actions
    panel.querySelector('#ai-copy').onclick = () => {
      navigator.clipboard?.writeText(answer);
      window.VELA_GESTURES.showTopToast('已复制到剪贴板');
    };
    panel.querySelector('#ai-save').onclick = () => {
      window.VELA_GESTURES.showTopToast('已自动保存至日志');
    };
    panel.querySelector('#ai-share').onclick = () => {
      const text = `${question || cfg.name}\n${entry.picked.map(p => `${p.pos}·${CN_NAMES[p.cardId]||p.cardId}${p.rev?'(逆)':''}`).join(' / ')}`;
      navigator.clipboard?.writeText(text);
      window.VELA_GESTURES.showTopToast('已复制分享摘要');
      window.VELA_POINTS.addPoints(5, '分享解读');
    };
    panel.querySelector('#ai-restart').onclick = () => { panel.classList.remove('visible'); resetToIdle(); };
    const send = async () => {
      const inp = panel.querySelector('#ai-followup');
      const q = inp.value.trim();
      if (!q) return;
      inp.value = '';
      content.insertAdjacentHTML('beforeend', `
        <div style="margin:20px 0 8px; font-family:var(--font-ui); font-size:11px; letter-spacing:.15em; color:var(--text-dim); text-transform:uppercase;">追问</div>
        <blockquote>${q}</blockquote>
      `);
      const ansDiv = document.createElement('div');
      content.appendChild(ansDiv);
      content.scrollTop = content.scrollHeight;
      if (!window.VELA.prefs.apiKey) {
        ansDiv.innerHTML = `<p style="color:var(--text-dim);"><em>（未填 API Key，追问不可用）</em></p>`;
      } else {
        aiHistory.push({ role: 'user', content: q });
        // change system to "followup" version
        aiHistory[0] = { role: 'system', content: getFuSys(window.VELA.currentTone) };
        try {
          const a = await streamDeepSeek(aiHistory, ansDiv);
          aiHistory.push({ role: 'assistant', content: a });
        } catch (e) {
          ansDiv.innerHTML = `<div style="color:#c44;">追问失败：${e.message}</div>`;
        }
      }
    };
    panel.querySelector('#ai-send').onclick = send;
    panel.querySelector('#ai-followup').onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }

  function resetToIdle() {
    window.VELA.picked = [];
    window.VELA.currentMood = null;
    window.VELA.state = 'IDLE';
    window.VELA_APP?.renderIdle?.();
  }

  // Streaming SSE
  async function streamDeepSeek(messages, contentEl) {
    contentEl.innerHTML = '<div style="color:var(--text-dim); font-style:italic;">星辰正在聆听…</div>';
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + window.VELA.prefs.apiKey
      },
      body: JSON.stringify({ model: 'deepseek-chat', messages, stream: true, temperature: 0.85 })
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(r.status + ' ' + t.slice(0, 120));
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '';
    contentEl.innerHTML = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') break;
        try {
          const j = JSON.parse(data);
          const chunk = j.choices?.[0]?.delta?.content || '';
          full += chunk;
          contentEl.innerHTML = renderMarkdown(full);
          contentEl.scrollTop = contentEl.scrollHeight;
        } catch {}
      }
    }
    return full;
  }

  function renderMarkdown(t) {
    if (window.marked?.parse) {
      try { return window.marked.parse(t); } catch {}
    }
    // basic fallback
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/^### (.*)$/gm,'<h3>$1</h3>')
      .replace(/^## (.*)$/gm,'<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/\n\n/g,'</p><p>')
      .replace(/^>(.*)$/gm,'<blockquote>$1</blockquote>')
      .replace(/^/, '<p>').replace(/$/, '</p>');
  }

  // ===== Closing block (renders after reading completes) =====
  const CLOSING_LINES = [
    '把这份回信带回你的生活，让它在某个安静的时刻被想起。',
    '你不需要立刻做决定。让这些话先在心里住几天。',
    '牌只是镜子，行动是你自己的。',
    '今夜，可以放下一点焦虑了。',
    '若这次的话不准——那也只是说，你已经走在更前面的路上。',
    '愿你带着这些字句入梦，醒来时，心里更轻一些。',
    '记得回来告诉我——后来怎么了。'
  ];

  function appendClosingBlock(contentEl, entry) {
    const idx = window.VELA.history.findIndex(h => h.ts === entry.ts);
    const line = CLOSING_LINES[Math.floor(Math.random() * CLOSING_LINES.length)];
    const div = document.createElement('div');
    div.className = 'reading-closing';
    div.innerHTML = `
      <div class="reading-closing-text">✦ ${line}</div>
      <div class="reading-closing-actions">
        <button class="outcome-cta" data-act="outcome">记录这次的结果</button>
        <button data-act="restart">再占一次</button>
        <button data-act="log">查看日志</button>
      </div>
    `;
    contentEl.appendChild(div);
    div.querySelector('[data-act="outcome"]').onclick = () => {
      if (idx >= 0) openOutcome(window.VELA.history[idx]);
    };
    div.querySelector('[data-act="restart"]').onclick = () => {
      document.getElementById('ai-panel').classList.remove('visible');
      resetToIdle();
    };
    div.querySelector('[data-act="log"]').onclick = () => {
      document.getElementById('ai-panel').classList.remove('visible');
      openLog();
    };
    setTimeout(() => contentEl.scrollTo({ top: contentEl.scrollHeight, behavior: 'smooth' }), 200);
  }

  function generateLocalReading(q, tone, picked, mood) {
    const cfg = SPREADS[window.VELA.currentSpread];
    const moodOpen = {
      anxious: '我能感受到你心里的那些不安。焦虑是一种很疲惫的状态——它让人反复想同一件事，却找不到出口。',
      lost:    '迷茫是种很特殊的痛——不是绝望，是站在十字路口、却看不清任何一条路的样子。',
      hopeful: '你带着期待来到这里。期待是一种温柔的勇气——你愿意相信明天可能更好。',
      calm:    '你此刻是平静的。这是一种少有的好状态，让你能听见自己内心真正的声音。',
      urgent:  '紧迫感像潮水一样推着你。但越是这种时候，越值得停下来一刻，看清牌真正想说的话。'
    };
    const cards = picked.map(p => {
      const me = MEANINGS[p.card.id] || { up: '', rev: '', kw: '' };
      return {
        pos: p.pos,
        name: (CN_NAMES[p.card.id] || p.card.n) + (p.rev ? '（逆位）' : ''),
        meaning: p.rev ? me.rev : me.up,
        kw: me.kw,
        rev: p.rev
      };
    });

    if (tone === 'balanced') {
      // 书信体
      let out = '亲爱的你，\n\n';
      if (mood) out += moodOpen[mood.id] + ' ';
      if (q) out += `你带着「${q}」来到这里，这本身已经是种勇气——愿意正视一件事，就是改变的开始。\n\n`;
      else out += '你没有具体的问题，但来到这里，说明你内心有某些东西想被听见。\n\n';

      if (cards.length === 1) {
        const c = cards[0];
        out += `今天的牌是 **${c.name}**，关键词「${c.kw}」。\n\n`;
        out += `它在说：${c.meaning}。这张牌不是预言，更像是今天为你准备的一面小镜子。`;
        out += `当你回到日常生活时，留意是否有什么时刻，让你想起了这张牌的感觉。`;
      } else {
        out += `这${cards.length}张牌共同呈现的，是一个完整的故事——`;
        out += `从「${cards[0].kw}」起步，经过「${cards[Math.floor(cards.length/2)].kw}」的阶段，最终走向「${cards[cards.length-1].kw}」。\n\n`;
        out += '---\n\n';
        cards.forEach(c => {
          out += `### ✦ ${c.pos} · ${c.name}\n`;
          out += `${c.meaning}。这意味着在你的故事里，**${c.pos}**这个位置上，正发生着关于「${c.kw}」的事。`;
          if (c.rev) out += ` 逆位提醒你：这股能量目前是阻塞的、内化的，需要先看见，才能流动。`;
          out += '\n\n';
        });
        out += '---\n\n';
      }
      out += '\n愿你今夜睡得安稳。无论牌怎么说，你才是写故事的人。\n\n*—— 来自星辰的回信*';
      return out;
    }

    if (tone === 'practical') {
      let out = '### 核心判断\n\n';
      const themeStr = q ? `针对「${q}」` : '综合来看';
      const directions = cards.map(c => c.kw).filter(Boolean);
      out += `${themeStr}：当前局面的关键词是 **${directions.slice(0, 3).join(' / ')}**。`;
      const revCount = cards.filter(c => c.rev).length;
      if (revCount >= cards.length / 2) {
        out += ' 多张逆位提示——内部存在比外部更大的阻力，先处理认知和情绪的卡点，再做决定。\n\n';
      } else {
        out += ' 整体能量方向较为开放，适合主动出击。\n\n';
      }
      out += '### 牌面拆解\n\n';
      cards.forEach(c => {
        out += `- **${c.pos}（${c.name}）**：${c.meaning}\n`;
      });
      out += '\n### 立即可做\n\n';
      const acts = cards.slice(0, 3).map((c, i) => {
        const verbs = ['本周内', '本月内', '近期'];
        return `${i+1}. **${verbs[i]}**：围绕「${c.kw}」做一个具体动作（写下来、对话一次、设个截止日期都算）。`;
      });
      out += acts.join('\n') + '\n\n';
      out += '### 需要警惕\n\n';
      const risk = cards.find(c => c.rev) || cards[cards.length - 1];
      out += `- **${risk.name}**：${risk.meaning}。这是这次牌阵里最可能被你忽略的盲区——它不一定立刻发生，但需要预案。`;
      return out;
    }

    // poetic
    let out = '### 牌阵作为镜像\n\n';
    if (mood) out += `${moodOpen[mood.id].split('。')[0]}。`;
    out += `这${cards.length}张牌不是预言你将经历什么，而是你潜意识此刻浮现的几个原型。\n`;
    out += `它们之所以在此刻被抽到，是因为你的内在某些部分，恰好需要被命名。\n\n`;
    out += '---\n\n';
    cards.forEach(c => {
      out += `**✦ ${c.pos} · ${c.name}**\n`;
      out += `当你看到「${c.kw}」这个词，留意身体的反应。${c.meaning}。`;
      if (c.rev) out += ` 这股能量目前是被压抑或被合理化的——它想被你重新看见。`;
      out += '\n\n';
    });
    out += '---\n\n### 值得静默的提问\n\n';
    out += `- 当我看到「${cards[0].kw}」时，我第一个想到的人/场景是什么？\n`;
    if (cards.length > 1) {
      out += `- 在我的生活里，「${cards[cards.length-1].kw}」是我真正渴望的，还是我以为我应该渴望的？\n`;
    }
    out += `\n> 你不需要回答任何问题，重要的是问题本身在你心里停留的那个片刻。`;
    return out;
  }

  // ===== Store / Feedback / Redeem =====
  function openStore() {
    const m = document.getElementById('card-detail-modal');
    const SKINS = [
      { id: 'classic', name: '✦ 星辰经典', desc: '默认免费', pts: 0 },
      { id: 'cat',     name: '🐱 猫咪密语', desc: '粉底·爪印', pts: 150 },
      { id: 'divine',  name: '🏮 东方神明', desc: 'Chinese Divine 牌面', pts: 220 },
      { id: 'botanic', name: '🌿 植物谜语', desc: 'Botanical Codex 牌面', pts: 220 },
      { id: 'zodiac',  name: '⭐ 星座天穹', desc: '宇宙蓝·星座线', pts: 200 },
      { id: 'rose',    name: '🥀 哥特玫瑰', desc: '深红·荆棘', pts: 250 },
      { id: 'ink',     name: '🎋 水墨仙境', desc: '白底·竹叶', pts: 300 },
      { id: 'aurora',  name: '🌌 极光迷离', desc: '动态极光', pts: 350 }
    ];
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>皮肤商店</h2>
      <div class="modal-sub">用积分解锁专属牌背 · 当前余额 ✦ ${window.VELA.points.toLocaleString()}</div>
      <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:14px;">
        ${SKINS.map(s => {
          const owned = window.VELA.unlocked.backs.includes(s.id);
          const active = window.VELA.cardBack === s.id;
          return `<div style="padding:12px; background:var(--surface); border:1px solid ${active ? 'var(--accent)' : 'var(--border)'}; border-radius:var(--radius-md);">
            <div style="aspect-ratio:0.66; border-radius:var(--radius-sm); overflow:hidden; margin-bottom:10px;" class="store-preview" data-skin="${s.id}"></div>
            <div style="font-family:var(--font-head); font-size:13px; color:var(--accent); margin-bottom:2px;">${s.name}</div>
            <div style="font-family:var(--font-ui); font-size:11px; color:var(--text-dim); margin-bottom:8px;">${s.desc}</div>
            ${owned
              ? (active
                  ? '<div style="font-size:12px; color:var(--accent); letter-spacing:.05em;">✓ 当前使用</div>'
                  : `<button class="topbar-btn" data-use="${s.id}" style="width:100%; justify-content:center;">使用</button>`)
              : `<button class="topbar-btn" data-buy="${s.id}" data-pts="${s.pts}" style="width:100%; justify-content:center;">${s.pts} 积分解锁</button>`
            }
          </div>`;
        }).join('')}
      </div>
    `;
    // Render previews
    m.querySelectorAll('.store-preview').forEach(prev => {
      const skin = prev.dataset.skin;
      const backImg = getCardBackImage(skin);
      prev.innerHTML = `<div class="card-back${backImg ? ' image-back' : ''}" data-skin="${skin}" style="width:100%; height:100%; position:relative;">
        <div class="card-back-inner" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
          <svg viewBox="0 0 100 100" style="width:60%; height:60%;">
            <circle cx="50" cy="50" r="40" fill="none" stroke-width="0.5"/>
            <circle cx="50" cy="50" r="20" fill="none" stroke-width="0.5"/>
            <circle cx="50" cy="50" r="3" fill="currentColor"/>
          </svg>
        </div>
      </div>`;
      // Force skin-specific style via inline override (since body[data-cardback] only affects whole body)
      const cb = prev.querySelector('.card-back');
      cb.style.background = getSkinBg(skin);
      if (backImg) cb.style.backgroundImage = `url("${backImg}")`;
      const svg = prev.querySelector('svg');
      svg.style.stroke = getSkinStroke(skin);
      if (backImg) svg.style.display = 'none';
    });
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    m.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const pts = parseInt(b.dataset.pts);
      if (window.VELA.points >= pts) {
        window.VELA.unlocked.backs.push(b.dataset.buy);
        window.VELA.points -= pts;
        window.VELA_POINTS.updatePointsDisplay();
        window.VELA.save();
        openStore();
      } else {
        window.VELA_GESTURES.showTopToast(`还差 ${pts - window.VELA.points} 积分`);
      }
    });
    m.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
      window.VELA.cardBack = b.dataset.use;
      document.body.setAttribute('data-cardback', b.dataset.use);
      window.VELA.save();
      window.VELA_GESTURES.showTopToast('已切换牌背');
      openStore();
    });
    m.classList.add('visible');
  }

  function getSkinBg(skin) {
    switch (skin) {
      case 'cat': return 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 6px, transparent 7px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.35) 5px, transparent 6px), linear-gradient(135deg, #f5b8c8, #e89bb0)';
      case 'divine': return 'linear-gradient(135deg, #09142e, #142653)';
      case 'botanic': return 'linear-gradient(135deg, #e9dfc7, #bca879)';
      case 'zodiac': return 'radial-gradient(circle at center, #1a2b5e, #050816)';
      case 'rose': return 'radial-gradient(circle at 50% 50%, rgba(160,30,40,0.4), transparent 60%), linear-gradient(135deg, #2a0408, #500818, #1a0204)';
      case 'ink': return '#faf8f3';
      case 'aurora': return 'linear-gradient(135deg, #0a3050, #50a090, #a0e0c0, #50a090, #0a3050)';
      default: return 'linear-gradient(135deg, #0a1430, #04081a)';
    }
  }
  function getSkinStroke(skin) {
    switch (skin) {
      case 'cat': return 'rgba(255,255,255,0.7)';
      case 'divine': return '#d8b55d';
      case 'botanic': return '#6d5b35';
      case 'zodiac': return 'rgba(180,200,255,0.6)';
      case 'rose': return '#d83a52';
      case 'ink': return '#2a2a2a';
      case 'aurora': return 'rgba(255,255,255,0.5)';
      default: return '#e8c050';
    }
  }

  function openFeedback() {
    const m = document.getElementById('card-detail-modal');
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>📮 给星辰的一封信</h2>
      <div class="modal-sub">每条被采纳的建议获得 150 积分 + 专属成就，承诺7天内回复</div>
      <div class="field">
        <textarea id="fb-text" placeholder="说说你对 VELA 的想法、建议、希望看到的功能…" maxlength="500"></textarea>
      </div>
      <button class="btn-primary" id="fb-send" style="width:100%;">发送 (+5 积分)</button>
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    m.querySelector('#fb-send').onclick = (e) => {
      const t = m.querySelector('#fb-text').value.trim();
      if (!t) return;
      const lastFb = storage.get('vela_fb_day');
      if (lastFb === window.VELA_UTIL.dayKey()) {
        window.VELA_GESTURES.showTopToast('今天已经发送过反馈了');
        m.classList.remove('visible');
        return;
      }
      storage.set('vela_fb_day', window.VELA_UTIL.dayKey());
      const fb = storage.get('vela_feedback_history', []);
      fb.push({ text: t, ts: Date.now() });
      storage.set('vela_feedback_history', fb);
      window.VELA_POINTS.addPoints(5, '提交反馈', { x: e.clientX, y: e.clientY });
      window.VELA_GESTURES.showTopToast('已记录，星辰收到了 ✨');
      m.classList.remove('visible');
    };
    m.classList.add('visible');
  }

  function openRedeem() {
    const m = document.getElementById('card-detail-modal');
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>🔑 兑换码</h2>
      <div class="modal-sub">输入 VELA 兑换码以获得奖励</div>
      <div class="field">
        <input id="rd-code" placeholder="VELA-XXXX-XXXX" />
      </div>
      <button class="btn-primary" id="rd-ok" style="width:100%;">兑换</button>
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    m.querySelector('#rd-ok').onclick = (e) => {
      const code = (m.querySelector('#rd-code').value || '').trim().toUpperCase();
      if (!code) return;
      // demo: only one valid code: VELA-WELCOME → 100 pts
      const CODES = { 'VELA-WELCOME': 100, 'VELA-STARS': 50 };
      if (window.VELA.usedCodes.includes(code)) {
        window.VELA_GESTURES.showTopToast('此兑换码已使用过');
        return;
      }
      if (CODES[code]) {
        window.VELA.usedCodes.push(code);
        window.VELA_POINTS.addPoints(CODES[code], '兑换码 ' + code, { x: e.clientX, y: e.clientY });
        window.VELA_GESTURES.showTopToast(`兑换成功 +${CODES[code]} 积分`);
        m.classList.remove('visible');
      } else {
        window.VELA_GESTURES.showTopToast('无效的兑换码');
      }
    };
    m.classList.add('visible');
  }

  // ===== Points history popover =====
  function openPointsHistory() {
    const m = document.getElementById('card-detail-modal');
    m.querySelector('.modal-card').innerHTML = `
      <button class="modal-close" data-close>×</button>
      <h2>积分明细</h2>
      <div class="modal-sub">当前余额：✦ ${window.VELA.points.toLocaleString()}</div>
      ${window.VELA.pointsLog.length ? window.VELA.pointsLog.slice(0, 30).map(p => `
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); font-family:var(--font-ui); font-size:13px;">
          <div>
            <div style="color:var(--text-main); margin-bottom:2px;">${p.reason}</div>
            <div style="color:var(--text-dim); font-size:11px;">${fmtTime(p.ts)}</div>
          </div>
          <div style="color:var(--accent); font-weight:600;">+${p.n}</div>
        </div>
      `).join('') : '<div style="color:var(--text-dim); padding:20px; text-align:center;">还没有积分记录</div>'}
    `;
    m.querySelector('[data-close]').onclick = () => m.classList.remove('visible');
    m.classList.add('visible');
  }

  // ===== Spread hint =====
  function updateSpreadHint() {
    const el = document.getElementById('spread-hint');
    if (el) {
      const cfg = SPREADS[window.VELA.currentSpread];
      el.textContent = `${cfg.icon}  ${cfg.name} · ${cfg.count} 张`;
    }
  }

  window.VELA_MODALS = {
    openSettings, openDeckLibrary, openCardDetail, openLog, openQuestion, openMood,
    openAIPanel, openStore, openFeedback, openRedeem, openPointsHistory,
    updateSpreadHint, closeAllModals
  };
})();

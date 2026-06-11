/* ============================================================
   VELA · 积分 · 成就 · 签到
   ============================================================ */
(function() {
  const { storage, dayKey } = window.VELA_UTIL;

  const ACHIEVEMENTS = {
    first_reading:    { name: '✦ 命运初见', desc: '完成第一次解读',           pts: 20 },
    first_outcome:    { name: '⭐ 星辰印记', desc: '首次记录预言应验',         pts: 50 },
    rebellion_3:      { name: '⚡ 逆天者',   desc: '累计3次"我改变了命运"',     pts: 80 },
    streak_7:         { name: '🌙 命运常客', desc: '连续签到7天',              pts: 100 },
    fifty_readings:   { name: '🔮 先知',     desc: '累计完成50次解读',         pts: 200 },
    witness_20:       { name: '👁 命运见证者', desc: '累计记录20次预言结果',   pts: 100 },
    scholar:          { name: '📚 命运学者', desc: '浏览全部78张牌库',         pts: 30 },
    cartographer:     { name: '🗺 星图编辑者', desc: '反馈被采纳',             pts: 0 }
  };

  function unlock(id) {
    if (window.VELA.achievements[id]) return false;
    const a = ACHIEVEMENTS[id];
    if (!a) return false;
    window.VELA.achievements[id] = { ts: Date.now() };
    if (a.pts > 0 && !window.VELA_CLOUD?.isSignedIn?.()) {
      addPoints(a.pts, `成就：${a.name}`, null, `achievement_${id}`, id);
    }
    showAchievementToast(a);
    window.VELA.save();
    return true;
  }

  function checkProgressAchievements() {
    const v = window.VELA;
    if (v.history.length >= 1) unlock('first_reading');
    if (v.history.length >= 50) unlock('fifty_readings');
    const outcomes = v.history.filter(h => h.outcome).length;
    if (outcomes >= 20) unlock('witness_20');
    const rebellions = v.history.filter(h => h.outcome === 'rebellion').length;
    if (rebellions >= 3) unlock('rebellion_3');
    if (v.viewedCards.length >= 78) unlock('scholar');
    if (storage.get('vela_feedback_approved', false)) unlock('cartographer');
  }

  function showAchievementToast(a) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'achievement-toast';
    el.innerHTML = `
      <div class="ico">${a.name.split(' ')[0]}</div>
      <div class="body">
        <div class="name">${a.name}</div>
        <div class="desc">${a.desc}</div>
      </div>
      ${a.pts > 0 ? `<div class="pts">+${a.pts}</div>` : ''}
    `;
    stack.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3500);
    setTimeout(() => el.remove(), 3900);
  }

  function addPoints(n, reason, fromXY = null, cloudAction = null, eventId = null) {
    if (n <= 0) return;
    if (window.VELA_CLOUD?.isSignedIn?.()) {
      const action = cloudAction || inferCloudAction(n, reason);
      if (!action) {
        console.warn('Cloud points action not recognized:', reason);
        return;
      }
      window.VELA_CLOUD.awardPoints(action, eventId || `${action}_${Date.now()}`)
        .then(r => {
          if (!r || r.duplicate) return;
          window.VELA.pointsLog.unshift({ n: r.awarded || n, reason, ts: Date.now() });
          window.VELA.pointsLog = window.VELA.pointsLog.slice(0, 50);
          floatPoints(r.awarded || n, fromXY);
          window.VELA.save();
        })
        .catch(e => window.VELA_GESTURES?.showTopToast?.(e.message || '积分同步失败'));
      return;
    }
    window.VELA.points += n;
    window.VELA.pointsLog.unshift({ n, reason, ts: Date.now() });
    window.VELA.pointsLog = window.VELA.pointsLog.slice(0, 50);
    updatePointsDisplay();
    floatPoints(n, fromXY);
    window.VELA.save();
  }

  function inferCloudAction(n, reason) {
    if (reason === '每日签到') return 'daily_checkin';
    if (reason === '完成每日一牌') return 'reading_daily';
    if (reason === '完成解读') return 'reading';
    if (reason === '分享解读') return 'share';
    if (reason === '提交反馈') return 'feedback';
    if (reason === '记录预言结果') return n >= 55 ? 'outcome_high' : 'outcome_standard';
    if (reason === '连续30天奖励') return 'streak_30';
    return null;
  }

  function updatePointsDisplay() {
    const el = document.getElementById('points-display');
    if (el) el.textContent = window.VELA.points.toLocaleString();
  }

  function floatPoints(n, fromXY) {
    const target = document.getElementById('points-display')?.getBoundingClientRect();
    const start = fromXY || { x: innerWidth/2, y: innerHeight/2 };
    const ft = document.createElement('div');
    ft.className = 'points-float';
    ft.textContent = `+${n}`;
    ft.style.left = start.x + 'px';
    ft.style.top = start.y + 'px';
    document.body.appendChild(ft);
    setTimeout(() => ft.remove(), 600);
  }

  // ----- Daily checkin -----
  function todayChecked() {
    return storage.get('vela_checkin_day') === dayKey();
  }
  function getStreak() {
    const last = storage.get('vela_checkin_day');
    const today = dayKey();
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    return (last === today || last === yesterday) ? storage.get('vela_streak', 0) : 0;
  }
  function maybeShowCheckin() {
    const banner = document.getElementById('checkin-banner');
    if (!banner) return;
    if (todayChecked()) { banner.classList.remove('visible'); return; }
    banner.classList.add('visible');
  }
  function doCheckin(evt) {
    if (todayChecked()) return;
    const last = storage.get('vela_checkin_day');
    const today = dayKey();
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    let streak = getStreak();
    if (last === yesterday) streak += 1;
    else streak = 1;
    storage.set('vela_checkin_day', today);
    storage.set('vela_streak', streak);

    const xy = evt ? { x: evt.clientX, y: evt.clientY } : null;
    addPoints(10, '每日签到', xy, 'daily_checkin', today);
    document.getElementById('checkin-banner')?.classList.remove('visible');

    if (streak >= 7) unlock('streak_7');
    if (streak === 30 && !window.VELA_CLOUD?.isSignedIn?.()) {
      addPoints(200, '连续30天奖励', null, 'streak_30', today);
    }
  }

  // public expose
  window.VELA_POINTS = {
    addPoints, updatePointsDisplay, maybeShowCheckin, doCheckin,
    unlock, checkProgressAchievements, ACHIEVEMENTS, getStreak
  };
})();

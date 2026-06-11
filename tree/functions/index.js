const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
const ADMIN_PASSCODE = defineSecret("VELA_ADMIN_PASSCODE");
const REGION = "asia-east1";

const REWARDS = {
  daily_checkin: { points: 10, limit: "daily" },
  reading_daily: { points: 15, limit: "event", dailyMax: 2 },
  reading: { points: 20, limit: "event", dailyMax: 3 },
  share: { points: 5, limit: "daily" },
  feedback: { points: 5, limit: "event", dailyMax: 1 },
  outcome_standard: { points: 25, limit: "event", dailyMax: 3 },
  outcome_high: { points: 55, limit: "event", dailyMax: 3 },
  outcome_rebellion: { points: 55, limit: "event", dailyMax: 3 },
  view_card: { points: 0, limit: "event" }
};

const ACHIEVEMENT_REWARDS = {
  first_reading: 20,
  first_outcome: 50,
  rebellion_3: 80,
  streak_7: 100,
  fifty_readings: 200,
  witness_20: 100,
  scholar: 30
};

const SKINS = {
  themes: { C: 100, D: 200 },
  faces: { cat: 520, divine: 420, botanical: 360 },
  backs: { cat: 180, divine: 220, botanical: 160 }
};

function requireUser(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "请先登录");
  if (request.auth.token.admin !== true && request.auth.token.email_verified !== true) {
    throw new HttpsError("permission-denied", "请先完成邮箱验证");
  }
  return request.auth.uid;
}

function requireAdmin(request) {
  const uid = requireUser(request);
  if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "需要管理员权限");
  return uid;
}

function safeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function dayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
}

function yesterdayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(Date.now() - 86400000));
}

function updateMetrics(profile, action, eventId) {
  const metrics = { ...(profile.metrics || {}) };
  if (action === "reading" || action === "reading_daily") metrics.readings = (metrics.readings || 0) + 1;
  if (action.startsWith("outcome_")) metrics.outcomes = (metrics.outcomes || 0) + 1;
  if (action === "outcome_rebellion") metrics.rebellions = (metrics.rebellions || 0) + 1;
  if (action === "view_card") {
    const cards = new Set(metrics.viewedCards || []);
    cards.add(eventId);
    metrics.viewedCards = Array.from(cards).slice(0, 78);
  }
  if (action === "daily_checkin") {
    metrics.streak = profile.lastCheckinDay === yesterdayKey() ? (metrics.streak || 0) + 1 : 1;
  }
  return metrics;
}

function awardAutomaticAchievements(profile, metrics) {
  const ids = new Set(profile.achievementIds || []);
  const bonusIds = new Set(profile.bonusIds || []);
  const eligible = {
    first_reading: (metrics.readings || 0) >= 1,
    first_outcome: (metrics.outcomes || 0) >= 1,
    rebellion_3: (metrics.rebellions || 0) >= 3,
    streak_7: (metrics.streak || 0) >= 7,
    fifty_readings: (metrics.readings || 0) >= 50,
    witness_20: (metrics.outcomes || 0) >= 20,
    scholar: (metrics.viewedCards || []).length >= 78
  };
  let bonus = 0;
  for (const [id, ok] of Object.entries(eligible)) {
    if (ok && !ids.has(id)) {
      ids.add(id);
      bonus += ACHIEVEMENT_REWARDS[id];
    }
  }
  if ((metrics.streak || 0) >= 30 && !bonusIds.has("streak_30")) {
    bonusIds.add("streak_30");
    bonus += 200;
  }
  return { achievementIds: Array.from(ids), bonusIds: Array.from(bonusIds), bonus };
}

function defaultUnlocked() {
  return { themes: ["A", "B"], backs: ["classic"], faces: ["classic"] };
}

exports.bootstrapUser = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      email: request.auth.token.email || null,
      points: 0,
      unlocked: defaultUnlocked(),
      achievementIds: [],
      metrics: {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  } else {
    await ref.set({
      email: request.auth.token.email || snap.data().email || null,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  return { ok: true };
});

async function ensureProfile(tx, uid, email = null) {
  const ref = db.doc(`users/${uid}`);
  const snap = await tx.get(ref);
  if (!snap.exists) {
    return { email: email || null, points: 0, unlocked: defaultUnlocked(), isNew: true };
  }
  return snap.data();
}

exports.adminLogin = onCall({ region: REGION, secrets: [ADMIN_PASSCODE] }, async request => {
  const passcode = String(request.data?.passcode || "");
  const expected = ADMIN_PASSCODE.value();
  const ip = request.rawRequest.ip || "unknown";
  const attemptRef = db.doc(`security/adminAttempts/${crypto.createHash("sha256").update(ip).digest("hex")}`);
  const attempt = await attemptRef.get();
  const data = attempt.data() || {};
  if (data.lockUntil?.toMillis?.() > Date.now()) throw new HttpsError("resource-exhausted", "尝试次数过多，请稍后再试");

  const valid = passcode.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(passcode), Buffer.from(expected));
  if (!valid) {
    const failures = (data.failures || 0) + 1;
    await attemptRef.set({
      failures: failures >= 5 ? 0 : failures,
      lockUntil: failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    throw new HttpsError("permission-denied", "管理员口令不正确");
  }

  await attemptRef.delete().catch(() => {});
  return { token: await getAuth().createCustomToken("vela-admin", { admin: true }) };
});

exports.awardPoints = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const action = safeId(request.data?.action);
  const eventId = safeId(request.data?.eventId);
  const reward = REWARDS[action];
  if (!reward) throw new HttpsError("invalid-argument", "未知积分行为");
  if (!eventId) throw new HttpsError("invalid-argument", "缺少事件编号");

  const today = dayKey();
  const eventKey = reward.limit === "daily" ? `${action}_${today}` :
    reward.limit === "once" ? action : `${action}_${eventId}`;
  const eventRef = db.doc(`users/${uid}/pointEvents/${eventKey}`);
  const profileRef = db.doc(`users/${uid}`);

  return db.runTransaction(async tx => {
    const existing = await tx.get(eventRef);
    const profile = await ensureProfile(tx, uid, request.auth.token.email);
    if (existing.exists) return { points: profile.points || 0, awarded: 0, duplicate: true };

    if (reward.dailyMax) {
      const counterGroup = action.startsWith("outcome_") ? "outcome" : action;
      const counterRef = db.doc(`users/${uid}/pointEvents/counter_${counterGroup}_${today}`);
      const counter = await tx.get(counterRef);
      const count = counter.data()?.count || 0;
      if (count >= reward.dailyMax) throw new HttpsError("resource-exhausted", "今天此类积分已达到上限");
      tx.set(counterRef, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    const metrics = updateMetrics(profile, action, eventId);
    const achievements = awardAutomaticAchievements(profile, metrics);
    const points = (profile.points || 0) + reward.points + achievements.bonus;
    tx.set(eventRef, { action, eventId, points: reward.points, createdAt: FieldValue.serverTimestamp() });
    tx.set(profileRef, {
      points, email: request.auth.token.email || profile.email || null,
      unlocked: profile.unlocked || defaultUnlocked(),
      metrics, achievementIds: achievements.achievementIds, bonusIds: achievements.bonusIds,
      lastCheckinDay: action === "daily_checkin" ? today : (profile.lastCheckinDay || null),
      createdAt: profile.isNew ? FieldValue.serverTimestamp() : (profile.createdAt || FieldValue.serverTimestamp()),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { points, awarded: reward.points + achievements.bonus, achievementBonus: achievements.bonus, duplicate: false };
  });
});

exports.purchaseSkin = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const kind = request.data?.kind;
  const skinId = request.data?.skinId;
  const price = Object.hasOwn(SKINS, kind) ? SKINS[kind]?.[skinId] : null;
  if (!Number.isFinite(price)) throw new HttpsError("invalid-argument", "未知皮肤");
  const profileRef = db.doc(`users/${uid}`);

  return db.runTransaction(async tx => {
    const profile = await ensureProfile(tx, uid, request.auth.token.email);
    const unlocked = profile.unlocked || defaultUnlocked();
    unlocked[kind] ||= ["classic"];
    if (unlocked[kind].includes(skinId)) return { points: profile.points || 0, unlocked };
    if ((profile.points || 0) < price) throw new HttpsError("failed-precondition", "积分不足");
    unlocked[kind].push(skinId);
    const points = profile.points - price;
    tx.set(profileRef, {
      points, unlocked, email: request.auth.token.email || profile.email || null,
      createdAt: profile.isNew ? FieldValue.serverTimestamp() : (profile.createdAt || FieldValue.serverTimestamp()),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { points, unlocked };
  });
});

exports.redeemCode = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const code = String(request.data?.code || "").trim().toUpperCase();
  const codeRef = db.doc(`redeemCodes/${safeId(code)}`);
  const eventRef = db.doc(`users/${uid}/pointEvents/redeem_${safeId(code)}`);
  const profileRef = db.doc(`users/${uid}`);
  return db.runTransaction(async tx => {
    const codeSnap = await tx.get(codeRef);
    const eventSnap = await tx.get(eventRef);
    const profile = await ensureProfile(tx, uid, request.auth.token.email);
    const codeData = codeSnap.data();
    if (!codeSnap.exists || codeData.active === false || !Number.isFinite(codeData.points)) {
      throw new HttpsError("not-found", "无效兑换码");
    }
    if (eventSnap.exists) throw new HttpsError("already-exists", "此兑换码已使用过");
    const points = (profile.points || 0) + codeData.points;
    tx.set(eventRef, { action: "redeem", code, points: codeData.points, createdAt: FieldValue.serverTimestamp() });
    tx.set(profileRef, {
      points, unlocked: profile.unlocked || defaultUnlocked(),
      email: request.auth.token.email || profile.email || null,
      createdAt: profile.isNew ? FieldValue.serverTimestamp() : (profile.createdAt || FieldValue.serverTimestamp()),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { points, awarded: codeData.points };
  });
});

exports.submitFeedback = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const text = String(request.data?.text || "").trim().slice(0, 500);
  if (!text) throw new HttpsError("invalid-argument", "反馈不能为空");
  const ref = db.collection("feedback").doc();
  const rateRef = db.doc(`feedbackRate/${uid}_${dayKey()}`);
  await db.runTransaction(async tx => {
    const rate = await tx.get(rateRef);
    const count = rate.data()?.count || 0;
    if (count >= 3) throw new HttpsError("resource-exhausted", "今天提交反馈的次数已达到上限");
    tx.set(rateRef, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(ref, {
      uid, email: request.auth.token.email || null, text, status: "pending",
      createdAt: FieldValue.serverTimestamp()
    });
  });
  return { id: ref.id };
});

exports.adminListFeedback = onCall({ region: REGION }, async request => {
  requireAdmin(request);
  const snap = await db.collection("feedback").orderBy("createdAt", "desc").limit(100).get();
  return { items: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
});

exports.adminApproveFeedback = onCall({ region: REGION }, async request => {
  requireAdmin(request);
  const id = safeId(request.data?.feedbackId);
  const feedbackRef = db.doc(`feedback/${id}`);
  return db.runTransaction(async tx => {
    const feedbackSnap = await tx.get(feedbackRef);
    if (!feedbackSnap.exists) throw new HttpsError("not-found", "反馈不存在");
    const feedback = feedbackSnap.data();
    if (feedback.status === "approved") return { duplicate: true };
    const profile = await ensureProfile(tx, feedback.uid, feedback.email);
    const points = (profile.points || 0) + 150;
    tx.set(db.doc(`users/${feedback.uid}`), {
      points, unlocked: profile.unlocked || defaultUnlocked(), email: feedback.email || profile.email || null,
      approvedFeedbackCount: (profile.approvedFeedbackCount || 0) + 1,
      achievementIds: Array.from(new Set([...(profile.achievementIds || []), "cartographer"])),
      createdAt: profile.isNew ? FieldValue.serverTimestamp() : (profile.createdAt || FieldValue.serverTimestamp()),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(feedbackRef, { status: "approved", approvedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(db.doc(`users/${feedback.uid}/pointEvents/feedback_approved_${id}`), {
      action: "feedback_approved", points: 150, createdAt: FieldValue.serverTimestamp()
    });
    return { points };
  });
});

exports.adminListUsers = onCall({ region: REGION }, async request => {
  requireAdmin(request);
  const snap = await db.collection("users").orderBy("updatedAt", "desc").limit(100).get();
  return { items: snap.docs.map(d => ({ uid: d.id, ...d.data() })) };
});

exports.adminGrantPoints = onCall({ region: REGION }, async request => {
  requireAdmin(request);
  const uid = safeId(request.data?.uid);
  const amount = Math.trunc(Number(request.data?.amount));
  const reason = String(request.data?.reason || "管理员奖励").slice(0, 100);
  if (!uid || !Number.isFinite(amount) || amount < -10000 || amount > 10000 || amount === 0) {
    throw new HttpsError("invalid-argument", "积分数值无效");
  }
  const profileRef = db.doc(`users/${uid}`);
  return db.runTransaction(async tx => {
    const profile = await ensureProfile(tx, uid);
    const points = Math.max(0, (profile.points || 0) + amount);
    tx.set(profileRef, {
      points, unlocked: profile.unlocked || defaultUnlocked(), email: profile.email || null,
      createdAt: profile.isNew ? FieldValue.serverTimestamp() : (profile.createdAt || FieldValue.serverTimestamp()),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(db.doc(`users/${uid}/pointEvents/admin_${Date.now()}`), {
      action: "admin_grant", reason, points: amount, createdAt: FieldValue.serverTimestamp()
    });
    return { points };
  });
});

exports.adminCreateRedeemCode = onCall({ region: REGION }, async request => {
  requireAdmin(request);
  const code = safeId(String(request.data?.code || "").trim().toUpperCase());
  const points = Math.trunc(Number(request.data?.points));
  if (!code || !Number.isFinite(points) || points < 1 || points > 10000) {
    throw new HttpsError("invalid-argument", "兑换码或积分无效");
  }
  await db.doc(`redeemCodes/${code}`).set({
    points, active: true, updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true, code, points };
});

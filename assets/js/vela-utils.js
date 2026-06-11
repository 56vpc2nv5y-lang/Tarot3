/* ============================================================
   VELA · 工具层
   - storage (localStorage helpers)
   - state (global state container)
   - dom helpers
   ============================================================ */

const storage = {
  get(k, d=null) {
    try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  },
  remove(k) { try { localStorage.removeItem(k); } catch {} }
};

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const el = (tag, attrs={}, ...children) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    e.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return e;
};

const fmtTime = ts => {
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff/60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff/3600)} 小时前`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `${days} 天前`;
  return `${d.getMonth()+1}月${d.getDate()}日`;
};

const dayKey = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

// Global state container (mutable singleton)
window.VELA = {
  // app state
  state: 'IDLE',       // IDLE | MOOD | INTRO | PICKING | REVEALING | INTERPRETING
  currentSpread: storage.get('vela_spread', 'three'),
  currentTheme: storage.get('vela_theme', 'A'),
  currentTone: storage.get('vela_tone', 'balanced'),
  currentMood: null,
  cardBack: storage.get('vela_cardback', 'classic'),
  cardFace: storage.get('vela_cardface', 'classic'),

  // deck / picking
  deck: [],
  picked: [],
  carouselOffset: 0,
  carouselTarget: 0,
  carouselVel: 0,

  // user data
  points: storage.get('vela_points', 0),
  pointsLog: storage.get('vela_points_log', []),
  history: storage.get('vela_history', []),
  achievements: storage.get('vela_achievements', {}),
  viewedCards: storage.get('vela_viewed_cards', []),
  unlocked: storage.get('vela_unlocked', { themes: ['A','B'], backs: ['classic'], faces: ['classic'] }),
  usedCodes: storage.get('vela_used_codes', []),

  // settings
  prefs: storage.get('vela_prefs', {
    gestureControl: !window.matchMedia('(pointer: coarse)').matches,
    cameraPreview: false,
    haptics: true,
    simpleAnim: false,
    apiKey: ''
  }),

  // misc
  isPaused: false,
  hist: [],       // AI conversation history
  current: null,  // current in-flight reading (before save)

  save() {
    storage.set('vela_points', this.points);
    storage.set('vela_points_log', this.pointsLog);
    storage.set('vela_history', this.history);
    storage.set('vela_achievements', this.achievements);
    storage.set('vela_viewed_cards', this.viewedCards);
    storage.set('vela_unlocked', this.unlocked);
    storage.set('vela_used_codes', this.usedCodes);
    storage.set('vela_prefs', this.prefs);
    storage.set('vela_spread', this.currentSpread);
    storage.set('vela_theme', this.currentTheme);
    storage.set('vela_tone', this.currentTone);
    storage.set('vela_cardback', this.cardBack);
    storage.set('vela_cardface', this.cardFace);
    window.VELA_CLOUD?.scheduleSync?.();
  }
};

// Migrate older local saves that predate face skins.
window.VELA.unlocked.themes ||= ['A', 'B'];
window.VELA.unlocked.backs ||= ['classic'];
window.VELA.unlocked.faces ||= ['classic'];
window.VELA.prefs.gestureControl ??= !window.matchMedia('(pointer: coarse)').matches;
window.VELA.prefs.cameraPreview ??= false;
window.VELA.prefs.haptics ??= true;
window.VELA.prefs.simpleAnim ??= false;
window.VELA.prefs.apiKey ??= '';
if (!window.VELA.unlocked.backs.includes('classic')) window.VELA.unlocked.backs.unshift('classic');
if (!window.VELA.unlocked.faces.includes('classic')) window.VELA.unlocked.faces.unshift('classic');

window.VELA_UTIL = { storage, $, $$, el, fmtTime, dayKey };

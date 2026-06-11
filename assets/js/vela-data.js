/* ============================================================
   VELA · 数据层
   - DECK: 78 张牌
   - MEANINGS: 中文牌义
   - SPREADS: 4 种牌阵
   - getSys / buildPmt / getFuSys: AI prompt
   ============================================================ */

const P = 'assets/tarot/pkt/';

const DECK = (() => {
  const c = [];
  ['The Fool','The Magician','The High Priestess','The Empress','The Emperor','The Hierophant','The Lovers','The Chariot','Strength','The Hermit','Wheel of Fortune','Justice','The Hanged Man','Death','Temperance','The Devil','The Tower','The Star','The Moon','The Sun','Judgement','The World']
    .forEach((n, i) => {
      const id = `ar${String(i).padStart(2, '0')}`;
      c.push({ id, n, suit: 'major', img: `${P}${id}.jpg` });
    });
  [
    { code: 'wa', n: 'Wands', cn: '权杖' },
    { code: 'cu', n: 'Cups', cn: '圣杯' },
    { code: 'sw', n: 'Swords', cn: '宝剑' },
    { code: 'pe', n: 'Pentacles', cn: '星币' }
  ].forEach(s =>
    [
      { code: 'ac', n: 'Ace' }, { code: '02', n: 'Two' }, { code: '03', n: 'Three' },
      { code: '04', n: 'Four' }, { code: '05', n: 'Five' }, { code: '06', n: 'Six' },
      { code: '07', n: 'Seven' }, { code: '08', n: 'Eight' }, { code: '09', n: 'Nine' },
      { code: '10', n: 'Ten' }, { code: 'pa', n: 'Page' }, { code: 'kn', n: 'Knight' },
      { code: 'qu', n: 'Queen' }, { code: 'ki', n: 'King' }
    ].forEach(r => {
      const id = `${s.code}${r.code}`;
      c.push({ id, n: `${r.n} of ${s.n}`, suit: s.n, img: `${P}${id}.jpg` });
    })
  );
  return c;
})();

// Custom face skins may be incomplete while artwork is still being produced.
// Missing cards always fall back to the complete classic RWS deck.
const CAT_MAJOR = [
  'fool','magician','high_priestess','empress','emperor','hierophant','lovers','chariot',
  'strength','hermit','wheel_of_fortune','justice','hanged_man','death','temperance',
  'devil','tower','star','moon','sun','judgement','world'
];
const DIVINE_MAJOR = [
  'fool_nezha','magician_jiang_ziya','high_priestess_zhinv','empress_xi_wangmu',
  'emperor_yu_huang_dadi','hierophant_taishang_laojun','lovers_niulang_zhinv',
  'chariot_sun_wukong','strength_erlang_shen','hermit_zhongli_quan',
  'wheel_of_fortune_taiyi_zhenren','justice_bao_zheng','hanged_one_nezha_sacrifice',
  'death_heibai_wuchang','temperance_guanyin','devil_demon_pill','tower_gonggong',
  'star_chang_e','moon_yue_lao','sun_hou_yi','judgement_fengshen_bang','world_pangu'
];
const BOTANIC_MAJOR = [
  'fool_dandelion','magician_ginseng','high_priestess_evening_primrose','empress_rose',
  'emperor_oak','hierophant_laurel','lovers_honeysuckle','chariot_morning_glory',
  'strength_valerian','hermit_moss','wheel_of_fortune_sunflower','justice_iris',
  'hanged_one_mistletoe','death_poppy','temperance_lavender'
];
const RANK_FILE = {
  ac: '01_ace', '02': '02_two', '03': '03_three', '04': '04_four', '05': '05_five',
  '06': '06_six', '07': '07_seven', '08': '08_eight', '09': '09_nine', '10': '10_ten',
  pa: 'page', kn: 'knight', qu: 'queen', ki: 'king'
};
const SUIT_FILE = { wa: 'wands', cu: 'cups', sw: 'swords', pe: 'pentacles' };
const CAT_MAJOR_AVAILABLE = new Set([
  'ar00','ar01','ar02','ar03','ar04','ar06','ar07','ar08','ar09','ar10','ar11',
  'ar13','ar14','ar15','ar16','ar17','ar18','ar19','ar20','ar21'
]);
const CAT_MINOR_AVAILABLE = new Set([
  ...['wa','cu'].flatMap(s => Object.keys(RANK_FILE).map(r => s + r)),
  ...Object.keys(RANK_FILE).filter(r => r !== 'ki').map(r => 'sw' + r),
  'peac'
]);
const DIVINE_AVAILABLE = new Set([
  ...Array.from({ length: 22 }, (_, i) => `ar${String(i).padStart(2, '0')}`).filter(id => id !== 'ar07'),
  'waac','wa02','wa03'
]);
const BOTANIC_AVAILABLE = new Set(Array.from({ length: 15 }, (_, i) => `ar${String(i).padStart(2, '0')}`));

const FACE_SKINS = {
  classic: {
    name: '韦特经典', icon: '✦', price: 0, coverage: 78,
    desc: '完整 78 张 · 默认牌面', cover: 'assets/tarot/pkt/ar00.jpg'
  },
  cat: {
    name: '猫咪密语', icon: '🐱', price: 520, coverage: CAT_MAJOR_AVAILABLE.size + CAT_MINOR_AVAILABLE.size,
    desc: '温柔水彩 · 缺图自动使用经典牌', cover: 'cat/cat_major_00_fool.png'
  },
  divine: {
    name: '东方神明', icon: '🏮', price: 420, coverage: DIVINE_AVAILABLE.size,
    desc: '东方神话 · 缺图自动使用经典牌', cover: 'chinese god and godness/divine_major_14_temperance_guanyin.png'
  },
  botanical: {
    name: '植物图鉴', icon: '🌿', price: 360, coverage: BOTANIC_AVAILABLE.size,
    desc: '植物学图谱 · 缺图自动使用经典牌', cover: 'tree/botanic_major_10_wheel_of_fortune_sunflower.png'
  }
};

const BACK_SKINS = {
  classic:   { name: '星辰经典', icon: '✦', price: 0, desc: '默认牌背' },
  cat:       { name: '猫咪密语', icon: '🐱', price: 180, desc: '粉色水彩 · 猫与月亮' },
  divine:    { name: '东方神明', icon: '🏮', price: 220, desc: '太极八卦 · 天庭深蓝' },
  botanical: { name: '植物图鉴', icon: '🌿', price: 160, desc: '羊皮纸 · 薰衣草图谱' }
};

function customCardImage(card, skin) {
  if (!card || skin === 'classic') return null;
  if (skin === 'cat') {
    if (card.id.startsWith('ar') && CAT_MAJOR_AVAILABLE.has(card.id)) {
      const i = Number(card.id.slice(2));
      return `cat/cat_major_${String(i).padStart(2, '0')}_${CAT_MAJOR[i]}.png`;
    }
    if (CAT_MINOR_AVAILABLE.has(card.id)) {
      const suit = SUIT_FILE[card.id.slice(0, 2)];
      const rank = RANK_FILE[card.id.slice(2)];
      return `cat/cat_${suit}_${rank}.png`;
    }
  }
  if (skin === 'divine' && DIVINE_AVAILABLE.has(card.id)) {
    if (card.id.startsWith('ar')) {
      const i = Number(card.id.slice(2));
      return `chinese god and godness/divine_major_${String(i).padStart(2, '0')}_${DIVINE_MAJOR[i]}.png`;
    }
    return `chinese god and godness/divine_wands_${RANK_FILE[card.id.slice(2)]}.png`;
  }
  if (skin === 'botanical' && BOTANIC_AVAILABLE.has(card.id)) {
    const i = Number(card.id.slice(2));
    return `tree/botanic_major_${String(i).padStart(2, '0')}_${BOTANIC_MAJOR[i]}.png`;
  }
  return null;
}

function getCardImage(card, skin = window.VELA?.cardFace || 'classic') {
  return customCardImage(card, skin) || card?.img || '';
}

function hasCustomCardImage(card, skin = window.VELA?.cardFace || 'classic') {
  return !!customCardImage(card, skin);
}

// 中文牌名映射
const CN_NAMES = {
  ar00: '愚者', ar01: '魔术师', ar02: '女祭司', ar03: '皇后', ar04: '皇帝',
  ar05: '教皇', ar06: '恋人', ar07: '战车', ar08: '力量', ar09: '隐者',
  ar10: '命运之轮', ar11: '正义', ar12: '倒吊人', ar13: '死神', ar14: '节制',
  ar15: '恶魔', ar16: '高塔', ar17: '星星', ar18: '月亮', ar19: '太阳',
  ar20: '审判', ar21: '世界'
};
['wa','cu','sw','pe'].forEach(s => {
  const cnS = { wa: '权杖', cu: '圣杯', sw: '宝剑', pe: '星币' }[s];
  const ranks = { ac: '一', '02': '二', '03': '三', '04': '四', '05': '五', '06': '六', '07': '七', '08': '八', '09': '九', '10': '十', pa: '侍从', kn: '骑士', qu: '王后', ki: '国王' };
  Object.entries(ranks).forEach(([c, r]) => { CN_NAMES[s + c] = `${cnS}${r}`; });
});

const SPREADS = {
  daily: { name: '每日一牌', icon: '☀', desc: '快速指引 · 1张', count: 1, positions: ['今日讯息'], layout: 'single' },
  three: { name: '过去现在未来', icon: '🕯', desc: '经典三牌 · 3张', count: 3, positions: ['过去','现在','未来'], layout: 'triple' },
  five:  { name: '五芒星阵', icon: '⭐', desc: '全面洞察 · 5张', count: 5, positions: ['当下处境','阻碍力量','潜在优势','建议行动','可能结果'], layout: 'star' },
  celtic:{ name: '凯尔特十字', icon: '✦', desc: '深度全景 · 10张', count: 10, positions: ['核心处境','当下挑战','潜意识根基','近期过往','可能结果','即将到来','你的姿态','外在环境','希望与恐惧','最终走向'], layout: 'celtic' }
};

const MEANINGS = {
  ar00:{up:'纯真、启程、信任、无限可能',rev:'鲁莽、犹豫、回避真实选择',kw:'起点'},
  ar01:{up:'意志、行动力、技能整合、显化',rev:'操纵、空想、力量被搁置',kw:'掌控'},
  ar02:{up:'直觉、潜意识、神秘知识、静观',rev:'压抑直觉、表面化、秘密浮现',kw:'内观'},
  ar03:{up:'丰盛、创造、孕育、母性能量',rev:'依赖、停滞、创造力受阻',kw:'丰盈'},
  ar04:{up:'权威、结构、稳定、父性能量',rev:'专制、僵化、控制欲',kw:'秩序'},
  ar05:{up:'传统、信仰、教导、共同体',rev:'反叛、教条主义、寻找自己的路',kw:'传承'},
  ar06:{up:'关系、选择、价值观契合、结合',rev:'失衡、犹豫、价值冲突',kw:'选择'},
  ar07:{up:'意志驱动、胜利、自我控制、突破',rev:'失控、方向混乱、内在拉扯',kw:'征服'},
  ar08:{up:'温柔的力量、耐心、勇气、驯服内在',rev:'自我怀疑、压抑情绪、缺乏自信',kw:'柔韧'},
  ar09:{up:'独处、内省、智慧、寻找意义',rev:'孤立、退缩过度、拒绝指引',kw:'沉思'},
  ar10:{up:'转折、循环、命运转向、机会',rev:'坏运气、抗拒变化、循环困住',kw:'转轮'},
  ar11:{up:'公平、真相、因果、决断',rev:'不公、逃避责任、偏见',kw:'权衡'},
  ar12:{up:'换视角、暂停、奉献、新的领悟',rev:'拖延、僵局、徒劳的牺牲',kw:'倒悬'},
  ar13:{up:'结束、蜕变、释放、重生',rev:'抗拒变化、停滞、长期僵局',kw:'蜕变'},
  ar14:{up:'平衡、调和、节制、耐心整合',rev:'失衡、极端、不耐烦',kw:'调和'},
  ar15:{up:'束缚、执念、上瘾、阴影',rev:'觉察束缚、释放、解除幻觉',kw:'枷锁'},
  ar16:{up:'剧变、崩塌、突破伪装、真相显露',rev:'避开灾难、内部崩塌、延迟的瓦解',kw:'瓦解'},
  ar17:{up:'希望、疗愈、灵感、温柔的指引',rev:'失去信念、自我怀疑、希望黯淡',kw:'微光'},
  ar18:{up:'幻象、潜意识、不确定、深层恐惧',rev:'迷雾散去、看清真相、释放幻觉',kw:'迷雾'},
  ar19:{up:'喜悦、活力、清晰、成功显现',rev:'暂时的阴霾、过度乐观、能量受阻',kw:'明亮'},
  ar20:{up:'觉醒、重生、召唤、宽恕过去',rev:'自责、错过召唤、未完成的清算',kw:'觉醒'},
  ar21:{up:'完成、整合、圆满、新循环开始',rev:'未竟之事、停滞、缺少最后一步',kw:'圆满'},
  waac:{up:'灵感、创造火花、新计划',rev:'拖延、灵感受阻',kw:'火种'},
  wa02:{up:'规划、远见、抉择伙伴',rev:'计划受阻、犹豫不决',kw:'远眺'},
  wa03:{up:'扩展、远行、机会到来',rev:'延迟、目光短浅',kw:'远征'},
  wa04:{up:'庆祝、稳定的根基、团聚',rev:'根基不稳、过渡期',kw:'安顿'},
  wa05:{up:'竞争、摩擦、活力对抗',rev:'冲突缓解或转入暗处',kw:'交锋'},
  wa06:{up:'胜利、被认可、凯旋',rev:'胜利推迟、自我怀疑',kw:'凯旋'},
  wa07:{up:'坚守立场、防御、信念',rev:'压力崩溃、放弃',kw:'坚守'},
  wa08:{up:'快速行动、信息传递、加速',rev:'拖延、信息混乱',kw:'疾驰'},
  wa09:{up:'坚韧、伤痕中的警觉',rev:'防御过度、疲惫',kw:'警戒'},
  wa10:{up:'重担、过载、承担过多',rev:'卸下、释放重担',kw:'重负'},
  wapa:{up:'探索、好奇、新热情',rev:'分心、不成熟',kw:'信使'},
  wakn:{up:'冲动、热情行动、冒险',rev:'鲁莽、半途而废',kw:'驰骋'},
  waqu:{up:'自信、温暖领袖、热情指引',rev:'自我中心、易怒',kw:'炽女'},
  waki:{up:'远见领袖、果断行动',rev:'独裁、冲动决策',kw:'王者'},
  cuac:{up:'新感情、情感涌现、灵性开启',rev:'情感封闭、空虚',kw:'初情'},
  cu02:{up:'共鸣、双向连接、契合',rev:'失衡的关系、误解',kw:'相契'},
  cu03:{up:'友谊、庆祝、共同欢愉',rev:'三角关系、过度社交',kw:'欢聚'},
  cu04:{up:'冷漠、忽视眼前、内省',rev:'重新看见、走出低迷',kw:'怠倦'},
  cu05:{up:'失落、悲伤、聚焦于失去',rev:'接受失去、看到剩下的',kw:'惋惜'},
  cu06:{up:'怀旧、童年、纯真',rev:'困在过去、无法前进',kw:'追忆'},
  cu07:{up:'幻想、多种选择、不切实际',rev:'看清现实、做出取舍',kw:'虚像'},
  cu08:{up:'离开、寻找更深意义',rev:'徘徊、害怕离开',kw:'告别'},
  cu09:{up:'满足、心愿达成',rev:'物质满足下的空虚',kw:'如愿'},
  cu10:{up:'圆满、家庭、情感丰盛',rev:'表面和谐、家庭张力',kw:'团圆'},
  cupa:{up:'感性、艺术天赋、温柔信息',rev:'情绪化、不成熟',kw:'梦少'},
  cukn:{up:'浪漫、追求、感性行动',rev:'幻想、不可靠',kw:'痴客'},
  cuqu:{up:'共情、直觉、情感智慧',rev:'情绪反复、过度共情',kw:'柔后'},
  cuki:{up:'情感掌控、外柔内稳',rev:'压抑情绪、被动攻击',kw:'渊王'},
  swac:{up:'突破思维、清晰真相、新觉知',rev:'混乱、错误判断',kw:'破晓'},
  sw02:{up:'僵局、回避、需要决断',rev:'打破僵局、看清真相',kw:'踌躇'},
  sw03:{up:'心痛、悲伤、必要的伤口',rev:'疗愈、释放痛苦',kw:'痛击'},
  sw04:{up:'休息、恢复、内在整理',rev:'倦怠、需要持续休整',kw:'静养'},
  sw05:{up:'冲突的胜利、得不偿失',rev:'和解、放下争执',kw:'裂隙'},
  sw06:{up:'过渡、远离痛苦、转向平静',rev:'仍在挣扎、未完成的告别',kw:'渡水'},
  sw07:{up:'策略、欺骗、绕道',rev:'坦白、回归正道',kw:'诡计'},
  sw08:{up:'自缚、被困、视野受限',rev:'看见自由、解除限制',kw:'蒙缚'},
  sw09:{up:'焦虑、夜不能寐、放大恐惧',rev:'走出阴影、释放担忧',kw:'夜惊'},
  sw10:{up:'谷底、彻底结束、最坏已过',rev:'缓慢复原、避免最坏',kw:'谷底'},
  swpa:{up:'好奇、机敏、八卦',rev:'多嘴、刻薄、冲动',kw:'锐少'},
  swkn:{up:'快速行动、直率、雄辩',rev:'冲动好斗、过度急躁',kw:'锐骑'},
  swqu:{up:'清晰、独立、理性判断',rev:'冷酷、苛刻、过度防御',kw:'明后'},
  swki:{up:'权威思维、客观、公正决断',rev:'刻板、咄咄逼人',kw:'明王'},
  peac:{up:'物质新机会、稳固基础',rev:'机会延迟、根基不稳',kw:'实芽'},
  pe02:{up:'平衡多重事项、灵活应对',rev:'失衡、应付不来',kw:'兼顾'},
  pe03:{up:'协作、技艺、被认可',rev:'缺乏配合、技艺不足',kw:'匠心'},
  pe04:{up:'保有、稳固、控制',rev:'吝啬、抓得过紧',kw:'守财'},
  pe05:{up:'匮乏感、困境、孤立',rev:'走出困境、获得支持',kw:'困乏'},
  pe06:{up:'给予与接受、慷慨、平衡',rev:'施受不平衡、债务',kw:'施受'},
  pe07:{up:'耐心、评估、长期投入',rev:'急于求成、投入未果',kw:'静候'},
  pe08:{up:'专注、精进、刻意练习',rev:'敷衍、缺乏专注',kw:'精进'},
  pe09:{up:'独立自足、优雅、自我滋养',rev:'依赖他人、表面富足',kw:'丰裕'},
  pe10:{up:'家族传承、长期富足、根基',rev:'家庭争端、财务断裂',kw:'承业'},
  pepa:{up:'好学、起步实干',rev:'拖延、缺乏方向',kw:'实少'},
  pekn:{up:'稳健推进、可靠、保守',rev:'停滞、固执、无趣',kw:'稳骑'},
  pequ:{up:'务实、滋养、丰盛母亲',rev:'物质焦虑、过度操劳',kw:'实后'},
  peki:{up:'富足、稳健、企业家',rev:'贪婪、墨守成规',kw:'实王'}
};

// 情绪标签
const MOODS = [
  { id: 'anxious',  emoji: '🌊', label: '焦虑' },
  { id: 'lost',     emoji: '🌙', label: '迷茫' },
  { id: 'hopeful',  emoji: '✨', label: '期待' },
  { id: 'calm',     emoji: '🌿', label: '平静' },
  { id: 'urgent',   emoji: '🔥', label: '紧迫' }
];

// 意图识别
function detectIntent(q) {
  if (!q) return null;
  const s = q.toLowerCase();
  if (/恋|爱|感情|分手|喜欢|对象|前任|约会|暧昧|结婚|婚姻/.test(s)) return { id: 'love', label: '感情方向', emoji: '💗' };
  if (/工作|事业|职业|跳槽|升职|创业|项目|老板|同事|面试|offer/.test(s)) return { id: 'career', label: '事业方向', emoji: '⚡' };
  if (/选|该不该|要不要|决定|犹豫|权衡|两难/.test(s)) return { id: 'decision', label: '决策方向', emoji: '⚖' };
  return { id: 'general', label: '通用解读', emoji: '✦' };
}

// 月相
function getMoonPhase(date) {
  const knownNewMoon = new Date('2024-01-11');
  const days = ((date - knownNewMoon) / 86400000 % 29.53 + 29.53) % 29.53;
  if (days < 1.85)  return { name:'新月',  emoji:'🌑' };
  if (days < 7.38)  return { name:'娥眉月',emoji:'🌒' };
  if (days < 11.07) return { name:'上弦月',emoji:'🌓' };
  if (days < 14.77) return { name:'盈凸月',emoji:'🌔' };
  if (days < 18.46) return { name:'满月',  emoji:'🌕' };
  if (days < 22.15) return { name:'亏凸月',emoji:'🌖' };
  if (days < 25.84) return { name:'下弦月',emoji:'🌗' };
  return { name:'残月', emoji:'🌘' };
}

// AI Prompts
function getSys(t) {
  return {
    balanced: `你是一位温柔智慧的塔罗咨询师，擅长以书信的方式回应来访者。

来访者来到你面前时，往往携带着情绪的重量、孤独、或难以言说的困扰。你的首要任务不是给建议，而是先**接住这份感受**。

写信请遵循：
- 以"亲爱的你"或类似温暖称呼开始
- 第一段必须共情，承认对方的情绪（不评判、不急着分析）
- 接着用一段流畅的话讲述三张牌共同呈现的"整体讯息"——像在讲一个关于 ta 的故事
- 然后分别细述三张牌，每张落到具体生活情境，让 ta 感到被看见
- 用一句温暖的祝福收尾，落款"—— 来自星辰的回信"

请避免：堆砌玄学词、说教、"宇宙在听""你已经很棒了"这类空洞安慰。
你的语气：像一位深夜回信的老友，真诚、有温度、让人读完想哭又想笑。`,
    practical: `你是一位冷静、直接的策略顾问，把塔罗当作**决策框架**而非占卜。来访者付费咨询，需要的是判断而不是宽慰。

你的回答必须：
- 第一句就给出核心判断，不铺垫
- 结构化拆解，用 Markdown 标题分区
- 每张牌对应一个具体的处境洞察，避免抽象
- 给出 2-3 条**立即可执行**的行动建议（具体到"本周内做 X"）
- 标出 1 条潜在风险或盲区

风格参照：麦肯锡 1-pager，BCG 的"so what"。
严禁使用：能量、宇宙、内心深处、指引、宇宙在告诉你……一律不许出现。
允许使用：判断、风险、建议、机会成本、博弈、对方动机。`,
    poetic: `你融合荣格分析心理学与塔罗，把每张牌视作**来访者潜意识的镜子**——它们不是预言，而是 ta 内在某个原型、情结、或被压抑能量的投射。

你的回答要：
- 把牌作为符号读，不是事件
- 揭示来访者可能未意识到的心理动力学（阴影、阿尼玛/阿尼姆斯、自性、补偿机制）
- 多用反思性问题代替直接答案
- 触及情结而不诊断病理
- 语言精炼有诗意，但每句必须有心理学实质

避免：星座式预测、肤浅安慰、外在事件断言。
你的姿态：一面安静而锋利的镜子，让 ta 看见自己。`
  }[t] || '你是一位经验丰富的塔罗咨询师。';
}

function buildPmt(q, t, picked, mood) {
  const cfg = SPREADS[window.VELA.currentSpread] || SPREADS.three;
  const cardDesc = picked.map(c => `${c.pos}：${CN_NAMES[c.card.id] || c.card.n}（${c.rev ? '逆位' : '正位'}）`).join('\n');
  const qLine = q ? `来访者的问题：「${q}」` : '来访者没有具体问题，请给出综合性回应';
  const moodLine = mood ? `\n来访者此刻的心情：${mood.label}（${mood.emoji}）` : '';
  const layoutLine = `使用的牌阵：${cfg.name}（${cfg.count}张牌，每张代表「${cfg.positions.join('、')}」）`;

  if (cfg.count === 1) {
    const cardName = CN_NAMES[picked[0]?.card.id] || picked[0]?.card.n;
    const fmt = {
      balanced: `\n\n请用书信格式回信：\n亲爱的你，\n[第一段·共情承认（3-4句）]\n[第二段·关于「${cardName}」这张牌（6-10句）]\n[一句祝福，落款]\n—— 来自星辰的回信`,
      practical: `\n\n### 核心判断\n（1-2句）\n\n### 这张牌（${cardName}）说的事\n（3-5句具体洞察）\n\n### 今日可做\n1. [具体动作]\n2. [具体动作]\n\n### 需要警惕\n- [一个具体的风险]`,
      poetic: `\n\n### 这张牌作为今日镜像\n（4-6句，把「${cardName}」作为今日浮现的内在象征）\n\n### 值得静默的提问\n（1-2个反思性问题）\n\n> 一句意象式收尾`
    }[t];
    return `${qLine}${moodLine}\n\n${layoutLine}\n抽到：${cardDesc}${fmt}`;
  }

  const list = picked.map((p, i) => `${i + 1}. ${p.pos} · ${CN_NAMES[p.card.id] || p.card.n}（${p.rev ? '逆位' : '正位'}）`).join('\n');
  const fmt = {
    balanced: `\n\n请用书信格式深度回应。\n亲爱的你，\n[第一段·共情承认（4-5句）]\n[第二段·整体图景（6-10句）]\n---\n${picked.map(p => `### ✦ ${p.pos} · ${CN_NAMES[p.card.id] || p.card.n}\n[3-4句]`).join('\n\n')}\n---\n[温暖祝福]\n—— 来自星辰的回信`,
    practical: `\n\n### 核心判断\n（2-3句）\n\n### 牌面拆解\n${picked.map(p => `- **${p.pos}（${CN_NAMES[p.card.id] || p.card.n}）**：1-2句`).join('\n')}\n\n### 建议行动\n1. 本周内 [具体动作]\n2. 本月内 [具体动作]\n\n### 关键风险\n- [2条具体盲区]`,
    poetic: `\n\n### 整体镜像\n（4-6句）\n\n---\n\n${picked.map(p => `**✦ ${p.pos} · ${CN_NAMES[p.card.id] || p.card.n}**\n[2-3句]`).join('\n\n')}\n\n### 值得静默的提问\n（2-3个反思性问题）\n\n> 一句意象式收尾`
  }[t];
  return `${qLine}${moodLine}\n\n${layoutLine}\n\n牌阵：\n${list}${fmt}`;
}

function getFuSys(t) {
  return getSys(t) + '\n\n这是针对已完成塔罗解读的追问。保持你的解读视角和语气一致，给出有针对性的回答（100-200字，不重复已说内容）。';
}

window.VELA_DATA = {
  DECK, CN_NAMES, SPREADS, MEANINGS, MOODS, FACE_SKINS, BACK_SKINS,
  getCardImage, hasCustomCardImage, detectIntent, getMoonPhase, getSys, buildPmt, getFuSys
};

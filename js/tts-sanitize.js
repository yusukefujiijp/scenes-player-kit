/*!
 * File:    js/tts-sanitize.js
 * Role:    TTS入力整形（表示層と読み層を安全に音声化）
 * Pipeline: 0)矢印 → 0.5)ファイル名（基底＋拡張） → 1)句読点 → 2)拗音 → 3)長音 → 4)絵文字 → 5)スペース
 * Note:    冪等（再適用で増殖しない）／API互換（getTtsText/getTtsForRole）
 */

/* -------------------- Policy (runtime-overridable) -------------------- */
const DEFAULT_POLICY = {
  mode: 'mirror',
  commaPause: 'space2',
  periodPause: 'zspaceIfNeeded',
  yoon: 'katakana',
  yoonChoon: 'preferChoon',
  yoonChoonApply: 'titleOnly',
  // Arrows
  arrowSilence: 'space2',     // 'space2' | 'space1' | 'remove' | 'none'
  arrowGap: 'zspace',         // 'none' | 'zspace' | 'zspaceBoth'
  // Filename pronounce
  basePronounce: 'spellShort',    // 'spellShort' | 'spellAll' | 'off'
  baseSpellThreshold: 3,          // 短語基底名（<=3文字）は綴り読み
  // Dot pronounce
  dotPronounce: 'on',             // 'on' | 'off'
  dotPadding: 'space',            // 'space' | 'wide'
  dotExtMap: {
    yml: 'ヤムル', yaml: 'ヤムル', json: 'ジェイソン', jsonc: 'ジェイソン シー',
    md: 'エムディー', markdown: 'マークダウン', txt: 'テキスト', csv: 'シーエスブイ', tsv: 'ティーエスブイ',
    html: 'エイチティーエムエル', htm: 'エイチティーエムエル', xml: 'エックスエムエル', svg: 'エスブイジー',
    css: 'シーエスエス', scss: 'エスシーエスエス', sass: 'サス', less: 'レス',
    js: 'ジェーエス', jsx: 'ジェーエスエックス', mjs: 'エムジェーエス', cjs: 'シージェーエス',
    ts: 'ティーエス', tsx: 'ティーエスエックス', vue: 'ビュー', svelte: 'スヴェルト',
    pdf: 'ピーディーエフ', png: 'ピーエヌジー', jpg: 'ジェイペグ', jpeg: 'ジェイペグ', webp: 'ウェブピー',
    gif: 'ジフ', avif: 'エーヴィーアイエフ', ico: 'アイシーオー', heic: 'ヘイク',
    mp4: 'エムピーフォー', mov: 'ムーブ', webm: 'ウェブエム', mkv: 'エムケーブイ',
    mp3: 'エムピースリー', wav: 'ウェーブ', aac: 'エーエーシー', ogg: 'オッグ', flac: 'フラック',
    zip: 'ジップ', rar: 'ラー', '7z': 'セブンゼット', tar: 'ター', gz: 'ジーゼット', bz2: 'ビーゼットツー', xz: 'エックスゼット',
    tgz: 'ティージーゼット', tbz2: 'ティービーゼットツー',
    ini: 'イニ', conf: 'コンフ', toml: 'トムル', env: 'エンヴ',
    py: 'パイ', rb: 'アールビー', go: 'ゴー', rs: 'アールエス',
    java: 'ジャバ', kt: 'ケーティー', kts: 'ケーティーエス', swift: 'スウィフト',
    c: 'シー', h: 'エイチ', hh: 'エイチエイチ', cpp: 'シープラスプラス', hpp: 'エイチプラスプラス',
    cs: 'シーエス', php: 'ピーエイチピー', sql: 'エスキューエル',
    sh: 'エスエイチ', bash: 'バッシュ', zsh: 'ズィーエスエイチ', fish: 'フィッシュ',
    cmd: 'シーエムディー', bat: 'バット'
  }
};

function _readPolicyFromTtsUtils() {
  try {
    const u = (typeof window !== 'undefined') ? window.__ttsUtils : null;
    if (!u) return null;
    if (typeof u.getPolicy === 'function') {
      const p = u.getPolicy();
      return (p && typeof p === 'object') ? p : null;
    }
    if (u.policy && typeof u.policy === 'object') return u.policy;
    if (u.config && typeof u.config === 'object' && u.config.policy) return u.config.policy;
    return null;
  } catch (_) { return null; }
}
export function readPolicy() {
  try {
    const winPol = (typeof window !== 'undefined' && window.__ttsPolicy) || null;
    const utilPol = _readPolicyFromTtsUtils();
    return Object.assign({}, DEFAULT_POLICY, utilPol || {}, winPol || {});
  } catch (_) { return DEFAULT_POLICY; }
}

/* -------------------- Emoji / Decoratives Sanitizer -------------------- */
let _reProps;
try {
  // eslint-disable-next-line no-new
  new RegExp('\\p{Extended_Pictographic}', 'u');
  _reProps = new RegExp('[\\p{Extended_Pictographic}\\u200D\\uFE0F\\u20E3]|\\uD83C[\\uDFFB-\\uDFFF]', 'gu');
} catch (_) {
  _reProps = new RegExp(
    '[' + '\\u2300-\\u23FF' + '\\u2460-\\u24FF' + '\\u2500-\\u25FF' + '\\u2600-\\u26FF' +
          '\\u2700-\\u27BF' + '\\u2B00-\\u2BFF' + '\\u200D\\uFE0F\\u20E3' + ']' +
    '|[\\uD83C][\\uDFFB-\\uDFFF]|[\\uD83C-\\uDBFF][\\uDC00-\\uDFFF]', 'g'
  );
}
const _hardDeny = /[⏱⏲⏰⌛️]/g;
export function sanitizeEmoji(text) {
  return String(text || '').replace(_reProps, '').replace(_hardDeny, '');
}

/* -------------------- Arrows → Silence + Gap -------------------- */
const ARROWS_UNICODE_RE = /[\u2190-\u21FF\u2794\u27A1\u27B0\u27A4\u27B3\u27BD\u2900-\u297F]/g;
const ARROWS_ASCII_RE   = /(<-+|=+>|-+>|<+-+>)/g;
function _arrowRep(pol) {
  const sil = (pol && pol.arrowSilence) || 'space2';
  let rep = (sil === 'remove') ? '' : (sil === 'space1') ? ' ' : (sil === 'none') ? null : '  ';
  if (rep === null) return null;
  const gap = (pol && pol.arrowGap) || 'zspace';
  const Z = '\u3000';
  if (gap === 'zspace') rep = rep + Z;
  else if (gap === 'zspaceBoth') rep = Z + rep + Z;
  return rep;
}
export function sanitizeArrows(text, policy) {
  let s = String(text || '');
  const rep = _arrowRep(policy);
  if (rep === null) return s;
  return s.replace(ARROWS_UNICODE_RE, rep).replace(/\uFE0F/g, '').replace(ARROWS_ASCII_RE, rep);
}

/* -------------------- Filename pronounce（基底＋拡張） -------------------- */
// 綴り読み（英字/数字）
const _kanaLetters = {
  a:'エー', b:'ビー', c:'シー', d:'ディー', e:'イー', f:'エフ', g:'ジー', h:'エイチ',
  i:'アイ', j:'ジェイ', k:'ケー', l:'エル', m:'エム', n:'エヌ', o:'オー', p:'ピー',
  q:'キュー', r:'アール', s:'エス', t:'ティー', u:'ユー', v:'ブイ', w:'ダブリュー',
  x:'エックス', y:'ワイ', z:'ズィー'
};
const _kanaDigits = { '0':'ゼロ','1':'ワン','2':'ツー','3':'スリー','4':'フォー','5':'ファイブ','6':'シックス','7':'セブン','8':'エイト','9':'ナイン' };
function _spellKanaToken(tok) {
  const low = String(tok || '').toLowerCase();
  const out = [];
  for (const ch of low) {
    if (/[a-z]/.test(ch)) out.push(_kanaLetters[ch]);
    else if (/[0-9]/.test(ch)) out.push(_kanaDigits[ch]);
  }
  return out.join(' ');
}
// 連鎖拡張子優先マップ
const _multiExtMap = {
  'tar.gz': 'ター ジーゼット',
  'tar.bz2': 'ター ビーゼットツー',
  'tar.xz': 'ター エックスゼット',
  'd.ts': 'ディー ティーエス',
  'env.local': 'エンヴ ローカル'
};
// ドット連鎖の素片
const _DOT_RUN_SRC = '(?:\\.(?:[A-Za-z][A-Za-z0-9]{0,7}|7z))(?:\\.(?:[A-Za-z][A-Za-z0-9]{0,7}|7z)){0,3}';
// 基底名 + ドット連鎖（単語境界近似）
const _FILENAME_RE = new RegExp(`\\b([A-Za-z0-9_-]{1,32})(${_DOT_RUN_SRC})\\b`, 'g');

function _readExtKana(run, pol) {
  const pad = (pol.dotPadding === 'wide') ? '\u3000' : ' ';
  const body = run.slice(1); // leading '.' を除去
  const lower = body.toLowerCase();
  if (_multiExtMap[lower]) return 'ドット' + pad + _multiExtMap[lower];
  const map = Object.assign({}, DEFAULT_POLICY.dotExtMap, pol.dotExtMap || {});
  const parts = lower.split('.');
  const kana = parts.map(p => (p in map) ? map[p] : _spellKanaToken(p)).join(pad);
  return 'ドット' + pad + kana;
}
function _readBaseKana(base, pol) {
  const mode = pol.basePronounce || 'spellShort';
  const th = typeof pol.baseSpellThreshold === 'number' ? pol.baseSpellThreshold : 3;
  if (mode === 'off') return base;                // 変換しない
  if (mode === 'spellAll') return _spellKanaToken(base) || base;
  // spellShort: 英数字のみ＆短語（<=th）のときのみ綴り読み
  if (/^[A-Za-z0-9]+$/.test(base) && base.length <= th) {
    return _spellKanaToken(base) || base;
  }
  return base;
}
export function pronounceFilenames(text, policy) {
  const pol = policy || readPolicy();
  if ((pol.dotPronounce || 'on') === 'off') return String(text || '');
  return String(text || '').replace(_FILENAME_RE, (_m, base, run) => {
    const baseKana = _readBaseKana(base, pol);
    const extKana  = _readExtKana(run, pol);
    // 例: a.yml → 「エー ドット ヤムル」
    return `${baseKana} ${extKana}`;
  });
}

/* -------------------- 句読点/拗音/長音/スペース（既存） -------------------- */
export function applyPunctuationPauses(s, policy) {
  let out = String(s || '');
  const pol = policy || readPolicy();
  if (pol.commaPause === 'space2') out = out.replace(/、/g, '  ');
  if (pol.periodPause === 'zspaceIfNeeded') out = out.replace(/。(?!(?:　|\\s))/g, '。　');
  return out;
}
const _yoonMap = {
  'きゃ':'キャ','きゅ':'キュ','きょ':'キョ','しゃ':'シャ','しゅ':'シュ','しょ':'ショ',
  'ちゃ':'チャ','ちゅ':'チュ','ちょ':'チョ','にゃ':'ニャ','にゅ':'ニュ','にょ':'ニョ',
  'ひゃ':'ヒャ','ひゅ':'ヒュ','ひょ':'ヒョ','みゃ':'ミャ','みゅ':'ミュ','みょ':'ミョ',
  'りゃ':'リャ','りゅ':'リュ','りょ':'リョ','ぎゃ':'ギャ','ぎゅ':'ギュ','ぎょ':'ギョ',
  'じゃ':'ジャ','じゅ':'ジュ','じょ':'ジョ'
};
export function convertYoonToKatakanaForTTS(s) {
  let out = String(s || '');
  for (const hira in _yoonMap) if (Object.prototype.hasOwnProperty.call(_yoonMap, hira)) out = out.split(hira).join(_yoonMap[hira]);
  return out;
}
const _yoonHeads = '(キャ|キュ|キョ|シャ|シュ|ショ|チャ|チュ|チョ|ニャ|ニュ|ニョ|ヒャ|ヒュ|ヒョ|ミャ|ミュ|ミョ|リャ|リュ|リョ|ギャ|ギュ|ギョ|ジャ|ジュ|ジョ)';
const _uVowels = '[うウゥｳ]';
const _reYoonLong = new RegExp(_yoonHeads + _uVowels, 'g');
export function applyYoonLongVowelC(s) { return String(s || '').replace(_reYoonLong, (_m, head) => `${head}ー`); }
function tidySpaces(s) {
  let out = String(s || '');
  out = out.replace(/ {3,}/g, '  ').replace(/[ \\t]+$/gm, '').trim();
  return out;
}

/* -------------------- 組み立て -------------------- */
export function assembleTts(raw, role, policy) {
  const pol = policy || readPolicy();
  let t = String(raw || '');

  // 0) 矢印：無音＋“間”
  t = sanitizeArrows(t, pol);

  // 0.5) ファイル名（基底＋拡張）：「エー ドット ヤムル」等に
  t = pronounceFilenames(t, pol);

  // 1) 句読点休止
  t = applyPunctuationPauses(t, pol);

  // 2) 拗音カタカナ化
  if (pol.yoon === 'katakana') t = convertYoonToKatakanaForTTS(t);

  // 3) 拗音+ウ系の長音化（役割で制御）
  const roleKey = String(role || 'narr');
  const applyChoon =
    pol.yoonChoon !== 'off' && (
      pol.yoonChoonApply === 'all' ||
      (pol.yoonChoonApply === 'titleOnly' && (roleKey === 'title' || roleKey === 'titleKey'))
    );
  if (applyChoon && pol.yoonChoon === 'preferChoon') t = applyYoonLongVowelC(t);

  // 4) 絵文字・装飾の黙殺
  t = sanitizeEmoji(t);

  // 5) スペース冪等整形
  t = tidySpaces(t);

  return t;
}

/* -------------------- ロール別原文抽出＆公開API -------------------- */
function rawForRole(scene, role) {
  const r = String(role || 'narr');
  if (r === 'titleKey') return scene?.titleKeyTTS || scene?.title_key || '';
  if (r === 'title')    return scene?.titleTTS    || scene?.title     || '';
  if (r === 'tag' || r === 'tags') {
    const tags = Array.isArray(scene?.sectionTags) ? scene.sectionTags : [];
    return tags.slice(0, 3).map(t => String(t || '').trim().replace(/^#/, '').replace(/_/g, ' ')).filter(Boolean).join('、');
  }
  return scene?.narrTTS || scene?.narr || '';
}
export function getTtsForRole(scene, role) {
  const pol = readPolicy();
  const raw = rawForRole(scene, role);
  return assembleTts(raw, role, pol);
}
export function getTtsText(scene) { return getTtsForRole(scene, 'narr'); }
const TtsSanitize = {
  readPolicy, sanitizeEmoji, sanitizeArrows, pronounceFilenames,
  convertYoonToKatakanaForTTS, applyYoonLongVowelC, applyPunctuationPauses,
  assembleTts, getTtsForRole, getTtsText
};
export default TtsSanitize;
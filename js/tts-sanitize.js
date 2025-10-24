/*!
 * File:    js/tts-sanitize.js
 * Role:    TTS 入力整形（scene の表示層と読み層を安全に音声化）
 * Focus:   ①装飾・絵文字の黙殺 ②拗音かな→カタカナ（にゅ→ニュ等）
 *          ③句読点で休止付与 ④拗音+ウ系の長音化（C型；ニュウ→ニュー）※役割/ポリシで制御
 * Scope:   narr / titleKey / title / tag の全ロール対応（*TTS 優先）
 * Policy:  window.__ttsPolicy もしくは tts-utils 側の policy があればそれを採用
 *
 * 依存注意：
 * - 本モジュールは **パース時に \p{} を使わない**（実行時に対応可否を検出）
 * - speakStrict() 側の stripMarkdownLight/scrub と併用しても冪等
 * - 適用順は「句読点 → 拗音（カタカナ化）→ 長音化（C型）→ 絵文字黙殺」
 *   （何度かけても自然に収束するよう順序設計）
 */

/* -------------------- Emoji / Decoratives Sanitizer -------------------- */
// 実行時に Unicode Property サポートを検出して、より広い範囲を無音化
let _reProps;
try {
  // ここは「評価」だけ（ソース上は \p を直接書かない）
  // eslint-disable-next-line no-new
  new RegExp('\\p{Extended_Pictographic}', 'u');
  const RE_PROP_STRING =
    // 拡張絵文字 + ZWJ/VS16/keycap + 肌色修飾
    '[\\p{Extended_Pictographic}\\u200D\\uFE0F\\u20E3]|\\uD83C[\\uDFFB-\\uDFFF]';
  _reProps = new RegExp(RE_PROP_STRING, 'gu');
} catch (_) {
  // Property 未対応環境向けの近似（BMP 記号 + サロゲート対 等）
  _reProps = new RegExp(
    '[' +
      '\\u2300-\\u23FF' + // Misc Technical（⏱, ⏲, ⌛ など）
      '\\u2460-\\u24FF' + // Enclosed Alphanumerics
      '\\u2500-\\u25FF' + // Box Drawing / Geometric Shapes
      '\\u2600-\\u26FF' + // Misc Symbols
      '\\u2700-\\u27BF' + // Dingbats
      '\\u2B00-\\u2BFF' + // Misc Symbols and Arrows
      '\\u200D\\uFE0F\\u20E3' + // ZWJ / VS16 / keycap
    ']' +
    '|[\\uD83C][\\uDFFB-\\uDFFF]' +        // 肌色修飾
    '|[\\uD83C-\\uDBFF][\\uDC00-\\uDFFF]', // サロゲート対（多くの Emoji）
    'g'
  );
}
// 将来差分で漏れても確実に黙らせる最終盾（個別ピン留め）
const _hardDeny = /[⏱⏲⏰⌛️]/g; // 末尾の ️ は VS16 由来のばらつき保険

export function sanitizeEmoji(text) {
  return String(text || '').replace(_reProps, '').replace(_hardDeny, '');
}

/* -------------------- Policy (runtime-overridable) -------------------- */
/**
 * 既定ポリシ
 * - commaPause: 'space2'  … 読点「、」→ 半角スペース2個（iOS のクリック音回避＆休止）
 * - periodPause: 'zspaceIfNeeded' … 句点「。」直後に空白が無ければ全角空白を補う（休止強化）
 * - yoon: 'katakana' … ひらがな拗音（にゅ等）→ カタカナ拗音（ニュ等）
 * - yoonChoon: 'preferChoon' … 拗音+ウ系を長音化（ニュウ→ニュー 等）
 * - yoonChoonApply: 'titleOnly' … 長音化の適用範囲（'titleOnly' | 'all' | 'off'）
 */
const DEFAULT_POLICY = {
  mode: 'mirror',
  commaPause: 'space2',
  periodPause: 'zspaceIfNeeded',
  yoon: 'katakana',
  yoonChoon: 'preferChoon',
  yoonChoonApply: 'titleOnly'
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
  } catch (_) {
    return null;
  }
}

export function readPolicy() {
  try {
    const winPol = (typeof window !== 'undefined' && window.__ttsPolicy) || null;
    const utilPol = _readPolicyFromTtsUtils();
    // 優先度：window.__ttsPolicy > ttsUtils.policy > DEFAULT
    return Object.assign({}, DEFAULT_POLICY, utilPol || {}, winPol || {});
  } catch (_) {
    return DEFAULT_POLICY;
  }
}

/* -------------------- 拗音かな -> カタカナ変換 -------------------- */
/**
 * iOS/Safari の日本語 TTS で「にゅ」「しゅ」等が不安定に聞こえるケースに対応。
 * 読み層（かな）をそのまま活かしつつ、拗音だけをカタカナへ（品詞や文節境界を使わない最小変換）。
 * 例: 「どうにゅう」→「どうニュう」
 */
const _yoonMap = {
  'きゃ':'キャ','きゅ':'キュ','きょ':'キョ',
  'しゃ':'シャ','しゅ':'シュ','しょ':'ショ',
  'ちゃ':'チャ','ちゅ':'チュ','ちょ':'チョ',
  'にゃ':'ニャ','にゅ':'ニュ','にょ':'ニョ',
  'ひゃ':'ヒャ','ひゅ':'ヒュ','ひょ':'ヒョ',
  'みゃ':'ミャ','みゅ':'ミュ','みょ':'ミョ',
  'りゃ':'リャ','りゅ':'リュ','りょ':'リョ',
  'ぎゃ':'ギャ','ぎゅ':'ギュ','ぎょ':'ギョ',
  'じゃ':'ジャ','じゅ':'ジュ','じょ':'ジョ'
};
export function convertYoonToKatakanaForTTS(s) {
  let out = String(s || '');
  for (const hira in _yoonMap) {
    if (!Object.prototype.hasOwnProperty.call(_yoonMap, hira)) continue;
    const kata = _yoonMap[hira];
    out = out.split(hira).join(kata);
  }
  return out;
}

/* -------------------- 拗音+ウ系の長音化（C型） -------------------- */
/**
 * 「ニュウ/ニュう → ニュー」「シュウ → シュー」などへ正規化。
 * idempotent（2回掛けても増殖しない）。適用範囲は policy.yoonChoonApply で制御。
 */
const _yoonHeads = '(キャ|キュ|キョ|シャ|シュ|ショ|チャ|チュ|チョ|ニャ|ニュ|ニョ|ヒャ|ヒュ|ヒョ|ミャ|ミュ|ミョ|リャ|リュ|リョ|ギャ|ギュ|ギョ|ジャ|ジュ|ジョ)';
const _uVowels = '[うウゥｳ]';
// 例： … ニュ + う/ウ/ゥ/ｳ → ニュー
const _reYoonLong = new RegExp(_yoonHeads + _uVowels, 'g');

export function applyYoonLongVowelC(s) {
  let out = String(s || '');
  // ニュう/ニュウ → ニュー 等へ
  out = out.replace(_reYoonLong, (_m, head) => `${head}ー`);
  return out;
}

/* -------------------- 句読点→休止（ザップ対策/間の調整） -------------------- */
export function applyPunctuationPauses(s, policy) {
  let out = String(s || '');
  const pol = policy || readPolicy();
  if (pol.commaPause === 'space2') {
    // 読点→半角スペース2個（クリック音/ノイズを避けつつ呼吸の間を作る）
    out = out.replace(/、/g, '  ');
  }
  if (pol.periodPause === 'zspaceIfNeeded') {
    // 句点の直後にすでに空白が無い場合のみ全角空白を補う（連続適用しても冪等）
    out = out.replace(/。(?!(?:　|\s))/g, '。　');
  }
  return out;
}

/* -------------------- 組み立て（句読点→拗音→長音→絵文字） -------------------- */
export function assembleTts(raw, role, policy) {
  const pol = policy || readPolicy();
  let t = String(raw || '');

  // 1) 句読点で休止を先に入れる（スペーシング確定）
  t = applyPunctuationPauses(t, pol);

  // 2) 拗音かな→カタカナ（にゅ→ニュ 等）
  if (pol.yoon === 'katakana') {
    t = convertYoonToKatakanaForTTS(t);
  }

  // 3) 拗音+ウ系の長音化（C型）。適用範囲は policy で制御（既定はタイトル系のみ）
  const roleKey = String(role || 'narr');
  const applyChoon =
    pol.yoonChoon !== 'off' && (
      pol.yoonChoonApply === 'all' ||
      (pol.yoonChoonApply === 'titleOnly' && (roleKey === 'title' || roleKey === 'titleKey'))
    );
  if (applyChoon && pol.yoonChoon === 'preferChoon') {
    t = applyYoonLongVowelC(t);
  }

  // 4) 絵文字・装飾の無音化（最後に）
  t = sanitizeEmoji(t);

  return t;
}

/* -------------------- ロール別の原文抽出 -------------------- */
function rawForRole(scene, role) {
  const r = String(role || 'narr');
  if (r === 'titleKey') {
    // 読み用: titleKeyTTS があれば優先。なければ表示層 title_key。
    return scene?.titleKeyTTS || scene?.title_key || '';
  }
  if (r === 'title') {
    return scene?.titleTTS || scene?.title || '';
  }
  if (r === 'tag' || r === 'tags') {
    // sectionTags を「、」連結した読みを返す（ここでも整形がかかる）
    const tags = Array.isArray(scene?.sectionTags) ? scene.sectionTags : [];
    return tags
      .slice(0, 3)
      .map(t => String(t || '').trim().replace(/^#/, '').replace(/_/g, ' '))
      .filter(Boolean)
      .join('、');
  }
  // 既定：本文（*TTS 優先）
  return scene?.narrTTS || scene?.narr || '';
}

/* -------------------- Public API -------------------- */
/**
 * 役割別の TTS テキストを返す（*TTS を優先）。policy は省略時 readPolicy()。
 * @param {object} scene - 単一シーン（title_key / title / sectionTags / narr / 各*TTS）
 * @param {('narr'|'titleKey'|'title'|'tag')} role
 * @returns {string} 音声合成に渡す整形済みテキスト
 */
export function getTtsForRole(scene, role) {
  const pol = readPolicy();
  const raw = rawForRole(scene, role);
  return assembleTts(raw, role, pol);
}

/**
 * 後方互換 API（従来は narr 系専用の取得関数）
 * player-core.js から import される想定。
 */
export function getTtsText(scene) {
  return getTtsForRole(scene, 'narr');
}

/* -------------------- Default export (便利バンドル) -------------------- */
const TtsSanitize = {
  readPolicy,
  sanitizeEmoji,
  convertYoonToKatakanaForTTS,
  applyYoonLongVowelC,
  applyPunctuationPauses,
  assembleTts,
  getTtsForRole,
  getTtsText
};
export default TtsSanitize;
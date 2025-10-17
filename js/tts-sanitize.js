// js/tts_sanitize.js  ——  Parse-safe版（\p{}をソースに書かない）
// 1) 特性検出（実行時にのみ \p{} を使う）
let _reProps;
try {
  // 対応判定：ここは文字列→実行時にだけ評価（未対応でもソースはパースOK）
  new RegExp('\\p{Extended_Pictographic}', 'u');
  // property対応環境：拡張絵文字＋修飾一式
  const RE_PROP_STRING =
    '[\\p{Extended_Pictographic}\\u200D\\uFE0F\\u20E3]|\\uD83C[\\uDFFB-\\uDFFF]';
  _reProps = new RegExp(RE_PROP_STRING, 'gu');
} catch (_) {
  // 非対応環境：BMP記号＋ZWJ/VS/キ―キャップ＋サロゲート対
  _reProps = new RegExp(
    '[' +
      '\\u2300-\\u23FF' + // Misc Technical（⏱, ⏲, ⌛ など）
      '\\u2460-\\u24FF' + // Enclosed Alphanumerics
      '\\u2500-\\u25FF' + // Box Drawing / Geometric Shapes
      '\\u2600-\\u26FF' + // Misc Symbols
      '\\u2700-\\u27BF' + // Dingbats
      '\\u2B00-\\u2BFF' + // Misc Symbols and Arrows
      '\\u200D\\uFE0F\\u20E3' + // ZWJ/VS16/keycap
    ']' +
    '|[\\uD83C][\\uDFFB-\\uDFFF]' +        // 肌色修飾
    '|[\\uD83C-\\uDBFF][\\uDC00-\\uDFFF]', // サロゲート対（多くのEmoji）
    'g'
  );
}
// 最終盾：将来差分や環境差で漏れても確実に黙らせる
const _hardDeny = /[⏱⏲⏰⌛️]/g; // 末尾の ️ はVS16保険

export function sanitizeEmoji(text) {
  return String(text || '').replace(_reProps, '').replace(_hardDeny, '');
}
export function getTtsText(scene) {
  // narrTTSがあっても二度掛けは無害（冪等）
  return sanitizeEmoji(scene?.narrTTS || scene?.narr || '');
}
/*!
  Project:  shorts-player-kit
  File:     js/utils/color.js
  Role:     Color analysis and theme application utilities.
            Provides pure functions for color calculation and DOM manipulators for theming.
*/

/**
 * 色文字列を解析し、輝度や最適な文字色を含むオブジェクトを返す純粋関数.
 * @param {string} hexColor - #RRGGBB 形式の色文字列.
 * @returns {{isValid:boolean, hex:string|null, L:number|null, onDark:boolean|null, contrastColor:string|null}} 分析結果.
 */
export function analyzeColor(hexColor) {
  const s = String(hexColor || '').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (!m) {
    return { isValid: false, hex: null, L: null, onDark: null, contrastColor: null };
  }
  const h = m[1];
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  // WCAG準拠の相対輝度（sRGB → 線形化）で 0..1 の L を得る
  const sRGB = (x) => { x /= 255; return (x <= 0.03928) ? (x / 12.92) : Math.pow((x + 0.055) / 1.055, 2.4); };
  const R = sRGB(r), G = sRGB(g), B = sRGB(b);
  const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  // 青系が暗く感じやすい分を見込んで 0.45 をしきい値に
  const onDark = (L < 0.45);
  const contrastColor = onDark ? '#ffffff' : '#111111';
  return { isValid: true, hex: `#${h}`, L, onDark, contrastColor };
}

/**
 * analyzeColorからの分析結果に基づき、DOMのテーマ（クラスやCSS変数）を適用する.
 * @param {{isValid:boolean, onDark:boolean|null, contrastColor:string|null}} analysisResult 
 */
export function applyColorTheme(analysisResult) {
  try {
    if (!analysisResult || !analysisResult.isValid) {
      document.body.classList.remove('text-on-dark', 'text-on-light');
      delete document.body.dataset.contrast;
      document.documentElement.style.removeProperty('--tagchip-fg-auto');
    } else {
      document.body.classList.toggle('text-on-dark', !!analysisResult.onDark);
      document.body.classList.toggle('text-on-light', !analysisResult.onDark);
      document.body.dataset.contrast = analysisResult.onDark ? 'dark' : 'light';
      document.documentElement.style.setProperty('--tagchip-fg-auto', analysisResult.contrastColor);
    }
  } catch (_) { }
}

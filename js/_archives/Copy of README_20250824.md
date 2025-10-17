【📦JSフォルダREADME: 効果・音声ユーティリティの使い方と“ブロック毎Copy&Paste”運用基準】
	1.	目的（What & Why）
1.1 本READMEは、js/ フォルダの全体仕様・使い方・保守規範を一箇所に集約し、数日後でも迷わず復元できることを目的とします。
1.2 運用の最重要原則は、**ブロック毎のCopy&Paste（完全体）**です。単一一致アンカーを用いた貼付のみで改変を成立させ、人的エラーを最小化します。
	2.	構成（ファイル一覧）
2.1 global-zoom-guard.js
2.1.1 端末のズーム挙動・Safe Area等の環境保護を司る軽量ガード。
2.2 tts-voice-utils.js
2.2.1 Web Speech API（speechSynthesis）の声カタログ生成と選好設定を提供。
2.2.2 公開API: window.__ttsVoiceCatalog（配列）, window.__ttsUtils.setup(opts), window.__ttsUtils.pick(role), window.__ttsUtils.getCatalog().
2.3 scene-effects.js
2.3.1 Promise規約のエフェクト・レジストリ。標準 light-in / fade-in / slide-up / zoom-in を搭載。
2.3.2 公開API: window.__effects.register(name, fn), window.__effects.run(name, el, opts), list(), has().
	3.	読み込み順（厳守）
3.1 index.html への <script> 追加は以下の順序を厳守します。
3.1.1 完全体ブロック（Copy&Paste用）

<!-- MUST #2a: tts-voice-utils.js -->
<script src="./js/tts-voice-utils.js" defer></script>

<!-- MUST #2b: scene-effects.js -->
<script src="./js/scene-effects.js" defer></script>

<!-- MUST #2: debug_panel.js, then MUST #3: player.core.js -->
<script src="./debug_panel.js" defer></script>
<script src="./player.core.js" defer></script>


	4.	player.core.js 側の結線（TTS設定の中央化）
4.1 scenes.json 読み込み直後に、TTS設定を1行で適用します。
4.2 完全体ブロック（Copy&Paste用）

/* ===== Init ===== */
async function init() {
  setBackdropFromBase(null, 'A');
  applyThemeClass('A');
  try {
    const res = await fetch('./scenes.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    videoData = await res.json();
    window.__ttsUtils && window.__ttsUtils.setup(videoData.videoMeta?.tts || {});
    scenes = Array.isArray(videoData.scenes) ? videoData.scenes : [];
    banner.textContent = (videoData.videoMeta && videoData.videoMeta.bannerText) || '';
    renderScene(0);
    playBtn.addEventListener('click', () => { if (!isPlaying) playSequence(); }, { once: true });
  } catch (e) {
    content.textContent = 'scenes.json の読み込み、または初期化に失敗しました: ' + e;
    console.error(e);
  }
}
init();


	5.	scene-effects.js（標準エフェクトとAPI）
5.1 標準エフェクト
5.1.1 light-in… opacity:0→1（t, opacityFrom）。
5.1.2 fade-in… light-in のエイリアス。
5.1.3 slide-up… translateY(dy) + opacity（t, dy, easing, opacityFrom）。
5.1.4 zoom-in… scale(from) + opacity（t, scaleFrom, easing, opacityFrom）。
5.2 実行規約（Promise）
5.2.1 すべて Promise を返却し、完了時にresolveします（呼び出し側は非ブロッキング運用／将来同期化も可）。
5.2.2 prefers-reduced-motion: reduce が真の環境では即スキップ（ユーザー配慮）。
5.3 呼び出し例（既に実装済の非同期・非ブロッキング呼出）
5.3.1 player.core.js の描画直後に以下が入っています。

if (window.__effects) {
  const sceneEl = content.firstElementChild || content;
  const name = (scene && scene.effect) ? scene.effect : 'light-in';
  try { window.__effects.run(name, sceneEl, scene); } catch(e) { /* no-op */ }
}

5.4 カスタム登録例（開発者向け）
5.4.1 独自効果 drop-in を追加：

window.__effects.register('drop-in', (el, {t=500, dy=-24}={}) => new Promise(res=>{
  const prevT = el.style.transform, prevTr = el.style.transition, prevW = el.style.willChange;
  el.style.transform = `translateY(${dy}px)`;
  el.style.willChange = 'transform';
  el.style.transition = `transform ${t}ms cubic-bezier(.2,.8,.2,1)`;
  requestAnimationFrame(()=>{ el.style.transform = 'translateY(0)'; });
  const h = (e)=>{ if(e.propertyName==='transform'){ el.removeEventListener('transitionend', h);
    el.style.transition = prevTr || ''; el.style.willChange = prevW || ''; res(); } };
  el.addEventListener('transitionend', h);
}));


	6.	tts-voice-utils.js（APIと運用）
6.1 公開API
6.1.1 window.__ttsVoiceCatalog… 配列として公開（Debug Panel互換）。
6.1.2 window.__ttsUtils.setup({ lang, voicePreferences })… 中央設定（scenes.json の videoMeta.tts を渡す）。
6.1.3 window.__ttsUtils.pick(role)… 役割別に最適候補を返します（現状は言語＋名称包含で選択）。
6.2 Safari/WKWebView対策
6.2.1 onvoiceschanged + 複数回 refreshVoices() 再試行で、声リスト遅延に追随。
6.3 UI側（Debug Panel）
6.3.1 セレクタは __ttsVoiceCatalog を参照（Pull型）。再描画時に最新が反映されます。
	7.	scenes.json の指定例（効果・音声）
7.1 最小例

{
  "videoMeta": {
    "bannerText": "地のいきもの／人の“かたち”",
    "tts": { "lang": "ja-JP", "voicePreferences": ["Kyoko","Otoya"], "rate": 1.2 }
  },
  "scenes": [
    { "page": "1", "type": "title", "title": "プロローグ", "effect": "light-in", "base": "#fef08a" },
    { "page": "2", "type": "text",  "title": "重心と支持多角形", "effect": "slide-up", "base": "#f59e0b" },
    { "page": "3", "type": "title", "title": "導入", "effect": "zoom-in", "base": "#a7f3d0" }
  ]
}

7.2 効果オプション拡張（将来案）
7.2.1 scene.effectOpts を導入する設計に拡張可能（現実装は scene をそのまま opts として渡しているため、キーを追加すれば即運用可）。

	8.	トラブルシューティング
8.1 SyntaxError: Unexpected EOF（末尾欠落）
8.1.1 IIFEの閉じ })(); が欠落していないかを確認。ファイル末尾を必ず目視。
8.2 エフェクトが効かない
8.2.1 prefers-reduced-motion: reduce が有効だと無効化されます。OS設定を確認。
8.2.2 index.html の読込順を再確認（scene-effects.js が debug_panel.js の前で、player.core.js の前）。
8.3 音声が出ない／声リストが空
8.3.1 初回はユーザー操作でアンロックが必要（ブラウザの自動再生規制）。
8.3.2 数百ms〜1.2s後に __ttsVoiceCatalog が充足するかを確認。
	9.	Copy&Paste運用規範（完全体アンカー）
9.1 3Step厳守
9.1.1 1.ファイル名 → 2.操作（replace-block/insert-after/replace-file） → 3.検索ワード（直前行/署名行/直後行）。
9.2 単一一致でなければ中止
9.2.1 ヒットが0または2以上のときは貼付を中止し、アンカーを再定義。
9.3 差分提示
9.3.1 回答では前後1行を含む完全体を提示（このREADMEのブロック形式に準拠）。
	10.	変更履歴（要点）
10.1 2025-08-24
10.1.1 tts-voice-utils.js 外出し。index.html の読込順を確定化。
10.1.2 scene-effects.js 外出し。標準 light-in/fade-in/slide-up/zoom-in 実装。
10.1.3 player.core.js に __ttsUtils.setup(...) を1行結線。
10.1.4 banner を position: fixed 化し、版面不動を確立。
	11.	NS-Core+Joy（運用テンプレ）
11.1 Propose: <今回の単一行動>
11.2 Justify: <VOI≥Cost を一文で>
11.3 Min-Execute: 1) <設計> 2) <取得> 3) <適用>
11.4 Verify: 期待=<KPI> / 実測=<値>（合格｜要修正）
11.5 Record: 変更点=<Δ> / 教訓=<再利用可能な一句>
11.6 Joy: <7〜20文字の短評／絵文字1つまで>
	12.	ライセンス／備考
12.1 ライセンスはプロジェクト定義に従います（Private/Internal想定）。
12.2 本フォルダの責務は「環境保護・音声・演出」。アプリ本体やデバッグUIはルート直下に維持して関心分離を徹底します。
---
doc_id: js-readme
doc_version: "2025-09-21.0"
module: js
render_contract: v1.1
schema_min: v3.2
tts_policy: "perRoleAbs: clamp 0.5–2.0, default 1.4"
last_verified: "2025-09-21T00:00:00+09:00"
verified_on:
 - device: "iPhone"
   os: "iOS (Safari)"
   workflow: ["Textastic", "Working Copy", "a-Shell http.server"]
tags: ["iOS-first", "activation-gate", "visualViewport", "debug-panel", "rate-per-role", "effects", "readme"]
---

# shorts-player-kit / js README (2025-09-21, latest)

この文書は `js/` 配下の**運用規範の単一ソース**です。  
iOS ファーストで、**表示契約（Render Contract）v1.1**／起動ゲート（Activation Gate）／TTS 規範／visualViewport 連携／Debug UI の責務分離を定義します。

---

## 0) TL;DR（重要ポイントだけ）
- **アクティベーション・ゲート必須**：初回の明示的ユーザー操作で TTS/Audio を解錠。以後は自動遷移可。Safari の自動再生ポリシー準拠。 [oai_citation:0‡Stack Overflow](https://stackoverflow.com/questions/74986310/how-to-keep-header-at-top-of-visual-viewport-after-layout-visual-viewport-change?utm_source=chatgpt.com)
- **レイアウトは `visualViewport`＋`dvh`＋`safe-area` の三点支持**：  
 `visualViewport.height` を CSS 変数で流し、平常時は `100dvh` を採用。下端は `env(safe-area-inset-bottom)` を加味。 [oai_citation:1‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API?utm_source=chatgpt.com)
- **TTS は役割別・絶対レート**（0.5–2.0、既定 1.4）。断片再生＋静寂ゲートで読了保証。`speechSynthesis` の状態はイベント駆動で可視化。 [oai_citation:2‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_environment_variables/Using_environment_variables?utm_source=chatgpt.com)
- **表示は“契約”駆動**：HTML 構造と CSS クラスで表層を固定。JS は**状態遷移**と**属性付与**のみ。`!important` 禁止。
- **Debug Panel は見た目ゼロ**：JS は状態だけを切り替え、**見た目は style.css のみ**（スコープ済み）。

---

## 1) Render Contract v1.1（表示の“契約”）

### レイヤ構造（固定）
- 背景: `#bgColor` / `#bgBreath`（`position:fixed; z-index:0; pointer-events:none`）  
 ベール（A/B/T）は `body.version-*` の組合せで **CSS が担当**。
- 舞台: `#wrapper > #content`（中央寄せ／1シーンぶんを内包）

### シーン DOM（1ページごと再構築）
`#content > .scene` に、以下**クラス名を契約**として内包：
- `.section-tags > .section-tag`（例：`#Trivia1`, `#Scripture` など複数。推奨 3 個）
- `.title_key`（例：`【創世記1:9–10 抄】`）
- `.title`
- `.symbol-bg > .symbol`（帯色は CSS 変数 `--symbol-bg-color`）
- `.narr`（`white-space:pre-line`）

> **禁止事項**：ID スロットへの直接描画を前提にしない（過渡アダプタは残すが非推奨）。  
> **目標**：`.scene` クラス構造へ完全移行。

---

## 2) 起動と状態（Activation Gate / State）

### Activation Gate
- **目的**：Safari のユーザージェスチャー要件を**最初の 1 回**で満たし、TTS・Audio・Video を解錠。 [oai_citation:3‡Stack Overflow](https://stackoverflow.com/questions/74986310/how-to-keep-header-at-top-of-visual-viewport-after-layout-visual-viewport-change?utm_source=chatgpt.com)
- **実装**：
 - `body.app-unactivated` を初期付与。ゲート UI はこの状態でのみ前面表示（`inert` で背面を無効化可）。 [oai_citation:4‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API?utm_source=chatgpt.com)
 - ゲートのクリックで `app-activated` へ遷移し、初期の「無音トークン」または「短チャンク再生」で `speechSynthesis` が動作可能化。
- **UX**：フェード/ズームなど演出は CSS 側。JS は `classList` とイベント発火のみ。

### ページ遷移と TTS 終端
- デフォルトは **TTS 完了＋postDelayMs** 後に自動遷移。  
- `advancePolicy.mode: "manual"` を指定したシーンは停止待ち。  
- ユーザーの「次へ」で**待機キャンセル**（navToken を無効化）。

---

## 3) ビューポート適応（iOS-first）

### 三点支持の方針
1) **`visualViewport`** でキーボード出現時の実可視領域を取得。 [oai_citation:5‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API?utm_source=chatgpt.com)  
2) **動的ビューポート単位 `dvh`** を平常時の高さ基準に採用（UI の表示非表示へ追従）。 [oai_citation:6‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/length?utm_source=chatgpt.com)  
3) **`safe-area` env()** でホームインジケータ分を下端に加算。 [oai_citation:7‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver?utm_source=chatgpt.com)

### 実装規約
- JS：`--visual-viewport-h` / `--host-bias-bottom` を `documentElement` にセット。  
- CSS：`#wrapper` / `#content` は `min-height: var(--visual-viewport-h, 100dvh)` を採用。  
- Debug Panel は **自分の実高**を `--debug-panel-h` としてフィードし、本文側 `padding-bottom` へ伝搬（`ResizeObserver`）。 [oai_citation:8‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/env?utm_source=chatgpt.com)  
- 主要イベントは **`passive:true`**、不要になれば **確実に解除**。 [oai_citation:9‡Stack Overflow](https://stackoverflow.com/questions/62780281/2024-ios-safari-video-autoplay-options?utm_source=chatgpt.com)

---

## 4) TTS 規範（Web Speech API）

### 役割別・絶対レート
- **範囲**：0.5–2.0 clamp。**既定 1.4**。  
- `tag / titleKey / title / narr` で個別指定。  
- 実際の適用は `__ttsUtils.getRateForRole(1.0, role)`。

### 読了保証（静寂ゲート）
- 長文は `splitChunksJa()` でチャンク化。  
- 各チャンク終了→`speechSynthesis.speaking=false` を監視→**静寂 ms** 経過で次へ。  
- `visibilitychange` でタブ非アクティブ時の挙動も安定化（ポリシーは「即停止」）。 [oai_citation:10‡html.spec.whatwg.org](https://html.spec.whatwg.org/?utm_source=chatgpt.com)

> 参考：Web Speech API（`speechSynthesis` / `SpeechSynthesisUtterance`） [oai_citation:11‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_environment_variables/Using_environment_variables?utm_source=chatgpt.com)

---

## 5) Debug Panel（責務と境界）

- **JS の責務**：状態（data 属性・クラス）とイベント発火のみ。  
- **CSS の責務**：配色・余白・レイアウト・アニメ。**`#debug-panel` スコープ**に限定。  
- **高さ連携**：`ResizeObserver`→`--debug-panel-h`→本文 `padding-bottom`。 [oai_citation:12‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/env?utm_source=chatgpt.com)

---

## 6) ファイル一覧（最小セット）
- `index.html`：**HTML は素体のみ**。`<style>` は禁止。  
- `style.css`：見た目の単一ソース。A/B/T ベール・タグ・帯・TTS 可視化等。  
- `js/player-core.js`：状態機械・シーン描画・TTS・遷移。  
- `js/tts-voice-utils.js`：声カタログ・役割別レート。  
- `js/scene-effects.js`：軽量エフェクトの登録・実行。  
- `js/debug_panel.js`：UI 状態・Stop ACK・テレメトリ。  
- `js/viewport_handler.js`：`visualViewport` 監視と CSS 変数供給。

---

## 7) テスト手順（iOS Safari 推奨）
1. 初回ロードで **Activation Gate** が前面。タップでゲート消滅＆TTS 解錠（ミュートでないこと）。 [oai_citation:13‡Stack Overflow](https://stackoverflow.com/questions/74986310/how-to-keep-header-at-top-of-visual-viewport-after-layout-visual-viewport-change?utm_source=chatgpt.com)  
2. **長文シーン**で飛ばしなし（途中で停止→再開しない）。  
3. `advancePolicy.postDelayMs` の反映（例：1000ms）を目視。  
4. `manual` のシーンで自動遷移停止。  
5. 再生中～余韻待ち中に「次へ」で**待機キャンセル**。  
6. 入力要素フォーカス→キーボード出現で本文が**下端に潜らない**（`visualViewport` 反映）。 [oai_citation:14‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API?utm_source=chatgpt.com)  
7. 端末回転／URL バー表示切替で**レイアウトが瞬断しない**（`dvh` 採用）。 [oai_citation:15‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/length?utm_source=chatgpt.com)

---

## 8) よくある落とし穴
- **`100vh` 固定**：iOS UI の表示非表示でズレる → `100dvh` を基本に。 [oai_citation:16‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/length?utm_source=chatgpt.com)  
- **safe-area 未対応**：下端の 1px 隙間や被り → `env(safe-area-inset-*)` を合算。 [oai_citation:17‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver?utm_source=chatgpt.com)  
- **初回ジェスチャーなしの再生**：無言失敗 → Activation Gate で解錠。 [oai_citation:18‡Stack Overflow](https://stackoverflow.com/questions/74986310/how-to-keep-header-at-top-of-visual-viewport-after-layout-visual-viewport-change?utm_source=chatgpt.com)  
- **イベント氾濫**：`passive` 付与・不要時 `removeEventListener`。 [oai_citation:19‡Stack Overflow](https://stackoverflow.com/questions/62780281/2024-ios-safari-video-autoplay-options?utm_source=chatgpt.com)

---

## 9) 参考（一次情報）
- Visual Viewport API（Explainer / MDN / browser support） [oai_citation:20‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/env?utm_source=chatgpt.com)  
- Dynamic viewport units: `dvh/svh/lvh`（MDN / Can I use） [oai_citation:21‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/length?utm_source=chatgpt.com)  
- Safe Area Insets `env(safe-area-inset-*)`（MDN） [oai_citation:22‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver?utm_source=chatgpt.com)  
- Safari 自動再生ポリシー（Apple Developer） [oai_citation:23‡Stack Overflow](https://stackoverflow.com/questions/74986310/how-to-keep-header-at-top-of-visual-viewport-after-layout-visual-viewport-change?utm_source=chatgpt.com)  
- Web Speech API（MDN） [oai_citation:24‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_environment_variables/Using_environment_variables?utm_source=chatgpt.com)  
- ResizeObserver（MDN / web.dev） [oai_citation:25‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Values_and_units?utm_source=chatgpt.com)  
- Passive Event Listeners（MDN） [oai_citation:26‡Stack Overflow](https://stackoverflow.com/questions/62780281/2024-ios-safari-video-autoplay-options?utm_source=chatgpt.com)  
- `inert` 属性（MDN） [oai_citation:27‡MDNウェブドキュメント](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API?utm_source=chatgpt.com)  
- Page Visibility API（MDN） [oai_citation:28‡html.spec.whatwg.org](https://html.spec.whatwg.org/?utm_source=chatgpt.com)
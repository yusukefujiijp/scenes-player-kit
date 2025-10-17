---
doc_id: js-readme
doc_version: "2025-08-31.1"
module: js
render_contract: v1.0
schema_min: v3.2
tts_policy: "perRoleAbs: clamp 0.5–2.0, default 1.4"
last_verified: "2025-08-31T22:00:00+09:00"
verified_on:
  - device: "iPhone"
    os: "iOS (Safari)"
    workflow: ["Textastic", "Working Copy", "a-Shell http.server"]
tags: ["iOS-first", "debug-panel", "rate-per-role", "effects", "readme"]
---

# shorts-player-kit / js README (2025-08-31, latest)

この文書は `js/` 配下の**最新運用規範**です。  
iOS（Textastic × Working Copy）前提で、**表示契約（Render Contract）**／読み込み順／TTS規範／デバッグUI／ローカル検証までを一箇所に集約します。

---

## 0) TL;DR（重要ポイントだけ）
- **速度規範は「役割別・絶対」一本化**：**0.5–2.0**、既定 **1.4**。UIの「基準Rate行」は既定で**非表示**。  
- **Page-1 は Play専用**。opening / transition / closing は**純エフェクト（本文キー無し）**。  
- **音は出るが文字が見えない**時は：CSSとJSの**DOM契約ズレ**がほぼ原因。以下の「Render Contract v1.0」に合わせる。  
- iOSは `file://` 直読みで `fetch('./scenes.json')` が落ちやすい。**http**で動かす（a-Shell等）。

---

## 1) Render Contract v1.0（表示の“契約”）
> **CSSとJSが一致して初めて安定表示になります。次スレでもここを唯一の基準にしてください。**

### レイヤ
- 背景：`#bgColor`（fixed / z-index:0 / pointer-events:none）…**JSが `scene.base` を塗る**  
- テーマ：`body.version-A|B|T` … JSがページ毎に付与（ベール・トーンはCSSが担当）

### シーン表層
- 1回だけ生成：`#content`
- 毎ページ描き直し：`#content > .scene`（**クラス構造**で以下を内包）
  - `.section-tag`（例：`#Trivia1` など、モノスペース体）  
  - `.title_key`（例：`【創世記1:9–10 抄】`）  
  - `.title`  
  - `.symbol-bg > .symbol`（帯は `--symbol-bg-color` をJSがセット）  
  - `.narr`（`white-space:pre-line`。`\n`/`\n\n`の聖なるリズム）

### 種別
- placeholder（Page-1専用, Playボタンのみ）  
- content（A/B/T の本文ページ）  
- effect（opening/transition/closing。**本文キー禁止**）

### 禁止事項
- CSSで `!important` を使わない（契約破りの温床）。  
- JS側が**ID直書きスロット**にだけ依存しない（クラス契約へ移行）。

> **現状**：`player.core.js` は**過渡アダプタ**として `#spk-wrap` と id スロット（`#title_key/#title/#narr`）へも描画可。  
> **目標**：早期に `.scene` クラス構造へ**完全移行**（次スレの最初のタスク）。

---

## 2) 現行モジュール（ファイル一覧と役割）

### `scene-effects.js`
- 軽量エフェクトのレジストリ：`register / run / list / has`  
- 既定：`light-in, fade-in, slide-up, zoom-in, flame-out`（`flame-out` は overlay=await）

### `tts-voice-utils.js`
- Web Speech API の声カタログと**レート・エンジン**  
- 主API
  - `setup(meta)`（`videoMeta.tts` 適用、JA-onlyフィルタ等）
  - `getCatalog({jaOnly})` / `pick(role)`
  - `setRateRole(map)` / `getRateRole()`：**役割別・絶対レート**  
  - `getRateForRole(base, role)`：**0.5–2.0 clamp**（`perRoleAbs` 時は base 無視、LS or 既定 1.4）  
- 既定レート（LS未設定時）：`{tag:1.4, titleKey:1.4, title:1.4, narr:1.4}`

### `player.core.js`（iOS-first中枢）
- シーン読み込み／描画／TTS／遷移／`__player` API  
- **速度参照は一本化**：`rateFor(role)` → `__ttsUtils.getRateForRole(1.0, role)`  
- **待機時間も同じ規範**に統一（読了優先）  
- **背景レイヤ順序を保証**：`#bgColor` を最背面に固定  
- **過渡アダプタ**：`#spk-wrap` + idスロットにも描画可（次段で撤去予定）

### `debug_config.js`
- **UIゲーティング**（コード側のみで制御）。既定は「基準Rate行**非表示**」「役割別のみ」  
- 推奨設定：
  ```js
  window.__dbgConfig = {
    collapsedDefault: true,
    sections: { status:true, note:false, controls:true, goto:true, ttsFlags:true, voices:true, baseRate:false },
    buttons:  { prev:true, next:true, play:true, stop:true, restart:true, goto:true },
    locks:    { allowTTSFlagEdit:true, allowVoiceSelect:true },
    rateMode: 'perRoleAbs',
    rolesRate:{ min:0.5, max:2.0, step:0.1, defaultAbs:1.4 }
  };
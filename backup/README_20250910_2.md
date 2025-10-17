# shorts-player-kit (iOS-first) — Root README (2025-09-09)

このリポは **短編プレイヤー**と**創造日シリーズ台本**を iOS（Textastic × Working Copy）で開発・検証する最小構成です。  
**次スレへ正確に引き継ぐ唯一の参照点**として、この README を常に最新に保ちます。

---

## 0. Source of Truth（今の決定事項）

- **公開URL（GitHub Pages / プロジェクトサイト）**  
  - `https://yusukefujiijp.github.io/shorts-player-kit/`  
  - Settings → Pages → **Build and deployment: GitHub Actions**（Source）
- **OG / favicon / 404**  
  - `assets/og-image.png`（**1200×630 PNG**、SNS互換◎）  
  - `assets/favicon.svg`（**SPK v2**／小サイズ可読最適化）  
  - `assets/favicon.ico`（任意・後日、旧UA互換用）  
  - `404.html`（ルート直下）
- **メタの原則**  
  - `og:image` と `twitter:image` は **同一の絶対URL**（上の公開ドメイン）。  
  - `canonical` / `og:url` も **正ドメイン（yusukefujiijp）** を厳守。
- **TTS 速度規範**：役割別**絶対レートのみ**（`0.5–2.0`, step `0.1`, 既定 `1.4`）  
  - UIは **Role Rate ×** のみ（基準レートUIは非表示）。  
  - 待機計時も `rateFor('narr')` に統一（独自クランプなし）。
- **ページ規約**：`Page 1 = Play専用`（Opening/Transition/Closing は純エフェクト）  
- **スキーマ**：`schema v2.7` 系。`scenes.json` 一元読み込み（インラインJSON禁止）。  
- **iOS実行**：`file://` を避け、`python3 -m http.server 8080` により `http://127.0.0.1:8080` で開く。

> **再発防止メモ**：ドメインは `yusukefujiijp`。`yusukefujijjp` は誤り。

---

## 1. フォルダ構成（現状スナップショット）

```
shorts-player-kit/
├─ .github/workflows/static.yml      # Pagesデプロイ（Actions）
├─ assets/                           # 画像・音源（og-image.png, favicon.svg 等）
├─ backup/                           # 旧資料退避（公開不要）
├─ content/                          # 台本アーカイブ（DayX_YYYYMMDD.json）
├─ dev/ / docs/ / releases/          # 補助
├─ js/
│  ├─ _archives/                     # 旧版の保管
│  ├─ debug_config.js                # デバッグUIのゲーティング
│  ├─ debug_panel.js                 # デバッグUI本体
│  ├─ global-zoom-guard.js           # iOS向けズーム/セーフエリア軽ガード
│  ├─ player.core.js                 # プレイヤ中枢（再生・待機・TTS結線）
│  ├─ README.md                      # js仕様メモ
│  ├─ scene-effects.js               # エフェクトレジストリ
│  └─ tts-voice-utils.js             # 声カタログ & 役割別レート
├─ index.html                        # エントリ（読込順は §3）
├─ scenes.json / schema.json         # 台本とスキーマ
└─ style.css                         # 最小スタイル
```

> `scenes.json` は現時点 **第六日（Day6）**。`content/` に日付付きでアーカイブします。

---

## 2. 主要コンセプト

2.1 **役割別レート一本化**  
2.1.1 UI: `debug_panel.js` の **Role Rate ×**（Tag / TitleKey / Title / Narr）。  
2.1.2 実行: `player.core.js` → `rateFor(role)` → `tts-voice-utils.getRateForRole(1.0, role)`。  
2.1.3 レンジ: `0.5–2.0`、既定 `1.4`（LS未設定時）。  

2.2 **Voice UI の統合**  
2.2.1 `Voice: [✓] Tag <select>  [✓] TitleKey <select> …` を一列構成。  
2.2.2 `Auto` は `__ttsUtils.pick(role)`（安定ID: `voiceURI > lang|name > name`）。

---

## 3. `<script>` 読込順（**index.html と一致させる契約**）

```html
<!-- 1) TTSユーティリティ（プレイヤより先） -->
<script src="./js/tts-voice-utils.js" defer></script>
<!-- 2) エフェクト（Promiseベース） -->
<script src="./js/scene-effects.js" defer></script>
<!-- 3) プレイヤ中枢 -->
<script src="./js/player.core.js" defer></script>
<!-- 4) デバッグ設定（UI本体より先） -->
<script src="./js/debug_config.js" defer></script>
<!-- 5) デバッグUI本体 -->
<script src="./js/debug_panel.js" defer></script>
<!-- 6) 任意のガード -->
<script src="./js/global-zoom-guard.js" defer></script>
```

> **破ると** 初期化順序で不具合が出ます（未定義参照／設定未適用）。

---

## 4. iOS ローカル検証（Textastic × Working Copy × a-Shell）

4.1 編集：Textastic → Working Copy ▶︎ Repositories ▶︎ 本リポを直接編集。  
4.2 サーバ：a-Shell で  
```bash
cd ~/Documents/shorts-player-kit
python3 -m http.server 8080
```  
4.3 再生：Safari で `http://127.0.0.1:8080/index.html`（`file://` 禁止）。  
4.4 ループ：Textastic保存 → Safariリロード（初回は任意クリックでTTS解錠）。

---

## 5. Working Copy（日常運用）

5.1 基本ルート：**編集 → Stage → Commit → Push**。  
5.2 併用時：他端末/ブラウザ変更があり得るなら **Fetch → Pull → Push** を習慣化。  
5.3 ブランチ：個人運用は `main` 一本で可。壊す恐れのみ短命ブランチ。  

**コミット規範：AI-Commit Master Prompt V3.0＋日本語版Summary必須**  
- Summary＝英語（Conventional Commits）。  
- Detail＝日本語4段：**【直訳】→【要約】→【理由】→【学び】**（最上段に“日本語版Summary”）。  
- 種別辞書：feat / fix / docs / style / refactor / test / chore / perf / build / ci / deps / revert。  

---

## 6. LocalStorage キー（実装で使用）

6.1 役割別レート：`dbg.tts.role.tag|titleKey|title|narr`。  
6.2 折り畳み：`dbg.panel.collapsed.v2`。  
6.3 互換（基準レートUI時のみ）：`dbg.tts.rate`。

---

## 7. GitHub Pages 公開（Actions運用）

7.1 設定  
7.1.1 Settings → Pages → **GitHub Actions** を選択。  
7.1.2 `.github/workflows/static.yml`（公式「Static HTML」基調）：  
- `on.push.branches: ["main"]`＋`workflow_dispatch`  
- `steps`: `checkout → configure-pages → upload-pages-artifact(path: '.') → deploy-pages`  

> **注**：現状は `path: '.'` で**全体公開**。公開除外を強めたいときは Allowlist 方式（`public/` 生成→`path: 'public'`）へ移行。

7.2 検証  
7.2.1 Actions の最新 Run が **Success**。  
7.2.2 公開URLトップが描画される。  
7.2.3 `…/assets/og-image.png` を**直叩き**できる。

---

## 8. アセット仕様（OG / favicon / SEO）

8.1 **OG画像**  
8.1.1 `assets/og-image.png`（**1200×630 PNG**、文字は縮小でも可読）。  
8.1.2 メタ：`og:image` と `twitter:image` を **同一絶対URL** にする。  
8.1.3 検証：Meta Sharing Debugger / Twitter Card Validator / LinkedIn Post Inspector。  
8.1.4 キャッシュ：表示が古い場合は **Scrape Again**。  

8.2 **Favicon（SPK v2 / 確定値）**  
8.2.1 ファイル：`assets/favicon.svg`。  
8.2.2 背景：安全インセット `x=y=24`、`w=h=464`、`rx=104`、ネイビー→チャコールの線形グラデ。  
8.2.3 文字：`SPK`、**Inter 800**、`font-size=188`、`letter-spacing=-0.024em`、`dy=.11em`。  
8.2.4 ハロー：`stroke=#000`、`stroke-width=22`、`stroke-opacity=0.16`、`paint-order: stroke fill`。  
8.2.5 検証スニペット（16/32/64px 同時確認）：
```html
<img src="./assets/favicon.svg" width="16" height="16">
<img src="./assets/favicon.svg" width="32" height="32">
<img src="./assets/favicon.svg" width="64" height="64">
```
8.2.6 HTMLリンク（併用推奨）：
```html
<link rel="icon" type="image/svg+xml" href="./assets/favicon.svg">
<link rel="icon" type="image/x-icon" href="./assets/favicon.ico"> <!-- 任意／旧UA -->
```
8.2.7 キャッシュ更新：  
`<link rel="icon" href="./assets/favicon.svg?v=20250909">` のように**クエリでバージョン付与**も可。  

---

## 9. トラブルシュート

9.1 **TTSが鳴らない**：初回クリック未実行／TTSフラグOFF／実質空行／iOSサイレント。  
9.2 **Rate行が出る**：`debug_config.js` → `sections.baseRate=false` を確認。  
9.3 **音と待機がズレる**：`player.core.js` が `rateFor('narr')` を使用しているか（独自クランプ排除）。  
9.4 **404/OGが出ない**：ファイルの場所（ルート直下/`assets/`）と**絶対URL**を再確認。  
9.5 **faviconが更新されない**：ブラウザのキャッシュ／クエリ版 `?v=...` を適用。  

---

## 10. 次スレ開始チェックリスト

10.1 `scenes.json` のテーマ（例：Day6/Day7）が明記。  
10.2 `debug_config.js` → `sections.baseRate=false`（役割別のみ）。  
10.3 Role Rate ×：既定 `1.4`、範囲 `0.5–2.0`、step `0.1`。  
10.4 `player.core.js` に `roleRate()` が無い（`rateFor()` に統一）。  
10.5 iOSは `python3 -m http.server 8080` 経由で検証。  
10.6 直近の台本は `content/` にアーカイブ済み。  
10.7 OGとfaviconは本仕様（§8）どおりに存在し、直叩きOK。  

---

## 11. 変更履歴（このREADMEの更新）

- **2025-09-09**: Pages公開手順・OG/fav/404・検証手順を追記。JS読込順を契約化。**SPK favicon v2** の確定値を明記。AI-Commit Master Prompt V3.0／日本語版Summary必須を常設。  
- **2025-09-08**: 初版起稿。

---

Joy: 役割ごとに息を整え、物語は歩きます。🕯️

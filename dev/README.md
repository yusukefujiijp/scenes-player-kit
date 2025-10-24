# 【🎬shorts-player-kit: 外部JSON差し替えで量産するショート動画プレイヤー】

1. **目的（What & Why）**  
   1.1 **What**: 単一HTML/CSS/JSで動作する“短尺プレイヤー”。内容は **`scenes.json` の差し替えのみ**で量産。  
   1.2 **Why**: モバイル（Textastic等）中心の制作運用で、**ビルド不要・即時試写・即時修正**を実現するため。  
   1.3 **設計原則**: 依存最小（生JSのみ）／ロード順固定／外部JSONコントラクト準拠／版面の**不動化**（オーバーレイ帯）／Safe-Area考慮。

---

2. **ファイル構成とロード順**  
   2.1 **ルート構造**（例: スクリーンショット準拠）

shorts-player-kit/
├─ _archives/               # 旧版・検証用
├─ ai_prompts/              # プロンプト資材
├─ docs/                    # 変更履歴・ノート類
├─ js/
│   └─ global-zoom-guard.js # 端末ズーム/安全域ガード
├─ debug_panel.js           # 折畳み式デバッグUI
├─ index.html               # エントリ（ロード順を規定）
├─ player-core.js           # 本体（レンダ/遷移/音声）
├─ README.md                # 本書
├─ scenes.json              # 外部データ本体（差し替え対象）
├─ schema.json              # データ契約（スキーマ）
└─ style.css                # スタイル（版面の不動化を含む）

2.2 **ロード順（厳守）**  
2.2.1 `style.css` → `debug_panel.js` → `player-core.js`（`defer` 推奨）。  
2.2.2 `scenes.json` は `player-core.js` 内 `fetch('./scenes.json')` で取得。  
2.2.3 **インラインJSON（`<script type="application/json">`）は使用しない**（設計方針）。

---

3. **クイックスタート（Textastic / ローカル試写）**  
3.1 **Textastic**: `index.html` を開くだけで動作。帯（バナー）表示後、▶︎で再生。  
3.2 **ローカルHTTP推奨（予備）**: 端末・環境により `fetch` が `file://` 経由で拒否される場合は、簡易HTTPサーバ（例: `python -m http.server`）を使用。  
3.3 **JSON差し替え運用**: `scenes.json` を入れ替え → 即時リロードで反映。  
3.4 **TTS（端末音声）**: 初回は**ユーザー操作**（タップ等）でアンロック（`player-core.js` で `touchstart/click/keydown` をリッスン）。

---

4. **UI/UXの要点（版面の不動化）**  
4.1 **バナー帯（#banner）**  
4.1.1 `position: fixed`（**フロー非干渉**）＋`pointer-events: none`（操作を遮らない）。  
4.1.2 `z-index: 1000`／`padding-top: calc(.5rem + var(--sa-top))`（ノッチ対応）。  
4.1.3 空文字でも視認されるよう `min-height` を確保。  
4.2 **背景レイヤ**: `#bgColor/#bgBreath` は `position: fixed; z-index:0`。  
4.3 **コンテンツ**: `#wrapper{ height:100dvh; display:flex; justify-content:center; }` で**常に中央**。  
4.4 **デバッグパネル**: 下部に小型UI（ページ移動／再生制御／TTS ON/OFF・声種選択）。

---

5. **データ契約（schema.json 抜粋）**  
5.1 **トップレベル**  
5.1.1 `videoMeta` … 全体メタ（`bannerText`, `theme`, `tts` 設定など）。  
5.1.2 `scenes` … シーン配列。  
5.2 **`videoMeta` 主フィールド**  
5.2.1 `bannerText`（String）… 上部帯に表示。  
5.2.2 `tts.lang`（例: `ja-JP`）, `tts.voicePreferences`（例: `["Kyoko","Otoya"]`）, `tts.rate`（Number）。  
5.3 **`scene`（各要素）主フィールド**  
5.3.1 `page`（String/Number）, `type`（例: `effect`/`text`/`title`）, `effect`（任意）, `title_key`/`title`/`narr`/`symbol`, `base`（背景色Hex）。  
5.3.2 例（最小）:
```json
{
  "videoMeta": {
    "bannerText": "地のいきもの／人の“かたち”",
    "tts": { "lang":"ja-JP", "voicePreferences":["Kyoko","Otoya"], "rate":1.2 }
  },
  "scenes": [
    { "page":"1", "type":"effect", "effect":"light-in", "title":"プロローグ", "base":"#d9f99d" }
  ]
}

5.4 検証: schema.json に準拠する scenes.json を作成 → 直接差し替え。構文エラー時は index.html 上のエラーメッセージで即時検知。

⸻

	6.	操作／挙動
6.1 基本: ▶︎で一連再生。Debug Panel から Prev/Next/Goto/Play/Stop。
6.2 TTS: Tag/TitleKey/Title/Narr の読み上げON/OFF切替と声種マップ選択。
6.3 テーマ: 背景色と影のレシピは player-core.js / style.css に定義（A/B/…）。
6.4 フォント: Google Fonts を使用（通信不可でも代替フォントで破綻しない設計）。

⸻

	7.	既知の注意点／推奨
7.1 fetch と環境差: 一部環境の file:// ではブロックされる可能性 → その場合のみローカルHTTPを利用。
7.2 音声ポリシー: 端末の自動再生規制により、初回操作が必須。
7.3 長文適応: 1シーン内のテキストが長い場合は narr を優先し、title は短く。
7.4 色彩: base は高彩度×高輝度に偏らないよう配分（視認性と疲労を考慮）。
7.5 拡張: 効果パラメータ（遷移秒など）は将来版で scene 単位に追加予定（後方互換方針）。

⸻

	8.	変更履歴（要点）
8.1 2025-08-24
8.1.1 バナー帯を fixed オーバーレイ化（版面の下方ズレ根絶／pointer-events:none で操作良化）。
8.1.2 インラインJSONフォールバックを撤去（運用方針「外部JSON差し替えのみ」に統一）。
8.1.3 Textastic での実機検証を通過（帯表示・中央配置・再生フローを確認）。

⸻

	9.	ライセンス／クレジット
9.1 License: Private / Internal（要相談）。
9.2 Design Notes: NS-Core（Propose/Justify/Min-Execute/Verify/Record）思想に基づく “ビルドレス即時試写” を中核要件化。

⸻

10. **NS-Core+Joy（運用メモ／テンプレ）**  
10.1 **Propose**: `<ここに今回の単一行動>`  
10.2 **Justify**: `<VOI≥Cost を一文で>`  
10.3 **Min-Execute**:  
   1) `<設計>`  
   2) `<取得>`  
   3) `<更新基準>`  
10.4 **Verify**:  
   - 期待=`<KPI>`  
   - 実測=`<値>`（合格｜要修正）  
10.5 **Record**:  
   - 変更点=`<Δ要約>`  
   - 教訓=`<再利用可能な一句>`  
10.6 **Joy**: `<7〜20文字の短評／絵文字1つまで>`

---

📌 **運用例**  
- **Propose**: `scenes.json を差し替え`  
- **Justify**: 差替コスト＜即時試写の価値  
- **Min-Execute**: 1) JSON編集 2) 保存 3) リロードで即反映  
- **Verify**: 期待=即試写 / 実測=OK（合格）  
- **Record**: 変更点=JSON更新 / 教訓=「データと表示は即座に同期する」  
- **Joy**: 「差替一発即再生✨」  
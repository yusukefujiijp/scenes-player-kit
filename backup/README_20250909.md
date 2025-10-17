# shorts-player-kit (iOS-first) — Root README (2025-09-08)

このリポは **短編プレイヤー**と**創造日シリーズ台本**を iOS（Textastic × Working Copy）で開発・検証するための最小構成です。  
**次スレへ正確に引き継ぐための“唯一の参照点”**として、この README を常に最新に保ちます。

---

## 0. いまの決定事項（Source of Truth）

- **TTS 速度規範**: 役割別**絶対レート**のみ使用（`0.5–2.0`, step `0.1`, 既定 `1.4`）。  
  - UIは **Role Rate ×** のみ（**基準レートUIは非表示**）。
  - 待機計時も `rateFor('narr')` に統一（プレイヤ側独自クランプなし）。
- **ページ規約**: `Page 1 = Play専用`。Opening / Transition / Closing は**純エフェクト**（title/narr/symbol無し）。
- **スキーマ**: `schema v2.7` 系。`scenes.json` 一元読み込み（インラインJSON禁止）。
- **iOS動作**: `file://` 読み込みは避け、**http.server** で `http://127.0.0.1:8080` から開く。

---

## 1. フォルダ構成（現状スナップショット）

shorts-player-kit/
├─ assets/           # 画像・音源など（空でもOK）
├─ backup/           # 旧ファイルの退避先（zip等）
├─ content/          # 台本のアーカイブ群（DayX_YYYYMMDD.json など）
├─ dev/              # 開発メモ、テンプレ、検証用ファイル
├─ docs/             # 仕様や手順メモ（外部共有向け）
├─ js/
│  ├─ _archives/                 # 旧版JSの保管
│  ├─ debug_config.js            # デバッグUIのゲーティング設定（コードのみで切替）
│  ├─ debug_panel.js             # 底部デバッグパネル本体（Role Rate× / Voice など）
│  ├─ global-zoom-guard.js       # （任意）iOS向けズーム/セーフエリアの軽ガード
│  ├─ player.core.js             # プレイヤ中枢（再生・待機・TTS結線）
│  ├─ README.md                  # jsフォルダ専用 README（最新仕様）
│  ├─ scene-effects.js           # エフェクトレジストリ（light-in / flame-out 等）
│  └─ tts-voice-utils.js         # 声カタログ & 役割別レート・エンジン
├─ releases/        # 配布物やタグ候補（空でもOK）
├─ index.html       # エントリ（script 読み込み順は下記 3. を厳守）
├─ scenes.json      # 現行の台本（※今は「第六日」版）
├─ schema.json      # スキーマ（v2.7 相当）
└─ style.css        # 最小スタイル

> **メモ**: 最新スクショ時点で `scenes.json` は **第六日（Day6）**。  
> `content/` には日付入りの台本をアーカイブしていきます（例：`content/Day6_20250830.json`）。

---

## 2. 主要コンセプト

- **役割別レート一本化**  
  - UI: `debug_panel.js` の **Role Rate ×**（Tag / TitleKey / Title / Narr）。  
  - 実行系: `player.core.js` → `rateFor(role)` → `tts-voice-utils.getRateForRole(1.0, role)`。  
  - クランプは **常に 0.5–2.0**。既定は **1.4**（LS未設定時）。
- **Voice UI の統合**  
  - `Voice: [✓] Tag <select>  [✓] TitleKey <select> …` の一列配置。  
  - `Auto` は `__ttsUtils.pick(role)` に委任（安定ID: `voiceURI > lang|name > name`）。

---

## 3. `<script>` の読み込み順（必ずこの順）

```html
<!-- 1) エフェクト -->
<script src="./js/scene-effects.js" defer></script>
<!-- 2) TTSユーティリティ（プレイヤより先） -->
<script src="./js/tts-voice-utils.js" defer></script>
<!-- 3) プレイヤ中枢 -->
<script src="./js/player.core.js" defer></script>
<!-- 4) デバッグ設定（UI本体より先） -->
<script src="./js/debug_config.js" defer></script>
<!-- 5) デバッグUI本体 -->
<script src="./js/debug_panel.js" defer></script>
<!-- 6) 任意のガード -->
<script src="./js/global-zoom-guard.js" defer></script>

	•	debug_config.js 例（既定で基準レートUI非表示、役割別のみ）:

window.__dbgConfig = {
  collapsedDefault: true,
  sections: {
    status: true, note: false, controls: true, goto: true,
    ttsFlags: true, voices: true,
    baseRate: false
  },
  locks: { allowTTSFlagEdit: true, allowVoiceSelect: true },
  rolesRate: { min: 0.5, max: 2.0, step: 0.1, defaultAbs: 1.4 },
  rateMode: 'perRoleAbs'
};



⸻

4. iOS ローカル検証（Textastic × Working Copy × a-Shell）
	1.	編集: Textastic で Working Copy ▶︎ Repositories ▶︎ shorts-player-kit を直接編集。
	2.	サーバ: a-Shell を開いて:

cd ~/Documents/shorts-player-kit
python3 -m http.server 8080


	3.	再生: Safari で http://127.0.0.1:8080/index.html を開く（file:// は使わない）。
	4.	ループ: Textasticで保存 → Safariでリロード。初回は任意クリックでTTS解錠。

⸻

5. Working Copy（最新版 UI）— 日常運用
	•	Commit: 右上 Status → 変更確認 → COMMIT。
メッセージ例:
	•	feat(ui): unify voice row & role-rate defaults (0.5–2.0, 1.4)
	•	content(day6): refresh scenes.json; archive to content/Day6_20250830.json
	•	Apply Patch: リポ画面右上 … → Apply Patch → diff を貼付 → Apply → Commit。
	•	Branch:
	•	安定: main
	•	作業: feat/day7-shabbat / fix/tts-pick など
	•	終了: Merge into main（必要なら Fast-forward）

⸻

6. LocalStorage キー（実装で使用）
	•	役割別レート:
	•	dbg.tts.role.tag / dbg.tts.role.titleKey / dbg.tts.role.title / dbg.tts.role.narr
	•	折り畳み: dbg.panel.collapsed.v2
	•	互換（基準レートUI時のみ）: dbg.tts.rate

⸻

7. 次スレ開始チェックリスト
	•	scenes.json の テーマ（例：Day6/Day7）が明記されている
	•	debug_config.js → sections.baseRate=false（役割別のみの想定）
	•	Role Rate × の既定=1.4、範囲=0.5–2.0, step=0.1
	•	player.core.js に roleRate() は存在しない（rateFor() 統一）
	•	iOSは http 経由で検証（a-Shellの python3 -m http.server 8080）
	•	直近の台本は content/ に日付付きでアーカイブ済み

⸻

8. 既知の注意点
	•	TTSが鳴らない: 初回クリック未実行／TTSフラグ OFF／実質空行／iOSサイレント。
	•	Rate行が出てくる: debug_config.js の sections.baseRate を確認。
	•	音と待機がズレる: player.core.js が rateFor('narr') を使っているか確認（残存の独自クランプを排除）。

⸻

9. 次の一手（提案）
	•	**Day7（安息）**への差し替えブランチを作成：feat/day7-shabbat
	•	既存 Day6 を content/Day6_YYYYMMDD.json にアーカイブ → scenes.json を Day7 で上書き
	•	Voice固定マップの導入（再現性向上）：__ttsVoiceMap = { narr: "<stable-id>" }

⸻

Joy: 役割ごとに息を整え、物語は歩きます。🕯️

これで、次スレのAIは**最新の構成・規約・運用**を一目で把握できます。必要なら、この README に「現在の `scenes.json` のテーマ名」と「直近のコミット要約」を追記しておくと、さらに迷子になりません。
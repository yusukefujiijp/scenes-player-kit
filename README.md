scenes-player-kit（iOS-first）
https://yusukefujiijp.github.io/scenes-player-kit/

作成: 2025/10/19 → 最終更新: 2025/10/22
対象: iPhoneオンリー開発（Textastic / Working Copy / a-Shell など）
目的: 「就寝前に深い祈りへ導く」短編シーン再生を、小粒に編集 → 即再生確認 → そのまま録画/投稿できる最小構成で提供。

この README は “次スレの AI への遺言状” でもあります。
AI はスレッドごとに忘れても、台本とこの README が意図を保持し続けます。

Audio Harvest Contract: exporter / final audio / `scenes.json` / schema validation を触る前に、必ず `docs/audio-harvest-contract.md` を先に読む。

⸻

ハイライト（設計の柱）
	•	Activation Gate = page1（無音）
初回タップで音声権限を解錠。投稿用動画では page1 はカットし、実映像は page2 開始。
	•	二層TTS（表示と読みの分離）
表示: narr / 読み: narrTTS。タイトルも titleKeyTTS / titleTTS を採用。
既定ポリシー mode: "mirror"（表示と読みの意味一致）。誘導文を“読みだけに追加”はしない。
	•	句読点と拗音の最適化（iOS TTS 対策）
	•	読点 、 → 半角スペース2個（クリック音/ノイズ回避 + 呼吸の間）
	•	句点 。 → 必要時に全角スペースを後置し休止補強
	•	拗音 “にゅ/しゅ/ちゅ …” → カタカナ化（例: にゅ→ニュ） で不安定発音を緩和
これらは js/tts-sanitize.js が narr / titleKey / title 全ロールに適用
	•	Render Contract（v1.1）
HTML 構造は固定。見た目は style.css の単一起源。JS は状態遷移と属性付与のみ。
	•	静寂ゲート
文章を短チャンク化 → 読了後、静寂時間と余韻を待ってから進行（読飛び防止）。

⸻

クイックスタート（iPhone / ローカル）

# a-Shell (iOS)
cd ~/Documents/scenes-player-kit
python3 -m http.server 8080
# Safari → http://127.0.0.1:8080/

1分チェック
	1.	最初にタップしたか（無音の原因の9割は未解錠）
	2.	見た目は style.css のみ（index.html に  を置かない）
	3.	#content が min-height: 100dvh 相当を満たす（visualViewport 連携）
	4.	読みが飛ぶ → チャンク化 & 静寂ゲートが効いているか
	5.	誤読は *TTS 層で直す（辞書より最優先）

⸻

台本（scenes.json）ルール — 「スクリプトが覚えている」

仕様は台本に自己記述します。AI/人が交代しても意図が残ります。

	•	videoMeta.doc.rulesMd（またはトップレベル doc.rulesMd）に運用ルールを保存
	•	代表ルール（要約）:
	•	二層TTS: narr と narrTTS を分離。タイトル系は titleKeyTTS / titleTTS
	•	mirror 準拠: 読みは表示と意味一致（読みだけに文を足さない）
	•	句読点: 、→スペース2個 / 。→必要時に全角スペース付加
	•	拗音: “にゅ/しゅ/ちゅ …” を カタカナ拗音へ（例: どうにゅう→どうニュう）
	•	page1: アクティベーション専用（音声なし）。録画時はカット
	•	変更は *「まず rulesMd を更新 → TTS 修正 → どうしても必要ならコアに極小パッチ」
	•	videoMeta.doc.version を MAJOR.MINOR.PATCH で更新。理由も rulesMd に明記

例（rulesMd 抜粋）:
	•	“にゅ を ニュ へ内部変換（iOS TTS 安定化）”
	•	“読点を半角2スペースに置換（クリック音回避）”

⸻

ファイル構成（抜粋）

.
├── index.html
├── style.css
├── scenes.json                 # 台本（ルール自己記述）
└── js/
    ├── player-core.js          # 状態遷移 / 描画 / TTS / 自動進行
    ├── tts-sanitize.js         # 句読点・絵文字・拗音の整形（全ロール対応）
    ├── tts-voice-utils.js      # 音声選択・役割別レート
    └── scene-effects.js        # 軽量エフェクト

命名方針（教訓）: ドットよりダッシュ連結を採用（例: player-core.js）。
既存参照の置換は リポジトリ内検索で実施。
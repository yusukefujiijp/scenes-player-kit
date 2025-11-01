scenes-player-kit（iOS-first）
https://yusukefujiijp.github.io/scenes-player-kit/

作成: 2025/10/19 → 最終更新: 2025/10/22
対象: iPhoneオンリー開発（Textastic / Working Copy / a-Shell など）
目的: 「就寝前に深い祈りへ導く」短編シーン再生を、小粒に編集 → 即再生確認 → そのまま録画/投稿できる最小構成で提供。

この README は “次スレの AI への遺言状” でもあります。
AI はスレッドごとに忘れても、台本とこの README が意図を保持し続けます。

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

⸻

CI（最小 “Smoke”）
	•	Node.js 20 / acorn で 構文チェック（落ちたら赤止め）
	•	必須ファイルの 存在確認
	•	任意ファイル（js/tts-kv-simple.js / assets/tts-rules.json）があれば軽検証
	•	ワークフロー例: .github/workflows/smoke.yml

⸻

開発フロー（iPhone最適解）

シンプル派（推奨・今回の学びを踏まえた運用）
	•	main一本で進める（Working Copy から即 push）
	•	大きめ作業や実験のみ 短命ブランチを切って PR → squash merge
	•	事故回避に タグ を多めに打つ（例: 2025-10-22_ok-after-sync）

ブランチ派（共同編集が増えたら）
	•	既定ブランチは dev、dev → main は PR 必須
	•	main は 保護ルール（force-push禁止 / CI必須）
	•	巻き戻しは Revert PR を基本に（履歴保全）

⸻

GitHub を使う場合の iPhone 実務Tips
	•	Working Copy + PAT (classic)
.github/workflows/** を含む push は PAT に workflow スコープが必要。
認証: Username: <GitHub名> / Password: <PAT>（2FA でも可）
	•	追跡済みファイルを後から .gitignore に入れたい
→ git rm --cached -r <path> → commit → push（ローカル実体は消えない）

⸻

よくある落とし穴と対処（今回の“学び”要約）
	•	dev ⇄ main の同期で詰む
→ 最速解: main 一本で運用 + タグで保全。必要時のみ短命ブランチ + PR。
→ 安全策: main に保護ルール、PR に CI 必須、Revert PR で後戻り可能に。
	•	拗音「にゅ」系の発音崩れ
→ tts-sanitize.js のカタカナ拗音化を ON（にゅ→ニュ）
→ タイトルは特に崩れやすいので titleKeyTTS / titleTTS にも適用。
→ さらに A/B/C（にゅ / ニュウ / ニュー）でレート別の最短テスト文化を。
	•	読点の“ザップ音”
→ 読点は 半角スペース2個に置換。句点の後には全角空白で休止補強。

⸻

変更履歴（この README のリファクタリング要点）
	•	branch運用を「main一本＋短命ブランチ併用」へ再設計
理由: iPhone運用での衝突解消にかかる心理/時間コストを最小化
	•	ファイル命名: player.core.js → player-core.js を指針として明文化
理由: grep/置換の単純化、人的エラーの抑止
	•	台本にルールを同梱（videoMeta.doc.rulesMd またはトップレベル doc.rulesMd）
理由: AI スレッドの記憶に依存せず、台本が意図を永続化
	•	TTS整形の適用範囲を明記（本文＋タイトル系）
理由: 不具合の多発点（導入/見出し）の安定化
	•	CIは“Smoke”に限定
理由: iPhone 即時開発で落ちると困るチェックだけを自動化

⸻

次の一手（Move37）

短期（今日）
	•	scenes.json に doc.rulesMd を追記（mirror / 句読点 / 拗音化）
	•	page1 を 無音ゲート、page2 から録画本編
	•	titleKeyTTS / titleTTS を必ず入れる（特に導入）

中期（今週）
	•	CI（Smoke）を main push と手動実行に限定して安定化
	•	A/B/C + レートの極小台本を docs/tts-ab-kit.json として常備

長期（来月）
	•	新リポジトリ scenes-player へ移行（kit を卒業）
	•	目標: 台本ファイル1つで仕様/運用/実装方針まで自己完結

⸻

ライセンス / 著作権
	•	（必要に応じて記載）
	•	祈りのテキスト等、権利に配慮して運用してください。

⸻

最後に — 私がいなくなっても、台本が覚えています。
迷ったら doc.rulesMd を先に直す。それが“意図の単一情報源（SSOT）”です。
主の平安を。

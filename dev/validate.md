validate.md — 台本（scenes.json）の検証手順・運用ルール（完全版）

この文書は dev/validate.md として保管してください。
目的：壊れない台本を、人/AI/CI のどの経路でも確実に作れるようにすること。

⸻

0. なぜ検証（Validate）が必要か
	•	プレイヤは 完全スタティック なので、実行前にミスを潰すほど安心して出荷できる。
	•	我々は エフェクト純化（効果ページに文字を書かない）や Page1=Play-only 等の“契約”で安定を得ている。
スキーマとリンタで契約違反を前段で検出し、デバッグ時間を激減させる。
	•	AI生成ワークフローでも 事前にルールを機械に伝え, 違反を自動で赤線にするのが最短。

⸻

1. この文書で使うファイルと前提
	•	ルート直下：
	•	./scenes.json … 実行される台本（当日分）
	•	./schema.json … 構造と禁止事項を定義（このプロジェクト同梱の最新版）
	•	台本保管庫（実行はしない）：
	•	./content/dayX.json … 作り置きの台本（採用時に scenes.json へコピー）
	•	プレイヤ中枢：
	•	./js/player-core.js … Page1=Play-only / TTS / 効果呼出
	•	./js/scene-effects.js … 効果ユーティリティ（Promise）
	•	./js/debug_panel.js / ./js/debug_config.js / ./js/tts-voice-utils.js

✅ 重要：台本ファイルには $schema を必ず入れる（エディタで即赤線）

{
  "$schema": "./schema.json",
  // 以降、省略…
}



⸻

2. まず読む「黄金ルール」（絶対に守る）
	1.	Page-1 は Play ボタン専用
	•	{"page":"1","type":"placeholder"} のみ（UI表示以外の本文・効果・TTSを出さない）
	2.	効果（effect）ページは純化
	•	type:"effect" のとき title_key/title/symbol/narr を書かない
	•	許可キーは effect/effectRole/base/uiVersion/t 程度（スキーマが強制）
	3.	プロローグ / エピローグ は 通常コンテンツとして必須
	•	version:"A" or "B" にし、テキストありで書く（効果ページにしない）
	4.	Opening / Transition / Closing の3効果 は存在すること
	•	例：light-in（opening）→ fade-to-black（transition）→ flame-out（closing）
	5.	色（scene.base）は #RRGGBB 固定
	•	CSS側はベール（veil）だけ。背景色は JS が scene.base を直塗り
	6.	A/B 構造
	•	A: 雑学セクション。sectionTag: "#Trivia1" .. "#Trivia7" を必須
	•	B: 神学コア（至聖所）。sanctum:"holy_of_holies" 等を必須（スキーマが検査）

⸻

3. クイックチェック（1分版）
	•	scenes.json の先頭に "$schema":"./schema.json" があるか？
	•	Page-1 が placeholder か？
	•	効果ページに文字が混じっていないか？（title/symbol/narr が無いこと）
	•	Opening/Transition/Closing がそれぞれ1回以上あるか？
	•	Prologue/Epilogue（通常シーン）を含むか？
	•	base がすべて #RRGGBB か？
	•	A には #TriviaN が付いているか？ B は必須の思想フィールドがあるか？

⸻

4. 検証の3レイヤ

4.1 レイヤA：スキーマ検証（構造・禁止事項）
	•	方法A-1：エディタでの即時検証
	•	scenes.json 先頭に "$schema":"./schema.json" を入れる
	•	VSCode なら 赤線が出てすぐ分かる
	•	方法A-2：CLI (AJV) でのバッチ検証
	•	1回だけグローバル導入する場合：

npm i -g ajv-cli ajv-formats
ajv validate -s ./schema.json -d ./scenes.json --spec=draft7 --all-errors --errors=text


	•	プロジェクト同梱にする場合（推奨）：

npm init -y
npm i -D ajv ajv-cli ajv-formats
npx ajv validate -s ./schema.json -d ./scenes.json --spec=draft7 --all-errors


	•	複数台本を一括検証（保管庫も一緒に）：

npx ajv validate -s ./schema.json -d "./content/*.json" --all-errors



4.2 レイヤB：セマンティック・リンティング（スキーマでは書きづらい規約）

例：ページ番号の連番、Opening→A群→Transition→B群→Epilogue→Closing の大まかな順序など。

最低限チェックすべき項目（推奨）：
	•	ページ番号の単調増加（重複・飛び番の許容基準を定義。原則は昇順一意）
	•	Opening/Transition/Closing の順序（Opening は Page-1 の次、Closing は最後）
	•	Prologue/Epilogue が通常シーンであること（効果ページで書かない）
	•	A/B 最低件数（minA/minB を満たしているか）
	•	A の sectionTag が #TriviaN 形式（Nの重複は許容/非許容を選ぶ）
	•	効果ページに文字キーが1つも存在しないこと（保険の二重チェック）
	•	base の重複や極端な色（任意：運用方針に合わせる）

例：Node スニペット（dev/lint.js に保存して実行）

// dev/lint.js
const fs = require('fs');

function fail(msg){ console.error('✗', msg); process.exitCode = 1; }
function ok(msg){ console.log('✔', msg); }

const j = JSON.parse(fs.readFileSync('./scenes.json', 'utf8'));
const scenes = j.scenes || [];

let last = 0;
for (const s of scenes){
  const n = +s.page;
  if (!Number.isInteger(n) || n < 1) fail(`page が整数文字列でない: ${s.page}`);
  if (n < last) fail(`page が後退: ${last} -> ${n}`);
  last = n;

  if (s.type === 'effect'){
    // 文字キー混入の検出
    ['sectionTag','title_key','title','symbol','narr'].forEach(k=>{
      if (k in s) fail(`effectシーンに${k}が存在: page=${s.page}`);
    });
  }
}

const hasOpen = scenes.some(s => s.type==='effect' && s.effectRole==='opening');
const hasTrans= scenes.some(s => s.type==='effect' && s.effectRole==='transition');
const hasClose= scenes.some(s => s.type==='effect' && s.effectRole==='closing');
if (!hasOpen)  fail('opening エフェクトが無い');
if (!hasTrans) fail('transition エフェクトが無い');
if (!hasClose) fail('closing エフェクトが無い');

const content = scenes.filter(s => s.type!=='effect');
const pro = content.find(s => (s.title_key||'').includes('プロローグ'));
const epi = content.find(s => (s.title_key||'').includes('エピローグ'));
if (!pro) fail('プロローグが無い（通常シーンとして必要）');
if (!epi) fail('エピローグが無い（通常シーンとして必要）');

const aCount = content.filter(s => s.version==='A').length;
const bCount = content.filter(s => s.version==='B').length;
if (aCount < 3) fail(`Aが少ない (minA=3) 実数=${aCount}`);
if (bCount < 3) fail(`Bが少ない (minB=3) 実数=${bCount}`);

if (!process.exitCode) ok('Semantic lint OK');

実行：

node dev/lint.js

4.3 レイヤC：ランタイム・スモークテスト（本体で軽く動かす）
	1.	index.html をローカルで開く（または npx serve などの簡易HTTPでホスト）
	2.	Page-1に ▶︎ があり、クリックで Page-2（opening効果） に進むこと
	3.	Debugパネル（🐞）が最下段に固定されていること（折り畳みOK・GoTo表示OK）
	4.	効果ページでは文字が描かれない（純粋な演出のみ）
	5.	A/Bページで TTSが役割ごとに正しく切り替わる（Tag/TitleKey/Title/Narr）
	6.	Transition を挟んで B 群へ、最後に Epilogue → Closing へ終息
	7.	再生停止/再開、GoTo、Prev/Next が自然に動作する

⸻

5. 実用的なワークフロー（人 / AI / CI）

5.1 人が書く場合（おすすめ順）
	•	（推奨） scenes.json 開いたら先頭に "$schema":"./schema.json" を入れる
→ エディタが即バリデーションしてくれる
	•	保存前に クイックチェック（上の 3章）
	•	コミット前フック（任意）：ajv validate と node dev/lint.js を走らせる

5.2 AIに書かせる場合（テンプレの使い方）
	1.	dev/prompts/ に 台本テンプレ を用意（必須ルールを平易に明文化）
	•	「Page-1はPlay-only」「効果には文字を書かない」「Prologue/Epilogueは通常シーン」等
	2.	生成結果に 自動で $schema を挿入 させる
	3.	生成直後に AJV と lint.js を当てる（CIと同じコマンド）

ポイント：AIには**“効果ページはエフェクト専用”と“プロ/エピは通常シーン”を明示する。
さらに、“必ず $schema を先頭に書いて”もテンプレに入れると事故0に近づく**。

5.3 CI（GitHub Actions 例）

任意。あとで導入してもOK。壊れた台本はマージできない状態にするだけで品質が安定する。

# .github/workflows/validate.yml
name: Validate scenes
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm i -D ajv ajv-cli ajv-formats
      - run: npx ajv validate -s ./schema.json -d ./scenes.json --spec=draft7 --all-errors
      - run: node dev/lint.js


⸻

6. 失敗例とすぐ直せる対処（早見表）

症状 / エラー	原因	対処
type:"effect" なのにテキストが出る／ページが飛ぶ	効果ページに title / narr 等を書いている	効果ページは effect系キーだけにする（文字キー全削除）
▶︎押しても Page-3 から始まる	Page-2 が効果＋文字の混在／Page-1がplaceholderでない	Page-1をplaceholder、Page-2は opening効果のみに修正
Debugパネルが高い位置に出る	CSSで #debug-panel に position を与えている	位置は JSで fixed。CSSは safe-area の padding のみに戻す
TTSが全役割で同じになる	__ttsVoiceMap の更新が全ロールへ反映されている	デバッグUIの data-role ごとに 独立キー（tag/titleKey/title/narr）を保持
色が変わらない	CSS側で背景を上書き	背景は scene.base で JS が直塗り。CSSはベール/帯のみ
Bページでスキーマエラー	Bは sanctum/polemicAxis/doctrineTags>=2 必須	必須キーを追加、タグは2つ以上に


⸻

7. 追加のチェック（品質を一段上げる任意項目）
	•	effectDuration / t の統一感：opening/transition/closing の尺を揃える（±20%以内など）
	•	sectionTag の順序：#Trivia1 → #TriviaN が大きく前後していないか（演出意図が無ければ昇順推奨）
	•	文字量×TTS Rate：1シーンの実尺（TTS時間 + 間）を12–18秒のレンジに収める
	•	カラーパレット：A=ライト系、B/T=ダーク系の対比が明確か（CSSのベールと喧嘩しない色味）
	•	絵文字の視認：symbol は 1–3個が最も映える。多すぎると可読性が落ちる

⸻

8. 手順のテンプレ（毎回の運用の流れ）
	1.	content/dayX.json をベースに編集 → $schema 入りで保存
	2.	AJV：npx ajv validate -s ./schema.json -d ./content/dayX.json
	3.	Lint：node dev/lint.js（対象を差し替える/オプション化OK）
	4.	OKなら content/dayX.json を scenes.json にコピー（当日採用）
	5.	index.html を開き、スモークテスト（▶︎ → opening → A群 → transition → B群 → epilogue → closing）
	6.	問題なければ backup/日付/ に一式保存 → releases/日付/zip を作成（配布用）

⸻

9. 参考：最小テンプレ（手早く作る用）

{
  "$schema": "./schema.json",
  "//": "Page1=Play-only, Effect pages are textless, Prologue/Epilogue are content scenes.",
  "videoMeta": {
    "dossierId": "genesis-dayX-yyyymmdd",
    "creationTimestamp": "2025-01-01T00:00:00+09:00",
    "theme": "天地創造の第X日目",
    "triviaTitle": "第X日—テーマ副題",
    "thumbnailText": "【第X日】短い見出し",
    "bannerText": "短いバナー",
    "tts": { "lang": "ja-JP", "voicePreferences": ["Kyoko","Otoya"], "rate": 1.12, "readTitleKey": false }
  },
  "scenes": [
    { "page":"1", "type":"placeholder", "title":"(Play-only)" },
    { "page":"2", "type":"effect", "effect":"light-in", "effectRole":"opening", "base":"#c7f9cc", "uiVersion":"T" },

    { "page":"3", "version":"A", "title_key":"【プロローグ】", "title":"…", "symbol":"…", "base":"#d9f99d", "effect":"slide-up", "narr":"…\n…" },
    { "page":"4", "version":"A", "sectionTag":"#Trivia1", "title_key":"【…】", "title":"…", "symbol":"…", "base":"#fde68a", "effect":"slide-up", "narr":"…\n…" },
    { "page":"5", "version":"A", "sectionTag":"#Trivia2", "title_key":"【…】", "title":"…", "symbol":"…", "base":"#bbf7d0", "effect":"light-in", "narr":"…\n…" },

    { "page":"6", "type":"effect", "effect":"fade-to-black", "effectRole":"transition", "base":"#111827", "uiVersion":"T" },

    { "page":"7", "version":"B", "title_key":"【…】", "title":"…", "symbol":"…", "base":"#0f766e", "effect":"light-in", "narr":"…\n…", "sanctum":"holy_of_holies", "polemicAxis":"Hellenism_vs_Hebraism", "doctrineTags":["HolyOfHolies","CovenantCentered"] },
    { "page":"8", "version":"B", "title_key":"【エピローグ】", "title":"…", "symbol":"…", "base":"#1f2937", "effect":"light-in", "narr":"…\n…" },

    { "page":"9", "type":"effect", "effect":"flame-out", "effectRole":"closing", "base":"#0b132b", "uiVersion":"T" }
  ]
}


⸻

10. まとめ（総括と次への計画）
	•	構造（スキーマ）→ セマンティクス（リンタ）→ ランタイム（スモーク）の三段締めで、作者もAIも迷わない。
	•	効果ページ純化／Page1=Play-only／Prologue/Epilogue通常化 という3大原則が安定の鍵。
	•	次の拡張はいつでも：CI導入、プリコミット、自動生成スクリプト（content/→scenes.json コピー）など。

これで 「作る → すぐ赤線 → 直す → 一発で走る」 を恒常化できます。
Step-by-Step の勝ち筋を、毎回同じ道順で踏み固めましょう。

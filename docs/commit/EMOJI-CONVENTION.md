docs/commit/EMOJI-CONVENTION.md（完成版）

# コミット絵文字規約（Emoji + Conventional Commits）

本規約は、Conventional Commits v1.0.0 を基盤に、ヘッダ先頭へ 1 個の絵文字（半角スペース区切り）を許可する
運用ルールです。機械可読性は維持しつつ、人間にとっても視認性の高い履歴を目指します。

## 1. 目的
1. 履歴の可読性・検索性を高める（視覚的スキャンが容易）。
2. 自動化（リリースノート生成、CI 判定）との両立。
3. チーム内で意味が一意に通じる最小限の絵文字セットを定義。

## 2. 参照基準
- Conventional Commits 1.0.0（型・スコープ・破壊的変更の表現）  
- Gitmoji（絵文字→意味の対応表）  
- commitlint（規約違反の検出自動化）

## 3. 基本構文

 ()! : 


<body (optional)>
<BLANK LINE>
<footer (optional)>
```
- **emoji**: 先頭に 1 個だけ。直後に半角スペース。  
- **type**: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`  
- **scope**: 任意。`ui`, `debug`, `player.core` など。  
- **!**: 破壊的変更（BREAKING CHANGE）を示す感嘆符。  
- **subject**: 先頭を小文字、句点は付けない、50 文字以内が目安。  
- **body**: 「何をしたか」ではなく**【何故】（理由）**と設計判断を書く。72 桁で改行。  
- **footer**: `Resolves #123` など Issue 連携や注記。


4. 絵文字と type の対応（最小運用セット）

Gitmoji をベースに、まずは下記から開始（必要に応じて拡張可）。

	1.	✨ feat : 機能追加
	2.	🐛 fix  : バグ修正
	3.	📝 docs: ドキュメントのみ
	4.	🎨 style: フォーマット/見た目（ロジック非変更）
	5.	♻️ refactor: 挙動同じで内部改善
	6.	⚡ perf: パフォーマンス向上
	7.	✅ test: テスト追加・修正
	8.	🧱 build: ビルド関連（依存追加/設定）
	9.	⚙️ ci   : CI 設定・ワークフロー
	10.	🧹 chore: 雑務（依存更新、掃除）
	11.	⏪ revert: 取り消し

補助候補（任意採用）
🔒 セキュリティ関連 / 🚑 緊急修正 / 🔧 ユーティリティ / 🔍 ログ/可観測性 など

5. 例

良い例

✨ feat(player.core): allow emoji-prefixed headers in commitlint

【直訳】player.core: commitlint で絵文字先頭ヘッダを許可
【要約】Conventional Commits を維持しつつ、先頭絵文字 + 半角スペースを許容。
         解析は parserPreset.headerPattern を Unicode 絵文字対応に拡張。
【何故】可視性を高め、履歴スキャンを容易にするため。自動化との両立を維持。
【学習】絵文字は 1 個/ヘッダ先頭。subject は50字目安・句点なし。
【課題】gitmoji の拡張方針と CI での失敗ケース収集。

Resolves #123

悪い例

feat: ✨ add something          ← 絵文字の位置が後ろ
✨feat:missing space            ← 絵文字の直後に空白なし
✨ Feat: Capitalized Subject    ← type の大文字化、Subject の書式違反

6. Lint（commitlint）設定
	•	拡張：@commitlint/config-conventional
	•	先頭絵文字許可：parserPreset.parserOpts.headerPattern を上書き（Unicode 物性使用）

.commitlintrc.cjs

// docs 参照: https://commitlint.js.org/#/reference-rules
// 仕様: https://www.conventionalcommits.org/en/v1.0.0/
module.exports = {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      // optional leading emoji + space, then type(scope)!: subject
      headerPattern:
        /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})?\s)?(\w+)(?:$begin:math:text$([^)]+)$end:math:text$)?(!)?:\s(.+)$/u,
      headerCorrespondence: ['type', 'scope', 'breaking', 'subject']
    }
  },
  rules: {
    'type-enum': [
      2, 'always',
      ['feat','fix','docs','style','refactor','perf','test','build','ci','chore','revert']
    ],
    'subject-full-stop': [2, 'never', ['.']],
    'subject-case': [2, 'never', ['sentence-case','start-case','pascal-case','upper-case']],
    'header-max-length': [2, 'always', 72]
  }
};

代替案：:sparkles: などのショートコードを使う場合は
^(:\\w+:\\s)?(type...) という単純化も可能（ただし実絵文字より冗長）。

7. Git Hook（Husky）

# 1) dev 依存
npm i -D @commitlint/cli @commitlint/config-conventional husky

# 2) Husky 初期化
npx husky init

# 3) commit-msg フックに commitlint を紐づけ
#    (husky@9+ では .husky/commit-msg が生成される)
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'

8. 運用ルール（抜粋）
	1.	絵文字は 1 個だけ／ヘッダ先頭／直後は半角スペース。
	2.	subject は 50 文字以内、句点を付けない。
	3.	body は 【何故】（背景・設計判断・代替案）を中心に 72 桁改行。
	4.	破壊的変更は ! と BREAKING CHANGE: を併記。
	5.	Issue を閉じる場合は Resolves #<番号> を Footer に記載。

9. FAQ
	•	Q: 絵文字が解析を壊さない？
A: commitlint の headerPattern を拡張して先頭絵文字を無視して解析します。
	•	Q: 絵文字の意味は増やせる？
A: Gitmoji の表を参照し、type-enum と対にして順次採用できます。
	•	Q: 既存履歴との整合性は？
A: 規約導入後のコミットから適用。過去は再書換え不要。

10. 参考
	•	Conventional Commits v1.0.0（仕様）
	•	Gitmoji（意味付けガイド）
	•	commitlint（ルール/導入）

---

## .commitlintrc.cjs（単体スニペット：コピペ用）

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      headerPattern:
        /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})?\s)?(\w+)(?:\(([^)]+)\))?(!)?:\s(.+)$/u,
      headerCorrespondence: ['type','scope','breaking','subject']
    }
  },
  rules: {
    'type-enum': [2, 'always', ['feat','fix','docs','style','refactor','perf','test','build','ci','chore','revert']],
    'subject-full-stop': [2, 'never', ['.']],
    'subject-case': [2, 'never', ['sentence-case','start-case','pascal-case','upper-case']],
    'header-max-length': [2, 'always', 72]
  }
};

参考: Conventional Commits 仕様と commitlint のルール定義。 ￼

⸻

Husky 手順（単体スニペット：コピペ用）

npm i -D @commitlint/cli @commitlint/config-conventional husky
npx husky init
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'

参考: Husky 公式ドキュメント。 ￼

⸻

サンプル：コミット雛形（あなたの日本語様式）

✨ feat(debug): add emoji commit convention policy

【直訳】debug: 絵文字コミット規約のポリシーを追加
【要約】Conventional Commits を維持しつつ先頭絵文字を許可する社内規約を新設。commitlint
         の headerPattern を Unicode 絵文字対応に拡張し、Husky で事前検証を自動化
【何故】視認性向上と自動化の両立。人が履歴を速く読める一方で、型解析やリリース生成の
         機械可読性を損なわないため
【学習】絵文字は 1 個/先頭/半角スペース、subject は句点なし、body は 72 桁改行
【課題】拡張絵文字セットの選定と、CI 上の例外ケース（マージボット等）の扱い

Resolves #123


⸻

出典
	•	Conventional Commits 1.0.0（公式仕様）.
	•	Gitmoji（絵文字→意味ガイド）.
	•	commitlint ルール・設定（公式ドキュメント例）.  ￼
	•	Husky（Git フック導入）.  ￼

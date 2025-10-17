# shorts-player-kit — Project Entry

> **Purpose**: iOS（Textastic × Working Copy × a-Shell）で “短編プレイヤー” を小粒に日課化。  
> **Ops Principle**: **Move 37**（一歩先の工夫）を**毎日1フェーズ**。**小さく編集 → すぐPush → すぐ検証**。

---

## 📚 Documentation
- **Index（最初に読む）** → [`./docs/INDEX.md`](./docs/INDEX.md)
- **Schema** → [`./schema.json`](./schema.json)  
- **Current Script** → [`./scenes.json`](./scenes.json) / Archives → `./content/`

> ドキュメントは **INDEX 起点**で辿る前提に統一。新規ドキュメントを足すときは **INDEX に必ずリンク追加**。

---

## 🔎 Public Health (GitHub Pages)
1. **Live URL**: https://yusukefujiijp.github.io/shorts-player-kit/  
2. **Actions**: 最新 Run が **Success**（Deploy が緑）  
3. **Cards**: Facebook Debugger / X（Twitter）Card Validator で  
   `canonical / og:url / og:image / twitter:image` が **完全一致**

> ずれを見つけたら：`index.html` の `<link rel="canonical">` と `og:url` / `og:image` / `twitter:image` を修正 → Push。

---

## 🧪 Local Run（a-Shell）
```bash
# リポのルートへ移動（例：iCloud 配下なら適宜変更）
cd ~/Documents/shorts-player-kit

# サーバ起動
python3 -m http.server 8080

# 停止方法（iOS）
# 画面上部の「×」で a-Shell ウィンドウを閉じるか、キーボードがあれば Ctrl+C

Safari: http://127.0.0.1:8080/index.html を開く（file:// は禁止）

⸻

🧭 Minimal Folder Map

shorts-player-kit/
├─ assets/              # 画像・音源（og-image.png, favicon.svg/.ico など）
├─ content/             # 台本アーカイブ（DayX_YYYYMMDD.json）
├─ docs/                # ドキュメント（INDEX.md 起点）
│  └─ tools/            # a-Shell関連（policy / inventory など）
├─ js/                  # player.core.js / debug_panel.js / effects ほか
├─ releases/            # 配布物・タグ候補（任意）
├─ index.html           # エントリ（script 読み順は runtime契約に従う）
├─ scenes.json          # 現行台本
├─ schema.json          # スキーマ
└─ style.css


⸻

✍️ Commit Policy（超要約）
	•	Summary（英語1行）: <type>(<scope>)<!>: <imperative>（句点なし／目安≤50字／上限72字）
	•	Detail（日本語）先頭: 直訳行（英語Summaryの和訳）
	•	主要 type: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|deps
	•	Working Copy は空コミット不可 → Heartbeat は .meta/logs/.heartbeat.log に追記して差分を作る

テンプレ（コピペ用）:

Summary: <type>(<scope>)<!>: <imperative English summary>
Detail:
【直訳】<type和訳>(<scope>): <和訳Summary>
【要約】<1行で>
【理由】<課題/選定理由/代替案却下理由>
【学び・Nuance】<type意図/検証結果/再発防止>


⸻

🧩 Why this README (Refactoring Notes)
	•	入口の一本化：詳細は docs/INDEX.md に寄せ、README は“導線＋実務の最小集合”だけに限定。
	•	運用の即応性：公開ヘルス / ローカルRun / コミット規範の実務3点を上位に固定表示。
	•	巻き戻し容易化：構成と役割を明示し、ドキュメント追加・更新の変更点追跡を容易に。

© 2025 shorts-player-kit authors. All rights reserved.

---

## 変更点と理由（教師メモ）

1) **Docs 導線の一極化**  
   - 以前は README に説明が散在 → 迷子になりがち。  
   - **INDEX 起点**を明示し、README は“玄関”に特化。新規文書は INDEX に追加だけで迷子ゼロ。

2) **Public Health を上段固定**  
   - Pages 成否・カード整合は公開で最も壊れやすい箇所。**3チェック**を常設で事故削減。

3) **a-Shell ローカル手順を最短化**  
   - `http.server` 起動と**停止方法**を必ずセットで提示（iOSは Ctrl+C が効かない環境あり）。

4) **Commit 規範は“超要約＋テンプレ”**  
   - 詳細は AI-Commit Master に委譲。README では**日々の実務に必要な最小形**のみ。

5) **フォルダ地図は“役割”重視**  
   - どのファイルを触れば目的が達成されるかが直感で分かる粒度に整形。

---

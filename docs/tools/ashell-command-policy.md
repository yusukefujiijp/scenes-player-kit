a-Shell Command Policy v1.1（AI用・厳守）

1) 根拠（ソース・オブ・トゥルース）
	•	直近の docs/tools/ashell-command-inventory.md の 最新 Snapshot（あなたが貼ってくれた一覧）を正とする。
	•	AI はコマンド提案の前に、そのコマンド名が Snapshot に載っているかを前提に判断する（載ってないものは提案しない）。

2) 禁止・非推奨（この環境では提案しない）
	•	git（代わりに Working Copy を GUI クライアントとして使用）
	•	which（必要なら Python で代替：shutil.which()）
	•	printf（Python の print(...) で代替。echo で足りる場合は echo）
	•	nl（awk の '{print NR" "$0}' で代替）
	•	test / [ … ] での存在確認（Python の os.path で代替）
	•	長いヒアドキュメント（改行貼付け事故が多発するため）
	•	連結しまくったワンライナー（; や && 多用）
→ 1行ずつ実行できる形で提示する

3) 推奨（この順で選ぶ）
	•	最優先：Python（python3 -c か小スクリプト）
例：ファイル出力・整形・存在判定・環境確認など
	•	次点：シンプルなPOSIXコマンド（echo, cat, ls, cp, mv, sed, awk, grep, mkdir, pwd など）
	•	ファイル作成は echo >> か pico/nano/vim で手入力（自動インデントに注意）
	•	外部フォルダは pickFolder → bookmark <name> → cd ~<name> / jump <name>

4) コマンド提示スタイル（ミス減らしのための約束）
	•	すべて 1行ずつのコードブロックで提示（コピペ → Return で必ず完結）。
	•	生成物はすぐ確認コマンドも続けて提示（pwd, ls -al, cat など）。
	•	ファイル追記は 必ず >>、上書きが必要なら「上書きである」ことを明記して > を使う。
	•	編集系（pico/nano）は “保存・終了キー” を毎回明示。

5) 代表的な代替レシピ（最短メモ）
	•	which foo → Python で

python3 -c "import shutil,sys;print(shutil.which(sys.argv[1]) or 'NA')" foo


	•	nl file.txt → awk で

awk '{print NR\" \"$0}' file.txt


	•	存在確認（ファイル/ディレクトリ）

python3 -c "import os,sys; p=sys.argv[1]; print('OK' if os.path.exists(p) else 'NO')" path/to/thing



6) ヒアドキュメントを使わずにファイルを作る（安全版テンプレ）
	•	まず空行（区切り）を足して見やすく：

echo "" >> docs/tools/ashell-command-inventory.md


	•	見出しや小さな行は echo で積む：

echo "## Snapshot: $(date '+%Y-%m-%d %H:%M:%S %Z')" >> docs/tools/ashell-command-inventory.md


	•	中～長文は Python で一発書き：

python3 -c "open('docs/tools/sample.txt','w',encoding='utf-8').write('hello\\nworld\\n')"



7) a-Shell 固有機能の基本
	•	pickFolder → 任意フォルダを開く（iCloudや他アプリ領域を含む）
	•	bookmark <name> → 現在地にマーク
	•	showmarks → 登録を一覧
	•	cd ~<name> / jump <name> → マークへ移動
	•	help -l → 利用可能コマンド一覧（今回の Snapshot）
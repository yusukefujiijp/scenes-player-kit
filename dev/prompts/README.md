---
id: "ai_prompts-readme"
version: "2.0.0"
updated: "2025-08-24 JST"
scope: "ai_prompts"
---

# ai_prompts — **ブロック毎のCopy&Paste**を最重要原則にした運用基盤

1. **原則**  
   1.1 3Step固定: **1.ファイル名 → 2.操作 → 3.検索ワード**。  
   1.2 完全体アンカー: **直前行 / 署名行 / 直後行**の三位一体で**単一一致**を保証。  
   1.3 操作優先度: **replace-block ＞ insert-after ＞ replace-file**。  
   1.4 フェイルセーフ: 単一一致でない場合は**中止**（再アンカー定義）。  
   1.5 末尾規範: **NS-Core+Joy（1 loop）** を各応答末尾に添付。

2. **最短の使い方**  
   2.1 `blockmap.yml` を見て対象ブロックとアンカーを決定。  
   2.2 回答では **ブロック毎**に「完全体」を提示（貼付のみで反映可能）。  
   2.3 実行順序を厳密に守る（依存や読み込み順の破壊を防止）。

3. **雛形（回答フォーマット）**  

	1.	ファイル名: ${FILE_PATH}
	2.	操作: ${OPERATION}   # replace-block | insert-after | replace-file
	3.	検索ワード（完全体）
	•	直前行: ${PREV_LINE}
	•	本文先頭: ${ANCHOR_LINE}   # BlockID or 署名行（関数/コメント）
	•	直後行: ${NEXT_LINE}

置換後ブロック（前後1行を含む完全体で提示）

${PATCH_BLOCK}

検証
	•	期待: ${EXPECTED}
	•	実測: ${OBSERVED}（合格｜要修正）
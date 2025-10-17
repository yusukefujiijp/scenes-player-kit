---
id: "AI_PROMPT.context-safety-3step"
title: "文脈固定で安全編集（3Step: file→operation→search）"
version: "1.1.0"
updated: "2025-08-21 20:30 JST"
tags: ["context", "safety", "3step", "block-replace", "insert-after", "single-match"]
summary: "前後文脈をアンカーに単一一致でブロック/関数の置換・挿入を安全に行う最小手順。"
discipline:
  step_order: ["file", "operation", "search"]   # 1.ファイル名 → 2.操作 → 3.検索ワード
  op_priority: ["replace-block", "insert-after", "replace-file"]
  context_lines_min: 1                            # 少なくとも前後1行
  require_single_match: true
  case_sensitive: true

rationale:
  - "重名関数・入れ子・似た署名の誤爆対策として“完全体”（直前/署名/直後）でアンカーする。"
  - "BlockID（例: SK-BLOCK:...）と署名行を二重化。どちらかで破断してももう一方で同定。"

# AI_PROMPT — context-safety 3Step（Complete-Form Anchors）

1. ファイル名: ${FILE_PATH}
2. 操作: ${OPERATION}   # replace-block | insert-after | replace-file
3. 検索ワード（完全体）
   - 直前行: ${PREV_LINE}
   - 本文先頭: ${ANCHOR_LINE}
   - 直後行: ${NEXT_LINE}

### 置換後ブロック（前後1行を含む“完全体”で提示）
```diff
${PATCH_BLOCK}

検証
	•	期待: ${EXPECTED}
	•	実測: ${OBSERVED}（合格｜要修正）

⸻

NS-Core+Joy（1 loop）
	•	Propose: ${ONE_ACTION}
	•	Justify: ${VOI_OVER_COST}
	•	Min-Execute: 1) ${DESIGN} 2) ${GET} 3) ${APPLY}
	•	Verify: 期待=${KPI} / 実測=${VALUE}（合格|要修正）
	•	Record: Δ=${DELTA} / 教訓=${LESSON}
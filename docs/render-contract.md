Render Contract v1.0（ドキュメント化して固定）
	•	背景レイヤ：#bgColor（fixed／z-index:0／JSがbase色だけ塗る）
	•	テーマ：body.version-A|B|T（JSがSceneごとに付与）
	•	シーン表層：#content（JSが1回だけ生成）
	•	シーン塊：#content > .scene（毎ページ置換）
	•	要素（すべてクラスで表現。テキストはtextContentで安全に注入）
	•	.section-tag … #Tag … 表示
	•	.title_key … 【…】
	•	.title
	•	.symbol-bg > .symbol … 帯と絵文字（--symbol-bg-color をJSがセット）
	•	.narr … 改行は \n / \n\n（CSSは white-space:pre-line）
	•	プレースホルダ：Page-1は 純Play（本文なし）。
	•	エフェクト：type:"effect" は 本文なし、#contentは空に。
	•	禁止：CSSに !important は使わない（契約破りの温床）。
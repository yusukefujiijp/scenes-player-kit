# CHANGES — shorts-player-kit（CHANGES_20250821.md）
1. メタ情報
   1.1 **最終更新（手動）:** 2025-08-21 18:50 JST  
   1.2 **対象範囲:** ランタイム（HTML/CSS/JS）、デバッグパネル、TTS、ショートカット連携、運用ドキュメント  
   1.3 本ファイルは当日の「実装版ログ」。5行要約は `docs/CHANGES.min.md` に追記すること。

2. 2025-08-21 — Textastic安全域確立 & TTSエクスポート完成
   2.1 概要（What/Why）
       2.1.1 **What:** iOS Textastic での下端固定問題を**安全域（safe-area）+ visualViewport**で解決。TTSの**Note読みON/OFF**と**m4aエクスポート（現在/全体）**をデバッグパネルに実装。  
       2.1.2 **Why:** 実機（iPhone 16 Pro Max）で**中段固定化**・**UI切れ**が発生。録画と後聴き双方の運用を**安定二層化**（再生=Web Speech、保存=Shortcuts）するため。

3. 変更点（Changed / Added / Fixed / Removed）
   3.1 Changed
       3.1.1 **index.html** に安全域CSSを直書き（`viewport-fit=cover`を活かす設計へ）  
              3.1.1.1 `body` に `env(safe-area-inset-*)` を適用。  
              3.1.1.2 `#debug-panel` に `padding-bottom: env(safe-area-inset-bottom)` を付与。  
              3.1.1.3 `html, body, #app { touch-action: manipulation }` でダブルタップズーム抑止。  
       3.1.2 **debug_panel.js** を整理（ES5/自己完結）  
              3.1.2.1 折り畳みバー最小化・バー右端に `Toggle` 追加。  
              3.1.2.2 `visualViewport` で下端の**見かけの余白**を検出し `translateY(gap)` で追従。  
              3.1.2.3 幅切れ対策：固定配置＋左右マージン調整（実測で左右欠け解消）。  
       3.1.3 **挿入/置換のAIテンプレ**（指示用プロンプト）を短縮版・完全版の二系統で更新（ブロックID・直前直後行・3Step検索の原則を固定）。

   3.2 Added
       3.2.1 **TTSフラグ `readNote`** を追加（既定OFF）。デバッグパネル1列目に **Note** チェックを実装。  
       3.2.2 **Exportボタン** をデバッグパネルに追加  
              3.2.2.1 `🎙 Export m4a（現在）` … 現在シーンのみテキスト収集→Shortcutsで音声化保存。  
              3.2.2.2 `🎧 Export m4a（全体）` … 全シーン結合テキスト→同上。  
       3.2.3 **player-core.js API** 拡張  
              3.2.3.1 `collectCurrentText(flags)` と `collectAllText(flags)` を実装（Tag/TitleKey/Title/Narr/Noteの粒度制御）。  
              3.2.3.2 `runShortcutForText(text)` を実装（ショートカット名は `__ttsFlags.shortcutName`）。  
       3.2.4 **Note音声**：`speakScene()` に Note読上げ（末尾）を追加（`readNote`=true時のみ）。

   3.3 Fixed
       3.3.1 **Textastic下端固定バグ**：`env(safe-area-inset-*)` + `visualViewport`で**中段固定化**を解消。  
       3.3.2 **下がり過ぎ問題**：実測オフセット **+80px** により“ちょうど”の位置へ調整（安全域とホームバー状況の合算のため）。  
       3.3.3 **左右切れ**：固定配置と横幅計算を見直し、iOS実機で左右欠けを解消。  
       3.3.4 **Noteチェックのみで無音**：`readNote`有効時に `AI_Comment` を確実に読み上げるよう `speakScene()` を修正。  
       3.3.5 **m4aエクスポート**：現在/全体の**保存成功**を実機確認（拡張子.cafのケース含むが再生・変換とも問題なし）。

   3.4 Removed / Deprecated
       3.4.1 **パネルのBiasスライダー等の可視UI**は削除（実験で有効だったが本番ではノイズ）。内部は静的オフセットで保持。  
       3.4.2 **Siri/Hattori等の“非WebSpeech声”直選択UI**は撤去（Web Speech未公開声は列挙不能なため）。  
       3.4.3 **旧一括声選択UI**は実験フォルダへ退避（本線は日本語Web Speech列挙のみに限定）。

4. 実装差分（抜粋要約）
   4.1 **index.html**  
       4.1.1 `<meta name="viewport" content="... viewport-fit=cover">` の上で、`<style>` 内に `env(safe-area-inset-*)` を明示。  
       4.1.2 デバッグパネル直下配置を維持（`#debug-panel` は末尾、`debug_panel.js`→`player-core.js` の順に `defer`）。  
   4.2 **debug_panel.js**  
       4.2.1 `readNote` チェックを既定OFF。  
       4.2.2 `m4a（現在/全体）` ボタン追加。`__player.collect*Text()` → `__player.runShortcutForText()` 呼び出し。  
       4.2.3 `visualViewport` 追従・`translateZ(0)` で再描画安定化。  
   4.3 **player-core.js**  
       4.3.1 `collectCurrentText/collectAllText` 実装（Tag/TitleKey/Title/Narr/Noteの出力順は scene 表示順に準拠）。  
       4.3.2 `speakScene()` に Note読上げを追加（末尾、改行挿入）。  
       4.3.3 `runShortcutForText(text)` 実装（ショートカット名は `window.__ttsFlags.shortcutName`。規定値は `"Make Spoken Audio from Text"`）。

5. 検証（Verify）
   5.1 **初期描画**：A系の明色で不透明描画（背景透明化は未再現）。  
   5.2 **A/B/Tベール**：A=明薄、B/T=暗。`scene.base` が最終決定（CSSは雰囲気層のみ）。  
   5.3 **再生/停止**：`Play` で進行、`Stop` で確実停止。`Play` は**現在シーンから**開始。  
   5.4 **Note音声**：`Note` チェックON時、`AI_Comment` を末尾で読み上げ。  
   5.5 **エクスポート**：`現在/全体` の m4a 保存に成功（拡張子 .caf となる場合も再生・変換とも実用上問題なし）。  
   5.6 **Textastic/Safari**：Textasticで下端固定を実現。Safariは**わずかに上がる**が許容範囲。

6. 既知の注意点（Heads-up）
   6.1 **ショートカットは前面遷移**：iOS仕様上、録画と同時運用は不可。エクスポート専用として使う。  
   6.2 **MP3化**：Apple標準では不可。**a-Shell + LAME** のコミュニティ手法で実験を継続（別フォルダ推奨）。  
   6.3 **Web Speechの声**：端末に存在してもWeb Speechに露出しない声（例：Siri/Hattori）はUIに出せない。  
   6.4 **下端+80px**：機種/バー表示状態で最適値が変動し得る。`env(safe-area-inset-*)` と視覚確認で調整。

7. 運用・移行（次スレAIへの明示）
   7.1 **ロード順契約厳守**：`style.css → debug_panel.js → player-core.js`（ESM不使用）。  
   7.2 **背景権限**：背景は**JS最終決定**、CSSはベール/帯/文字のみ（`!important`で上書き禁止）。  
   7.3 **挿入/置換の原則**：**ブロックごと置換を優先**。3Step（ファイル名→検索ワード→相対位置）と**直前/直後行の完全体**で指示。  
   7.4 **ショートカット名**：`__ttsFlags.shortcutName` を参照（フォルダ名の固定は**不要**）。

8. NS-Core ログ（主要判断）
   8.1 **Propose:** 再生=Web Speech / 保存=m4a（標準） / MP3=実験（a-Shell）へ役割分離。  
   8.2 **Justify:** 画面遷移ゼロの同期性と、後聴き資産化を両立。将来の拡張（RSS/Podcast/MP3）も安全に増築。  
   8.3 **Min-Execute:** `index.html` へ安全域CSS追加、`debug_panel.js` に Export 2ボタンと `readNote`、`player-core.js` に収集APIを追加。  
   8.4 **Verify:** 実機で下端固定/左右欠け解消、Note音声、m4a保存（現在/全体）を確認。  
   8.5 **Record:** 本CHANGESに記録、`docs/CHANGES.min.md` に5行要約、`handshake.json` に“MP3は実験路線”を明記。

9. 5行要約（`docs/CHANGES.min.md` 追記用）
   9.1 Textastic下端固定を **safe-area + visualViewport** で確立（中段固定化を解消）。  
   9.2 デバッグパネルに **Note読み（既定OFF）** と **m4aエクスポート（現在/全体）** を実装。  
   9.3 `player-core.js` に **collect*Text / runShortcutForText** を追加し、保存系を確立。  
   9.4 **Siri/HattoriはWeb Speech未露出**のためUI列挙対象外。MP3化は **a-Shell+LAME** の実験路線へ。  
   9.5 **背景=JS最終決定 / !important禁止 / ロード順固定** を再確認し、安定運用を継続。
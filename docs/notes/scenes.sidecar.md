---
title: "scenes.sidecar — 根拠・検証メモ（shorts-player-kit）"
updated: "2025-08-21 22:15 JST"
artifact: "notes/scenes.sidecar.md"
relates_to:
  - "./scenes.json"
  - "./player-core.js"
  - "./style.css"
  - "./debug_panel.js"
ai_handshake: "./ai_handshake.json#scriptSource"
ai_handshake_version: "2.0"
schema:
  path: "./schema.json"
  min: "2.6.1"
ssot: "./scenes.json"
theme:
  A: "light"
  B: "dark"
  T: "dark"
background:
  authority: "player-core.js"
  property: "scene.base"
tts:
  defaults: { readTag: true, readTitleKey: true, readTitle: true, readNarr: true, readNote: false }
safe_area:
  note: "iOSは env() + visualViewport + bottom +80px で安定"
review:
  smoke_minutes: 3
license: "MIT (planned)"
---

# scenes.sidecar — 根拠・検証メモ

1. 目的と範囲  
   1.1 **目的**: `scenes.json` の構造・意図・検証結果を**言語化**し、実装変更なしで知識を継承する。  
   1.2 **範囲**: ランタイム**非依存**。背景決定権・A/B/Tの役割・TTS方針・落とし穴・検証手順を記録する。

2. 契約ミラー（必須条件）  
   2.1 **背景**: すべての *content* シーンが `base: "#RRGGBB"` を持つ（**空は禁止**）。  
   2.2 **A層**: `sectionTag` は `#Trivia[1..7]`（最大7想定、厳密強制ではない）。  
   2.3 **B層**: `sanctum="holy_of_holies"`, `polemicAxis="Hellenism_vs_Hebraism"`, `doctrineTags>=2`。  
   2.4 **effect**: `type="effect"`, `effectRole ∈ {opening, transition, closing}`。  
   2.5 **TTS既定**: Tag / TitleKey / Title / Narr = ON, Note = OFF（DPで切替）。

3. 背景決定とA/B/T  
   3.1 **最終決定者**: `player-core.js` が `scene.base` を `#bgColor` と `body` へ**直塗り**。  
   3.2 **CSSの責務**: **ベール/帯/文字のみ**（`!important` や `background` ショートハンドで上書きしない）。  
   3.3 **テーマ**: `body.version-{A|B|T}`（A=明薄、B/T=暗）で雰囲気層を切替。**背景本体は base**。

4. Scene Map（day6 構成の概要）  
   4.1 **表は“構成の骨格”のみ固定**。文言は脚本変更で可動。

   | Page | Kind       | Tag/Role       | 期待背景 | メモ |
   |-----:|------------|----------------|----------|------|
   | 1    | effect     | opening        | 明系     | light-in 開幕 |
   | 2–8  | A × 7      | #Trivia1..7    | 明系     | 導入の雑学層 |
   | 9    | effect     | transition     | 暗系     | fade-to-black |
   | 10–15| B × 6      | holy_of_holies | 暗系     | 神学・関係性 |
   | 16   | effect     | closing        | 暗/暖    | flame-out 余韻 |

5. 根拠（抄）  
   5.1 **SSoT**: 視覚の根拠は `scenes.json` の `base`。  
   5.2 **安全ガード**: CSSで `#bgColor` を上書きしない（透明化の主因）。  
   5.3 **同期**: TTS不可でも**擬似ウェイト**で演出リズムを維持。

6. iOS/モバイル実測メモ（Textastic/Safari）  
   6.1 **meta**: `viewport-fit=cover` 必須。  
   6.2 **CSS**: `body` と `#debug-panel` に `env(safe-area-inset-*)`。  
   6.3 **JS**: `visualViewport` 追従＋**+80px**平行移動で DP 下端を安定化（Textastic の下端誤認対策）。

7. 既知の落とし穴（Pitfalls）  
   7.1 `#bgColor` を `!important` や `background` ショートハンドで上書き → **透明化**。  
   7.2 ロード順崩れ（`style.css → debug_panel.js → player-core.js`）→ 背景決定負け。  
   7.3 `base` 未指定 → フォールバックに落ちるが**原則禁止**（意図が曖昧）。  
   7.4 キャッシュ汚染 → **ハードリロード**で検証。

8. スモーク（≈3分）  
   8.1 初期表示で**明系**が出る。  
   8.2 `Goto: 10` で B に遷移し**暗ベール**が乗る。  
   8.3 Note（`AI_Comment`）が DP 最上段に表示され続ける。  
   8.4 `Stop` で音声・効果が即停止、先頭で **▶︎** が復帰。

9. NS-Core ログ（追記式）  
   9.1 **2025-08-20 10:00 — day6骨格の固定**  
       9.1.1 Propose: A(7)→effect→B(6)→effect。  
       9.1.2 Justify: 再現性ある流れを次スレへ。  
       9.1.3 Min-Execute: 文言最小、構成のみ確定。  
       9.1.4 Verify: 2/10/16 へ `Goto`、想定通り。  
       9.1.5 Record: 透明化は未再現、規律を脚注へ。

10. 差分レビューのコツ  
    10.1 **順序・件数・種別** → **base** → **文言**の順に確認。  
    10.2 B では神学的強度を高め、A は軽快に。迷いは `AI_Comment` に残す。
---
title: "AI-New Era: player.sidecar — 設計と運用（shorts-player-kit）"
updated: "2025-08-21 21:05 JST"
artifact: "notes/player.sidecar.md"
relates_to:
  - "./player-core.js"
  - "./style.css"
  - "./debug_panel.js"
  - "./scenes.json"
ai_handshake: "./ai_handshake.json#runtimeContract"
ai_handshake_version: "2.0"
load_order: ["./style.css","./debug_panel.js","./player-core.js"]
safe_area:
  viewport_fit_cover: true
  visual_viewport_follow: true
  extra_bottom_px: 80
tts:
  default_lang: "ja-JP"
  flags_default: { readTag: true, readTitleKey: true, readTitle: true, readNarr: true, readNote: false }
export:
  m4a_scene: true
  m4a_all: true
  mp3_experimental: true
repentance:
  - "2025-08-21: Textasticでの可視下端誤認をenv()+visualViewport+80pxで解消。教訓を文書化。"
risk_register:
  - id: r-bg-override
    desc: "#bgColor の背景が !important / background ショートハンドで上書きされる"
    mitigation: "CSSで禁止、JSが直塗りで最終決定、ai_handshake.jsonで契約化"
license: "MIT (planned)"
---

# AI-New Era: player.sidecar — 設計と運用

1. 目的と適用範囲  
   1.1 **目的:** `player-core.js` の設計判断・既知の落とし穴・運用規範を**言語化**し、スレ移行時の認識齟齬を防ぐ。  
   1.2 **適用:** ランタイム非依存のドキュメント。人とAIの両読者が対象。

2. 役割分担（Runtime Contract 要約）  
   2.1 **Player（JS）最終決定:** `scene.base` を `#bgColor` と `body` に**直塗り**（`setBackdropFromBase(hex, themeHint)`）。  
   2.2 **CSSの責務限定:** ベール/帯/文字のみ。`#bgColor` の `background-color` を **!important/ショートハンドで上書きしない**。  
   2.3 **Debug Panelの非干渉:** 背景・ロード順に影響しない**UI支援限定**。  
   2.4 **ロード順:** `style.css` → `debug_panel.js` → `player-core.js`（ESM不使用）。  
   2.5 **台本 SSoT:** `scenes.json`（`base` は空にしない。schemaで検出）。

3. レンダリング / テーマ / 効果  
   3.1 **テーマ:** `body.version-{A|B|T}` のクラスでベール切替（A=明薄、B/T=暗）。**背景本体は base**。  
   3.2 **描画:** `renderScene(i)` は `sectionTag → title_key → title → symbol-band → narr` を組み立て。  
   3.3 **効果:** `playEffectIfAny(scene)` で簡易エフェクト（light-in / fade-to-black / flame-out）。**base も同時に塗る**。

4. TTS（Web Speech）  
   4.1 **粒度フラグ:** `window.__ttsFlags = { readTag, readTitleKey, readTitle, readNarr, readNote:false }`。  
   4.2 **読み順:** Tag → TitleKey → Title → Narr（空行は短ポーズ）。`#Trivia N` → 「トリビア N」に正規化。  
   4.3 **Note読み:** `readNote` が true かつ `scene.AI_Comment` があれば末尾で読上げ。  
   4.4 **フォールバック:** 音声不可でも**擬似ウェイト**でリズムを維持。  
   4.5 **ボイス選択:** **列挙される日本語音声のみ**をUI提示（Siri/Hattori等はWeb Speech非列挙のため直接選択不可）。

5. Export（音声書き出し）  
   5.1 **現在/全体:** DP から **現在シーン**／**全シーン**のテキストを Shortcuts へ渡し m4a 生成。  
   5.2 **拡張子:** `.m4a` / `.caf` のいずれも発生しうる（後工程で統一可能）。  
   5.3 **前面遷移:** iOSの仕様上 Shortcuts は前面遷移。**録画とは両立不可**（録画時はWeb Speechを使用）。  
   5.4 **実験的mp3:** a-Shell + LAME による mp3 化は**実験扱い**（運用ログに明記）。

6. 背景透明化の再発防止（チェックリスト）  
   6.1 **CSS禁止:** `#bgColor` を `!important` や `background` ショートハンドで上書きしない。  
   6.2 **JS直塗り:** `setBackdropFromBase` が**常に**最終決定。  
   6.3 **ロード順厳守:** `style.css` → `debug_panel.js` → `player-core.js`。  
   6.4 **キャッシュ:** 修正時は**ハードリロード**で検証。  
   6.5 **schema:** 最初のcontentシーン `base` 欠落は**lintエラー**にする（将来ルール）。

7. `__player` API（外部コントロール契約）  
   7.1 **最小集合:**  
   ```js
   window.__player = {
     next(), prev(), goto(i), restart(),
     play(), stop(),
     info() => ({ index, total, playing }),
     getScene(i?) => scene | null
   }
7.2 Export補助（実装分岐）:
// Exportブランチで提供される場合がある
collectCurrentText(flags) => string
collectAllText(flags) => string
runShortcutForText(text) => void
   7.3 仕様注意: goto(i) は 0-based。DP入力は 1-based → 渡すとき i-1。

8. パフォーマンス指針  
   8.1 DOM再構築はシーン切替時のみ。  
   8.2 CSSトランジションは ≤1.5s を目安。  
   8.3 低性能端末は prefers-reduced-motion に配慮（将来フラグ）。

9. デバッグの型（即応パターン）  
   9.1 観測: __player.info() → __player.getScene()。  
   9.2 停止: __player.stop()（エフェクトDOM除去／TTSキャンセル／breath停止）。  
   9.3 同期: TTS不在でも擬似ウェイトで視覚と歩調を合わせる。

10. Safe-Area / Textastic 対応（実測知見）  
    10.1 HTML: viewport-fit=cover。  
    10.2 CSS: env(safe-area-inset-*) を body と #debug-panel に適用。  
    10.3 JS: visualViewport で可視下端追従＋**+80px平行移動**。  
    10.4 Safari差: 数 px の浮きは仕様として許容（デザインで吸収）。

11. コード接点（3Stepナビ）  
    11.1 操作: 置換（推奨）／挿入／削除を明記。  
    11.2 ファイル: player-core.js / debug_panel.js / style.css。  
    11.3 検索ワード:  
        - 11.3.1 Player背景直塗り → function setBackdropFromBase(（直前に isValidHex6）  
        - 11.3.2 TTS読上げ順 → async function speakScene(（readNote 分岐付近）  
        - 11.3.3 Export送出 → runShortcutForText（Exportブランチ）  
        - 11.3.4 DP追従オフセット → attachVisualViewportPin（visualViewport）  
        - 11.3.5 CSS禁止事項 → #bgColor / !important を検索し存在しないことを確認

12. 既知の落とし穴  
    12.1 Playの開始位置誤実装: 常に1ページ目から → 現在ページから再生に修正済。  
    12.2 DPの干渉: オーバーレイが▶︎を塞ぐ → クリック領域設計で回避（現行はクリア）。  
    12.3 初回音声許諾: iOS Safariで初回タップが必要。  
    12.4 Shortcuts前面遷移: 録画とは設計上相容れない（用途分離）。

13. NS-Core ログ（追記式）  
    13.1 2025-08-20 10:00 — 再生開始位置の仕様明確化  
        13.1.1 Propose: play() は現在シーンから。  
        13.1.2 Justify: 任意ページ検証を高速化。  
        13.1.3 Min-Execute: goto(0) を除去。  
        13.1.4 Verify: Goto: 8 → Play で 8 から開始。  
        13.1.5 Record: DP説明と整合。  
    13.2 2025-08-21 18:30 — Textastic下端誤認の恒久対応  
        13.2.1 Propose: env()＋visualViewport＋**+80px** 平行移動。  
        13.2.2 Justify: 実機で再現・効果確認。  
        13.2.3 Min-Execute: CSSとJSに最小追記。  
        13.2.4 Verify: DPが沈まず操作可能、Safariのわずかな浮きは許容。  
        13.2.5 Record: ai_handshake.json と CHANGES_20250821.md に記録。

14. 付録：QAチェック短縮版  
    14.1 初期描画が明色不透明。  
    14.2 ▶︎ が押せ、DPが下端に追従。  
    14.3 A/B/Tでベールが適切に変化。  
    14.4 TTSトグル（Tag/TitleKey/Title/Narr/Note）反映。  
    14.5 Export（現在/全体）がm4aを生成。  
    14.6 背景透明化が再現しない。
---

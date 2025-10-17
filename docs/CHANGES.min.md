---
project: shorts-player-kit
role: "ミニCHANGEログ（Append-only）"
policy:
  append_only: true
  bullets_per_day: "3-10"
updated_jst: "2025-08-21T19:10:00+09:00"
index_dates: ["2025-08-19","2025-08-20","2025-08-21"]
---

CHANGES.min (Append-only) — shorts-player-kit

Updated: 2025-08-21 19:10 JST

## 2025-08-19
- 透明化の根因特定：CSS `!important` 撤去／JS直塗り回復
- テーマ層単純化（A明薄/B,T暗）＋`--symbol-bg-color`
- TTS粒度（Tag/TitleKey/Title/Narr）＋「#Trivia→トリビア」
- DP最小版（開始ボタン非干渉／Note最上段）
- 文書運用確立（README/CHANGES/handshake）＋NS-Core

## 2025-08-20
- 名称統一→**shorts-player-kit**／台本はSSoT（scenes.json）
- 背景は**JS最終決定**／CSSはベールのみ（`!important`禁止）
- 読込順固定：`style.css → debug_panel.js → player.core.js`
- DP：Play=現在位置、Stop=確実停止、TTS4役既定ON
- `schema v2.6.1`更新／第六日に刷新／E2E確認

## 2025-08-21
- Textastic下端固定を **safe-area + visualViewport + 実測+80px** で解消
- DP：**Note読み(既定OFF)**・**m4a Export（現在/全体）** 実装
- player.core.js：`collect*Text`/`runShortcutForText`／Note読上げ統合
- Shortcuts：既定 `"Make Spoken Audio from Text"`（フォルダ固定不要）／MP3はa-Shell+LAME（実験）
- UI安定化：左右切れ解消／Safariの軽微ズレは許容／`touch-action: manipulation`
- 指示テンプレ更新：**ブロック置換優先**＋3Step＋直前/直後行の完全体
- 制約：Shortcutsは前面遷移（録画同時不可）／Web Speechは同期再生用
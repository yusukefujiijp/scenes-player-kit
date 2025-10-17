了解！ルートの README を、“表札＋目次”は維持しつつ、今回の到達点（Activation Gate／visualViewport／Render Contract v1.1）へリンクする最小だけど迷わない版に刷新しました。コピー用にそのまま貼れる完全版をどうぞ。

# shorts-player-kit (iOS-first)

短編プレイヤーの**最小デモ**。iOS（Textastic × Working Copy × a-Shell）だけで、**小粒に編集 → すぐ Push → すぐ検証**。  
本リポジトリは **Activation Gate**／**visualViewport 連携**／**Render Contract v1.1** を核に、TTS 読了優先の体験を提供します。

- **Live**: https://yusukefujiijp.github.io/shorts-player-kit/
- **Docs**: see [`docs/`](./docs)
  - [Playbook](./docs/README.playbook.md) — 日々の運用ガイド（Heartbeat 含む）
  - [Commits](./docs/COMMITS.md) — Conventional Commits + 日本語 Detail 規範
  - [Pages](./docs/PAGES.md) — GitHub Pages（Actions）手順
  - [Assets](./docs/ASSETS.md) — OG 画像 / Twitter カード / Favicon
  - [a-Shell](./docs/ASHELL.md) — iCloud パス & ワンライナー集

---

## What’s inside（最重要だけ）
- **Activation Gate**：初回タップで TTS/Audio を解錠（Safari の自動再生要件を単一ジェスチャで満たす）
- **Render Contract v1.1**：HTML 構造は固定、見た目は `style.css` が単一ソース、JS は状態遷移と属性付与のみ
- **visualViewport × dvh × safe-area**：オンスクリーンキーボードや UI の出入りでも“潜らない下端”
- **TTS 読了保証**：句点で分割 → 再生 → “静寂ゲート”で読了確認 → `postDelayMs` → 次シーン

> 仕様詳細は `js/` の README を参照 → [`js/README.md`](./js/README.md)

---

## Quick Start（local on iOS）
```bash
# a-Shell
cd ~/Documents/shorts-player-kit
python3 -m http.server 8080
# Safari → http://127.0.0.1:8080/


⸻

One-minute checklist（詰まったら）
	1.	初回タップした？ 画面上のゲートを必ずタップ（無音失敗の典型は未解錠）
	2.	index.html に  を置かない（見た目は style.css だけ）
	3.	#wrapper/#content が min-height: var(--visual-viewport-h, 100dvh) を読むか
	4.	Debug Panel の高さフィード（--debug-panel-h）が本文 padding-bottom に伝搬しているか
	5.	長文の“飛ばし”：player.core.js のチャンク化＋静寂ゲートが有効か

⸻

Repo map（抜粋）

.
├── index.html              # HTML 素体（<style> 禁止）
├── style.css               # 見た目の単一ソース（Render Contract v1.1）
├── js/
│   ├── player.core.js      # 状態機械・描画・TTS・遷移
│   ├── tts-voice-utils.js  # 声カタログ + 役割別・絶対レート
│   ├── scene-effects.js    # 軽量エフェクト
│   ├── debug_panel.js      # UI 状態（見た目は CSS 側）
│   └── viewport_handler.js # visualViewport → CSS 変数供給
└── docs/ …                 # 運用ドキュメント一式


⸻

Contributing（コミット規範）
	•	Conventional Commits を採用（例：feat: … / fix: … / refactor: … / chore: …）
	•	日本語の Detail は 1 行空けて本文に。例：

feat(player): add activation gate and quiet-wait

iOS Safari の自動再生要件を満たすため、初回タップで TTS/Audio を解錠…



この README は表札と目次です。運用の長文は docs/、実装規範は js/README.md に集約。

## Authoring Tips (Tags)
- `sectionTags` に一本化（配列）。**推奨 3 個**。
- 1 行に収まらない分は UI では非表示だが、TTS は **先頭 3 個**

必要に応じて、トップ README にバッジ（CI/Pages 状態など）や “デモ動画へのリンク” を追記できますが、**長文は `docs/`/`js/README.md` に寄せる**流儀はそのまま維持しました。
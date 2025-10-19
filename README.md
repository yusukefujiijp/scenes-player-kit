# scenes-player-kit (iOS-first)
作成日時: 2025/10/19 13:30

短編／場面（scenes）再生の**最小デモ**。iOS（Textastic × Working Copy × a-Shell）だけで  
**小粒に編集 → すぐ Push → すぐ検証**。  
本リポジトリは **Activation Gate**／**visualViewport 連携**／**Render Contract v1.1** を核に、TTS 読了優先の体験を提供します。

- **Live**: (任意) https://yusukefujiijp.github.io/scenes-player-kit/
- **Docs**: see [`docs/`](./docs)
  - [Playbook](./docs/README.playbook.md) — 日々の運用（Heartbeat ほか）
  - [Commits](./docs/COMMITS.md) — Conventional Commits 規範
  - [Pages](./docs/PAGES.md) — GitHub Pages（Actions）手順
  - [Assets](./docs/ASSETS.md) — OG 画像 / Favicon
  - [TTS Dictionary](./docs/TTS-DICTIONARY.md) — 読み修正ルール（辞書運用）
  - [Dev Flow](./docs/OPERATING-AGREEMENT.md) — 二車線（dev/main）運用の憲法

---

## What’s inside（最重要だけ）
- **Activation Gate**：初回タップ1回で TTS/Audio を解錠（Safari の自動再生要件を満たす）
- **Render Contract v1.1**：HTML 構造は固定、見た目は `style.css` の単一起源、JS は状態遷移と属性付与のみ
- **visualViewport × dvh × safe-area**：キーボード／UI出入りでも**下端を潜らない**
- **TTS 読了保証**：句点分割 → 再生 → **静寂ゲート**で読了確認 → `postDelayMs` → 次シーン
- **Page indicator（WIP）**：デバッグパネルが閉じていても **`2/20`** 等で現在位置を可視化

> 実装詳細は `js/` の README → [`js/README.md`](./js/README.md)

---

## Quick Start（Local, iOS / Desktop）
```bash
# a-Shell (iOS)
cd ~/Documents/scenes-player-kit
python3 -m http.server 8080
# Safari → http://127.0.0.1:8080/

# Desktop (任意)
python3 -m http.server 8080
# or: npx serve .
```

**One-minute checklist（詰まったら）**
1. 初回タップしたか？（無音の典型は Activation 未解錠）
2. `index.html` に `<style>` を置かない（見た目は `style.css` のみ＝Render Contract）
3. `#wrapper/#content` が `min-height: var(--visual-viewport-h, 100dvh)` を読んでいるか
4. Debug Panel の高さ変数 `--debug-panel-h` が本文 `padding-bottom` に伝搬しているか
5. 長文の飛ばし：`player.core.js` のチャンク化＋静寂ゲートが有効か
6. 誤読（例：「一日」を「ついたち」）は **TTS-DICTIONARY.md** の置換ルールで対処

---

## Development Flow（二車線の最小）
- 既定ブランチは **`dev`**。日常はここに直コミット。
- **`dev → main`** は PR 経由。Auto-merge 有効、マージ後は head ブランチ自動削除。
- 戻す時は **Revert PR**（履歴を壊さず安全に巻き戻す）。

---

## Repo map（抜粋）
```
.
├── index.html              # HTML 素体（<style> 禁止）
├── style.css               # 見た目の単一ソース（Render Contract v1.1）
├── js/
│   ├── player.core.js      # 状態機械・描画・TTS・遷移
│   ├── tts-voice-utils.js  # 声カタログ + 役割別・絶対レート
│   ├── scene-effects.js    # 軽量エフェクト
│   ├── debug_panel.js      # UI 状態（見た目は CSS 側）
│   └── viewport_handler.js # visualViewport → CSS 変数供給
└── docs/ …                 # 運用ドキュメント（上記リンク参照）
```

---

## Authoring Tips (Tags)
- `sectionTags` に一本化（配列）。**推奨3個**。
- 1 行に収まらない分は UI では省略されても、TTS は **先頭3個** を読む設計。

---

## Contributing（コミット規範）
- Conventional Commits：`feat: …` / `fix: …` / `refactor: …` / `chore: …`
- 日本語の Detail は 1 行空けて本文へ。例：
```
feat(player): add activation gate and quiet-wait

iOS Safari の自動再生要件を満たすため、初回タップで TTS/Audio を解錠…
```

> この README は**表札と最小目次**です。長文は `docs/`、実装規範は `js/README.md` に集約します。

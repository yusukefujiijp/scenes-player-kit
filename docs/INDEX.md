# 📚 Documentation Index

> プロジェクトの“迷わない導線”。最初にここを見るだけでOK。

## Quick Links
- プロジェクトのトップ: [README](../README.md)
- a-Shell コマンド方針: [Command Policy](tools/ashell-command-policy.md)
- a-Shell コマンド一覧（help -l 由来）: [Command Inventory](tools/ashell-command-inventory.md)

## 目的別
- **セットアップ**: Working Copy / Textastic / a-Shell 連携の最短手順（README 冒頭）
- **Pages 公開**: `.github/workflows/static.yml`／README の Pages 節
- **台本**: `scenes.json`（現行）／`content/`（過去アーカイブ）
- **スキーマ**: [schema.json](../schema.json)

## 運用メモ
- “長文貼り付け事故”を避けるため、Heredoc ではなく Python/echo で作成。
- Git 操作は CLI ではなく **Working Copy** を使用（本リポ方針）。

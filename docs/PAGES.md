# GitHub Pages（Actions デプロイ）

## 方針
- **Source**: GitHub **Actions** を使う（現行方式）。
- ワークフローは **リポ直下を配信**（`path: '.'`）。HTML/静的のみ。

## 設定手順（1回だけ）
1. GitHub → **Settings → Pages** → Source: **GitHub Actions** を選択。
2. `.github/workflows/static.yml` を作成し、下記を保存 → Push。

### `.github/workflows/static.yml`
```yaml
name: Deploy static content to Pages
on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

## 検証
- Actions の最新 Run が緑 **Success**、`Deploy to GitHub Pages` も緑。  
- 公開URL：`https://yusukefujiijp.github.io/shorts-player-kit/`

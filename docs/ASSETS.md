# Assets — OG/Twitter/Favicon

## OG / Twitter（同一URLに統一）
- `og:type=website`、`og:url` は公開URL、`og:image` は 1200×630 目安（横長）。
- `twitter:card=summary_large_image`、`twitter:image` は **og:image と同一URL** に。

### `<head>` 最小例
```html
<link rel="canonical" href="https://yusukefujiijp.github.io/shorts-player-kit/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="shorts-player-kit">
<meta property="og:title" content="shorts-player-kit | 短編プレイヤーのデモ">
<meta property="og:description" content="iOSでも軽快に動く短編プレイヤーの実験プロジェクト。">
<meta property="og:url" content="https://yusukefujiijp.github.io/shorts-player-kit/">
<meta property="og:image" content="https://yusukefujiijp.github.io/shorts-player-kit/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="shorts-player-kit | 短編プレイヤーのデモ">
<meta name="twitter:description" content="iOSでも軽快に動く短編プレイヤーの実験プロジェクト。">
<meta name="twitter:image" content="https://yusukefujiijp.github.io/shorts-player-kit/assets/og-image.png">
<link rel="icon" href="./assets/favicon.svg">
```

## ファビコン（SVG推奨）
- SVG をメインに、レガシー環境向けに `.ico` 併用可（`<link rel="icon">`）。

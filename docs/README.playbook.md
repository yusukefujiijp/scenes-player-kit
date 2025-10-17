# Playbook — AI-New Era（日課化のための最小手順）

- **原則**: 小さく編集 → すぐ Push → すぐ検証（Move37 = 一歩先の最小工夫）
- **装置**: iOS の Textastic（編集）× Working Copy（Git）× a‑Shell（サーバ/補助）

## Heartbeat（空コミット代替）
- 「今日は触った」を**ログに刻む**ことで、Working Copy の空コミット不可を回避。
- ログは Git 管理対象：`.meta/logs/.heartbeat.log`（リポに含めるため**非除外**）

### ワンライナー（a‑Shell）
```bash
python3 - <<'PY'
from datetime import datetime, timezone, timedelta; import os, pathlib
root = pathlib.Path.cwd()
log = root/".meta"/"logs"/".heartbeat.log"
log.parent.mkdir(parents=True, exist_ok=True)
jst = timezone(timedelta(hours=9))
stamp = datetime.now(jst).strftime("%Y-%m-%d %H:%M:%S %z")
with log.open("a", encoding="utf-8") as f: f.write(f"{stamp} touched\n")
print("[OK] heartbeat:", log)
PY
```

## デイリー最小チェック
1) Pages の公開URLに 200/表示OK  
2) `assets/og-image.png` とメタタグの整合（`og:image == twitter:image`）  
3) 変更が無くても Heartbeat を 1 行追記 → Commit/Push

## よくある詰まり（超短答）
- **404** → `index.html` がリポ直下か / Actions の成果物パスが `'.'` か。  
- **OG/Twitter プレビューが古い** → Facebook Debugger の再スクレイプ / X(Twitter) Card 再検証。

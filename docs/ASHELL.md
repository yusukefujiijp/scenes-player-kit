# a‑Shell — iCloud Path & One-liners

## iCloud 直下の実体パスへ（定番）
```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs"
pwd && ls -al
```

## 共有サンドボックス（3アプリ共有）
```bash
mkdir -p "shorts-lab/labsync-test" && cd "$_"
date > FROM_aShell.txt && echo "Hello from a-Shell" >> FROM_aShell.txt
```

## 簡易サーバ（ローカル検証）
```bash
cd ~/Documents/shorts-player-kit
python3 -m http.server 8080
# Safari → http://127.0.0.1:8080/index.html
```

> a‑Shell は iOS のターミナル。`help` / `help -l` で内蔵コマンド一覧、`.profile/.bashrc` は `~/Documents/` に置く。

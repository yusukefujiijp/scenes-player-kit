#!/usr/bin/env python3
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))

def repo_root() -> Path:
    # このスクリプトが scripts/ にある前提で 1つ上がリポ直下
    return Path(__file__).resolve().parent.parent

def main() -> None:
    root = repo_root()
    log = root / "meta" / "logs" / "heartbeat.log"  # ← ドット無し
    log.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(JST).strftime("%Y-%m-%d %H:%M:%S %z")
    with log.open("a", encoding="utf-8") as f:
        f.write(f"{stamp} touched\n")
    print(f"[OK] wrote heartbeat: {log.relative_to(root)}")

if __name__ == "__main__":
    main()
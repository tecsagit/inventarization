"""Restore synced task localStorage into Chrome after Chrome is fully closed."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".chrome-sync-profile" / "Default" / "Local Storage" / "leveldb"
TARGET = Path(
    r"C:\Users\Tecsa-user\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb"
)


def main() -> int:
    if not SOURCE.exists():
        print("Run scripts/sync-tasks-browser.py first.")
        return 1

    if (TARGET / "LOCK").exists():
        print("Close Google Chrome completely, then run this script again.")
        return 1

    for item in SOURCE.iterdir():
        if item.name == "LOCK":
            continue
        if item.is_file():
            shutil.copy2(item, TARGET / item.name)

    print(f"Restored task localStorage into {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

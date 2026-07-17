"""Recover task planner data from Chromium localStorage and merge into one JSON file."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from ccl_chromium_reader import ccl_chromium_localstorage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tasks-recovered.json"

TASK_KEYS = {
    "company-inventory-tasks-v1",
    "focus-todolist-v2",
    "focus-todolist-v1",
}

PROFILE_PATHS = [
    Path(r"C:\Users\Tecsa-user\AppData\Local\Microsoft\Edge\User Data\Default\Local Storage\leveldb"),
    Path(r"C:\Users\Tecsa-user\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb"),
]


def task_score(todo: dict) -> int:
    score = 0
    for key in ("notes", "contact", "deadline", "completedAt", "createdAt"):
        if todo.get(key):
            score += 1
    if todo.get("done"):
        score += 1
    return score


def merge_tasks(sources: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for src in sources:
        for todo in src["tasks"]:
            todo_id = todo.get("id")
            if not todo_id:
                continue
            prev = merged.get(todo_id)
            if not prev or task_score(todo) >= task_score(prev):
                merged[todo_id] = todo
    return sorted(merged.values(), key=lambda item: item.get("createdAt") or 0, reverse=True)


def read_profile(path: Path) -> list[dict]:
    if not path.exists():
        return []

    store = ccl_chromium_localstorage.LocalStoreDb(path)
    found: list[dict] = []

    try:
        for host in store.iter_storage_keys():
            for record in store.iter_records_for_storage_key(host):
                if record.script_key not in TASK_KEYS:
                    continue
                if not record.is_live or not record.value:
                    continue
                try:
                    data = json.loads(record.value)
                except json.JSONDecodeError:
                    continue
                if not isinstance(data, list) or not data:
                    continue
                found.append(
                    {
                        "profile": path.parent.parent.name,
                        "host": host,
                        "key": record.script_key,
                        "tasks": data,
                    }
                )
    finally:
        store.close()

    return found


def main() -> int:
    sources: list[dict] = []
    for profile_path in PROFILE_PATHS:
        sources.extend(read_profile(profile_path))

    if not sources:
        print("No task records found in browser profiles.")
        return 1

    for src in sources:
        print(
            f"{src['profile']} | {src['host']} | {src['key']} | {len(src['tasks'])} tasks"
        )
        for todo in src["tasks"]:
            print(f"  - {todo.get('text', '')}")

    merged = merge_tasks(sources)
    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nMerged {len(merged)} tasks -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Write merged tasks into Chrome localStorage for inventarization.onrender.com."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TASKS_FILE = ROOT / "tasks-recovered.json"
SITE_URL = "https://inventarization.onrender.com/"
CHROME_USER_DATA = Path(
    r"C:\Users\Tecsa-user\AppData\Local\Google\Chrome\User Data"
)
TEMP_USER_DATA = ROOT / ".chrome-sync-profile"


def main() -> int:
    if not TASKS_FILE.exists():
        print(f"Missing {TASKS_FILE}. Run scripts/recover-tasks.py first.")
        return 1

    merged = json.loads(TASKS_FILE.read_text(encoding="utf-8"))
    if not isinstance(merged, list):
        print("Invalid tasks-recovered.json")
        return 1

    print(f"Syncing {len(merged)} tasks to {SITE_URL}")

    if TEMP_USER_DATA.exists():
        shutil.rmtree(TEMP_USER_DATA, ignore_errors=True)
    TEMP_USER_DATA.mkdir(parents=True, exist_ok=True)

    source_default = CHROME_USER_DATA / "Default"
    target_default = TEMP_USER_DATA / "Default"
    target_default.mkdir(parents=True, exist_ok=True)

    for name in ("Cookies", "Preferences"):
        src = source_default / name
        dst = target_default / name
        if src.is_dir():
            shutil.copytree(src, dst, dirs_exist_ok=True)
        elif src.is_file():
            shutil.copy2(src, dst)

    source_ls = source_default / "Local Storage" / "leveldb"
    target_ls = target_default / "Local Storage" / "leveldb"
    target_ls.mkdir(parents=True, exist_ok=True)
    if source_ls.exists():
        for item in source_ls.iterdir():
            if item.name == "LOCK":
                continue
            dst = target_ls / item.name
            if item.is_file():
                shutil.copy2(item, dst)

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(TEMP_USER_DATA),
            channel="chrome",
            headless=False,
            args=["--profile-directory=Default"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(SITE_URL, wait_until="domcontentloaded", timeout=120_000)
        page.wait_for_timeout(2000)

        result = page.evaluate(
            """(incoming) => {
              const STORAGE_KEY = "company-inventory-tasks-v1";
              const LEGACY_KEYS = ["focus-todolist-v2", "focus-todolist-v1"];

              const normalize = (todo) => ({
                id: todo.id || Date.now().toString(36),
                text: todo.text || "",
                notes: typeof todo.notes === "string" ? todo.notes : "",
                contact: typeof todo.contact === "string" ? todo.contact : "",
                done: Boolean(todo.done),
                createdAt: todo.createdAt || Date.now(),
                completedAt: todo.completedAt ?? (todo.done ? (todo.createdAt || Date.now()) : null),
                deadline: todo.deadline ?? null,
                paused: Boolean(todo.paused),
                pauseRemainingMs: todo.pauseRemainingMs ?? null,
                notifiedSoon: Boolean(todo.notifiedSoon),
                notifiedOverdue: Boolean(todo.notifiedOverdue),
              });

              const score = (todo) => {
                let s = 0;
                for (const key of ["notes", "contact", "deadline", "completedAt", "createdAt"]) {
                  if (todo[key]) s += 1;
                }
                if (todo.done) s += 1;
                return s;
              };

              const map = new Map();
              const readKey = (key) => {
                const raw = localStorage.getItem(key);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) return;
                parsed.map(normalize).forEach((todo) => {
                  const prev = map.get(todo.id);
                  if (!prev || score(todo) >= score(prev)) map.set(todo.id, todo);
                });
              };

              readKey(STORAGE_KEY);
              LEGACY_KEYS.forEach(readKey);
              incoming.map(normalize).forEach((todo) => {
                const prev = map.get(todo.id);
                if (!prev || score(todo) >= score(prev)) map.set(todo.id, todo);
              });

              const before = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").length;
              const finalList = [...map.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
              localStorage.setItem(STORAGE_KEY, JSON.stringify(finalList));
              LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
              localStorage.setItem("company-inventory-tasks-recovered-synced", "1");
              return { before, after: finalList.length, tasks: finalList.map((t) => t.text) };
            }""",
            merged,
        )

        print(f"Before: {result['before']} | After: {result['after']}")
        for text in result["tasks"]:
            print(f"  - {text}")

        page.goto(f"{SITE_URL}#tasks", wait_until="domcontentloaded", timeout=120_000)
        page.wait_for_timeout(2000)
        context.close()

    print("Done. Close Chrome completely, then run scripts/restore-tasks-leveldb.py if needed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import json
import sys
from pathlib import Path

from ccl_chromium_reader import ccl_chromium_localstorage

EDGE_LS = Path(
    r"C:\Users\Tecsa-user\AppData\Local\Microsoft\Edge\User Data\Default\Local Storage\leveldb"
)
OUT = Path(__file__).resolve().parents[1] / "local-recovered.json"


def count_warehouse_igor(items):
    return len(
        [
            item
            for item in items
            if not item.get("employeeId") and item.get("site") == "Ігорівська"
        ]
    )


def main():
    store = ccl_chromium_localstorage.LocalStoreDb(EDGE_LS)
    best = None
    best_key = None

    for host in store.iter_storage_keys():
        if "file" not in host.lower() and "inventory" not in host.lower() and "tecsa" not in host.lower():
            continue
        print("host:", host)
        for record in store.iter_records_for_storage_key(host):
            if record.script_key != "company-inventory-v1":
                continue
            if not record.is_live or not record.value:
                continue
            try:
                obj = json.loads(record.value)
            except json.JSONDecodeError:
                print("  invalid json for", record.script_key)
                continue
            items = obj.get("items", [])
            wh_igor = count_warehouse_igor(items)
            print(
                " ",
                record.script_key,
                "employees",
                len(obj.get("employees", [])),
                "items",
                len(items),
                "wh igor",
                wh_igor,
            )
            if best is None or len(items) > len(best.get("items", [])):
                best = obj
                best_key = host

    store.close()

    if not best:
        print("No company-inventory-v1 record found. Listing all script keys with inventory in name:")
        store = ccl_chromium_localstorage.LocalStoreDb(EDGE_LS)
        for host in store.iter_storage_keys():
            for record in store.iter_all_records():
                if "inventory" in record.script_key:
                    print(host, record.script_key, "live", record.is_live, "value_len", len(record.value or ""))
        store.close()
        raise SystemExit(1)

    OUT.write_text(json.dumps(best, ensure_ascii=False, indent=2), encoding="utf-8")
    print("saved", OUT, "from", best_key)
    print("warehouse Igorivska", count_warehouse_igor(best["items"]))


if __name__ == "__main__":
    main()

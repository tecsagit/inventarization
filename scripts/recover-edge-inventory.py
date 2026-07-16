# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import shutil
from pathlib import Path

SRC = Path(
    r"C:\Users\Tecsa-user\AppData\Local\Microsoft\Edge\User Data\Default\Local Storage\leveldb"
)
WORK = Path(__file__).resolve().parents[1]
OUT = WORK / "local-recovery.json"

needle = b'{\x00"\x00e\x00m\x00p\x00l\x00o\x00y\x00e\x00e\x00s\x00"\x00'
best = None
report: list[str] = []

for src_name in ["000260.log", "000262.ldb", "000005.ldb"]:
    src = SRC / src_name
    if not src.exists():
        continue
    tmp = WORK / f"_copy_{src_name}"
    shutil.copy2(src, tmp)
    data = tmp.read_bytes()
    start = data.find(needle)
    if start < 0:
        report.append(f"{src_name}: no employees marker")
        continue

    meta = data.find(b"META:file://", start)
    chunk = data[start : meta if meta >= 0 else len(data)]
    last = chunk.rfind(b"}\x00")
    if last < 0:
        report.append(f"{src_name}: no closing brace")
        continue

    blob = chunk[: last + 2]
    if len(blob) % 2:
        blob = blob[:-1]
    text = blob.decode("utf-16le", errors="surrogatepass")
    report.append(
        f"{src_name}: text={len(text)} open={text.count('{')} close={text.count('}')}"
    )

    for fix in ("", "}", "}}", "]}", "]}", "]}}", "]}]}"):
        try:
            obj = json.loads(text + fix)
        except json.JSONDecodeError as error:
            report.append(f"  {fix!r}: {error}")
            continue
        if not isinstance(obj.get("items"), list):
            continue
        warehouse_igor = [
            item
            for item in obj["items"]
            if not item.get("employeeId") and item.get("site") == "Ігорівська"
        ]
        report.append(
            f"  OK {fix!r}: items={len(obj['items'])} wh={len(warehouse_igor)}"
        )
        if best is None or len(obj["items"]) > len(best["items"]):
            best = obj
        break

(WORK / "recovery-report.txt").write_text("\n".join(report), encoding="utf-8")
if not best:
    raise SystemExit("Recovery failed")

OUT.write_text(json.dumps(best, ensure_ascii=False, indent=2), encoding="utf-8")
print("\n".join(report))
print("saved", OUT)

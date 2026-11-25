"""store.json 持久化层：线程锁、原子写、快照与启动清理。

内存里的 mem 是唯一真相；落盘只经 _persist()（临时文件 + os.replace），
快照按 uid 节流保留 HISTORY_KEEP 份，启动时再收口一次历史遗留文件。
"""
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

from .config import DATA_DIR, HISTORY_DIR, HISTORY_GAP, HISTORY_KEEP, STORE

_lock = threading.Lock()


def _load() -> dict[str, Any]:
    try:
        with STORE.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            raise ValueError("store 格式错误")
        return {
            "users": raw["users"] if isinstance(raw.get("users"), dict) else {},
            "ideas": raw["ideas"] if isinstance(raw.get("ideas"), list) else [],
        }
    except (OSError, ValueError, json.JSONDecodeError):
        return {"users": {}, "ideas": []}


mem = _load()


def _persist() -> None:
    """临时文件 + os.replace 原子替换，避免写出半个 JSON。"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STORE.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(mem, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STORE)


def _snapshot(uid: str, rec: dict) -> None:
    """写入前留一份快照。按时间窗节流，超出保留份数就删最旧的。"""
    if not rec or not isinstance(rec.get("state"), dict):
        return
    try:
        HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        files = sorted(HISTORY_DIR.glob(f"{uid}-*.json"))
        last = 0
        if files:
            try:
                last = int(files[-1].stem.split("-")[-1])
            except ValueError:
                last = 0
        now = int(rec.get("serverTime") or time.time() * 1000)
        if files and now - last < HISTORY_GAP:
            return
        name = f"{uid}-{now}.json"
        tmp = HISTORY_DIR / (name + ".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False)
        os.replace(tmp, HISTORY_DIR / name)
        for old in sorted(HISTORY_DIR.glob(f"{uid}-*.json"))[:-HISTORY_KEEP]:
            old.unlink(missing_ok=True)
    except OSError:
        pass


def _prune_history() -> None:
    """启动时按 uid 清理超限快照。

    _snapshot 里的删除与写入在同一次调用内完成，进程中途退出会留下超额文件；
    历史遗留的目录（曾因保存自循环堆过 70+ 份）也需要一次性收口。
    """
    try:
        HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        by_uid: dict[str, list[Path]] = {}
        for p in HISTORY_DIR.glob("*-*.json"):
            by_uid.setdefault(p.stem.rsplit("-", 1)[0], []).append(p)
        for files in by_uid.values():
            for old in sorted(files)[:-HISTORY_KEEP]:
                old.unlink(missing_ok=True)
    except OSError:
        pass


_prune_history()

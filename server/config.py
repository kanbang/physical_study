"""唯一配置源：路径、体积上限、通用正则与文本清洗。"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent   # 项目根（app.py 所在目录）
DATA_DIR = ROOT / "data"
STORE = DATA_DIR / "store.json"
AI_CFG = DATA_DIR / "ai_config.json"
DIST = ROOT / "frontend" / "dist"          # Vue3 + Vite 构建产物
HISTORY_DIR = DATA_DIR / "history"         # 学习数据快照目录（误删/误改可回滚）

MAX_BODY = 512 * 1024        # 请求体上限
MAX_STATE = 256 * 1024       # 单用户学习数据上限
MAX_IDEAS = 200              # 猜想墙保留条数
HISTORY_KEEP = 20            # 每个用户保留份数
HISTORY_GAP = 10 * 60 * 1000 # 两次快照的最小间隔（10 分钟）

UID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
BASE_URL_RE = re.compile(r"^https?://[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$")
CTRL_RE = re.compile(r"[\x00-\x1f\x7f]")


def clean_text(v: Any, maxlen: int) -> str:
    return CTRL_RE.sub(" ", str(v if v is not None else "")).strip()[:maxlen]

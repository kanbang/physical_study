"""卡片层：白名单校验、截断 JSON 修复、代码块剥离。

AI 的输出永远只是候选数据：字段与长度在这里收敛，不合法一律丢弃，绝不"猜一个值"。
"""
from __future__ import annotations

import json
import re
from typing import Any

from .config import clean_text

DOMAINS = ["力学", "电磁", "热学", "光学", "近代", "方法"]
REALMS = ["光学", "力学", "热学", "电磁", "近代", "宇宙", "日常", "科学方法", "脑洞"]
DOMAIN_KW = {
    "力学": "力 速度 加速度 斜面 摩擦 弹簧 碰撞 撞 动量 能量 功 杆 圆周 摆 抛 上升 下降 重量 重力 万有引力 卫星 引力".split(),
    "电磁": "电 电阻 电压 电流 磁 感应 电荷 电容 电路 安培 欧姆 线圈 导轨 洛伦兹 电场 库仑".split(),
    "热学": "热 温度 气 压强 熵 内能 分子 比热 绝热 等温 等压 循环 卡诺 蒸发 沸腾".split(),
    "光学": "光 反射 折射 镜 透镜 波长 干涉 衍射 偏振 折射率 影 颜色 蓝天 彩虹".split(),
    "近代": "原子 量子 光电 相对论 核 质能 电子能级 半衰期 衰变 光子".split(),
    "方法": "量纲 极限 近似 估算 对称 守恒 微元 图像 参考系".split(),
}


def _guess_domain(text: str) -> str:
    best, score = "力学", 0
    for dom, kws in DOMAIN_KW.items():
        n = sum(1 for kw in kws if kw in text)
        if n > score:
            best, score = dom, n
    return best


def _txt(v: Any, maxlen: int) -> str:
    return clean_text(v, maxlen)


def _lines(v: Any, max_items: int, maxlen: int) -> list[str]:
    if not isinstance(v, list):
        return []
    out = []
    for x in v[:max_items]:
        s = _txt(x, maxlen)
        if s:
            out.append(s)
    return out


def validate_card(c: Any) -> dict | None:
    """白名单式校验：字段与长度全部收敛，未知字段丢弃；不合法返回 None。"""
    if not isinstance(c, dict):
        return None
    kind = c.get("kind")
    if kind == "problem":
        p = c.get("problem") if isinstance(c.get("problem"), dict) else {}
        answers = []
        for a in (p.get("answers") if isinstance(p.get("answers"), list) else [])[:4]:
            if not isinstance(a, dict):
                continue
            label = _txt(a.get("label"), 40)
            unit = _txt(a.get("unit"), 16) or "—"
            try:
                value = float(a.get("value"))
            except (TypeError, ValueError):
                continue  # 数值不合法就丢，绝不保留编造的答案
            tol = a.get("tol", 0.01)
            try:
                tol = min(0.5, max(1e-6, abs(float(tol))))
            except (TypeError, ValueError):
                tol = 0.01
            if label and isfinite(value):
                answers.append({"label": label, "value": value, "unit": unit, "tol": tol})
        return {
            "kind": "problem",
            "summary": _txt(c.get("summary"), 120),
            "problem": {
                "title": _txt(p.get("title"), 60) or "未命名题目",
                "level": p.get("level") if p.get("level") in ("初中", "高中") else "高中",
                "dom": p.get("dom") if p.get("dom") in DOMAINS else _guess_domain(_txt(p.get("text"), 4000)),
                "model": _txt(p.get("model"), 8) if _txt(p.get("model"), 8) in {"m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12"} else "",
                "text": _txt(p.get("text"), 900),
                "hints": _lines(p.get("hints"), 6, 160),
                "answers": answers,
                "solution": _lines(p.get("solution"), 8, 300),
                "trap": _txt(p.get("trap"), 220),
            },
        }
    if kind == "wonder":
        w = c.get("wonder") if isinstance(c.get("wonder"), dict) else {}
        return {
            "kind": "wonder",
            "summary": _txt(c.get("summary"), 120),
            "wonder": {
                "title": _txt(w.get("title"), 60) or "未命名奇妙",
                "realm": w.get("realm") if w.get("realm") in REALMS else "日常",
                "level": w.get("level") if w.get("level") in ("入门", "进阶", "脑洞") else "入门",
                "hook": _txt(w.get("hook"), 220),
                "think": _lines(w.get("think"), 5, 160),
                "reveal": _txt(w.get("reveal"), 700),
                "formula": _txt(w.get("formula"), 140),
                "tryIt": _txt(w.get("tryIt"), 320),
                "deeper": _txt(w.get("deeper"), 320),
                # 只保留真实存在的知识点 id（k1..k20，与 frontend/src/data/topics.js 对齐），避免悬空引用
                "topics": [t for t in (w.get("topics") if isinstance(w.get("topics"), list) else [])[:8]
                           if re.fullmatch(r"k(?:[1-9]|1[0-9]|20)", str(t))],
            },
        }
    return None


def _open_stack(s: str) -> list[str] | None:
    """返回补齐所需的右括号栈；引号不闭合或括号错配时返回 None。"""
    stack: list[str] = []
    in_str = esc = False
    for ch in s:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]":
            if not stack or stack.pop() != ch:
                return None
    return None if in_str else stack


def repair_json(s: str) -> dict | None:
    """修复被 max_tokens 截断的 JSON：从末尾往回退到可补全的位置。"""
    s = s.strip()
    if not s:
        return None
    if s.startswith("{") and s.rstrip().endswith("}"):
        try:
            v = json.loads(s)
            return v if isinstance(v, dict) else None
        except ValueError:
            pass
    for cut in range(len(s) - 1, 0, -1):
        if s[cut] not in "}]\"":
            continue
        stack = _open_stack(s[: cut + 1])
        if stack is None:
            continue
        try:
            v = json.loads(s[: cut + 1] + "".join(reversed(stack)))
        except ValueError:
            continue
        if isinstance(v, dict) and v.get("kind"):
            return v
    return None


def split_card(content: str) -> tuple[str, dict | None]:
    """剥离 ```json 卡片，返回 (纯文本回复, 校验后的卡片)。

    无论卡片解析成功与否，代码块都从文字里删掉 —— 不然半截 JSON 会直接糊到学生脸上。
    """
    text, card_raw, span = content, None, None
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if m:
        span, body = m.span(), m.group(1).strip()
    else:
        m2 = re.search(r"```(?:json)?\s*([\s\S]*)$", content)   # 未闭合：多半是被截断
        if m2:
            span, body = m2.span(), m2.group(1).strip()
    if span:
        try:
            card_raw = json.loads(body)
        except (ValueError, json.JSONDecodeError):
            card_raw = repair_json(body)
        text = (content[: span[0]] + content[span[1]:]).strip()
    card = validate_card(card_raw) if card_raw is not None else None
    if span and card is None:
        text = text or "（这次没整理出完整卡片，可以再说一次题目，或把条件补全一点。）"
    return text or "（AI 没有给出文字说明，请直接看下方卡片草稿。）", card


def isfinite(v: float) -> bool:
    return v == v and v not in (float("inf"), float("-inf"))

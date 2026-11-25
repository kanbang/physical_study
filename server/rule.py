"""本地规则降级：未接入在线 AI 或调用失败时，只做归类与骨架，不编造数值答案。"""
from __future__ import annotations

import json
import re

from .cards import _guess_domain

def _looks_like_problem(text: str) -> bool:
    has_goal = bool(re.search(r"求|计算|多少|问|已知|如图|^\s*题|一道题|这道题", text))
    has_data = bool(re.search(r"\d", text))
    is_idea = bool(re.search(r"为什么|如果|要是|会不会|会怎样|我想知道|好奇|想象|难道", text))
    if has_goal and has_data:
        return True
    return has_goal and not is_idea


FILLER_RE = re.compile(
    r"^\s*(?:"
    r"(?:我)?(?:今天|刚刚|刚才)?\s*(?:遇到|碰见|做了|看了)?\s*(?:一道|一个|这份|这张)?\s*"
    r"(?:题目|题|问题|想法|疑问|概念)\s*[:：,，]?"
    r"|(?:我)?(?:一直|很|特别|很好)?(?:好奇|想不通|不明白|想问|在想)\s*[:：,，]?"
    r")\s*")
CONCEPT_RE = re.compile(r"什么是|是什么|如何理解|怎么理解|怎样理解|的区别|有什么区别|有啥区别|关系是|定义是")
CONCRETE_RE = re.compile(r"题|求|计算|已知|多少|如图|\d")


def _clean_title(text: str) -> str:
    """标题只留内容本体：去掉「我遇到一道题：」这类口头前缀，截到 20 字以内的自然断点。"""
    t = FILLER_RE.sub("", text.strip())
    t = t.replace("\n", " ").strip()
    if len(t) <= 20:
        return t or text[:20]
    cut = t[:20]
    for sep in ("，", "。", "；", "：", ",", ";", "?", "？", " "):
        i = cut.rfind(sep)
        if i >= 8:
            return cut[:i]
    return cut + "…"


def _is_concept_question(text: str) -> bool:
    """概念提问不生成卡片（与在线模式的系统提示词规则保持一致）。"""
    return bool(CONCEPT_RE.search(text)) and not bool(CONCRETE_RE.search(text))


def rule_organize(user_text: str) -> str:
    """本地规则模式：只归类、搭骨架，数值答案留给学生自己填。"""
    dom = _guess_domain(user_text)
    if _is_concept_question(user_text):
        return (f"本地规则模式（未接入在线 AI，或在线调用失败已降级）：这看起来是概念提问（归到「{dom}」），"
                "我先把问题记下来，不生成卡片 —— 概念问题直接讲清更好，硬塞进题库反而会稀释训练场。\n"
                "建议这么走：① 去「知识图谱」找到对应知识点看公式与适用条件；② 如果是在某道题里卡住的，"
                "把题干和你的思路一起发给我，我再整理成训练场卡片。\n"
                "配置在线 AI 后，这里会给出完整的概念讲解。")
    if _looks_like_problem(user_text):
        level = "初中" if not re.search(r"高中|导数|积分|角动量|转动惯量|麦克斯韦|相对论", user_text) else "高中"
        card = {
            "kind": "problem",
            "summary": f"按关键词初步归类为「{level}·{dom}」题目（本地规则模式，未接入在线 AI）",
            "problem": {
                "title": _clean_title(user_text),
                "level": level, "dom": dom, "model": "",
                "text": user_text,
                "hints": [
                    "先判断过程分几段，每段受力/能量关系是否相同。",
                    "画出示意图，标出已知量、目标量与守恒量。",
                    "写出关键方程后先用工具箱查一遍量纲。",
                ],
                "answers": [],
                "solution": ["（待补充：请把你的解法分步写在这里，入库前先自己核验。）"],
                "trap": "（待补充：这题最容易踩的坑是什么？）",
            },
        }
        head = ("本地规则模式（未接入在线 AI，或在线调用失败已降级）：我把你的内容初步整理成一张「训练场题目」草稿。"
                "归类靠关键词，未必准确，可下拉调整；标准答案我不会替你编造 —— 请在答案栏填入你核验过的数值，再入库。")
    else:
        card = {
            "kind": "wonder",
            "summary": f"按关键词初步归类为「{dom}」趣味思考（本地规则模式，未接入在线 AI）",
            "wonder": {
                "title": _clean_title(user_text),
                "realm": dom, "level": "入门",
                "hook": "大多数人凭直觉会怎么回答？先写下来。",
                "think": [
                    "第一反应的答案是什么？依据是什么假设？",
                    "有没有极端情形或反例可以检验这个直觉？",
                ],
                "reveal": "（待补充：揭晓与解释，注意写清适用条件。）",
                "formula": "（待补充）",
                "tryIt": "（待补充：在家能动手验证的小实验。）",
                "deeper": "（待补充：更奇妙的是……）",
                "topics": [],
            },
        }
        head = ("本地规则模式（未接入在线 AI，或在线调用失败已降级）：我把你的想法初步整理成一张「奇思妙想」草稿。"
                "揭晓内容和动手实验需要你自己补全 —— 想清楚再写，写不出的部分正是值得去查证的部分。")
    return head + "\n```json\n" + json.dumps(card, ensure_ascii=False) + "\n```"

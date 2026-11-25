"""回复语言规范化：清掉模型偶尔夹带进正文的英文思维链 / <think> 块。

适用范围只限「面向学生的说明文字」，卡片 JSON 由 split_card 剥离后不经过这里。
判定刻意保守：只删除整行没有汉字、且确实是英文自然语言的段落；
公式行、单位/记号行、代码围栏、中文段落一律保留。
清理后若把中文弄没了，或整段清空，就原样返回 —— 宁可留一段英文，
也绝不把学生该看到的中文答复删空。
"""
from __future__ import annotations

import re

HAN = re.compile(r"[\u4e00-\u9fff]")
THINK_BLOCK = re.compile(r"<think>[\s\S]*?</think>", re.I)
THINK_TAG = re.compile(r"</?think>", re.I)
# 行内 / 行间公式、\(...\) 全部视为受保护内容
MATH = re.compile(r"\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\([^)]*?\\\)")
FENCE = re.compile(r"^\s*```")
# 推理模型英文草稿的典型起手式：命中后放宽长度门槛
EN_LEAD = re.compile(
    r"^\s*(?:okay|ok|alright|so|now|let me|let'?s|i need to|i should|i'll|first|"
    r"step\s*\d|wait|hmm|the user|we need|we have|we can|to solve|given|consider|"
    r"actually|note that|therefore|thus|hence|however|but|also|finally|in conclusion|"
    r"thinking|reasoning|analysis|answer|summary|check|verify|calculate|compute|"
    r"recall|since|because|according to|my answer|the answer is|here'?s|assuming|"
    r"using|from|for|next|then|now)\b",
    re.I,
)


def _is_english_line(line: str) -> bool:
    """整行是否可判为「英文自然语言」而非公式、记号或中文说明。"""
    s = line.strip()
    if not s or FENCE.match(s):
        return False
    probe = MATH.sub(" ", s)
    # 公式/LaTeX 命令占主：不当作英文句子删掉
    if probe.count("\\") >= 2 or "$" in probe:
        return False
    if HAN.search(probe):
        return False
    words = re.findall(r"[A-Za-z]+", probe)
    if not words:
        return False
    n_alpha = sum(len(w) for w in words)
    if EN_LEAD.match(probe):
        return n_alpha >= 3
    # 普通英文行：至少 3 个单词、8 个字母，避免误删 v0e^(-t/tau) 这类记号
    return n_alpha >= 8 and len(words) >= 3


def normalize_reply(text: str) -> str:
    """删英文推理行 / 压缩空行；任何拿不准的情况都退回原文。"""
    if not isinstance(text, str) or not text.strip():
        return text
    src = THINK_TAG.sub("", THINK_BLOCK.sub("", text))
    out = "\n".join(ln for ln in src.split("\n") if not _is_english_line(ln))
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    if not out or (not HAN.search(out) and HAN.search(text)):
        return text.strip()
    return out

"""在线模型层：提示词、协议自适应（OpenAI / Anthropic）、错误归一、模型列表地址推导。"""
from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

from .config import AI_CFG, clean_text

AI_TIMEOUT = 60.0
AI_MAX_MSGS = 16          # 送入模型的历史条数上限
AI_MAX_CHARS = 4000       # 单条消息上限
AI_MAX_OUT = 3000         # 单次回复的 token 上限（卡片 JSON 较长，1800 会被截断）
AI_ROLES = {"user", "assistant"}

AI_SYSTEM_PROMPT = """你是「竞物台」的物理竞赛学习助手，面向初高中学生。请用简体中文回答，语气友好、简洁，每次回复不超过 200 字。

学生会做三类事情：
(a) 提问物理概念 —— 直接讲清概念并指出公式适用条件，不要生成卡片；
(b) 分享一道遇到的题目 —— 先用一两句点评思路方向（不要直接给完整解答），再生成 kind="problem" 的卡片；
(c) 分享一个有趣的想法或疑问 —— 先回应它奇妙在哪里，再生成 kind="wonder" 的卡片。

卡片必须放在回复的最末尾，用 ```json 代码块包裹，格式二选一：
{"kind":"problem","summary":"一句话说明为什么归入训练场","problem":{"title":"≤20字标题","level":"初中或高中","dom":"力学|电磁|热学|光学|近代|方法","text":"完整题干","hints":["提示1","提示2","提示3"],"answers":[{"label":"所求量","value":123,"unit":"m","tol":0.01}],"solution":["分步解析1","分步解析2"],"trap":"易错点"}}
{"kind":"wonder","summary":"一句话说明为什么归入奇思妙想","wonder":{"title":"≤20字标题","realm":"光学|力学|热学|电磁|近代|宇宙|日常|科学方法","level":"入门|进阶|脑洞","hook":"直觉上大多数人会怎么想","think":["引导问题1","引导问题2"],"reveal":"揭晓与解释","formula":"关键公式","tryIt":"在家能动手验证的小实验","deeper":"更奇妙的是"}}

硬性要求：
1. answers 里的数值必须自己先推公式再代数字算对；没把握就给空数组 []，并在 summary 里写明「数值答案待核验」，绝不编造数字。
2. 有争议或未定论的科学问题（如姆潘巴效应），必须在 reveal 或 deeper 中明确说出争议。
3. 题目与揭晓内容都要标注理想化假设与适用条件。
4. 只在学生分享题目或想法时生成卡片；闲聊或概念提问不要生成。
5. 卡片 JSON 写紧凑：hints / solution 每条不超过 60 字、最多 4 条，不要加注释或多余字段；文字说明最多两句。
6. 所有公式一律用 LaTeX：行内 $...$，独立公式 $$...$$；分式用 \\frac{}{}、根号用 \\sqrt{}、上下标用 _{}/^{}、希腊字母用 \\theta 等；物理量斜体由数学模式自动给出，单位用正体 \\mathrm{m/s}。不要写 a/b 这种斜杠分式，也不要写 Unicode 上标（如 m/s²）。formula 字段只放 LaTeX，不带 $。
7. 只输出最终答复：不要输出思考过程、分析步骤、英文草稿或 <think> 标签；所有文字说明一律简体中文，公式、单位与专有名词缩写除外。"""


def _load_ai_cfg() -> dict:
    saved: dict[str, Any] = {}
    try:
        with AI_CFG.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, dict):
            saved = raw
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return {
        # 文件优先、环境变量兜底：反过来会让"在界面里保存的配置"被旧环境变量盖掉，改了不生效
        "base_url": str(saved.get("base_url") or os.environ.get("AI_BASE_URL") or "").strip(),
        "api_key": str(saved.get("api_key") or os.environ.get("AI_API_KEY") or "").strip(),
        "model": str(saved.get("model") or os.environ.get("AI_MODEL") or "").strip(),
    }


def _clean_msgs(raw: Any) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if not isinstance(raw, list):
        raise ValueError("messages 必须是数组")
    for m in raw:
        if not isinstance(m, dict):
            continue
        role = str(m.get("role") or "")
        content = clean_text(m.get("content"), AI_MAX_CHARS)
        if role in AI_ROLES and content:
            out.append({"role": role, "content": content})
    if not out:
        raise ValueError("没有可用的对话消息")
    return out[-AI_MAX_MSGS:]


ANTHROPIC_VERSION = "2023-06-01"

# 状态码 → 人能看懂的下一步。只在没有更具体信息时兜底，原文 message 永远一起展示。
ERR_HINT = {
    400: "请求体被拒绝：先确认模型 ID 与平台模型广场里的写法完全一致",
    401: "鉴权失败：Key 错误/已删除，或刚创建的 Key 还没生效（官方要求等待约 1 分钟）",
    402: "账号额度或套餐不可用：该模型需先在平台「模型广场」订购/续费，或换用余额充足的账号",
    403: "无权限：该模型未开通、Key 被限权，或来源 IP 不在白名单",
    404: "接口地址不对：base_url 要填到 /v1/chat/completions（OpenAI 风格）或 /v1/messages（Anthropic 风格）",
    405: "路径拼错：base_url 可能已经带了 /chat/completions，被重复拼接了一次",
    413: "请求体过大",
    415: "内容类型不被接受：检查 base_url 指向的是不是聊天补全接口",
    422: "参数格式不对：检查 model / messages / max_tokens 字段",
    429: "限流或额度用尽：稍后重试，或降低调用频率",
    500: "服务端异常，稍后重试",
    502: "网关错误，稍后重试",
    503: "服务暂不可用，稍后重试",
    504: "上游超时，稍后重试",
}


class LLMError(Exception):
    """带结构化信息的在线调用错误，前端据此给出可操作的提示。"""

    def __init__(self, status: int | None, code: str, message: str, hint: str, endpoint: str = ""):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.hint = hint
        self.endpoint = endpoint

    def to_dict(self) -> dict:
        return {"status": self.status, "code": self.code, "message": self.message,
                "hint": self.hint, "endpoint": self.endpoint}

    def brief(self) -> str:
        head = f"HTTP {self.status}" if self.status else "网络错误"
        return f"{head} {self.message}" + (f"；{self.hint}" if self.hint else "")


def _endpoints(base_url: str) -> list[tuple[str, str]]:
    """把用户填的 base_url 归一成候选 (地址, 协议) 列表。

    支持：完整 …/chat/completions、Anthropic 的 …/messages、…/v1、…/paas/v4、
    只填域名、以及移动云这类需要 …/v1/chat/completions 的平台。
    第一个是主选，其余在 404/405/415 时按顺序兜底。
    """
    b = (base_url or "").strip().rstrip("/")
    if not b:
        b = "https://api.openai.com/v1"
    low = b.lower()
    if low.endswith("/chat/completions"):
        root = b[: -len("/chat/completions")]
        return [(b, "openai"), (root + "/messages", "anthropic")]
    if low.endswith("/messages"):
        root = b[: -len("/messages")]
        return [(b, "anthropic"), (root + "/chat/completions", "openai")]
    if re.search(r"/[a-z0-9._-]*v\d+$", low):       # …/v1、…/paas/v4、…/compatible-mode/v1
        return [(b + "/chat/completions", "openai")]
    return [(b + "/v1/chat/completions", "openai"), (b + "/v1/messages", "anthropic")]


def _payload(proto: str, cfg: dict, msgs: list[dict[str, str]]) -> tuple[dict, dict]:
    msgs = msgs or [{"role": "user", "content": "你好"}]
    if proto == "anthropic":
        body = {"model": cfg["model"], "max_tokens": AI_MAX_OUT, "system": AI_SYSTEM_PROMPT,
                "messages": [{"role": m["role"], "content": m["content"]} for m in msgs]}
        headers = {"x-api-key": cfg["api_key"], "anthropic-version": ANTHROPIC_VERSION,
                   "content-type": "application/json"}
    else:
        body = {"model": cfg["model"], "temperature": 0.3, "max_tokens": AI_MAX_OUT,
                "messages": [{"role": "system", "content": AI_SYSTEM_PROMPT}] + msgs}
        headers = {"Authorization": f"Bearer {cfg['api_key']}", "content-type": "application/json"}
    return body, headers


def _err_from_response(r: "httpx.Response", endpoint: str, model: str) -> LLMError:
    msg, code = "", ""
    try:
        j = r.json()
    except Exception:
        j = None
    if isinstance(j, dict):
        e = j.get("error")
        if isinstance(e, dict):
            msg = str(e.get("message") or e.get("msg") or "")
            code = str(e.get("code") or e.get("type") or "")
        elif isinstance(e, str):
            msg = e
        if not msg:
            msg = str(j.get("message") or j.get("msg") or "")
            code = code or str(j.get("code") or "")
    if not msg:
        msg = (r.text or "").strip().replace("\n", " ")[:200] or f"HTTP {r.status_code}"
    hint = ERR_HINT.get(r.status_code, "")
    if r.status_code == 402 and "/" in model:
        hint += (f"；注意 {model} 带供应商前缀，通常要单独订阅，"
                 f"可先试去掉前缀的 {model.split('/', 1)[1]}")
    return LLMError(r.status_code, code, msg[:220], hint, endpoint)


def _extract_text(proto: str, data: Any) -> str:
    if proto == "anthropic":
        blocks = data.get("content") if isinstance(data, dict) else None
        if isinstance(blocks, list):
            text = "".join(str(b.get("text") or "") for b in blocks
                           if isinstance(b, dict) and b.get("type") in (None, "text"))
            if text.strip():
                return text
        raise LLMError(None, "empty", "模型返回为空", "换个模型或稍后重试", "")
    choices = data.get("choices") if isinstance(data, dict) else None
    if not isinstance(choices, list) or not choices:
        raise LLMError(None, "bad_shape", "返回中没有 choices 字段", "该地址可能不是聊天补全接口", "")
    msg = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = msg.get("content") if isinstance(msg, dict) else None
    if isinstance(content, list):      # 新版 OpenAI 风格的 content 块数组
        content = "".join(str(b.get("text") or "") for b in content if isinstance(b, dict))
    if not isinstance(content, str) or not content.strip():
        content = (msg or {}).get("reasoning_content") if isinstance(msg, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise LLMError(None, "empty", "模型返回为空", "换个模型或稍后重试", "")
    return content


async def call_llm(cfg: dict, msgs: list[dict[str, str]]) -> str:
    """按候选地址逐个尝试；只有 404/405/415 才换下一个，其余错误立刻上报。"""
    last: LLMError | None = None
    async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
        for url, proto in _endpoints(cfg["base_url"]):
            body, headers = _payload(proto, cfg, msgs)
            try:
                r = await client.post(url, json=body, headers=headers)
            except httpx.HTTPError as e:
                last = LLMError(None, "network", f"连不上 {url}（{type(e).__name__}）",
                                "检查网络、代理，或域名是否写错", url)
                continue
            if r.status_code >= 400:
                err = _err_from_response(r, url, cfg["model"])
                last = err
                if r.status_code in (404, 405, 415):
                    continue
                raise err
            try:
                data = r.json()
            except ValueError:
                last = LLMError(r.status_code, "bad_json", "返回不是 JSON：" + (r.text or "")[:120],
                                "该地址可能不是聊天补全接口", url)
                continue
            try:
                return _extract_text(proto, data)
            except LLMError as e:
                e.endpoint = url
                last = e
                continue
    raise last or LLMError(None, "unknown", "调用失败", "检查 base_url 与模型名")


def _api_root(base: str) -> str:
    """把配置里的完整接口地址收敛成 API 根（…/v1）。

    直接对第一个候选地址 rsplit("/", 2) 会把 Anthropic 风格 …/v1/messages 削成裸域名，
    拼出来的模型列表地址就少了 /v1。
    """
    b = (base or "").strip().rstrip("/")
    low = b.lower()
    for suffix in ("/chat/completions", "/messages", "/completions", "/models"):
        if low.endswith(suffix):
            return b[: -len(suffix)]
    return b

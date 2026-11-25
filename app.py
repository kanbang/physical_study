"""竞物台 · 后端入口（FastAPI 路由层）

这里只做三件事：装配 CORS、把请求转成对 storage / cards / llm 的调用、托管前端静态文件。
实现按职责放在 server/ 下：
  config.py   路径、体积上限、正则 —— 唯一配置源
  storage.py  store.json 读写、原子落盘、快照与启动清理
  cards.py    卡片白名单校验、截断 JSON 修复、代码块剥离
  rule.py     未接入在线 AI 时的本地规则降级
  llm.py      提示词、协议自适应、错误归一、模型列表地址

接口清单见 /api/docs。启动：poetry run python app.py
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Any

import httpx

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from server.cards import split_card, validate_card
from server.config import (AI_CFG, BASE_URL_RE, DATA_DIR, DIST, MAX_BODY, MAX_IDEAS,
                           MAX_STATE, STORE, UID_RE, clean_text)
from server.llm import (ANTHROPIC_VERSION, LLMError, _api_root, _clean_msgs, _endpoints,
                        _err_from_response, _load_ai_cfg, call_llm)
from server.rule import rule_organize
from server.reply import normalize_reply
from server import storage
from server.storage import _lock, _persist, _snapshot, mem

app = FastAPI(title="竞物台 API", version="1.0.0", docs_url="/api/docs", redoc_url=None)
# 前端与后端同源部署，正常情况下不走 CORS。默认只放行本机来源，避免任何网页都能读写本机数据；
# 局域网教学需要时用 JW_ALLOW_ORIGINS="http://192.168.1.10:3000,http://..." 显式追加。
ALLOW_ORIGINS = [o.strip() for o in os.environ.get("JW_ALLOW_ORIGINS", "").split(",") if o.strip()] or [
    "http://127.0.0.1:3000", "http://localhost:3000",
    "http://127.0.0.1:5173", "http://localhost:5173",   # vite dev
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


def ok(data: dict, status: int = 200) -> JSONResponse:
    return JSONResponse({**data, "ok": True}, status_code=status,
                        headers={"Cache-Control": "no-store"})


def fail(msg: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"ok": False, "error": msg}, status_code=status)


def valid_uid(v: Any) -> str:
    s = str(v or "")
    return s if UID_RE.fullmatch(s) else "guest"


async def json_body(request: Request) -> dict:
    raw = await request.body()
    if len(raw) > MAX_BODY:
        raise ValueError("请求体过大")
    try:
        data = json.loads(raw or b"{}")
    except (ValueError, UnicodeDecodeError):
        raise ValueError("JSON 格式错误")
    if not isinstance(data, dict):
        raise ValueError("请求体必须是 JSON 对象")
    return data


@app.get("/api/health")
async def health():
    with _lock:
        return ok({"service": "physics-olympiad-lab", "time": int(time.time() * 1000),
                   "users": len(mem["users"]), "ideas": len(mem["ideas"])})


@app.get("/api/state")
async def get_state(uid: str = "guest"):
    uid = valid_uid(uid)
    with _lock:
        rec = mem["users"].get(uid)
        snapshot = dict(rec) if rec else None
    if not snapshot:
        return ok({"uid": uid, "state": None, "updatedAt": 0, "version": 0})
    return ok({"uid": uid, "state": snapshot["state"],
               "updatedAt": snapshot["updatedAt"], "version": snapshot["version"]})


@app.put("/api/state")
async def put_state(request: Request, uid: str = "guest"):
    uid = valid_uid(uid)
    try:
        body = await json_body(request)
    except ValueError as e:
        return fail(str(e))
    state = body.get("state")
    if not isinstance(state, dict):
        return fail("state 必须是对象")
    if len(json.dumps(state, ensure_ascii=False)) > MAX_STATE:
        return fail("学习数据过大", 413)
    now = int(time.time() * 1000)
    try:
        updated = int(body.get("updatedAt") or now)
    except (TypeError, ValueError):
        updated = now
    with _lock:
        old = mem["users"].get(uid, {})
        _snapshot(uid, old)
        rec = {"state": state, "updatedAt": updated, "serverTime": now,
               "version": int(old.get("version", 0)) + 1}
        mem["users"][uid] = rec
        _persist()
    return ok({"uid": uid, "version": rec["version"], "serverTime": now})


@app.get("/api/history")
async def get_history(uid: str = "guest"):
    uid = valid_uid(uid)
    items = []
    for p in sorted(storage.HISTORY_DIR.glob(f"{uid}-*.json"), reverse=True)[:30]:
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        st = d.get("state") if isinstance(d.get("state"), dict) else {}
        custom = st.get("custom") if isinstance(st.get("custom"), dict) else {}
        items.append({
            "file": p.name,
            "ts": d.get("serverTime", 0),
            "problems": len(custom.get("problems") or []),
            "wonders": len(custom.get("wonders") or []),
            "attempts": len(st.get("attempts") or []),
        })
    return ok({"items": items})


@app.post("/api/history/restore")
async def restore_history(request: Request, uid: str = "guest"):
    uid = valid_uid(uid)
    try:
        body = await json_body(request)
    except ValueError as e:
        return fail(str(e))
    name = clean_text(body.get("file"), 80)
    if not re.fullmatch(r"[A-Za-z0-9_-]+-\d{10,16}\.json", name) or not name.startswith(uid + "-"):
        return fail("快照文件名不合法")
    path = storage.HISTORY_DIR / name
    if not path.exists():
        return fail("快照不存在", 404)
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fail("快照损坏")
    state = d.get("state") if isinstance(d.get("state"), dict) else None
    if not state:
        return fail("快照内容为空")
    now = int(time.time() * 1000)
    with _lock:
        old = mem["users"].get(uid, {})
        _snapshot(uid, old)
        mem["users"][uid] = {"state": state, "updatedAt": now, "serverTime": now,
                             "version": int(old.get("version", 0)) + 1}
        _persist()
    return ok({"restored": name, "updatedAt": now})


@app.get("/api/export")
async def export_state(uid: str = "guest"):
    uid = valid_uid(uid)
    with _lock:
        rec = mem["users"].get(uid) or {}
        payload = {"app": "竞物台", "uid": uid, "exportedAt": int(time.time() * 1000),
                   "state": rec.get("state")}
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    fname = f"jingwutai-{uid}-{time.strftime('%Y%m%d-%H%M%S')}.json"
    return Response(content=body, media_type="application/json; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@app.get("/api/ideas")
async def get_ideas():
    with _lock:
        items = list(reversed(mem["ideas"][-60:]))
    return ok({"items": items})


@app.get("/api/ai/config")
async def get_ai_config():
    c = _load_ai_cfg()
    return ok({"configured": bool(c["api_key"] and c["model"]),
               "base_url": c["base_url"], "model": c["model"],
               "has_key": bool(c["api_key"])})


@app.put("/api/ai/config")
async def put_ai_config(request: Request):
    try:
        body = await json_body(request)
    except ValueError as e:
        return fail(str(e))
    saved: dict[str, Any] = {}
    try:
        with AI_CFG.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, dict):
            saved = raw
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    old = dict(saved)
    for k in ("base_url", "model"):
        if k in body:
            saved[k] = clean_text(body.get(k), 200)
    if "api_key" in body:
        saved["api_key"] = clean_text(body.get("api_key"), 200)
    if saved.get("base_url") and not BASE_URL_RE.match(saved["base_url"]):
        return fail("接口地址必须是以 http:// 或 https:// 开头的完整 URL")
    # 密钥只发给用户亲手配置过的地址：换地址必须同时重新填 Key，
    # 否则任何能访问本接口的页面都能把 base_url 改成自己的服务器，再借 /api/ai/chat 把已存密钥带走。
    old_base = clean_text(old.get("base_url"), 200).rstrip("/")
    new_base = clean_text(saved.get("base_url"), 200).rstrip("/")
    if old.get("api_key") and new_base and new_base != old_base and not clean_text(body.get("api_key"), 200):
        return fail("更换接口地址时必须同时重新填写 API Key（已保存的密钥只发给配置过的服务器）")
    if saved.get("api_key") and saved.get("model") and not saved.get("base_url"):
        saved["base_url"] = "https://api.openai.com/v1"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = AI_CFG.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(saved, f, ensure_ascii=False, indent=2)
    os.replace(tmp, AI_CFG)
    c = _load_ai_cfg()
    return ok({"configured": bool(c["api_key"] and c["model"]), "model": c["model"]})


@app.post("/api/ai/chat")
async def ai_chat(request: Request):
    try:
        body = await json_body(request)
        msgs = _clean_msgs(body.get("messages"))
    except ValueError as e:
        return fail(str(e))
    cfg = _load_ai_cfg()
    note, err = "", None
    if cfg["api_key"] and cfg["model"]:
        mode, model = "ai", cfg["model"]
        try:
            content = await call_llm(cfg, msgs)
        except LLMError as e:  # 鉴权/套餐/网络等一律降级，但把原因原样交给界面
            mode, model = "rule", "本地规则"
            note = f"（在线 AI 未成功：{e.brief()}。已降级为本地规则模式）"
            err = e.to_dict()
            content = rule_organize(msgs[-1]["content"])
        except Exception as e:  # 兜底：不让对话中断
            mode, model = "rule", "本地规则"
            note = f"（在线 AI 调用失败：{str(e)[:90]}，已降级为本地规则模式）"
            err = {"status": None, "code": "exception", "message": str(e)[:160], "hint": "", "endpoint": ""}
            content = rule_organize(msgs[-1]["content"])
    else:
        mode, model = "rule", "本地规则"
        content = rule_organize(msgs[-1]["content"])
    reply, card = split_card(content)
    reply = normalize_reply(reply)
    if note:
        reply = note + "\n" + reply
    return ok({"reply": reply[:4000], "card": card, "mode": mode, "model": model, "error": err})


@app.post("/api/ai/test")
async def ai_test(request: Request):
    """用当前（或请求里覆盖的）配置发一次极小请求，把失败原因原样返回，便于自检。"""
    try:
        body = await json_body(request)
    except ValueError:
        body = {}
    cfg = _load_ai_cfg()
    for k in ("base_url", "model", "api_key"):
        v = clean_text(body.get(k), 300)
        if v:
            cfg[k] = v
    if not (cfg["api_key"] and cfg["model"]):
        return ok({"connected": False, "model": cfg["model"], "endpoint": "",
                   "detail": {"status": None, "code": "unconfigured",
                              "message": "还没有保存 API Key 或模型名",
                              "hint": "先在下面点选服务商、粘贴 Key 并保存", "endpoint": ""}})
    t0 = time.time()
    try:
        text = await call_llm(cfg, [{"role": "user", "content": "只回复两个字：收到"}])
        return ok({"connected": True, "ms": int((time.time() - t0) * 1000),
                   "model": cfg["model"], "reply": text.strip()[:60],
                   "endpoint": _endpoints(cfg["base_url"])[0][0], "detail": None})
    except LLMError as e:
        return ok({"connected": False, "ms": int((time.time() - t0) * 1000),
                   "model": cfg["model"], "endpoint": e.endpoint or _endpoints(cfg["base_url"])[0][0],
                   "detail": e.to_dict()})


@app.get("/api/ai/models")
async def ai_models():
    """代理 GET <root>/models，让界面直接列出账号可见的模型 ID（避免手抄错）。"""
    cfg = _load_ai_cfg()
    if not cfg["api_key"]:
        return fail("还没有配置 API Key")
    murl = _api_root(cfg["base_url"]) + "/models"
    # 两种协议的头都带上：OpenAI 用 Bearer，Anthropic 用 x-api-key
    headers = {"Authorization": f"Bearer {cfg['api_key']}", "x-api-key": cfg["api_key"],
               "anthropic-version": ANTHROPIC_VERSION}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(murl, headers=headers)
    except httpx.HTTPError as e:
        return fail(f"连不上 {murl}（{type(e).__name__}）", 502)
    if r.status_code >= 400:
        e = _err_from_response(r, murl, cfg["model"])
        return JSONResponse({"ok": False, "error": e.message, "detail": e.to_dict()}, status_code=200)
    try:
        data = r.json()
    except ValueError:
        return fail("模型列表接口返回的不是 JSON", 502)
    items = data.get("data") if isinstance(data, dict) else None
    ids = [str(m.get("id")) for m in items if isinstance(m, dict) and m.get("id")] if isinstance(items, list) else []
    return ok({"endpoint": murl, "count": len(ids), "models": sorted(set(ids))})


@app.post("/api/ideas")
async def post_idea(request: Request):
    try:
        body = await json_body(request)
    except ValueError as e:
        return fail(str(e))
    text = clean_text(body.get("text"), 300)
    wid = clean_text(body.get("wid"), 32)
    if not text:
        return fail("猜想内容不能为空")
    if not wid:
        return fail("缺少题目编号")
    item = {
        "id": "i_" + format(int(time.time() * 1000), "x") + os.urandom(2).hex(),
        "wid": wid, "text": text, "uid": valid_uid(body.get("uid"))[:8],
        "ts": int(time.time() * 1000),
    }
    with _lock:
        mem["ideas"].append(item)
        if len(mem["ideas"]) > MAX_IDEAS:
            mem["ideas"] = mem["ideas"][-MAX_IDEAS:]
        _persist()
    return ok({"item": item})


@app.get("/", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
async def index():
    f = DIST / "index.html"
    if f.is_file():
        return FileResponse(f, media_type="text/html; charset=utf-8",
                            headers={"Cache-Control": "no-cache"})
    return fail("前端未构建：请先执行 cd frontend && npm install && npm run build", 500)


# Vite 静态资源（带 hash 的 js/css）
if (DIST / "assets").is_dir():
    from fastapi.staticfiles import StaticFiles
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "3000"))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"竞物台服务已启动: http://{host}:{port}")
    print(f"数据文件: {STORE}")
    uvicorn.run(app, host=host, port=port, log_level="info")



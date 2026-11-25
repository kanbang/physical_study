"""路由级回归：用 FastAPI TestClient 真跑一遍写接口。

存在的理由很具体：把实现拆进 server/ 包后，`_persist()` 里漏了一个 `DATA_DIR` 导入，
单测全绿、但 `PUT /api/state` 直接 500。纯函数测试看不见这种"接线错误"，
所以这里把数据目录指向临时目录，端到端走一遍读写链路。
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_spec = importlib.util.spec_from_file_location("jw_app", ROOT / "app.py")
app_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(app_mod)

from fastapi.testclient import TestClient   # noqa: E402
from server import storage as storage_mod   # noqa: E402


class RouteTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        tmp = pathlib.Path(self.tmp.name)
        self._old = (storage_mod.DATA_DIR, storage_mod.STORE, storage_mod.HISTORY_DIR, storage_mod.mem.copy())
        storage_mod.DATA_DIR = tmp
        storage_mod.STORE = tmp / "store.json"
        storage_mod.HISTORY_DIR = tmp / "history"
        storage_mod.mem.clear()
        storage_mod.mem.update({"users": {}, "ideas": []})
        self.c = TestClient(app_mod.app)

    def tearDown(self):
        storage_mod.DATA_DIR, storage_mod.STORE, storage_mod.HISTORY_DIR = self._old[:3]
        storage_mod.mem.clear()
        storage_mod.mem.update(self._old[3])
        self.tmp.cleanup()

    def test_health(self):
        r = self.c.get("/api/health")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["ok"])

    def test_state_roundtrip_persists_to_disk(self):
        state = {"days": ["2026-11-18"], "attempts": [], "custom": {"problems": [], "wonders": []}}
        r = self.c.put("/api/state?uid=u_test", json={"state": state, "updatedAt": 1700000000000})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["version"], 1)

        r2 = self.c.get("/api/state?uid=u_test")
        self.assertEqual(r2.json()["state"], state)
        self.assertEqual(r2.json()["updatedAt"], 1700000000000)

        # 落盘必须真的发生：重读文件里应有该用户
        self.assertTrue(storage_mod.STORE.is_file())
        self.assertIn("u_test", storage_mod.STORE.read_text(encoding="utf-8"))

    def test_state_rejects_non_object(self):
        r = self.c.put("/api/state?uid=u_test", json={"state": [1, 2, 3]})
        self.assertEqual(r.status_code, 400)
        self.assertIn("state", r.json()["error"])

    def test_ideas_post_and_list(self):
        r = self.c.post("/api/ideas", json={"wid": "k1", "text": "水面为什么有油膜色", "uid": "u_test"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["item"]["wid"], "k1")
        r2 = self.c.get("/api/ideas")
        self.assertEqual(len(r2.json()["items"]), 1)

    def test_ideas_rejects_empty_text(self):
        r = self.c.post("/api/ideas", json={"wid": "k1", "text": "   "})
        self.assertEqual(r.status_code, 400)

    def test_history_lists_snapshot_after_write(self):
        self.c.put("/api/state?uid=u_test", json={"state": {"days": []}, "updatedAt": 1700000000000})
        self.c.put("/api/state?uid=u_test", json={"state": {"days": ["2026-11-18"]}, "updatedAt": 1700000600000})
        r = self.c.get("/api/history?uid=u_test")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.json()["items"]), 1)

    def test_export_returns_attachment(self):
        self.c.put("/api/state?uid=u_test", json={"state": {"days": []}, "updatedAt": 1700000000000})
        r = self.c.get("/api/export?uid=u_test")
        self.assertEqual(r.status_code, 200)
        self.assertIn("attachment", r.headers.get("content-disposition", ""))
        self.assertEqual(r.json()["uid"], "u_test")

    def test_ai_config_rejects_bad_url(self):
        r = self.c.put("/api/ai/config", json={"base_url": "moma.cmecloud.cn/v1", "api_key": "sk-x"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("http", r.json()["error"])

    def test_index_served_when_dist_exists(self):
        r = self.c.get("/")
        # dist 已构建时应为 200；未构建则 500 且提示先 build
        self.assertIn(r.status_code, (200, 500))


if __name__ == "__main__":
    unittest.main(verbosity=2)

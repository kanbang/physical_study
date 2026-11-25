"""后端回归测试：poetry run python -m unittest discover -s tests -v

覆盖三处曾经出过问题、且改动容易复发的逻辑：
  1. validate_card 白名单（AI 产出的卡片不能带进未知字段/编造数值）
  2. split_card 对代码块与截断 JSON 的处理（半截 JSON 不能糊到学生面前）
  3. 快照保留上限与启动清理（保存自循环曾让 history 堆到 70+ 份）
另含 base_url 校验、协议自动判别两条纯函数断言。
实现按职责拆在 server/ 下，测试直接打对应模块（app.py 只是路由层）。
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_spec = importlib.util.spec_from_file_location("jw_app", ROOT / "app.py")
app = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(app)

from server import cards as cards_mod          # noqa: E402
from server import config as config_mod        # noqa: E402
from server import llm as llm_mod              # noqa: E402
from server import storage as storage_mod      # noqa: E402


class ValidateCardTest(unittest.TestCase):
    def test_problem_keeps_only_valid_answers(self):
        card = cards_mod.validate_card({
            "kind": "problem",
            "problem": {
                "title": "滑块过传送带",
                "level": "大学",                       # 非法枚举 → 回落"高中"
                "dom": "不存在的领域",                  # 非法 → 由文本猜测
                "model": "m99",                        # 不在 m1..m12 → 置空
                "text": "x" * 2000,                    # 超长 → 截到 900
                "answers": [
                    {"label": "a", "value": "1.5", "unit": "m/s"},
                    {"label": "b", "value": "abc", "unit": "m"},   # 数值非法 → 丢弃
                    {"label": "", "value": 2},                     # 缺 label → 丢弃
                ],
                "junk": "should be dropped",
            },
            "extra": {"anything": 1},
        })
        self.assertEqual(card["kind"], "problem")
        self.assertEqual(card["problem"]["level"], "高中")
        self.assertEqual(card["problem"]["model"], "")
        self.assertEqual(len(card["problem"]["text"]), 900)
        self.assertEqual([a["label"] for a in card["problem"]["answers"]], ["a"])
        self.assertNotIn("junk", card["problem"])
        self.assertNotIn("extra", card)

    def test_wonder_enum_fallback_and_topic_filter(self):
        card = cards_mod.validate_card({
            "kind": "wonder",
            "wonder": {"title": "电鳗", "realm": "玄学", "level": "？", "topics": ["k1", "k99", "x", "k12"]},
        })
        self.assertEqual(card["wonder"]["realm"], "日常")
        self.assertEqual(card["wonder"]["level"], "入门")
        self.assertEqual(card["wonder"]["topics"], ["k1", "k12"])

    def test_unknown_kind_rejected(self):
        self.assertIsNone(cards_mod.validate_card({"kind": "model"}))
        self.assertIsNone(cards_mod.validate_card("not a dict"))


class SplitCardTest(unittest.TestCase):
    def test_code_block_removed_from_reply(self):
        content = '先把条件理清。\n```json\n{"kind":"wonder","wonder":{"title":"皮球弹跳"}}\n```'
        text, card = cards_mod.split_card(content)
        self.assertNotIn("```", text)
        self.assertIn("先把条件理清", text)
        self.assertEqual(card["kind"], "wonder")

    def test_truncated_json_is_repaired(self):
        # max_tokens 截断的典型形态：少一个右括号
        content = '给个想法。\n```json\n{"kind":"problem","problem":{"title":"斜面","answers":[{"label":"a","value":1.5'
        text, card = cards_mod.split_card(content)
        self.assertNotIn("```", text)
        self.assertIsNotNone(card, "截断的卡片应能救回")
        self.assertEqual(card["problem"]["title"], "斜面")

    def test_broken_json_falls_back_to_text(self):
        text, card = cards_mod.split_card('说明\n```json\n{不是 json}\n```')
        self.assertIsNone(card)
        self.assertNotIn("```", text)
        self.assertTrue(text.strip())


class SnapshotTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self._old = (storage_mod.HISTORY_DIR, storage_mod.HISTORY_KEEP, storage_mod.HISTORY_GAP)
        storage_mod.HISTORY_DIR = pathlib.Path(self.tmp.name)

    def tearDown(self):
        storage_mod.HISTORY_DIR, storage_mod.HISTORY_KEEP, storage_mod.HISTORY_GAP = self._old
        self.tmp.cleanup()

    def test_keep_limit_with_wide_gap(self):
        storage_mod.HISTORY_KEEP, storage_mod.HISTORY_GAP = 5, 0
        t = 1_700_000_000_000
        for i in range(40):
            t += 1000
            storage_mod._snapshot("u_t", {"state": {"custom": {}}, "serverTime": t})
        self.assertEqual(len(list(storage_mod.HISTORY_DIR.glob("u_t-*.json"))), 5)

    def test_throttle_within_gap_writes_once(self):
        storage_mod.HISTORY_KEEP, storage_mod.HISTORY_GAP = 20, 10 * 60 * 1000
        t = 1_700_000_000_000
        for _ in range(50):          # 650ms 一次，10 分钟内只应留 1 份
            t += 650
            storage_mod._snapshot("u_t", {"state": {"custom": {}}, "serverTime": t})
        self.assertEqual(len(list(storage_mod.HISTORY_DIR.glob("u_t-*.json"))), 1)

    def test_startup_prune_collapses_legacy_files(self):
        storage_mod.HISTORY_KEEP = 3
        for uid in ("u_a", "u_b"):
            for i in range(10):
                (storage_mod.HISTORY_DIR / f"{uid}-{1_700_000_000_000 + i * 1000}.json").write_text("{}", encoding="utf-8")
        storage_mod._prune_history()
        self.assertEqual(len(list(storage_mod.HISTORY_DIR.glob("u_a-*.json"))), 3)
        self.assertEqual(len(list(storage_mod.HISTORY_DIR.glob("u_b-*.json"))), 3)


class ConfigAndEndpointTest(unittest.TestCase):
    def test_base_url_pattern(self):
        ok = ["https://moma.cmecloud.cn/v1/chat/completions", "http://127.0.0.1:8000/v1", "https://api.deepseek.com"]
        bad = ["moma.cmecloud.cn/v1", "javascript:alert(1)", "ftp://x/y", "  "]
        for u in ok:
            self.assertTrue(config_mod.BASE_URL_RE.match(u), u)
        for u in bad:
            self.assertFalse(config_mod.BASE_URL_RE.match(u), u)

    def test_endpoints_normalize(self):
        first = llm_mod._endpoints("https://api.anthropic.com/v1/messages")[0]
        self.assertEqual(first, ("https://api.anthropic.com/v1/messages", "anthropic"))
        # 用户把完整地址粘成 /messages，重试候选里必须是 /chat/completions 而不是 /messages/chat/completions
        urls = [u for u, _ in llm_mod._endpoints("https://api.anthropic.com/v1/messages")]
        self.assertIn("https://api.anthropic.com/v1/chat/completions", urls)
        self.assertFalse(any(u.endswith("/messages/chat/completions") for u in urls))

    def test_endpoints_bare_host(self):
        urls = [u for u, _ in llm_mod._endpoints("https://api.deepseek.com")]
        self.assertIn("https://api.deepseek.com/v1/chat/completions", urls)

    def test_models_root_keeps_version_segment(self):
        # …/v1/messages 曾把模型列表地址削成 <host>/models（少了 /v1）
        self.assertEqual(llm_mod._api_root("https://api.anthropic.com/v1/messages"), "https://api.anthropic.com/v1")
        self.assertEqual(llm_mod._api_root("https://moma.cmecloud.cn/v1/chat/completions"), "https://moma.cmecloud.cn/v1")
        self.assertEqual(llm_mod._api_root("https://api.deepseek.com/v1"), "https://api.deepseek.com/v1")

    def test_cors_not_wildcard(self):
        self.assertNotIn("*", app.ALLOW_ORIGINS)
        self.assertTrue(any("127.0.0.1" in o for o in app.ALLOW_ORIGINS))


if __name__ == "__main__":
    unittest.main(verbosity=2)

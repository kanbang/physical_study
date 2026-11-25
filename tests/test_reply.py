"""回复语言规范化回归测试（poetry run python -m unittest discover -s tests -v）

覆盖 glm-5.3-flash 曾把英文推理混进 reply 的几类形态，
以及最容易误伤的两类内容：LaTeX 公式行、纯中文答复。
"""
from __future__ import annotations

import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from server.cards import split_card          # noqa: E402
from server.reply import normalize_reply     # noqa: E402


class TestNormalizeReply(unittest.TestCase):
    def test_pure_chinese_untouched(self):
        s = "好题！抓住「光滑」二字，用机械能守恒即可。\n先写出 mgh = ½mv² 再化简。"
        self.assertEqual(normalize_reply(s), s)

    def test_english_reasoning_lines_removed(self):
        s = ("Let me think step by step about this physics problem.\n"
             "Step 1: identify the conserved quantity here.\n"
             "Therefore the answer should be six meters per second.\n"
             "\n"
             "好题！抓住「光滑」二字，用机械能守恒即可。")
        out = normalize_reply(s)
        self.assertIn("机械能守恒", out)
        self.assertNotIn("Let me think", out)
        self.assertNotIn("Step 1", out)
        self.assertNotIn("Therefore", out)

    def test_think_block_removed(self):
        s = ("<think>\nWe need to parse the user's question carefully.\n"
             "Compute v = sqrt(2gh) and check the units.\n</think>\n"
             "这题的关键是高度差，与斜面倾角无关。")
        out = normalize_reply(s)
        self.assertIn("高度差", out)
        self.assertNotIn("think", out.lower())
        self.assertNotIn("Compute", out)

    def test_unclosed_think_keeps_chinese_answer(self):
        # 未闭合的 <think> 不能把后面整段中文答复一起吞掉
        s = ("<think>\nWe need to work through the algebra first.\n"
             "这题的关键是高度差，与斜面倾角无关。\n"
             "先写出 mgh = ½mv²。")
        out = normalize_reply(s)
        self.assertIn("高度差", out)
        self.assertIn("mgh", out)
        self.assertNotIn("We need", out)

    def test_latex_lines_preserved(self):
        s = ("由能量守恒可得：\n"
             "$$R=\\frac{v_0^2\\sin 2\\theta}{g}$$\n"
             "其中 $v=\\sqrt{2gh}$。\n"
             "这就是最远射程。")
        out = normalize_reply(s)
        self.assertIn("\\frac", out)
        self.assertIn("\\sqrt", out)
        self.assertIn("最远射程", out)

    def test_notation_lines_preserved(self):
        s = "Q = ω0 / (2β)\nτ = mR / (B²L²)\n品质因数 Q 越大，共振峰越尖锐。"
        self.assertEqual(normalize_reply(s), s)

    def test_all_english_falls_back_to_original(self):
        s = "The terminal velocity is about 6 m/s."
        self.assertEqual(normalize_reply(s), s)

    def test_fence_and_blank_lines(self):
        s = ("先看一段推导：\n\n\n\n```text\nv = 6 m/s\n```\n"
             "Now I should double check the result.\n"
             "结论：取 g = 10 m/s² 时 v = 6 m/s。")
        out = normalize_reply(s)
        self.assertIn("```text", out)
        self.assertIn("结论", out)
        self.assertNotIn("double check", out)
        self.assertNotIn("\n\n\n", out)

    def test_empty_and_none(self):
        self.assertEqual(normalize_reply(""), "")
        self.assertIsNone(normalize_reply(None))

    def test_end_to_end_with_card_split(self):
        content = ("Let me analyze the problem before answering.\n"
                   "这题用机械能守恒最省事。\n"
                   "```json\n{\"kind\":\"wonder\",\"summary\":\"整理成奇思妙想\","
                   "\"wonder\":{\"title\":\"一个想法\",\"reveal\":\"揭晓内容\"}}\n```")
        reply, card = split_card(content)
        reply = normalize_reply(reply)
        self.assertIsNotNone(card)
        self.assertIn("机械能守恒", reply)
        self.assertNotIn("Let me analyze", reply)
        self.assertNotIn("```json", reply)


if __name__ == "__main__":
    unittest.main()

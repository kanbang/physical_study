/* 公式排版层回归测试：node --test tests/
   覆盖三类历史缺陷：Unicode 上标/分式、命令与字母粘连（\intr、\SigmaM）、整段公式带 $ 定界符。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {autoTex, renderMath, stripDelims, fixCmdSpacing, toSegments} from '../src/lib/tex.js'

const noError = html => !html.includes('katex-error')

test('autoTex：Unicode 公式转成课本写法', () => {
  assert.match(autoTex('v = s / t'), /\\frac\{s\}\{t\}/)
  assert.match(autoTex('a₁ = g(sinθ + μcosθ)'), /a_\{1\}.*\\theta/)
  assert.match(autoTex('√(2gh)'), /\\sqrt\{2gh\}/)
  assert.match(autoTex('⅓mL²'), /\\frac\{1\}\{3\}/)
  assert.match(autoTex('v回 = v₀√[(sinθ−μcosθ)/(sinθ+μcosθ)]'), /\\sqrt\{/)
})

test('autoTex：符号命令后必须留空格，避免 \\intr 这类未知命令', () => {
  const tex = autoTex('J = ∫r²dm')
  assert.match(tex, /\\int\s+r/)
  assert.equal(renderMath(tex, true).includes('katex-error'), false)
})

test('stripDelims：整段 $…$ / $$…$$ / \\(…\\) 剥壳', () => {
  assert.equal(stripDelims('$v_0=\\sqrt{2gh}$'), 'v_0=\\sqrt{2gh}')
  assert.equal(stripDelims('$$E_k=\\frac{1}{2}mv^2$$'), 'E_k=\\frac{1}{2}mv^2')
  assert.equal(stripDelims('\\(a^2+b^2\\)'), 'a^2+b^2')
  // 不是"整段被包裹"就原样返回，避免误伤正文里的货币符
  assert.equal(stripDelims('价格 $5 元'), '价格 $5 元')
})

test('renderMath：带定界符的块级公式不再标红（提示词要求 AI 写 $…$）', () => {
  for (const s of ['$v=\\frac{1}{2}mv^2$', '$$E_k=\\frac{1}{2}mv^2$$', 'R=\\frac{v_0^2\\sin 2\\theta}{g}']) {
    const html = renderMath(stripDelims(s), true)
    assert.ok(html.includes('katex'), s + ' 应渲染为 KaTeX')
    assert.ok(noError(html), s + ' 不应出现 katex-error')
  }
})

test('fixCmdSpacing：拆分粘连命令，但不误伤合法长命令', () => {
  assert.equal(fixCmdSpacing('\\SigmaM_外'), '\\Sigma M_外')
  assert.equal(fixCmdSpacing('\\omegaR'), '\\omega R')
  assert.equal(fixCmdSpacing('\\intr^{2}dm'), '\\int r^{2}dm')
  for (const ok of ['\\sinh(x)', '\\frac{a}{b}', '\\text{外}', '\\overline{AB}', '\\theta01']) {
    assert.equal(fixCmdSpacing(ok), ok)
  }
})

test('toSegments：中英混排里的行内公式与纯文本分段正确', () => {
  const segs = toSegments('由 $v=s/t$ 得，速度是 5 m/s。')
  assert.ok(segs.some(s => s.tex && s.html.includes('katex')))
  assert.ok(segs.some(s => !s.tex && s.text.includes('速度')))
})

test('回归锁：store.js 不得再把 updatedAt 写进响应式 DB（曾造成保存自循环）', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/store.js', import.meta.url)), 'utf8')
  assert.equal(/DB\.updatedAt\s*=/.test(src), false)
})

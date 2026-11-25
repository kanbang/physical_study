/* 内容扩展点回归测试：node --test tests/
   1) collectAddons 的排序 / 去重 / 非法跳过（纯函数，不依赖 Vite）
   2) 新增题目与趣味题的字段、关联知识点、LaTeX 渲染、数值自洽
   3) 新增内容不与内置题库撞 id */
import test from 'node:test'
import assert from 'node:assert/strict'
import {collectAddons} from '../src/data/mergeAddons.js'
import {BASE_PROBLEMS} from '../src/data/problems.js'
import {BASE_WONDERS} from '../src/data/wonders.js'
import {TOPICS} from '../src/data/topics.js'
import {ADDON_WONDERS} from '../src/data/addons/01-wonders.js'
import {ADDON_PROBLEMS} from '../src/data/addons/02-problems.js'
import {renderMath, stripDelims, toSegments} from '../src/lib/tex.js'

const noKatexError = html => !String(html).includes('katex-error')

test('collectAddons：按文件名字典序收集，两类内容分开', () => {
  const files = {
    './addons/02-x.js': {ADDON_PROBLEMS: [{id: 'p2', title: 'B', text: '题干'}], ADDON_WONDERS: [{id: 'w2', title: 'B', reveal: '揭晓'}]},
    './addons/01-a.js': {ADDON_PROBLEMS: [{id: 'p1', title: 'A', text: '题干'}], ADDON_WONDERS: [{id: 'w1', title: 'A', reveal: '揭晓'}]},
  }
  const r = collectAddons(files, () => {})
  assert.deepEqual(r.problems.map(x => x.id), ['p1', 'p2'])
  assert.deepEqual(r.wonders.map(x => x.id), ['w1', 'w2'])
})

test('collectAddons：id 重复 / 缺字段 / 非对象只跳过并告警', () => {
  const warns = []
  const files = {'./addons/01-a.js': {
    ADDON_PROBLEMS: [
      {id: 'p1', title: '好题', text: '题干'},
      {id: 'p1', title: '重复', text: '题干'},
      {id: 'p2', title: '缺题干'},
      {title: '缺 id', text: '题干'},
      null,
    ],
    ADDON_WONDERS: [{id: 'w1', title: '缺揭晓'}],
  }}
  const r = collectAddons(files, m => warns.push(m))
  assert.deepEqual(r.problems.map(x => x.id), ['p1'])
  assert.equal(r.wonders.length, 0)
  assert.ok(warns.some(m => m.includes('重复')))
  assert.ok(warns.some(m => m.includes('缺少 text')))
  assert.ok(warns.some(m => m.includes('缺少 reveal')))
  assert.equal(warns.length, 5)
})

test('collectAddons：兼容 PROBLEMS / WONDERS 别名，空输入安全', () => {
  const r = collectAddons({'x.js': {PROBLEMS: [{id: 'p', title: 'T', text: 'Q'}], WONDERS: [{id: 'w', title: 'T', reveal: 'R'}]}}, () => {})
  assert.equal(r.problems.length, 1)
  assert.equal(r.wonders.length, 1)
  assert.deepEqual(collectAddons({}, () => {}), {problems: [], wonders: []})
})

test('新增内容 id 不与内置题库重复，且自身不重复', () => {
  const pids = BASE_PROBLEMS.concat(ADDON_PROBLEMS).map(x => x.id)
  const wids = BASE_WONDERS.concat(ADDON_WONDERS).map(x => x.id)
  assert.equal(new Set(pids).size, pids.length)
  assert.equal(new Set(wids).size, wids.length)
  assert.equal(ADDON_PROBLEMS.length, 2)
  assert.equal(ADDON_WONDERS.length, 3)
})

test('新增趣味题字段齐全、关联知识点真实存在', () => {
  const ids = new Set(TOPICS.map(t => t.id))
  for (const w of ADDON_WONDERS) {
    for (const k of ['id', 'title', 'realm', 'level', 'hook', 'reveal', 'formula', 'tryIt', 'deeper']) {
      assert.ok(String(w[k] || '').trim(), w.id + ' 缺 ' + k)
    }
    assert.ok(Array.isArray(w.think) && w.think.length >= 2, w.id + ' 缺引导问题')
    assert.ok(w.topics.every(t => ids.has(t)), w.id + ' 有悬空知识点引用')
    assert.ok(['入门', '进阶', '脑洞'].includes(w.level))
  }
})

test('新增题目字段齐全、答案均为有限数值', () => {
  for (const p of ADDON_PROBLEMS) {
    for (const k of ['id', 'level', 'dom', 'title', 'text', 'trap']) assert.ok(String(p[k] || '').trim(), p.id + ' 缺 ' + k)
    assert.ok(Array.isArray(p.hints) && p.hints.length >= 2)
    assert.ok(Array.isArray(p.solution) && p.solution.length >= 2)
    assert.ok(p.answers.length >= 2)
    for (const a of p.answers) {
      assert.ok(String(a.label || '').trim() && String(a.unit || '').trim())
      assert.ok(Number.isFinite(a.value) && a.tol > 0)
    }
  }
})

test('新增内容所有公式渲染无 katex-error（含块级 formula）', () => {
  const fields = w => [w.hook, ...(w.think || []), w.reveal, w.tryIt, w.deeper, w.formula]
  for (const w of ADDON_WONDERS) {
    assert.ok(noKatexError(renderMath(stripDelims(w.formula), true)), w.id + ' 块级公式报错')
    for (const f of fields(w)) {
      const html = toSegments(f).map(s => s.html || '').join('')
      assert.ok(noKatexError(html), w.id + ' 行内公式报错：' + f.slice(0, 40))
    }
  }
  for (const p of ADDON_PROBLEMS) {
    for (const f of [p.text, p.trap, ...p.hints, ...p.solution]) {
      const html = toSegments(f).map(s => s.html || '').join('')
      assert.ok(noKatexError(html), p.id + ' 公式报错：' + f.slice(0, 40))
    }
  }
})

test('数值核验：p15 完全弹性碰撞', () => {
  const m1 = 2, m2 = 1, v0 = 6
  const v1 = (m1 - m2) / (m1 + m2) * v0
  const v2 = 2 * m1 / (m1 + m2) * v0
  const eta = 4 * m1 * m2 / (m1 + m2) ** 2 * 100
  const got = ADDON_PROBLEMS.find(p => p.id === 'p15').answers.map(a => a.value)
  assert.ok(Math.abs(got[0] - v1) < 0.01 && Math.abs(got[1] - v2) < 0.01 && Math.abs(got[2] - eta) < 0.01)
  assert.ok(Math.abs(0.5 * m1 * v0 ** 2 - (0.5 * m1 * v1 ** 2 + 0.5 * m2 * v2 ** 2)) < 1e-9)
})

test('数值核验：p16 RC 充电能量账', () => {
  const R = 1e4, C = 1e-4, E = 12
  const tau = R * C, t = tau * Math.log(2), W = C * E ** 2 * 1000, U = 0.5 * C * E ** 2 * 1000
  const got = ADDON_PROBLEMS.find(p => p.id === 'p16').answers.map(a => a.value)
  assert.ok(Math.abs(got[0] - tau) < 0.01)
  assert.ok(Math.abs(got[1] - t) < 0.01)
  assert.ok(Math.abs(got[2] - W) < 0.01 && Math.abs(got[3] - U) < 0.01 && Math.abs(got[4] - (W - U)) < 0.01)
})

test('数值核验：w16 压力熔化量级 / w17 微波波长 / w18 滚动时间比', () => {
  const p = 600 / (2 * 0.30 * 0.001)
  assert.ok(Math.abs(p - 1e6) < 1)
  assert.ok(Math.abs(p * 7.4e-8 - 0.074) < 0.002)
  assert.ok(Math.abs(3e8 / 2.45e9 - 0.122) < 0.002)
  const ratio = Math.sqrt((5 / 7) / (3 / 5))
  assert.ok(Math.abs(ratio - Math.sqrt(25 / 21)) < 1e-9 && Math.abs(ratio - 1.09) < 0.01)
})

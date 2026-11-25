/* 卡片校验回归：拦截条件与"可保存但提醒"必须靠结构化字段区分，不能再靠中文文案正则。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {checkCard} from '../src/lib/cardCheck.js'

const problem = over => ({kind: 'problem', problem: Object.assign({title: '斜面', text: '从 5 m 滑下', answers: [{label: 'v', value: 10, unit: 'm/s'}]}, over)})
const wonder = over => ({kind: 'wonder', wonder: Object.assign({title: '电鳗', reveal: '直流脉冲'}, over)})

test('完整卡片：blocking 与 warning 都为空', () => {
  assert.deepEqual(checkCard(problem()), {blocking: '', warning: ''})
  assert.deepEqual(checkCard(wonder()), {blocking: '', warning: ''})
})

test('必填项缺失 → blocking（调用方必须拦下）', () => {
  assert.match(checkCard(problem({title: '  '})).blocking, /标题/)
  assert.match(checkCard(problem({text: ''})).blocking, /题干/)
  assert.match(checkCard(wonder({title: ''})).blocking, /标题/)
  assert.match(checkCard(wonder({reveal: ''})).blocking, /揭晓/)
  assert.match(checkCard(null).blocking, /没有卡片内容/)
})

test('无标准答案 → 只给 warning，不拦截（可保存为只读题）', () => {
  const r = checkCard(problem({answers: []}))
  assert.equal(r.blocking, '')
  assert.match(r.warning, /不能自动判分/)
  // 数值无法解析同样不算"可判分"
  const r2 = checkCard(problem({answers: [{label: 'v', value: '待核验'}]}))
  assert.equal(r2.blocking, '')
  assert.match(r2.warning, /不能自动判分/)
})

test('未知卡片类型 → blocking', () => {
  assert.match(checkCard({kind: 'model'}).blocking, /未知的卡片类型/)
})

test('回归锁：源码里不得再用中文文案正则做控制流', () => {
  const root = fileURLToPath(new URL('../src', import.meta.url))
  const walk = dir => readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : (/\.(vue|js)$/.test(f) ? [p] : [])
  })
  const hits = []
  for (const f of walk(root)) {
    const src = readFileSync(f, 'utf8')
    if (/\/请先填写\/|\/可以保存\//.test(src)) hits.push(f)
  }
  assert.deepEqual(hits, [], '这些文件仍在用中文文案判断校验结果：' + hits.join(', '))
})

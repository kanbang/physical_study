/* 仿真插件回归测试：node --test tests/
   1) src/sims/*.js 全部结构合规、id 不重复（新增仿真只丢文件即生效）
   2) 07 受迫振动：长时间推进后数值振幅逼近解析稳态、能量账守恒、绘图不抛错 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync} from 'node:fs'

const simDir = new URL('../src/sims/', import.meta.url)
const defs = []
for (const f of readdirSync(simDir).filter(n => n.endsWith('.js')).sort()) {
  const m = await import(new URL(f, simDir).href)
  defs.push({file: f, def: m.default})
}

test('全部仿真：字段齐全、id 唯一、init/step/draw/rows 可调用', () => {
  // 只设下限不设上限：以后往 src/sims/ 丢新文件即自动纳入，本测试无需改动
  assert.ok(defs.length >= 7, '仿真数量不应少于 7，实际 ' + defs.length)
  const ids = new Set()
  for (const {file, def} of defs) {
    for (const k of ['id', 'name', 'brief', 'rate', 'params', 'init', 'step', 'draw', 'rows', 'note', 'legend']) {
      assert.ok(def && def[k] !== undefined, file + ' 缺 ' + k)
    }
    assert.ok(typeof def.id === 'string' && typeof def.name === 'string')
    assert.ok(Array.isArray(def.params) && def.params.length > 0)
    for (const k of ['init', 'step', 'draw', 'rows']) assert.equal(typeof def[k], 'function', file + '.' + k)
    assert.ok(!ids.has(def.id), file + ' id 重复：' + def.id)
    ids.add(def.id)
  }
  assert.ok(ids.has('drive'), '新增的受迫振动仿真未被注册')
})

test('新增仿真 07：结构、解析量、稳态数值解', () => {
  const def = defs.find(d => d.def.id === 'drive').def
  const p = {}
  for (const q of def.params) p[q.k] = q.val
  const s = def.init(p)
  assert.equal(s.t, 0)
  const dt = 1 / 240
  for (let i = 0; i < 240 * 30; i++) def.step(dt, p, s)   // 30 s 物理时间，瞬态早已衰减

  const rows = Object.fromEntries(def.rows(s, p))
  const numA = Object.keys(rows).find(k => k.includes('数值近一周期振幅'))
  const theA = Object.keys(rows).find(k => k.includes('理论稳态振幅'))
  const Anum = Number(rows[numA].split(' ')[0])
  const A = Number(rows[theA].split(' ')[0])
  assert.ok(Number.isFinite(Anum) && Number.isFinite(A) && A > 0)
  assert.ok(Math.abs(Anum - A) / A < 0.01, '数值振幅应逼近解析稳态，实际 ' + Anum + ' vs ' + A)

  const residual = Object.keys(rows).find(k => k.includes('能量残差'))
  assert.ok(Math.abs(Number(rows[residual].split(' ')[0])) < 0.05, '能量账应守恒：' + rows[residual])
  for (const [k, v] of Object.entries(rows)) assert.ok(!/NaN|Infinity/.test(v), k + ' 出现非有限值：' + v)
})

test('新增仿真 07：共振点振幅最大、Q 随阻尼增大而下降', () => {
  const def = defs.find(d => d.def.id === 'drive').def
  const base = {}
  for (const q of def.params) base[q.k] = q.val
  const read = p => {
    const s = def.init(p)
    for (let i = 0; i < 240 * 8; i++) def.step(1 / 240, p, s)
    return Object.fromEntries(def.rows(s, p))
  }
  const at = w => Number(read({...base, w})['理论稳态振幅 A(ω)'].split(' ')[0])
  const wr = Number(read(base)['共振频率 ω_r'].split(' ')[0])
  assert.ok(wr > 0 && wr < Math.sqrt(base.k / base.m))
  assert.ok(at(wr) > at(base.w) || Math.abs(at(wr) - at(base.w)) / at(wr) < 0.02)
  assert.ok(at(wr) > at(wr * 0.6) && at(wr) > at(wr * 1.5), '共振点应是幅频曲线峰值')
  const qLow = Number(read({...base, b: base.b})['品质因数 Q = ω₀/(2β)'])
  const qHigh = Number(read({...base, b: base.b * 4})['品质因数 Q = ω₀/(2β)'])
  assert.ok(qHigh < qLow / 3.9 && qHigh > qLow / 4.1)
})

test('新增仿真 07：draw 在 mock canvas 上不抛异常', () => {
  const def = defs.find(d => d.def.id === 'drive').def
  const p = {}
  for (const q of def.params) p[q.k] = q.val
  const s = def.init(p)
  for (let i = 0; i < 240 * 3; i++) def.step(1 / 240, p, s)
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => { t[k] = v; return true },
  })
  assert.doesNotThrow(() => def.draw(ctx, 900, 560, s, p))
})

/* 新增仿真 08–11 的回归测试：数值解 vs 解析解、守恒律、结构合规、绘图不抛错。
   覆盖四个此前空白的板块：天体轨道 / 碰撞质心系 / RC 电路 / 光电效应。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync} from 'node:fs'

const simDir = new URL('../src/sims/', import.meta.url)
const defs = new Map()
for (const f of readdirSync(simDir).filter(n => n.endsWith('.js')).sort()) {
  const d = (await import(new URL(f, simDir).href)).default
  defs.set(d.id, d)
}
const of = id => defs.get(id)
const params = id => {
  const p = {}
  for (const q of of(id).params) p[q.k] = q.val
  return p
}
const run = (id, secs, over = {}) => {
  const d = of(id), p = {...params(id), ...over}, s = d.init(p)
  for (let i = 0; i < 240 * secs; i++) d.step(1 / 240, p, s)
  return {s, p, rows: Object.fromEntries(d.rows(s, p))}
}
// 读数形如 "0.94167 m"、"0（相对值）"、"6.626070e-34 J·s"，用 parseFloat 稳健取首位数值
const num = v => parseFloat(String(v))
const mockCtx = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true }
})

test('08–11 四个新仿真均已由插件机制自动注册', () => {
  for (const id of ['kepler', 'collision', 'rc', 'photo']) {
    assert.ok(defs.has(id), '未注册：' + id)
  }
  assert.equal(defs.size, 13)
})

test('08 开普勒：活力公式、面积速度、能量、周期全部与解析一致', () => {
  const {s, p, rows} = run('kepler', 6, {k: .82})
  assert.ok(s.t > 0)
  assert.ok(Math.abs(num(rows['速率相对偏差'])) < .01)
  assert.ok(Math.abs(num(rows['面积速度相对偏差'])) < .01)
  assert.ok(Math.abs(num(rows['能量残差 (ε−ε₀)/|ε₀|'])) < .01)
  assert.equal(num(rows['偏心率 e = |k²−1|']).toFixed(4), Math.abs(.82 ** 2 - 1).toFixed(4))
  const T = num(rows['解析周期 T = √(a³/M)']), Tm = num(rows['实测周期（过 +x 轴）'])
  assert.ok(Math.abs(Tm - T) / T < .03, '实测周期应贴近解析：' + Tm + ' vs ' + T)
  // 圆轨道：r 恒等于 r₀，v 恒等于 v_c
  const c = run('kepler', 4, {k: 1})
  assert.ok(Math.abs(num(c.rows['当前日距 r']) - 1) < 1e-6)
  assert.ok(Math.abs(num(c.rows['当前速率 v（数值）']) - 2 * Math.PI) < 1e-4)
  // 开普勒第三定律 T² = a³/M
  const a = num(rows['半长轴 a = r₀/(2−k²)'])
  assert.ok(Math.abs(T * T - a ** 3 / p.M) / (T * T) < 1e-3, 'T² 应等于 a³/M（读数已四舍五入到 5 位）')
})

test('09 碰撞：动量/能量守恒、质心匀速、恢复系数、e=0 损失最大', () => {
  for (const e of [1, .5, 0]) {
    const {s, p, rows} = run('collision', 3, {e})
    assert.ok(Math.abs(num(rows['动量守恒残差'])) < 1e-8, 'e=' + e + ' 动量应守恒')
    assert.ok(Math.abs(num(rows['能量残差 E₀−E−损失'])) < 1e-8, 'e=' + e + ' 能量账应闭合')
    const xy = rows['质心位置 数值 / 解析'].split(' / ').map(parseFloat)
    assert.ok(Math.abs(xy[0] - xy[1]) < 1e-8, '质心应严格匀速直线')
    assert.ok(Math.abs(num(rows['恢复系数 实测 / 设定']) - e) < 1e-8)
    const pp = rows['质心系动量 p₁′ / p₂′'].split(' / ').map(parseFloat)
    assert.ok(Math.abs(pp[0] + pp[1]) < 1e-8, '质心系动量应等大反向')
  }
  const full = run('collision', 3, {e: 0})
  const mu = num(full.rows['约化质量 μ = m₁m₂/M'])
  assert.ok(Math.abs(num(full.rows['累计碰撞损失']) - .5 * mu * 9) / 3 < 1e-4, 'e=0 应损失全部相对动能 ½μv_rel²')
  const elastic = run('collision', 3, {e: 1})
  assert.equal(num(elastic.rows['累计碰撞损失']), 0)
})

test('10 RC：数值解贴合解析、能量账闭合、充满时储能与发热各占一半', () => {
  for (const mode of ['charge', 'discharge']) {
    const {s, rows} = run('rc', 8, {mode})
    assert.ok(Math.abs(num(rows['电压相对偏差'])) < .01, mode + ' 数值解应贴合解析')
    assert.ok(Math.abs(num(rows['能量残差 来源−E_C−Q_R'])) < 1e-6, mode + ' 能量账应闭合')
    assert.ok(Math.abs(num(rows['时间常数 τ = RC']) - 1) < 1e-9, 'τ = 10kΩ×100μF = 1 s')
    assert.ok(s.t > 5, '应推进若干个 τ')
  }
  const c = run('rc', 8).rows
  const ec = num(c['电容储能 E_C = ½Cu²']), qr = num(c['电阻发热 Q_R'])
  assert.ok(Math.abs(ec - qr) / ec < .01, '充电末态储能与发热应各占一半，实际 ' + ec + ' / ' + qr)
  assert.ok(Math.abs(ec - num(c['总能量标度 ½CU₀²'])) / ec < .01)
  const d = run('rc', 8, {mode: 'discharge'}).rows
  assert.ok(Math.abs(num(d['电阻发热 Q_R']) - num(d['总能量标度 ½CU₀²'])) < 1e-3, '放电末态储能全部变焦耳热')
  assert.ok(Math.abs(num(d['电容储能 E_C = ½Cu²'])) < 1e-3)
  // R 改变只改 τ 与电流，不改终值比例
  const r2 = run('rc', 8, {R: 20}).rows
  assert.ok(Math.abs(num(r2['电阻发热 Q_R']) - qr) < 1e-3, '焦耳热终值与 R 无关')
})

test('11 光电效应：爱因斯坦方程、红限、斜率测定 h、光强只改饱和电流', () => {
  const a = run('photo', 10).rows
  assert.ok(Math.abs(num(a['最大初动能 K_max = hν−W']) - (num(a['光子能量 hν']) - num(a['金属逸出功 W']))) < 1e-9)
  assert.ok(Math.abs(num(a['截止电压 U_c = K_max/e']) - num(a['最大初动能 K_max = hν−W'])) < 1e-9)
  assert.ok(Math.abs(num(a['红限频率 ν₀ = W/h']) - 2.28 / .4135667696) < .001)
  assert.ok(Math.abs(num(a['与标准值相对偏差'])) < 1e-6, '由斜率反推的 h 应等于标准值')
  assert.ok(Math.abs(Number(a['由此测得 h = e·斜率'].split(' ')[0]) - 6.62607015e-34) < 1e-40)
  // 低于红限：无光电子；提高光强不改变 U_c
  const dark = run('photo', 10, {nu: 4, W: 4.5}).rows
  assert.match(dark['是否发生光电效应'], /否/)
  assert.equal(num(dark['当前光电流 I']), 0)
  const bright = run('photo', 10, {I0: 1}).rows
  assert.equal(bright['截止电压 U_c = K_max/e'], a['截止电压 U_c = K_max/e'])
  assert.notEqual(bright['饱和电流 I₀（∝光强）'], a['饱和电流 I₀（∝光强）'])
})

test('12 挡板弹簧：准静态平衡、F 减小 / N 不变 / L 变长', () => {
  const read = theta => run('wallSpring', 3, {theta, auto:'manual'}).rows
  const a = read(45), b = read(60)
  const ma = 1, mb = 2, g = 10
  assert.ok(Math.abs(num(a['推力 F = T cosθ']) - ma * g / Math.tan(45 * Math.PI / 180)) < .01)
  assert.ok(Math.abs(num(b['推力 F = T cosθ']) - ma * g / Math.tan(60 * Math.PI / 180)) < .01)
  assert.ok(Math.abs(num(b['b 对 OQ 压力 N']) - (ma + mb) * g) < 1e-6)
  assert.equal(num(a['b 对 OQ 压力 N']), num(b['b 对 OQ 压力 N']), 'N 应始终等于两球总重')
  assert.ok(num(b['推力 F = T cosθ']) < num(a['推力 F = T cosθ']), 'θ 增大时 F 应变小')
  assert.ok(num(b['弹簧长度 L']) > num(a['弹簧长度 L']), 'θ 增大时弹簧应变长')
  assert.ok(num(b['压缩量 L₀−L']) < num(a['压缩量 L₀−L']), 'θ 增大时压缩量应变小')
  assert.ok(num(b['b 到 O 的水平距离 x']) < num(a['b 到 O 的水平距离 x']), 'b 应向左靠近 O')
  assert.ok(num(b['a 的高度 y']) > num(a['a 的高度 y']), 'a 应沿竖直板上升')
  assert.match(b['判断 A：F 变大'], /错误/)
  assert.match(b['判断 B：N_OQ 变大'], /错误/)
  assert.match(b['判断 C：弹簧变短'], /错误/)
  assert.match(b['判断 D：弹簧变长'], /正确/)
})

test('13 三力平衡：拉密定理、示数此消彼长、末态对调', () => {
  const read = phi => run('forceTriangle', 3, {phi, auto:'manual'}).rows
  const a = read(0), b = read(60)
  assert.ok(Math.abs(num(a['测力计 a 示数 Tₐ']) - 5.8) < .01)
  assert.ok(Math.abs(num(a['测力计 b 示数 Tᵦ']) - 2.9) < .01)
  assert.ok(Math.abs(num(b['测力计 a 示数 Tₐ']) - 2.9) < .01)
  assert.ok(Math.abs(num(b['测力计 b 示数 Tᵦ']) - 5.8) < .01)
  assert.ok(num(b['测力计 a 示数 Tₐ']) < num(a['测力计 a 示数 Tₐ']), 'a 应变小')
  assert.ok(num(b['测力计 b 示数 Tᵦ']) > num(a['测力计 b 示数 Tᵦ']), 'b 应变大')
  assert.equal(num(a['a、b 夹角（不变）']), 120)
  assert.equal(num(b['a、b 夹角（不变）']), 120)
  assert.match(b['a 示数变化'], /变小/)
  assert.match(b['b 示数变化'], /变大/)
})

test('12/13 动画与拖拽：自动往返会推进，直接拖小球/测力计可改变角度与读数', () => {
  for (const id of ['wallSpring', 'forceTriangle']) {
    const d = of(id), p = params(id), s = d.init(p)
    const key = id === 'wallSpring' ? 'theta' : 'phi'
    const start = s[key]
    for (let i = 0; i < 240; i++) d.step(1 / 240, p, s)
    assert.ok(Math.abs(s[key] - start) > 1, id + ' 自动演示应推进角度')
    assert.ok(d.tip && d.autoKey && typeof d.pointer === 'function', id + ' 应有拖拽/动画支持')
  }
  // 拖 b 向左：θ 增大、F 减小、弹簧变长
  {
    const d = of('wallSpring'), p = {...params('wallSpring'), auto:'manual', theta:45}, s = d.init(p)
    const W = 900, H = 560, ox = 96, oy = H - 74, R = p.L0 * 1.12
    const sc = Math.min((W - 210) / R, (H - 122) / R), bx = ox + s.x * sc
    const F0 = s.F, L0 = s.L
    assert.equal(d.pointer('down', bx, oy, s, p, W, H), true)
    assert.equal(d.pointer('move', bx - 80, oy, s, p, W, H), true)
    assert.ok(s.theta > 45, '向左拖 b 应增大 θ')
    assert.ok(s.F < F0 && s.L > L0, '推力应变小、弹簧应变长')
    d.pointer('up', 0, 0, s, p, W, H)
  }
  // 拖 a 向上：θ 同样增大（反向校验另一只球可拖）
  {
    const d = of('wallSpring'), p = {...params('wallSpring'), auto:'manual', theta:45}, s = d.init(p)
    const W = 900, H = 560, ox = 96, oy = H - 74, R = p.L0 * 1.12
    const sc = Math.min((W - 210) / R, (H - 122) / R), ay = oy - s.y * sc
    assert.equal(d.pointer('down', ox, ay, s, p, W, H), true)
    assert.equal(d.pointer('move', ox, ay - 60, s, p, W, H), true)
    assert.ok(s.theta > 45, '向上拖 a 应增大 θ')
  }
  // 拖测力计 a 顺时针转向水平：φ 增大、a 示数变小、b 示数变大
  {
    const d = of('forceTriangle'), p = {...params('forceTriangle'), auto:'manual', phi:0}, s = d.init(p)
    const W = 900, H = 560, ox = W * .40, oy = H * .60, R = Math.min(H * .40, W * .26)
    const ax = ox + R * .66 * Math.cos(Math.PI / 3), ay = oy - R * .66 * Math.sin(Math.PI / 3)
    const Ta0 = s.Ta, Tb0 = s.Tb
    assert.equal(d.pointer('down', ax, ay, s, p, W, H), true)
    const nx = ox + R * .55 * Math.cos(Math.PI / 6), ny = oy - R * .55 * Math.sin(Math.PI / 6)
    assert.equal(d.pointer('move', nx, ny, s, p, W, H), true)
    assert.ok(s.phi > 0, '顺时针拖 a 应增大 φ')
    assert.ok(s.Ta < Ta0 && s.Tb > Tb0, 'a 示数变小、b 示数变大')
    d.pointer('up', 0, 0, s, p, W, H)
  }
})

test('08–11、12、13 全部：rows 无 NaN/Infinity/undefined，draw 在 mock canvas 上不抛异常', () => {
  for (const id of ['kepler', 'collision', 'rc', 'photo', 'wallSpring', 'forceTriangle']) {
    const d = of(id), p = params(id), s = d.init(p)
    for (let i = 0; i < 240 * 5; i++) d.step(1 / 240, p, s)
    for (const [k, v] of Object.entries(Object.fromEntries(d.rows(s, p)))) {
      assert.ok(!/NaN|Infinity|undefined/.test(String(v)), id + '.' + k + ' = ' + v)
    }
    assert.doesNotThrow(() => d.draw(mockCtx(), 900, 560, s, p), id + '.draw 抛异常')
  }
})

test('08–11、12、13 全部：参数极值下 rows 仍为有限值且 draw 正常', () => {
  const cases = {
    kepler: [{M: .5, r0: .4, k: .55}, {M: 2, r0: 1.6, k: 1.35}],
    collision: [{m1: .2, m2: 5, v1: -4, v2: 6, e: 0}, {m1: 5, m2: .2, v1: 6, v2: -4, e: 1}],
    rc: [{mode: 'charge', U0: 1, R: 2, C: 20}, {mode: 'discharge', U0: 12, R: 50, C: 500}],
    photo: [{nu: 4, W: 4.5, I0: .2}, {nu: 12, W: 1.8, I0: 1}],
    wallSpring: [{theta: 80, ma: 1.5, mb: 4, k: 100, L0: .8, auto: 'auto'},
                 {theta: 35, ma: .5, mb: .5, k: 400, L0: 1.6, auto: 'manual'}],
    forceTriangle: [{phi: 60, Ta0: 8, auto: 'auto'}, {phi: 0, Ta0: 4, auto: 'manual'}]
  }
  for (const [id, list] of Object.entries(cases)) {
    const d = of(id)
    for (const over of list) {
      const p = {...params(id), ...over}, s = d.init(p)
      for (let i = 0; i < 240 * 3; i++) d.step(1 / 240, p, s)
      for (const [k, v] of Object.entries(Object.fromEntries(d.rows(s, p)))) {
        assert.ok(!/NaN|Infinity|undefined/.test(String(v)), id + ' ' + JSON.stringify(over) + ' → ' + k + ' = ' + v)
      }
      assert.doesNotThrow(() => d.draw(mockCtx(), 900, 560, s, p))
    }
  }
})

// 仿真 12 · 直角挡板间的压缩弹簧（准静态推球 / 正交分解 / 整体法）
// 与题目 p17 配套：可拖小球 a / b，也可自动往返；F 减小、N 不变、L 变长。
import {COL,frame,line,arrow,label,dot,plot,fmtNum} from "../lib/canvasUtils.js"

const G = 10
const rad = d => d * Math.PI / 180
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const calc = (deg, p) => {
  const th = rad(deg), sn = Math.max(Math.sin(th), 1e-6), cs = Math.cos(th)
  const T = p.ma * G / sn        // 竖直平衡：T sinθ = mₐg
  const d = T / p.k              // 压缩量
  const L = p.L0 - d             // 弹簧长度
  return {T, d, L, x: L * cs, y: L * sn, F: T * cs, Na: T * cs,
          Nb: (p.ma + p.mb) * G, sn, cs, th}
}
// 画面坐标与 draw 共用，便于 canvas 拖拽命中
const view = (W, H, p) => {
  const ox = 96, oy = H - 74
  const R = p.L0 * 1.12
  const sc = Math.min((W - 210) / R, (H - 122) / R)
  return {ox, oy, sc, X: x => ox + x * sc, Y: y => oy - y * sc}
}
// 由 b 的横坐标 x（随 θ 减小）或 a 的高度 y（随 θ 增大）反解 θ
const solveTheta = (target, key, inc, p) => {
  let lo = 35, hi = 80
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2, v = calc(mid, p)[key]
    if (inc ? v > target : v < target) hi = mid; else lo = mid
  }
  return (lo + hi) / 2
}

export default {
  id:'wallSpring', name:'直角挡板 · 压缩弹簧推球',
  brief:'拖小球 / 自动往返 / F↓ N不变 L↑', rate:1,
  tip:'直接拖橙色小球 b（或蓝色小球 a）改变夹角；点「自动演示」可让它自己来回。',
  autoKey:'auto', manualKeys:['theta'],
  sync(p, s) { p.theta = Math.round(s.theta * 10) / 10 },
  legend:[{c:COL.red,n:'重力 mg'},{c:COL.green,n:'挡板支持力 N'},
          {c:COL.blue,n:'弹簧弹力 T'},{c:COL.orange,n:'推力 F'}],
  note:`<b>先记住一句话：</b>把 b 往左推，弹簧更陡，反而<b>更省力</b>。
  <ol style="margin:6px 0 0;padding-left:20px">
    <li><b>弹簧是被压短的。</b>竖直挡板光滑，只能给 a 水平支持力；要托住 a 的重力，只能靠弹簧斜向上的弹力，所以弹簧必须压缩。</li>
    <li><b>a 的重力没变。</b>弹簧越陡，托住同样重力需要的弹力越小：T = mₐg ÷ sinθ。θ 从 45° 增到 60°，T 从 14.1 N 减到 11.5 N。</li>
    <li><b>推力跟着变小。</b>F 只是弹力的水平分量：F = T·cosθ = mₐg ÷ tanθ，从 10 N 减到 5.77 N。所以 A「变大」错。</li>
    <li><b>地面压力不变。</b>把两球和弹簧看成一个整体，地面只需托住总重 30 N，与你用多大力推无关。B 错。</li>
    <li><b>弹簧反而变长。</b>弹力小 → 压缩量小 → 长度变大（1.129 m → 1.142 m）。C 错、D 对。</li>
  </ol>
  <b>答案：错误的是 A、B、C。</b>拖小球或点「自动演示」亲自看一遍。`,
  params:[
    {k:'theta',label:'目标夹角 θ',min:35,max:80,step:1,val:45,unit:'°'},
    {k:'ma',label:'a 的质量 mₐ',min:.5,max:1.5,step:.1,val:1,unit:'kg'},
    {k:'mb',label:'b 的质量 mᵦ',min:.5,max:4,step:.1,val:2,unit:'kg'},
    {k:'k',label:'劲度系数 k',min:100,max:400,step:10,val:200,unit:'N/m'},
    {k:'L0',label:'弹簧原长 L₀',min:.8,max:1.6,step:.1,val:1.2,unit:'m'},
    {type:'select',k:'auto',label:'演示方式',options:[{v:'auto',n:'自动往返（推荐）'},{v:'manual',n:'手动拖 θ'}],val:'auto'}
  ],
  init(p) {
    const th = clamp(Number(p.theta) || 45, 35, 80)
    const mode = p.auto || 'manual'
    const s = {t:0, theta:th, theta0:th, lastAuto:mode,
               autoDir: mode === 'auto' ? (th <= 57.5 ? 1 : -1) : 0,
               grab:null, hover:null, trace:[]}
    Object.assign(s, calc(th, p))
    return s
  },
  step(dt, p, s) {
    s.t += dt
    const mode = p.auto || 'manual'
    if (mode !== s.lastAuto) {
      s.lastAuto = mode
      s.autoDir = mode === 'auto' ? (s.theta <= 57.5 ? 1 : -1) : 0
    }
    if (mode === 'auto') {
      // 匀速往返，端点掉头，不会卡在滑块给定的旧角度
      s.theta += s.autoDir * 14 * dt
      if (s.theta >= 80) { s.theta = 80; s.autoDir = -1 }
      if (s.theta <= 35) { s.theta = 35; s.autoDir = 1 }
    } else {
      const target = clamp(Number(p.theta) || 45, 35, 80)
      s.theta += clamp(target - s.theta, -220 * dt, 220 * dt)
    }
    Object.assign(s, calc(s.theta, p))
    s.trace.push([s.x, s.y]); if (s.trace.length > 180) s.trace.shift()
  },
  pointer(kind, x, y, s, p, W, H) {
    const v = view(W, H, p)
    if (kind === 'up') { s.grab = null; return true }
    const nearB = Math.hypot(x - v.X(s.x), y - v.oy) < 24
    const nearA = Math.hypot(x - v.ox, y - v.Y(s.y)) < 24
    if (kind === 'hover') { s.hover = nearB ? 'b' : nearA ? 'a' : null; return nearB || nearA }
    if (kind === 'down') {
      if (!nearB && !nearA) return false
      s.grab = nearB ? 'b' : 'a'; s.hover = s.grab
      p.auto = 'manual'
      return true
    }
    if (kind === 'move' && s.grab) {
      const deg = s.grab === 'b'
        ? solveTheta((x - v.ox) / v.sc, 'x', false, p)
        : solveTheta((v.oy - y) / v.sc, 'y', true, p)
      p.theta = Math.round(clamp(deg, 35, 80) * 10) / 10
      s.theta = p.theta
      Object.assign(s, calc(s.theta, p))
      return true
    }
    return false
  },
  draw(ctx, W, H, s, p) {
    frame(ctx, W, H)
    const v = view(W, H, p), {ox, oy, sc} = v
    const R = p.L0 * 1.12
    const X = v.X, Y = v.Y
    const top = Y(R), right = X(R)

    // 两块光滑挡板
    line(ctx, ox, oy, ox, top, '#7d889e', 4)
    line(ctx, ox, oy, right, oy, '#7d889e', 4)
    label(ctx,'P',ox-14,top+4,'#6d7893',12)
    label(ctx,'Q',right+6,oy+16,'#6d7893',12)
    label(ctx,'O',ox-20,oy+18,'#6d7893',12)

    // 初始位置（灰色虚影）与 b 的运动轨迹
    const g0 = calc(s.theta0, p)
    ctx.save(); ctx.globalAlpha = .35
    dot(ctx, X(0), Y(g0.y), 10, COL.grey)
    dot(ctx, X(g0.x), Y(0), 10, COL.grey)
    ctx.restore()
    label(ctx,'a₀',X(0)-30,Y(g0.y)-8,COL.grey,10)
    label(ctx,'b₀',X(g0.x)-8,oy+22,COL.grey,10)
    for (let i=0;i<s.trace.length;i+=4) dot(ctx, X(s.trace[i][0]), oy, 1.6, '#cbd5e8')

    // 弹簧（压缩）
    const ax = ox, ay = Y(s.y), bx = X(s.x), by = oy
    const dx = bx-ax, dy = by-ay, len = Math.hypot(dx,dy) || 1
    const ux = dx/len, uy = dy/len, nx = -uy, ny = ux
    ctx.save(); ctx.strokeStyle = COL.blue; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(ax,ay)
    for (let i=1;i<12;i++) { const t=i/12, amp=(i%2?9:-9); ctx.lineTo(ax+dx*t+nx*amp, ay+dy*t+ny*amp) }
    ctx.lineTo(bx,by); ctx.stroke(); ctx.restore()

    const ball = (x,y,c) => { ctx.save(); ctx.fillStyle='#eef3ff'; ctx.strokeStyle=c; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore() }
    ball(ax,ay,COL.blue); ball(bx,by,COL.orange)
    label(ctx,'a',ax-26,ay-10,COL.blue,12)
    label(ctx,'b',bx+14,by+4,COL.orange,12)

    // 可拖动的虚线圈：鼠标靠近或正在拖时高亮
    const ring = (x,y,hot,c) => {
      ctx.save(); ctx.strokeStyle = hot ? c : '#b9c5da'; ctx.lineWidth = hot ? 2.5 : 1.4
      ctx.setLineDash(hot ? [] : [4,3]); ctx.beginPath(); ctx.arc(x,y,17,0,Math.PI*2); ctx.stroke(); ctx.restore()
    }
    ring(ax,ay, s.grab==='a'||s.hover==='a', COL.blue)
    ring(bx,by, s.grab==='b'||s.hover==='b', COL.orange)
    label(ctx,'拖我 →',bx+20,by-18, s.grab==='b'?COL.orange:'#9aa6bd',10)

    line(ctx,bx,by,ox,by,'#dbe2ee',1,[3,3])
    label(ctx,'θ='+fmtNum(s.theta,1)+'°',bx-42,by-16,'#6d7893',11)

    // 力箭头：长度按力的大小缩放并限幅
    const Ls = v => Math.max(18, Math.min(62, v * 2.4))
    arrow(ctx, ax, ay, ax, ay+Ls(p.ma*G), COL.red, 2)
    label(ctx,'mₐg',ax+6,ay+Ls(p.ma*G),COL.red,10)
    arrow(ctx, ax, ay, ax+Ls(s.Na), ay, COL.green, 2)
    label(ctx,'N_OP',ax+Ls(s.Na)+4,ay-6,COL.green,10)
    arrow(ctx, ax, ay, ax-ux*Ls(s.T), ay-uy*Ls(s.T), COL.blue, 2)
    label(ctx,'T',ax-ux*Ls(s.T)-12,ay-uy*Ls(s.T)-6,COL.blue,10)
    arrow(ctx, bx, by, bx-Ls(s.F), by, COL.orange, 2)
    label(ctx,'F='+fmtNum(s.F,1)+' N',bx-Ls(s.F)-4,by-8,COL.orange,10,'right')
    arrow(ctx, bx, by, bx, by-Ls(s.Nb), COL.green, 2)
    label(ctx,'N_OQ',bx+6,by-Ls(s.Nb),COL.green,10)
    arrow(ctx, bx, by, bx+ux*Ls(s.T), by+uy*Ls(s.T), COL.blue, 1.5)
    label(ctx,'T',bx+ux*Ls(s.T)+4,by+uy*Ls(s.T),COL.blue,10)

    label(ctx,'直角挡板 · 准静态推球：F↓   N 不变   L↑',20,24,'#17223c',13)
    label(ctx,'θ '+fmtNum(s.theta,1)+'°    L '+fmtNum(s.L,3)+' m    F '+fmtNum(s.F,2)+' N    N_OQ '+fmtNum(s.Nb,1)+' N',20,44,'#4c5872',11)

    // 右下角：F 随 θ 变化的解析曲线与当前工作点
    const B = {x:W-268,y:H-152,w:238,h:96}, curve=[]
    for (let i=0;i<=60;i++) { const t=35+45*i/60; curve.push([t, calc(t,p).F]) }
    const fmax = Math.max(...curve.map(q=>q[1]), 1)
    plot(ctx,B,[{pts:curve,c:COL.orange}],35,80,0,fmax*1.1,'θ / °','F / N')
    dot(ctx, B.x+6+(s.theta-35)/45*(B.w-12), B.y+B.h-6-s.F/(fmax*1.1)*(B.h-12), 4, COL.blue)
  },
  rows(s,p) {
    const F35 = p.ma * G / Math.tan(rad(35)), F80 = p.ma * G / Math.tan(rad(80))
    return [
      ['夹角 θ',fmtNum(s.theta,1)+' °'],
      ['弹簧长度 L',fmtNum(s.L,4)+' m'],
      ['弹簧原长 L₀',fmtNum(p.L0,3)+' m'],
      ['压缩量 L₀−L',fmtNum(s.d,4)+' m'],
      ['弹力 T = mₐg/sinθ',fmtNum(s.T,3)+' N'],
      ['推力 F = T cosθ',fmtNum(s.F,3)+' N'],
      ['a 对 OP 压力 N_a',fmtNum(s.Na,3)+' N'],
      ['b 对 OQ 压力 N',fmtNum(s.Nb,3)+' N'],
      ['两球总重 (mₐ+mᵦ)g',fmtNum((p.ma+p.mb)*G,3)+' N'],
      ['b 到 O 的水平距离 x',fmtNum(s.x,4)+' m'],
      ['a 的高度 y',fmtNum(s.y,4)+' m'],
      ['θ=35° 时推力 F',fmtNum(F35,3)+' N'],
      ['θ=80° 时推力 F',fmtNum(F80,3)+' N'],
      ['判断 A：F 变大','错误（F 随 θ 增大而减小）'],
      ['判断 B：N_OQ 变大','错误（恒为两球总重）'],
      ['判断 C：弹簧变短','错误（压缩量减小，L 变长）'],
      ['判断 D：弹簧变长','正确'],
      ['一句话结论','推力变小 · 地面压力不变 · 弹簧变长（错 A、B、C）']
    ]
  }
}

// 仿真 13 · 三力平衡与力的三角形（双测力计拉结点）
// 与题目 p18 配套：可拖测力计 / 自动往返，读数此消彼长、末态对调。
import {COL,frame,line,arrow,label,dot,fmtNum} from "../lib/canvasUtils.js"

const rad = d => d * Math.PI / 180
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const S120 = Math.sin(rad(120))
const calc = (phi, p) => {
  const alpha = 60 - phi, beta = 180 - phi
  const G = p.Ta0 * S120                       // 初态 Ta = G sin90/sin120
  const Ta = G * Math.sin(rad(150 - alpha)) / S120
  const Tb = G * Math.cos(rad(alpha)) / S120
  return {alpha, beta, G, Ta, Tb}
}
const view = (W, H) => {
  const ox = W * 0.40, oy = H * 0.60, R = Math.min(H * .40, W * .26)
  return {ox, oy, R, pt: (deg, r) => [ox + r * Math.cos(rad(deg)), oy - r * Math.sin(rad(deg))]}
}

export default {
  id:'forceTriangle', name:'三力平衡 · 力的三角形',
  brief:'拖测力计 / 自动往返 / 此消彼长', rate:1,
  tip:'拖动蓝色或绿色测力计（连同细线）绕 O 转动；点「自动演示」可自动往返。',
  autoKey:'auto', manualKeys:['phi'],
  sync(p, s) { p.phi = Math.round(s.phi * 10) / 10 },
  legend:[{c:COL.blue,n:'测力计 a 的拉力'},{c:COL.green,n:'测力计 b 的拉力'},{c:COL.red,n:'重物重力 G'}],
  note:`<b>一句话：</b>两根测力计像拔河——一起顺时针转、夹角保持 120° 时，a 越来越省力，b 越来越吃力，最后读数正好互换。
  <ol style="margin:6px 0 0;padding-left:20px">
    <li><b>先读数：</b>5 N 到 6 N 有 10 小格，每格 0.1 N；指针在 5 上方第 8 格，所以 a 是 <b>5.8 N</b>。</li>
    <li><b>三个力要围成三角形：</b>结点 O 被 a、b 和重物同时拉住，既然静止，三个力首尾相接必须刚好闭合。a、b 的夹角题设保证一直是 120°。</li>
    <li><b>a 为什么变小：</b>a 从 60° 转到水平，它“向上提”的份额越来越少，重活逐渐交给 b。Tₐ = G·sin(150°−α)/sin120°，α 从 60° 减到 0°，正弦从 1 降到 0.5，读数 5.8 N → 2.9 N。</li>
    <li><b>b 为什么变大：</b>b 越来越接近竖直，承担的重力份额越来越多。Tᵦ = G·cosα/sin120°，读数 2.9 N → 5.8 N。</li>
    <li><b>自己验一遍：</b>拖动时右侧力三角形始终闭合；转到 a 水平时两表示数恰好对调。</li>
  </ol>
  <b>答案：</b>a 示数变小，b 示数变大。`,
  params:[
    {k:'phi',label:'顺时针转角 φ',min:0,max:60,step:1,val:0,unit:'°'},
    {k:'Ta0',label:'a 初始示数',min:4,max:8,step:.1,val:5.8,unit:'N'},
    {type:'select',k:'auto',label:'演示方式',options:[{v:'auto',n:'自动往返（推荐）'},{v:'manual',n:'手动拖 φ'}],val:'auto'}
  ],
  init(p) {
    const phi = clamp(Number(p.phi) || 0, 0, 60)
    const mode = p.auto || 'manual'
    const s = {t:0, phi, phi0:phi, lastAuto:mode,
               autoDir: mode === 'auto' ? 1 : 0,
               grab:null, hover:null}
    Object.assign(s, calc(phi, p))
    return s
  },
  step(dt, p, s) {
    s.t += dt
    const mode = p.auto || 'manual'
    if (mode !== s.lastAuto) {
      s.lastAuto = mode
      s.autoDir = mode === 'auto' ? (s.phi <= 30 ? 1 : -1) : 0
    }
    if (mode === 'auto') {
      s.phi += s.autoDir * 8 * dt
      if (s.phi >= 60) { s.phi = 60; s.autoDir = -1 }
      if (s.phi <= 0) { s.phi = 0; s.autoDir = 1 }
    } else {
      const target = clamp(Number(p.phi) || 0, 0, 60)
      s.phi += clamp(target - s.phi, -180 * dt, 180 * dt)
    }
    Object.assign(s, calc(s.phi, p))
  },
  pointer(kind, x, y, s, p, W, H) {
    const v = view(W, H)
    if (kind === 'up') { s.grab = null; return true }
    const nearRay = deg => {
      const r = rad(deg), ux = Math.cos(r), uy = -Math.sin(r)
      const dx = x - v.ox, dy = y - v.oy
      const proj = dx * ux + dy * uy, perp = Math.abs(dx * uy - dy * ux)
      return proj > 12 && proj < v.R * .88 && perp < 20
    }
    const nearA = nearRay(s.alpha), nearB = nearRay(s.beta)
    if (kind === 'hover') { s.hover = nearA ? 'a' : nearB ? 'b' : null; return nearA || nearB }
    if (kind === 'down') {
      if (!nearA && !nearB) return false
      s.grab = nearA ? 'a' : 'b'; s.hover = s.grab
      p.auto = 'manual'
      return true
    }
    if (kind === 'move' && s.grab) {
      const deg = ((Math.atan2(v.oy - y, x - v.ox) * 180 / Math.PI) % 360 + 360) % 360
      const raw = s.grab === 'a' ? 60 - deg : 180 - deg
      p.phi = Math.round(clamp(raw, 0, 60) * 10) / 10
      s.phi = p.phi
      Object.assign(s, calc(s.phi, p))
      return true
    }
    return false
  },
  draw(ctx, W, H, s, p) {
    frame(ctx, W, H)
    const v = view(W, H), {ox, oy, R} = v
    const pt = v.pt

    // 半圆量角器与 30° 刻度
    ctx.save(); ctx.strokeStyle='#c8d2e6'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.arc(ox,oy,R,Math.PI,0,true); ctx.stroke(); ctx.restore()
    for (let d=0; d<=180; d+=30) {
      const [x1,y1]=pt(d,R-8), [x2,y2]=pt(d,R+3)
      line(ctx,x1,y1,x2,y2,'#9aa6bd',1)
      const [tx,ty]=pt(d,R+20)
      label(ctx,d+'°',tx-10,ty+4,'#8792a8',10)
    }
    line(ctx,ox-R-14,oy,ox+R+14,oy,'#dfe6f4',1,[4,4])

    // 初始位置虚影：一眼看出两根测力计转了多少
    const [iax,iay]=pt(60,R*.66), [ibx,iby]=pt(180,R*.66)
    line(ctx,ox,oy,iax,iay,'#b9c5da',1.5,[5,4])
    line(ctx,ox,oy,ibx,iby,'#b9c5da',1.5,[5,4])
    label(ctx,'初始 a',iax+6,iay-6,'#a5b0c6',10)
    label(ctx,'初始 b',ibx-58,iby-6,'#a5b0c6',10)

    // 两根细线与弹簧测力计
    const ra = R*.66, rb = R*.66
    const [ax,ay]=pt(s.alpha,ra), [bx,by]=pt(s.beta,rb)
    line(ctx,ox,oy,ax,ay,COL.blue,2)
    line(ctx,ox,oy,bx,by,COL.green,2)
    const dyn=(x,y,ang,c,txt)=>{
      ctx.save(); ctx.translate(x,y); ctx.rotate(-rad(ang))
      ctx.fillStyle='#f4f7fd'; ctx.strokeStyle=c; ctx.lineWidth=2
      ctx.fillRect(-9,-22,18,44); ctx.strokeRect(-9,-22,18,44)
      ctx.fillStyle=c; ctx.fillRect(-6,-18,12,6)
      ctx.restore()
      label(ctx,txt,x+12,y-12,c,10)
    }
    dyn(ax,ay,s.alpha,COL.blue,'a '+fmtNum(s.Ta,2)+' N')
    dyn(bx,by,s.beta,COL.green,'b '+fmtNum(s.Tb,2)+' N')

    // 可拖动的虚线圈
    const ring=(x,y,hot,c)=>{
      ctx.save(); ctx.strokeStyle=hot?c:'#b9c5da'; ctx.lineWidth=hot?2.5:1.4
      ctx.setLineDash(hot?[]:[4,3]); ctx.beginPath(); ctx.arc(x,y,17,0,Math.PI*2); ctx.stroke(); ctx.restore()
    }
    ring(ax,ay, s.grab==='a'||s.hover==='a', COL.blue)
    ring(bx,by, s.grab==='b'||s.hover==='b', COL.green)
    label(ctx,'↻ 拖我',ax+20,ay+22, s.grab==='a'?COL.blue:'#9aa6bd',10)
    label(ctx,'↻ 拖我',bx-46,by+22, s.grab==='b'?COL.green:'#9aa6bd',10)

    // 下垂重物 Q
    const qy = oy + R*.55
    line(ctx,ox,oy,ox,qy-18,'#8a95ad',2)
    ctx.save(); ctx.fillStyle='#fdebd0'; ctx.strokeStyle='#c07a3c'; ctx.lineWidth=2
    ctx.fillRect(ox-13,qy-18,26,30); ctx.strokeRect(ox-13,qy-18,26,30); ctx.restore()
    label(ctx,'Q',ox+18,qy+2,'#a2683a',12)
    dot(ctx,ox,oy,4,'#17223c')

    // O 点受力箭头（同一比例尺）
    const sc = Math.min(130, R*.7) / Math.max(p.Ta0, 1)
    const vlen = v => Math.max(10, v*sc)
    const [aex,aey]=pt(s.alpha,vlen(s.Ta))
    const [bex,bey]=pt(s.beta,vlen(s.Tb))
    arrow(ctx,ox,oy,aex,aey,COL.blue,2)
    arrow(ctx,ox,oy,bex,bey,COL.green,2)
    arrow(ctx,ox,oy,ox,oy+vlen(s.G),COL.red,2)
    label(ctx,'Tₐ',aex+5,aey-5,COL.blue,11)
    label(ctx,'Tᵦ',bex-22,bey-5,COL.green,11)
    label(ctx,'G',ox+6,oy+vlen(s.G),COL.red,11)

    label(ctx,'三力平衡 · 双测力计拉结点',20,24,'#17223c',13)
    label(ctx,'φ='+fmtNum(s.phi,1)+'°   a 方向 '+fmtNum(s.alpha,1)+'°   b 方向 '+fmtNum(s.beta,1)+'°',20,44,'#4c5872',11)
    label(ctx,'a 示数 '+fmtNum(s.Ta,2)+' N（变小）    b 示数 '+fmtNum(s.Tb,2)+' N（变大）',20,H-22,'#4c5872',11)

    // 右侧：首尾相接的力三角形
    const tx = W-214, ty = H*.30
    const [p1x,p1y]=[tx+vlen(s.Ta)*Math.cos(rad(s.alpha)), ty-vlen(s.Ta)*Math.sin(rad(s.alpha))]
    const [p2x,p2y]=[p1x+vlen(s.Tb)*Math.cos(rad(s.beta)), p1y-vlen(s.Tb)*Math.sin(rad(s.beta))]
    arrow(ctx,tx,ty,p1x,p1y,COL.blue,2)
    arrow(ctx,p1x,p1y,p2x,p2y,COL.green,2)
    ctx.save(); ctx.setLineDash([4,4]); arrow(ctx,p2x,p2y,tx,ty,COL.red,1.5); ctx.restore()
    label(ctx,'力三角形闭合',tx-14,ty-16,'#8792a8',10)
    label(ctx,'Tₐ + Tᵦ + G = 0',tx-14,ty+H*.30,'#6d7893',10)
  },
  rows(s,p) {
    const changeA = s.phi <= .05 ? '初始：5.8 N' : (s.phi >= 59.95 ? '末态：2.9 N（变小）' : '逐渐变小 ↓')
    const changeB = s.phi <= .05 ? '初始：2.9 N' : (s.phi >= 59.95 ? '末态：5.8 N（变大）' : '逐渐变大 ↑')
    return [
      ['顺时针转角 φ',fmtNum(s.phi,1)+' °'],
      ['a 的方向角 α',fmtNum(s.alpha,1)+' °'],
      ['b 的方向角 β',fmtNum(s.beta,1)+' °'],
      ['a、b 夹角（不变）','120.0 °'],
      ['测力计 a 示数 Tₐ',fmtNum(s.Ta,3)+' N'],
      ['测力计 b 示数 Tᵦ',fmtNum(s.Tb,3)+' N'],
      ['重物重力 G',fmtNum(s.G,3)+' N'],
      ['∠(Tᵦ, G)',fmtNum(150-s.alpha,1)+' °'],
      ['∠(Tₐ, G)',fmtNum(90+s.alpha,1)+' °'],
      ['a 示数变化',changeA],
      ['b 示数变化',changeB],
      ['Tₐ + Tᵦ + G 的矢量和','0（力三角形闭合）'],
      ['一句话结论','a 示数变小 · b 示数变大 · 末态对调']
    ]
  }
}

// 仿真 08 · 开普勒轨道与面积定律（万有引力 / 二体问题）
// 归一化天文单位：长度 AU、时间 年、质量 M☉，于是 GM☉ = 4π² AU³/yr²，
// 开普勒第三定律直接写成 T² = a³/M。1 AU/yr = 4.74047 km/s。
import {COL,frame,line,arrow,dot,label,plot,bars,rk4,fmtNum} from "../lib/canvasUtils.js"

const TAU = Math.PI * 2
const KMS = 4.74047

/* 由初始条件 (r₀, 0)、(0, k·v_c) 解析求出全部轨道要素。
   焦点在原点；k>1 时起点是近日点，k<1 时起点是远日点。 */
function orbit(p){
  const mu = TAU * TAU * p.M
  const vc = Math.sqrt(mu / p.r0)
  const v0 = p.k * vc
  const h = p.r0 * v0
  const eps = v0 * v0 / 2 - mu / p.r0
  const e = Math.abs(p.k * p.k - 1)
  const a = -mu / (2 * eps)
  const pRad = h * h / mu
  const peri = pRad / (1 + e)
  const apo = e < 1 ? pRad / (1 - e) : Infinity
  const T = Math.sqrt(a * a * a / p.M)
  const thetaP = p.k > 1 ? 0 : Math.PI
  return {mu,vc,v0,h,eps,e,a,pRad,peri,apo,T,thetaP,dAdt:h/2}
}
const rAt = (o,th) => o.pRad / (1 + o.e * Math.cos(th - o.thetaP))

export default {
 id:'kepler',name:'开普勒轨道与面积定律',brief:'平方反比有心力 / 面积速度守恒 / T² = a³/M / 活力公式',rate:.25,
 legend:[{c:COL.blue,n:'数值积分轨迹'},{c:COL.grey,n:'解析圆锥曲线 r(θ)'},{c:COL.orange,n:'等时扫过面积 ΔA'},{c:COL.green,n:'速度 v'}],
 note:'<b>物理要点：</b>取 AU、年、太阳质量为单位，则 GM = 4π²，圆轨道速度 v_c = √(GM/r₀)。加速度 a = −GM·r/r³，用 RK4 积分。由初始条件可解析得到：比角动量 h = r₀v₀（守恒）、偏心率 e = |k²−1|、半长轴 a = r₀/(2−k²)、周期 T = √(a³/M) 年——这就是开普勒第三定律 T² ∝ a³。矢径在单位时间扫过面积 dA/dt = h/2 恒定（开普勒第二定律），所以近日点快、远日点慢；图中橙色扇形是最近 0.12 个周期扫过的面积，形状随位置变化但面积不变。速率满足活力公式 v² = GM(2/r − 1/a)，可与数值解逐点对照。k = 1 是圆轨道，k < 1 起点为远日点，k > 1 起点为近日点，k → √2 时 a → ∞ 轨道趋于抛物线逃逸。右表「能量残差」「面积速度偏差」应始终贴近 0，用来检验积分精度。',
 params:[
  {k:'M',label:'中心天体质量 M',min:.5,max:2,step:.05,val:1,unit:'M☉'},
  {k:'r0',label:'初始日距 r₀',min:.4,max:1.6,step:.05,val:1,unit:'AU'},
  {k:'k',label:'初速比 k = v₀/v_c',min:.55,max:1.35,step:.01,val:1,unit:''}
 ],
 init(p){
  const o = orbit(p)
  return {t:0,x:p.r0,y:0,vx:0,vy:o.v0,A:0,eps0:o.eps,prevY:0,lastCross:null,Tmeas:null,
          hist:[[0,p.r0,0]],areaHist:[[0,0]]}
 },
 step(dt,p,s){
  const mu = orbit(p).mu
  const f = a => {
    const r = Math.hypot(a[0],a[1]) || 1e-9, c = -mu/(r*r*r)
    return [a[2],a[3],c*a[0],c*a[1]]
  }
  const cur = [s.x,s.y,s.vx,s.vy], nx = rk4(f,cur,dt)
  const h0 = cur[0]*cur[3]-cur[1]*cur[2], h1 = nx[0]*nx[3]-nx[1]*nx[2]
  s.A += .25*(h0+h1)*dt                    // ∫ ½(x·v_y − y·v_x) dt，梯形法
  s.x=nx[0];s.y=nx[1];s.vx=nx[2];s.vy=nx[3];s.t+=dt
  if(s.prevY<0 && s.y>=0 && s.x>0){       // 每次向上穿过 +x 轴 = 一个周期
    if(s.lastCross!==null) s.Tmeas = s.t - s.lastCross
    s.lastCross = s.t
  }
  s.prevY = s.y
  s.hist.push([s.t,s.x,s.y]); if(s.hist.length>1100)s.hist.shift()
  s.areaHist.push([s.t,s.A]); if(s.areaHist.length>1100)s.areaHist.shift()
 },
 draw(ctx,W,H,s,p){
  frame(ctx,W,H)
  const o = orbit(p), r = Math.hypot(s.x,s.y)
  const rmax = Math.max(isFinite(o.apo)?o.apo:o.peri*3, r, 1)*1.12
  const cx=W*.26, cy=H*.36, R=Math.min(W*.21,H*.27), sc=R/rmax
  const X=x=>cx+x*sc, Y=y=>cy-y*sc
  /* 解析轨道（焦点在原点） */
  const ring=[]
  for(let i=0;i<=260;i++){const th=TAU*i/260, rr=rAt(o,th);if(rr>0&&rr<rmax*1.4)ring.push([X(rr*Math.cos(th)),Y(rr*Math.sin(th))])}
  ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle=COL.grey;ctx.lineWidth=1.4;ctx.beginPath()
  ring.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke();ctx.restore()
  /* 等时扫过面积：取最近 0.12 周期的一段轨迹与两条矢径围成扇形 */
  if(s.t>0){
    const t0=Math.max(0,s.t-o.T*.12), seg=s.hist.filter(q=>q[0]>=t0)
    if(seg.length>2){
      ctx.save();ctx.fillStyle='rgba(217,118,51,.20)';ctx.beginPath();ctx.moveTo(cx,cy)
      seg.forEach(q=>ctx.lineTo(X(q[1]),Y(q[2])));ctx.closePath();ctx.fill();ctx.restore()
      line(ctx,cx,cy,X(seg[0][1]),Y(seg[0][2]),'#d9c7b2',1,[4,4])
      line(ctx,cx,cy,X(seg[seg.length-1][1]),Y(seg[seg.length-1][2]),COL.orange,1.4)
      label(ctx,'Δt 内 ΔA 恒定',X(seg[0][1])-30,Y(seg[0][2])-10,COL.orange,10)
    }
  }
  /* 数值轨迹 */
  ctx.save();ctx.strokeStyle=COL.blue;ctx.lineWidth=2.2;ctx.beginPath()
  s.hist.forEach((q,i)=>i?ctx.lineTo(X(q[1]),Y(q[2])):ctx.moveTo(X(q[1]),Y(q[2])));ctx.stroke();ctx.restore()
  /* 近 / 远日点标记 */
  const thP=o.thetaP, rp=o.peri
  dot(ctx,X(rp*Math.cos(thP)),Y(rp*Math.sin(thP)),3.2,COL.red)
  if(isFinite(o.apo))dot(ctx,X(o.apo*Math.cos(thP+Math.PI)),Y(o.apo*Math.sin(thP+Math.PI)),3.2,COL.green)
  /* 天体、矢径、速度 */
  line(ctx,cx,cy,X(s.x),Y(s.y),'#d8e0ee',1,[4,4])
  ctx.save();ctx.globalAlpha=.22;ctx.fillStyle=COL.orange;ctx.beginPath();ctx.arc(cx,cy,17,0,TAU);ctx.fill();ctx.restore()
  dot(ctx,cx,cy,8,COL.orange)
  label(ctx,'M = '+fmtNum(p.M,2)+' M☉',cx+12,cy-12,'#b06a2c',10)
  dot(ctx,X(s.x),Y(s.y),6,COL.blue)
  const vn=Math.hypot(s.vx,s.vy)||1, L=34
  arrow(ctx,X(s.x),Y(s.y),X(s.x)+s.vx/vn*L,Y(s.y)-s.vy/vn*L,COL.green,2)
  label(ctx,'v',X(s.x)+s.vx/vn*L+4,Y(s.y)-s.vy/vn*L,COL.green,11)
  label(ctx,'e = '+fmtNum(o.e,3)+'   a = '+fmtNum(o.a,3)+' AU',20,H-16,'#6d7893',11)
  label(ctx,'t = '+fmtNum(s.t,3)+' yr    r = '+fmtNum(r,3)+' AU',20,24,'#17223c',12)
  /* r(t)：数值 + 解析近/远日距 */
  const t1=Math.max(s.t,o.T*1.15), rlo=0, rhi=Math.max(isFinite(o.apo)?o.apo:rmax,r)*1.12
  const rnum=s.hist.map(q=>[q[0],Math.hypot(q[1],q[2])])
  const flat=(v)=>[[0,v],[t1,v]]
  plot(ctx,{x:W*.55,y:H*.08,w:W*.41,h:H*.25},[
    {pts:flat(o.peri),c:'#e0cdb4',dash:[4,4]},
    ...(isFinite(o.apo)?[{pts:flat(o.apo),c:'#e0cdb4',dash:[4,4]}]:[]),
    {pts:rnum,c:COL.blue}
  ],0,t1,rlo,rhi,'t / yr','r / AU')
  /* A(t)：数值累积面积 vs 解析直线 (h/2)·t */
  const Amax=Math.max(o.dAdt*t1,s.A,.001)*1.12
  plot(ctx,{x:W*.55,y:H*.40,w:W*.41,h:H*.25},[
    {pts:[[0,0],[t1,o.dAdt*t1]],c:COL.grey,dash:[5,4]},
    {pts:s.areaHist,c:COL.orange}
  ],0,t1,0,Amax,'t / yr','A / AU²')
  label(ctx,'斜率 = h/2 = '+fmtNum(o.dAdt,4)+' AU²/yr',W*.56,H*.38,'#8a95ad',10)
  /* 能量条（单位质量的比能量） */
  const Ek=.5*(s.vx*s.vx+s.vy*s.vy), Ep=-o.mu/r, en=Ek+Ep
  bars(ctx,W*.56,H*.73,W*.40,[{n:'比动能',v:Ek,c:COL.blue},{n:'比势能',v:Ep,c:COL.green},{n:'比机械能',v:en,c:COL.orange}],Math.max(Math.abs(Ek),Math.abs(Ep),Math.abs(en),.001))
  label(ctx,'轨道类型：'+(o.e<1e-6?'圆':o.e<1?'椭圆':'非束缚')+'    T = '+fmtNum(o.T,3)+' yr',W*.56,H*.70,'#6d7893',11)
 },
 rows(s,p){
  const o=orbit(p), r=Math.hypot(s.x,s.y), v=Math.hypot(s.vx,s.vy)
  const vTh=Math.sqrt(Math.max(0,o.mu*(2/r-1/o.a)))
  const epsNum=.5*v*v-o.mu/r
  const aNum=s.t>0?s.A/s.t:null
  const dev=aNum!==null&&o.dAdt>0?Math.abs(aNum-o.dAdt)/o.dAdt*100:null
  return[
   ['物理时间 t',fmtNum(s.t,3)+' yr'],['当前日距 r',fmtNum(r,4)+' AU'],
   ['当前速率 v（数值）',fmtNum(v,5)+' AU/yr = '+fmtNum(v*KMS,3)+' km/s'],
   ['活力公式 v = √[GM(2/r−1/a)]',fmtNum(vTh,5)+' AU/yr'],
   ['速率相对偏差',fmtNum(Math.abs(v-vTh)/Math.max(vTh,1e-9)*100,6)+' %'],
   ['圆轨道速度 v_c = √(GM/r₀)',fmtNum(o.vc,5)+' AU/yr'],['初速比 k = v₀/v_c',fmtNum(p.k,3)],
   ['比角动量 h = r×v',fmtNum(s.x*s.vy-s.y*s.vx,6)+' AU²/yr'],
   ['偏心率 e = |k²−1|',fmtNum(o.e,5)],['半长轴 a = r₀/(2−k²)',fmtNum(o.a,5)+' AU'],
   ['近日点 r_p / 远日点 r_a',fmtNum(o.peri,4)+' / '+(isFinite(o.apo)?fmtNum(o.apo,4):'∞')+' AU'],
   ['解析周期 T = √(a³/M)',fmtNum(o.T,5)+' yr'],['实测周期（过 +x 轴）',s.Tmeas===null?'未满一周':fmtNum(s.Tmeas,4)+' yr'],
   ['面积速度解析 h/2',fmtNum(o.dAdt,6)+' AU²/yr'],['面积速度数值 A/t',aNum===null?'—':fmtNum(aNum,6)+' AU²/yr'],
   ['面积速度相对偏差',dev===null?'—':fmtNum(dev,6)+' %'],['累计扫过面积 A',fmtNum(s.A,5)+' AU²'],
   ['比机械能 ε 数值 / 初始',fmtNum(epsNum,6)+' / '+fmtNum(o.eps,6)],
   ['能量残差 (ε−ε₀)/|ε₀|',fmtNum((epsNum-o.eps)/Math.max(Math.abs(o.eps),1e-9)*100,7)+' %']
  ]
 }
}

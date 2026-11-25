// 仿真 09 · 一维碰撞与质心系（恢复系数 / 动量守恒 / 能量账）
// 轨道是无限长直的：不设反射墙（墙会给系统外力冲量，破坏动量守恒）。
// 画面镜头跟随质心，两物体分离到足够远后自动重放，每轮内守恒律严格闭合。
import {COL,frame,line,arrow,dot,label,plot,bars,fmtNum} from "../lib/canvasUtils.js"

const LIM = 3, RAD = .32, GAP = 2*RAD, REPLAY_T = 12

function impulse(p,v1,v2){
  const M=p.m1+p.m2, mu=p.m1*p.m2/M
  const u=(p.m1*v1+p.m2*v2)/M, rel=v1-v2
  const n1=u-(p.m2/M)*p.e*rel, n2=u+(p.m1/M)*p.e*rel
  const dE=.5*p.m1*n1*n1+.5*p.m2*n2*n2-(.5*p.m1*v1*v1+.5*p.m2*v2*v2)
  return {n1,n2,dE,loss:.5*mu*(1-p.e*p.e)*rel*rel,M,mu,rel}
}

export default {
 id:'collision',name:'一维碰撞与质心系',brief:'恢复系数 e / 动量守恒 / 质心匀速 / 可损失动能上限',rate:1,
 legend:[{c:COL.blue,n:'滑块 1 · x₁′(t)'},{c:COL.orange,n:'滑块 2 · x₂′(t)'},{c:COL.green,n:'质心（匀速直线）'},{c:COL.red,n:'碰撞损失'}],
 note:'<b>物理要点：</b>设恢复系数 e = (v₂′−v₁′)/(v₁−v₂)，则 v₁′ = V_cm − (m₂/M)·e·(v₁−v₂)，v₂′ = V_cm + (m₁/M)·e·(v₁−v₂)，其中 V_cm = (m₁v₁+m₂v₂)/M 恒定不变。总动能可拆成 ½MV_cm²（质心平动，碰撞动不了）与 ½μ(v₁−v₂)²（相对运动，μ = m₁m₂/M）；一次碰撞最多损失 ΔE = ½μ(1−e²)(v₁−v₂)²，e = 0（完全非弹性、两滑块粘在一起）时损失最大，e = 1 时动能守恒。质心系里两物体动量始终等大反向。轨道无限长、没有反射墙，镜头自动跟随质心；右图 x_cm(t) 是一条斜率恒为 V_cm 的直线，无论中间碰撞多少次都不打折。两物体分离足够远（或满 12 s）后自动重放本轮实验，右表「能量残差 E₀−E−损失」与「动量守恒残差」应恒为 0。',
 params:[
  {k:'m1',label:'质量 m₁',min:.2,max:5,step:.1,val:1,unit:'kg'},
  {k:'m2',label:'质量 m₂',min:.2,max:5,step:.1,val:2,unit:'kg'},
  {k:'v1',label:'初速度 v₁',min:-4,max:6,step:.1,val:3,unit:'m/s'},
  {k:'v2',label:'初速度 v₂',min:-4,max:6,step:.1,val:0,unit:'m/s'},
  {k:'e',label:'恢复系数 e',min:0,max:1,step:.01,val:1,unit:''}
 ],
 init(p){ return fresh(p,0) },
 step(dt,p,s){
  const sub=Math.max(1,Math.min(40,Math.ceil(dt/.002))), h=dt/sub
  for(let i=0;i<sub;i++){
    s.x1+=s.v1*h; s.x2+=s.v2*h
    /* 唯一的外力事件是两滑块互碰：回退到接触时刻 → 解析冲量 → 补回剩余时间 */
    if(s.x2-s.x1<=GAP && s.v1-s.v2>0){
      const back=(GAP-(s.x2-s.x1))/(s.v1-s.v2)
      s.x1-=s.v1*back; s.x2-=s.v2*back
      const im=impulse(p,s.v1,s.v2)
      s.eMeas=(im.n2-im.n1)/im.rel
      s.lastLoss=im.loss
      s.v1=im.n1; s.v2=im.n2; s.loss-=im.dE; s.n++
      s.x1+=s.v1*back; s.x2+=s.v2*back
    }
    s.t+=h
    const xcm=(p.m1*s.x1+p.m2*s.x2)/(p.m1+p.m2)
    s.hist.push([s.t,s.x1-xcm,s.x2-xcm,xcm]); if(s.hist.length>1200)s.hist.shift()
    if(s.t>REPLAY_T || Math.abs(s.x2-s.x1)>2*LIM){ Object.assign(s,fresh(p,s.loop+1)); break }
  }
 },
 draw(ctx,W,H,s,p){
  frame(ctx,W,H)
  const M=p.m1+p.m2, Vcm=s.Vcm, xcm=(p.m1*s.x1+p.m2*s.x2)/M
  const mu=p.m1*p.m2/M, rel=s.v1-s.v2
  /* 上部：实验室系（镜头跟随质心） */
  const top=H*.17, sc=W*.40/LIM, X=v=>W*.5+(v-xcm)*sc
  line(ctx,20,top+34,W-20,top+34,'#dfe6f4',2)
  line(ctx,W*.5,top-48,W*.5,top+44,COL.green,1.4,[5,4])
  const rw=Math.max(14,RAD*sc)
  const box=(x,c,n)=>{
    ctx.save();ctx.fillStyle=c;ctx.globalAlpha=.88;ctx.fillRect(X(x)-rw,top-20,2*rw,40);ctx.restore()
    ctx.save();ctx.strokeStyle=c;ctx.lineWidth=2;ctx.strokeRect(X(x)-rw,top-20,2*rw,40);ctx.restore()
    label(ctx,n,X(x)-4,top+5,'#fff',11)
  }
  box(s.x1,COL.blue,'1'); box(s.x2,COL.orange,'2')
  arrow(ctx,X(s.x1),top-28,X(s.x1)+Math.max(-76,Math.min(76,s.v1*18)),top-28,COL.blue,2)
  arrow(ctx,X(s.x2),top-28,X(s.x2)+Math.max(-76,Math.min(76,s.v2*18)),top-28,COL.orange,2)
  label(ctx,'质心（镜头中心）  V_cm = '+fmtNum(Vcm,3)+' m/s',W*.5+8,top-52,COL.green,10)
  label(ctx,'无限长直轨道 · 第 '+(s.loop+1)+' 轮 · t = '+fmtNum(s.t,2)+' s · 碰撞 '+s.n+' 次',20,24,'#17223c',12)
  /* 中部左：质心系轨迹 x′(t) —— 质心恒为 0 */
  const t1=Math.max(2,s.t)
  plot(ctx,{x:44,y:H*.31,w:W*.46,h:H*.30},[
    {pts:[[0,0],[t1,0]],c:COL.green,dash:[5,4]},
    {pts:s.hist.map(q=>[q[0],q[1]]),c:COL.blue},
    {pts:s.hist.map(q=>[q[0],q[2]]),c:COL.orange}
  ],0,t1,-LIM,LIM,'t / s',"x′ / m（质心系）")
  /* 中部右：实验室系质心轨迹 x_cm(t) —— 严格匀速直线 */
  const xs=s.hist.map(q=>q[3]), lo=Math.min(...xs,s.xcm0), hi=Math.max(...xs,s.xcm0)
  const pad=Math.max(.5,(hi-lo)*.25)
  plot(ctx,{x:W*.56,y:H*.31,w:W*.40,h:H*.30},[
    {pts:[[0,s.xcm0],[t1,s.xcm0+Vcm*t1]],c:COL.grey,dash:[5,4]},
    {pts:s.hist.map(q=>[q[0],q[3]]),c:COL.green}
  ],0,t1,lo-pad,hi+pad,'t / s','x_cm / m')
  label(ctx,'斜率 = V_cm = '+fmtNum(Vcm,3)+' m/s',W*.57,H*.29,'#8a95ad',10)
  /* 质心系动量等大反向小示意 */
  const C=W*.76, cy=H*.69, p1=p.m1*(s.v1-Vcm), p2=p.m2*(s.v2-Vcm)
  line(ctx,W*.58,cy,W*.94,cy,'#dfe6f4',1.5)
  dot(ctx,C+(s.x1-xcm)*(W*.16/LIM),cy,6,COL.blue)
  dot(ctx,C+(s.x2-xcm)*(W*.16/LIM),cy,6,COL.orange)
  label(ctx,'质心系动量：p₁′ = '+fmtNum(p1,3)+' , p₂′ = '+fmtNum(p2,3)+' kg·m/s（等大反向）',W*.57,H*.64,'#6d7893',10)
  arrow(ctx,C,cy+14,C+Math.max(-70,Math.min(70,p1*14)),cy+14,COL.blue,1.8)
  arrow(ctx,C,cy+26,C+Math.max(-70,Math.min(70,p2*14)),cy+26,COL.orange,1.8)
  /* 下部：能量条 */
  const E=.5*p.m1*s.v1*s.v1+.5*p.m2*s.v2*s.v2, Ec=.5*M*Vcm*Vcm, Er=.5*mu*rel*rel
  bars(ctx,44,H*.76,W*.53,[{n:'当前动能',v:E,c:COL.blue},{n:'质心平动',v:Ec,c:COL.green},{n:'相对动能',v:Er,c:COL.orange},{n:'累计损失',v:s.loss,c:COL.red}],Math.max(s.E0,E,s.loss,.001))
  label(ctx,'E₀ = '+fmtNum(s.E0,4)+' J   E + 损失 = '+fmtNum(E+s.loss,4)+' J',W*.62,H*.79,'#6d7893',11)
  label(ctx,'最大可损失 ½μ(1−e²)v_rel² = '+fmtNum(.5*mu*(1-p.e*p.e)*rel*rel,4)+' J',W*.62,H*.79+18,'#b06a2c',10)
  label(ctx,'能量残差 = '+fmtNum(s.E0-E-s.loss,8)+' J',W*.62,H*.79+36,COL.green,11)
 },
 rows(s,p){
  const M=p.m1+p.m2, mu=p.m1*p.m2/M, rel=s.v1-s.v2
  const P=p.m1*s.v1+p.m2*s.v2, xcm=(p.m1*s.x1+p.m2*s.x2)/M
  const E=.5*p.m1*s.v1*s.v1+.5*p.m2*s.v2*s.v2
  const p1=p.m1*(s.v1-s.Vcm), p2=p.m2*(s.v2-s.Vcm)
  return[
   ['物理时间 t / 重放轮次',fmtNum(s.t,2)+' s / 第 '+(s.loop+1)+' 轮'],['本轮碰撞次数',String(s.n)],
   ['总动量 P / 初始 P₀',fmtNum(P,6)+' / '+fmtNum(s.P0,6)+' kg·m/s'],
   ['动量守恒残差',fmtNum(P-s.P0,9)+' kg·m/s'],
   ['质心速度 V_cm = P/M',fmtNum(s.Vcm,6)+' m/s'],
   ['质心位置 数值 / 解析',fmtNum(xcm,5)+' / '+fmtNum(s.xcm0+s.Vcm*s.t,5)+' m'],
   ['当前速度 v₁ / v₂',fmtNum(s.v1,5)+' / '+fmtNum(s.v2,5)+' m/s'],
   ['相对速度 v₁−v₂',fmtNum(rel,5)+' m/s'],
   ['恢复系数 实测 / 设定',s.eMeas===null?'尚未碰撞':fmtNum(s.eMeas,5)+' / '+fmtNum(p.e,3)],
   ['最近一次损失（理论）',fmtNum(s.lastLoss,6)+' J'],
   ['初始动能 E₀',fmtNum(s.E0,6)+' J'],['当前动能 E',fmtNum(E,6)+' J'],
   ['累计碰撞损失',fmtNum(s.loss,6)+' J'],['能量残差 E₀−E−损失',fmtNum(s.E0-E-s.loss,9)+' J'],
   ['质心平动动能 ½MV_cm²',fmtNum(.5*M*s.Vcm*s.Vcm,6)+' J（碰撞不可动用）'],
   ['相对动能 ½μv_rel²',fmtNum(.5*mu*rel*rel,6)+' J'],
   ['最大可损失（e=0）',fmtNum(.5*mu*rel*rel,6)+' J'],
   ['质心系动量 p₁′ / p₂′',fmtNum(p1,6)+' / '+fmtNum(p2,6)+' kg·m/s'],
   ['约化质量 μ = m₁m₂/M',fmtNum(mu,6)+' kg']
  ]
 }
}

function fresh(p,loop){
  const x1=-1.6,x2=.6,M=p.m1+p.m2
  const P=p.m1*p.v1+p.m2*p.v2, E=.5*p.m1*p.v1*p.v1+.5*p.m2*p.v2*p.v2
  const xcm=(p.m1*x1+p.m2*x2)/M
  return {t:0,loop,x1,x2,v1:p.v1,v2:p.v2,P0:P,E0:E,Vcm:P/M,xcm0:xcm,
          loss:0,n:0,eMeas:null,lastLoss:0,hist:[[0,x1-xcm,x2-xcm,xcm]]}
}

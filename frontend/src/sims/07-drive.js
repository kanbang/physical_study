// 仿真 07 · 受迫振动与共振（带时间项的 RK4 / 稳态解析解 / 幅频响应 / 功率账）
// 与 03 自由阻尼振子互补：这里看「外力持续驱动」的稳态、相位滞后与共振峰。
import {COL,frame,line,arrow,label,plot,bars,dot,fmtNum} from "../lib/canvasUtils.js"

const theory = p => {
  const w0sq = p.k / p.m, beta = p.b / (2 * p.m), f = p.F0 / p.m
  const A = w => f / Math.sqrt((w0sq - w * w) ** 2 + (2 * beta * w) ** 2)
  const phi = w => Math.atan2(2 * beta * w, w0sq - w * w)
  const w0 = Math.sqrt(w0sq)
  const light = w0sq > 2 * beta * beta
  const wr = light ? Math.sqrt(w0sq - 2 * beta * beta) : 0
  const Ar = light ? f / (2 * beta * Math.sqrt(w0sq - beta * beta)) : A(0)
  return {w0, w0sq, beta, f, A, phi, wr, Ar, Q: w0 / (2 * beta), light}
}

export default {
 id:'drive',name:'受迫振动与共振',brief:'稳态振幅 / 相位滞后 / 品质因数 Q / 功率平衡',rate:.35,
 legend:[{c:COL.blue,n:'数值 x(t)'},{c:COL.grey,n:'解析稳态 A cos(ωt−φ)'},{c:'#d9c7b2',n:'理论包络 ±A'},{c:COL.orange,n:'幅频响应 A(ω)'}],
 note:'<b>物理要点：</b>方程 mx″ + bx′ + kx = F₀cos(ωt)，令 ω₀² = k/m、β = b/(2m)。稳态解 x = A·cos(ωt − φ)，其中 A = (F₀/m)/√[(ω₀²−ω²)² + (2βω)²]，tanφ = 2βω/(ω₀²−ω²)。阻尼很小时共振频率 ω_r = √(ω₀² − 2β²) 略小于 ω₀，品质因数 Q = ω₀/(2β) 越大峰越尖。刚启动时曲线里含瞬态，要等若干周期才贴近灰虚线；进入稳态后，外力输入的平均功率恰等于阻尼耗散的平均功率，机械能不再增长，表中「能量残差」应稳定在 0 附近。播放速度已放慢 0.35×，读数中的 t 仍是真实物理时间。',
 params:[
  {k:'k',label:'劲度系数 k',min:50,max:400,step:10,val:200,unit:'N/m'},
  {k:'m',label:'质量 m',min:.2,max:2,step:.1,val:.5,unit:'kg'},
  {k:'b',label:'阻尼系数 b',min:.05,max:4,step:.05,val:.6,unit:'N·s/m'},
  {k:'F0',label:'驱动力幅值 F₀',min:.2,max:4,step:.1,val:1.5,unit:'N'},
  {k:'w',label:'驱动角频率 ω',min:2,max:50,step:.5,val:20,unit:'rad/s'}
 ],
 init(p){return{t:0,x:0,v:0,hist:[[0,0]],Win:0,Wdis:0}},
 step(dt,p,s){
   const {w0sq,beta,f}=theory(p)
   const acc=(t,x,v)=>f*Math.cos(p.w*t)-2*beta*v-w0sq*x
   const x0=s.x,v0=s.v,t0=s.t
   const k1x=v0,k1v=acc(t0,x0,v0)
   const k2x=v0+k1v*dt/2,k2v=acc(t0+dt/2,x0+k1x*dt/2,v0+k1v*dt/2)
   const k3x=v0+k2v*dt/2,k3v=acc(t0+dt/2,x0+k2x*dt/2,v0+k2v*dt/2)
   const k4x=v0+k3v*dt,k4v=acc(t0+dt,x0+k3x*dt,v0+k3v*dt)
   const nx=x0+dt*(k1x+2*k2x+2*k3x+k4x)/6
   const nv=v0+dt*(k1v+2*k2v+2*k3v+k4v)/6
   const vMid=(v0+nv)/2,FMid=p.F0*Math.cos(p.w*(t0+dt/2))
   s.Win+=FMid*vMid*dt
   s.Wdis+=p.b*vMid*vMid*dt
   s.x=nx;s.v=nv;s.t=t0+dt
   s.hist.push([s.t,nx]);if(s.hist.length>2600)s.hist.shift()
 },
 draw(ctx,W,H,s,p){
   frame(ctx,W,H)
   const th=theory(p),A=th.A(p.w),phi=th.phi(p.w),T=2*Math.PI/p.w
   const top=H*.30,cx=W*.5,scale=Math.min(460,72/Math.max(A,.01))
   /* 上部：弹簧 + 滑块 + 周期性外力 */
   line(ctx,60,top-30,60,top+30,COL.grey,3)
   const px=cx+s.x*scale
   ctx.save();ctx.strokeStyle='#c3d0ee';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(60,top)
   const coils=14,L=Math.max(24,px-60-22)
   for(let i=0;i<=coils*2;i++){const xx=60+L*i/(coils*2),yy=top+(i%2?11:-11);ctx.lineTo(xx,yy)}
   ctx.lineTo(px-20,top);ctx.stroke();ctx.restore()
   ctx.fillStyle='#e9efff';ctx.strokeStyle=COL.blue;ctx.lineWidth=2
   ctx.fillRect(px-20,top-24,40,48);ctx.strokeRect(px-20,top-24,40,48)
   line(ctx,cx,top-44,cx,top+48,'#dfe6f4',1,[4,4]);label(ctx,'平衡位置',cx+6,top+60,'#8a95ad',10)
   const F=p.F0*Math.cos(p.w*s.t),dir=F>=0?1:-1
   arrow(ctx,px+dir*22,top-4,px+dir*(22+Math.min(58,Math.abs(F)*22+12)),top-4,COL.orange,2)
   label(ctx,'F(t) = '+fmtNum(F,3)+' N',px+dir*26,top-16,COL.orange,10,dir>0?'left':'right')
   label(ctx,'ω = '+fmtNum(p.w,2)+' rad/s',60,top-52,COL.green,11)
   /* 中部：x(t) 波形，数值 vs 解析稳态 */
   const span=Math.max(1.0,4*T),t1=Math.max(span,s.t),t0=t1-span
   const steady=[],env=[],env2=[]
   for(let i=0;i<=160;i++){const t=t0+(t1-t0)*i/160;steady.push([t,A*Math.cos(p.w*t-phi)]);env.push([t,A]);env2.push([t,-A])}
   plot(ctx,{x:44,y:H*.36,w:W-88,h:H*.26},[
     {pts:env,c:'#d9c7b2',dash:[4,4]},{pts:env2,c:'#d9c7b2',dash:[4,4]},
     {pts:steady,c:COL.grey,dash:[5,4]},{pts:s.hist.filter(q=>q[0]>=t0),c:COL.blue}
   ],t0,t1,-A*1.25,A*1.25,'t / s','x / m')
   /* 下部：幅频响应曲线，标出当前工作点与共振峰 */
   const B={x:44,y:H*.70,w:W-88,h:H*.22},wmax=Math.max(2.5*th.w0,1.2*p.w),Amax=Math.max(th.Ar,A)*1.18
   const curve=[]
   for(let i=0;i<=180;i++){const wq=wmax*i/180;curve.push([wq,th.A(wq)])}
   plot(ctx,B,[{pts:curve,c:COL.orange}],0,wmax,0,Amax,'ω / (rad/s)','A / m')
   const X=v=>B.x+6+v/wmax*(B.w-12),Y=v=>B.y+B.h-6-v/Amax*(B.h-12)
   dot(ctx,X(p.w),Y(A),4.5,COL.blue)
   if(th.light)dot(ctx,X(th.wr),Y(th.Ar),4,COL.red)
   label(ctx,'当前 ω',X(p.w)+7,Y(A)-7,COL.blue,10)
   if(th.light)label(ctx,'共振峰 ω_r',X(th.wr)+6,Y(th.Ar)-8,COL.red,10)
   label(ctx,'Q = '+fmtNum(th.Q,2),B.x+B.w-96,B.y+16,'#6d7893',10)
   /* 能量条 */
   const Ek=.5*p.m*s.v*s.v,Ep=.5*p.k*s.x*s.x
   bars(ctx,W-250,18,230,[{n:'动能',v:Ek,c:COL.blue},{n:'势能',v:Ep,c:COL.green},{n:'已耗散',v:s.Wdis,c:COL.orange}],Math.max(Ek+Ep,s.Wdis,.001))
 },
 rows(s,p){
   const th=theory(p),A=th.A(p.w),phi=th.phi(p.w),T=2*Math.PI/p.w
   const win=s.hist.filter(q=>q[0]>=s.t-T).map(q=>q[1])
   const Anum=win.length>4?(Math.max(...win)-Math.min(...win))/2:null
   const E=.5*p.m*s.v*s.v+.5*p.k*s.x*s.x
   return[
    ['物理时间 t',fmtNum(s.t,2)+' s'],['驱动角频率 ω',fmtNum(p.w,3)+' rad/s'],
    ['固有角频率 ω₀ = √(k/m)',fmtNum(th.w0,4)+' rad/s'],['阻尼率 β = b/(2m)',fmtNum(th.beta,4)+' s⁻¹'],
    ['品质因数 Q = ω₀/(2β)',fmtNum(th.Q,3)],['共振频率 ω_r',th.light?fmtNum(th.wr,4)+' rad/s':'（阻尼过大，无峰）'],
    ['理论稳态振幅 A(ω)',fmtNum(A,6)+' m'],['数值近一周期振幅',s.t<T?'等待一个周期':fmtNum(Anum,6)+' m'],
    ['振幅相对偏差',(Anum===null)?'—':fmtNum(Math.abs(Anum-A)/Math.max(A,1e-9)*100,3)+' %'],
    ['相位滞后 φ',fmtNum(phi*180/Math.PI,3)+' °'],['共振峰振幅 A_r',th.light?fmtNum(th.Ar,5)+' m':'—'],
    ['当前位移 x / 速度 v',fmtNum(s.x,5)+' m / '+fmtNum(s.v,5)+' m/s'],
    ['累计外力输入功 W_in',fmtNum(s.Win,5)+' J'],['累计阻尼耗散 W_dis',fmtNum(s.Wdis,5)+' J'],
    ['能量残差 W_in−W_dis−E',fmtNum(s.Win-s.Wdis-E,6)+' J']
   ]
 }
}

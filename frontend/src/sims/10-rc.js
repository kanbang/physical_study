// 仿真 10 · RC 充放电：另一半能量去哪了（一阶 ODE / 解析解 / 能量账）
// 与 addons/02-problems.js 的「RC 充电另一半能量」互为印证。
// 数值用 RK4 同时积分 u_C 与电阻发热 Q_R，解析解作逐点对照。
import {COL,frame,line,arrow,dot,label,plot,bars,rk4,fmtNum} from "../lib/canvasUtils.js"

const consts = p => {
  const Rs=p.R*1e3, Cs=p.C*1e-6, tau=Rs*Cs
  return {Rs,Cs,tau,Efull:.5*Cs*p.U0*p.U0}   // Efull = ½CU₀²（J）
}
const heatRate = (p,u) => {
  const {Rs}=consts(p)
  const du = p.mode==='discharge' ? u : p.U0-u
  return du*du/Rs
}
const current = (p,u) => {
  const {Rs}=consts(p)
  return (p.mode==='discharge' ? u : p.U0-u)/Rs
}

export default {
 id:'rc',name:'RC 充放电 · 另一半能量',brief:'时间常数 τ / 数值解 vs 解析解 / 电源功 = 储能 + 焦耳热',rate:1,
 legend:[{c:COL.blue,n:'数值 u_C(t)、i(t)'},{c:COL.grey,n:'解析解'},{c:COL.green,n:'电容储能 E_C'},{c:COL.orange,n:'电阻发热 Q_R'}],
 note:'<b>物理要点：</b>方程 RC·du/dt = U₀−u，解为 u_C(t) = U₀(1−e^(−t/τ))、i(t) = (U₀/R)e^(−t/τ)，τ = RC；t = τ 时充到 63.2%，t = τ·ln2 是半衰时间。能量账最关键：电源做功 W_s = U₀q = CU₀u_C，电容储能 E_C = ½Cu_C²，电阻发热 Q_R = ∫i²R dt，恒有 W_s = E_C + Q_R。充满时 W_s = CU₀²，而 E_C 只有 ½CU₀²，另外 ½CU₀² 全部变成焦耳热——<b>这就是「另一半能量去哪了」的答案，且比例与 R 无关</b>：减小 R 只让过程更快，不改变各占一半。放电时电源退出，初始储能 ½CU₀² 最终全部变成 Q_R。右表「能量残差」应恒为 0，用来检验数值积分精度；拖动 R 会看到 τ 与 i 一起变，但两条能量曲线终值不变。',
 params:[
  {type:'select',k:'mode',label:'过程',options:[{v:'charge',n:'充电（电源接通）'},{v:'discharge',n:'放电（电源断开）'}],val:'charge'},
  {k:'U0',label:'电源电压 U₀',min:1,max:12,step:.5,val:6,unit:'V'},
  {k:'R',label:'电阻 R',min:2,max:50,step:1,val:10,unit:'kΩ'},
  {k:'C',label:'电容 C',min:20,max:500,step:10,val:100,unit:'μF'}
 ],
 init(p){
  const u=p.mode==='discharge'?p.U0:0, i=current(p,u)
  return {t:0,u,Qr:0,E0:p.mode==='discharge'?consts(p).Efull:0,
          hist:[[0,u,i,0,.5*consts(p).Cs*u*u,0]]}
 },
 step(dt,p,s){
  const {tau}=consts(p)
  const n=Math.max(1,Math.min(200,Math.ceil(dt/(tau/40)))), h=dt/n
  const f=a=>{
    const {Rs}=consts(p)
    const du=p.mode==='discharge' ? -a[0]/tau : (p.U0-a[0])/tau
    return [du,heatRate(p,a[0])]
  }
  for(let i=0;i<n;i++){
    const next=rk4(f,[s.u,s.Qr],h)
    s.u=next[0]; s.Qr=next[1]; s.t+=h
  }
  const u=s.u, i=current(p,u), Cs=consts(p).Cs
  const Ws=p.mode==='charge'?p.U0*Cs*u:0, Ec=.5*Cs*u*u
  s.hist.push([s.t,u,i,Ws,Ec,s.Qr]); if(s.hist.length>1400)s.hist.shift()
 },
 draw(ctx,W,H,s,p){
  frame(ctx,W,H)
  const {Rs,Cs,tau,Efull}=consts(p), u=s.u, i=current(p,u)
  const charging=p.mode==='charge'
  const q=Cs*u, Ws=charging?p.U0*Cs*u:0, Ec=.5*Cs*u*u, Qr=s.Qr
  /* 上部：电路图（矩形回路，电流箭头随 i 大小） */
  const y0=H*.10, y1=H*.27, xl=W*.10, xr=W*.46, mid=y0+ (y1-y0)/2
  line(ctx,xl,y0,xr-W*.09,y0,'#c8d2e6',2)
  line(ctx,xr,y0+18,xr,y1-18,'#c8d2e6',2)
  line(ctx,xl,y1,xr,y1,'#c8d2e6',2)
  line(ctx,xl,y0,xl,y1,'#c8d2e6',2)
  /* 开关 + 电阻（上横线的缺口处画锯齿） */
  const sx=W*.24, ex=W*.37
  line(ctx,sx,y0,ex,y0,'#c8d2e6',2)
  ctx.save();ctx.strokeStyle=COL.blue;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx+8,y0)
  for(let j=0;j<8;j++)ctx.lineTo(sx+8+(ex-sx-16)*j/8,y0+(j%2?7:-7))
  ctx.lineTo(ex-8,y0);ctx.stroke();ctx.restore()
  label(ctx,'R = '+fmtNum(p.R,1)+' kΩ',(sx+ex)/2-24,y0-16,COL.blue,10)
  /* 电源（左） */
  line(ctx,xl-14,mid-13,xl+14,mid-13,charging?COL.orange:COL.grey,2.4)
  line(ctx,xl-8,mid+8,xl+8,mid+8,charging?COL.orange:COL.grey,4)
  label(ctx,charging?'U₀ = '+fmtNum(p.U0,1)+' V':'电源已断开',xl-56,mid+4,charging?COL.orange:COL.grey,11)
  /* 电容（右竖线中部两块横板） */
  line(ctx,xr-20,y0+ (y1-y0)*.38,xr+20,y0+(y1-y0)*.38,COL.green,3)
  line(ctx,xr-20,y0+ (y1-y0)*.62,xr+20,y0+(y1-y0)*.62,COL.green,3)
  label(ctx,'C = '+fmtNum(p.C,0)+' μF',xr+26,y0+(y1-y0)*.5,COL.green,10)
  label(ctx,'+'+fmtNum(q*1e3,2)+' mC',xr-52,y0+(y1-y0)*.34,COL.blue,10)
  label(ctx,'u_C = '+fmtNum(u,3)+' V',xr-52,y0+(y1-y0)*.72,COL.blue,10)
  /* 电流箭头 */
  const im=Math.abs(i)*1000, dir=charging?1:-1, alen=Math.min(64,10+im*7)
  arrow(ctx,W*.28,y1+16,W*.28+dir*alen,y1+16,COL.orange,2)
  label(ctx,'i = '+fmtNum(im,3)+' mA',W*.28+dir*alen+6,y1+20,COL.orange,10)
  label(ctx,charging?'充电：电源持续供能':'放电：电源断开，电容经 R 放能',W*.60,H*.12,'#17223c',12)
  label(ctx,'τ = RC = '+fmtNum(tau,4)+' s    t = '+fmtNum(s.t,3)+' s = '+fmtNum(s.t/tau,3)+' τ',W*.60,H*.12+22,'#6d7893',11)
  label(ctx,'t = τ 时 u_C/U₀ = 1−1/e = 63.21%',W*.60,H*.12+40,'#8a95ad',10)
  label(ctx,'t½ = τ·ln2 = '+fmtNum(tau*Math.log(2),4)+' s',W*.60,H*.12+58,'#8a95ad',10)
  /* 中部左：u_C(t) 数值 vs 解析 */
  const t1=Math.max(tau*5,s.t*1.05,.2), x=Math.exp(-s.t/tau)
  const uTh=t=>p.U0*(charging?1-Math.exp(-t/tau):Math.exp(-t/tau))
  const iTh=t=>p.U0/Rs*Math.exp(-t/tau)
  const anaU=[],anaI=[]
  for(let j=0;j<=140;j++){const tt=t1*j/140;anaU.push([tt,uTh(tt)]);anaI.push([tt,iTh(tt)*1000])}
  plot(ctx,{x:44,y:H*.34,w:W*.44,h:H*.24},[
    {pts:[[0,p.U0*.6321],[t1,p.U0*.6321]],c:'#e0cdb4',dash:[4,4]},
    {pts:anaU,c:COL.grey,dash:[5,4]},
    {pts:s.hist.map(q2=>[q2[0],q2[1]]),c:COL.blue}
  ],0,t1,0,p.U0*1.12,'t / s','u_C / V')
  plot(ctx,{x:W*.54,y:H*.34,w:W*.42,h:H*.24},[
    {pts:anaI,c:COL.grey,dash:[5,4]},
    {pts:s.hist.map(q2=>[q2[0],q2[2]*1000]),c:COL.orange}
  ],0,t1,0,p.U0/Rs*1000*1.12,'t / s','i / mA')
  /* 下部：能量分配曲线 */
  const Emax=Math.max(Efull,charging?p.U0*p.U0*Cs:0,.001)*1000*1.12
  const series=[{pts:[[0,Efull*1000],[t1,Efull*1000]],c:'#d9c7b2',dash:[4,4]}]
  if(charging){
    series.push({pts:anaU.map(q2=>[q2[0],p.U0*Cs*q2[1]*1000]),c:COL.grey})
  }
  series.push({pts:anaU.map(q2=>[q2[0],.5*Cs*q2[1]*q2[1]*1000]),c:COL.green})
  series.push({pts:anaU.map(q2=>[q2[0],Efull*1000*(1-Math.exp(-2*q2[0]/tau))]),c:COL.orange})
  series.push({pts:s.hist.map(q2=>[q2[0],q2[5]*1000]),c:COL.red,lw:1.2})
  plot(ctx,{x:44,y:H*.63,w:W*.60,h:H*.29},series,0,t1,0,Emax,'t / s','能量 / mJ')
  label(ctx,charging?'灰：电源功 W_s   绿：储能 E_C   橙：焦耳热 Q_R':'棕：初始储能   绿：剩余 E_C   橙：焦耳热 Q_R',48,H*.61,'#8a95ad',10)
  /* 能量条 */
  bars(ctx,W*.69,H*.70,W*.27,[{n:'电源功',v:Ws*1000,c:COL.grey},{n:'储能',v:Ec*1000,c:COL.green},{n:'焦耳热',v:Qr*1000,c:COL.orange}],Math.max(Efull*1000,.001))
  label(ctx,charging?'充满后：储能 50% / 发热 50%':'放完：储能 0 / 发热 100%',W*.69,H*.67,'#b06a2c',10)
  label(ctx,'能量残差 = '+fmtNum(((charging?Ws:s.E0)-Ec-Qr)*1000,8)+' mJ',W*.69,H*.94,COL.green,10)
 },
 rows(s,p){
  const {Rs,Cs,tau,Efull}=consts(p), u=s.u, i=current(p,u), charging=p.mode==='charge'
  const x=Math.exp(-s.t/tau)
  const uTh=p.U0*(charging?1-x:x), iTh=p.U0/Rs*x
  const q=Cs*u, Ws=charging?p.U0*q:0, Ec=.5*Cs*u*u, Qr=s.Qr
  const src=charging?Ws:s.E0
  return[
   ['物理时间 t',fmtNum(s.t,4)+' s'],['时间常数 τ = RC',fmtNum(tau,5)+' s'],
   ['t/τ',fmtNum(s.t/tau,4)],['过程',charging?'充电（电源接通）':'放电（电源断开）'],
   ['电容电压 u_C 数值',fmtNum(u,6)+' V'],['电容电压 u_C 解析',fmtNum(uTh,6)+' V'],
   ['电压相对偏差',fmtNum(Math.abs(u-uTh)/Math.max(p.U0,1e-9)*100,6)+' %（满量程）'],
   ['电流 i 数值 / 解析',fmtNum(i*1000,6)+' / '+fmtNum(iTh*1000,6)+' mA'],
   ['电荷 q = Cu_C',fmtNum(q*1e3,6)+' mC'],
   ['电源做功 W_s',fmtNum(Ws*1000,6)+' mJ'],['电容储能 E_C = ½Cu²',fmtNum(Ec*1000,6)+' mJ'],
   ['电阻发热 Q_R',fmtNum(Qr*1000,6)+' mJ'],
   ['能量账来源（W_s 或 E₀）',fmtNum(src*1000,6)+' mJ'],
   ['能量残差 来源−E_C−Q_R',fmtNum((src-Ec-Qr)*1000,9)+' mJ'],
   ['瞬时能量效率 E_C/W_s',charging&&Ws>0?fmtNum(Ec/Ws*100,3)+' %':'—'],
   ['充满时储能占比',charging?'50.000 %（与 R 无关）':'0 %（放电）'],
   ['充满时发热占比',charging?'50.000 %（与 R 无关）':'100 %（放电）'],
   ['特征量 1−1/e',fmtNum((1-Math.exp(-1))*100,3)+' %'],
   ['半衰时间 t½ = τ ln2',fmtNum(tau*Math.log(2),5)+' s'],
   ['总能量标度 ½CU₀²',fmtNum(Efull*1000,6)+' mJ']
  ]
 }
}

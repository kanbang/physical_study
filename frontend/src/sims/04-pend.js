// 仿真 04 · 单摆：小角近似的误差（椭圆积分精确周期 vs 实测）
import {COL,frame,line,dot,label,plot,rk4,agmK,fmtNum} from "../lib/canvasUtils.js"

export default {
 id:'pend',name:'单摆：小角近似的误差',brief:'非线性方程 / 椭圆积分精确周期 / 实测周期',rate:1,
 legend:[{c:COL.blue,n:'真实非线性解 θ(t)'},{c:COL.grey,n:'小角近似解 θ₀cos(ω₀t)'}],
 note:'<b>物理要点：</b>θ″ + (g/L)sinθ = 0 是非线性方程。T₀ = 2π√(L/g) 只在 θ₀ ≪ 1 时成立；精确周期 T = 4√(L/g)·K(sin(θ₀/2))，K 由算术—几何平均（AGM）算出。θ₀ = 60° 时真实周期比 T₀ 约大 7.3%，一阶估计 θ₀²/16 ≈ 6.9%。加阻尼后精确周期公式不再严格适用。',
 params:[{k:'L',label:'摆长 L',min:.2,max:3,step:.1,val:1,unit:'m'},{k:'ang0',label:'初始摆角 θ₀',min:5,max:170,step:1,val:60,unit:'°'},{k:'g',label:'重力加速度 g',min:1,max:20,step:.1,val:9.8,unit:'m/s²'},{k:'damp',label:'阻尼系数 γ',min:0,max:.5,step:.01,val:0,unit:'s⁻¹'}],
 init(p){const a=p.ang0*Math.PI/180;return{t:0,th:a,w:0,hist:[[0,a,a]],prev:a,lastCross:null,Tmeas:null}},
 step(dt,p,s){
   const f=q=>[q[1],-(p.g/p.L)*Math.sin(q[0])-p.damp*q[1]];
   const nx=rk4(f,[s.th,s.w],dt);
   if(s.prev>0&&nx[0]<=0){const fr=s.prev/(s.prev-nx[0]),tc=s.t+fr*dt;if(s.lastCross!==null)s.Tmeas=tc-s.lastCross;s.lastCross=tc}
   s.prev=nx[0];s.th=nx[0];s.w=nx[1];s.t+=dt;
   const w0=Math.sqrt(p.g/p.L),a0=p.ang0*Math.PI/180,lin=a0*Math.exp(-p.damp*s.t/2)*Math.cos(w0*s.t);
   s.hist.push([s.t,s.th,lin]);if(s.hist.length>1800)s.hist.shift();
 },
 draw(ctx,W,H,s,p){
   frame(ctx,W,H);const cx=W*.42,py=34,Lpx=Math.min(185,H*.40),a0=p.ang0*Math.PI/180,w0=Math.sqrt(p.g/p.L);
   const lin=a0*Math.exp(-p.damp*s.t/2)*Math.cos(w0*s.t);
   line(ctx,cx,py,cx,py+Lpx+28,'#e2e8f4',1,[4,4]);
   ctx.save();ctx.strokeStyle='#eef2f9';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(cx,py,Lpx,Math.PI/2-Math.abs(a0),Math.PI/2+Math.abs(a0));ctx.stroke();ctx.restore();
   const bx=cx+Lpx*Math.sin(s.th),by=py+Lpx*Math.cos(s.th),gx=cx+Lpx*Math.sin(lin),gy=py+Lpx*Math.cos(lin);
   line(ctx,cx,py,gx,gy,'#d3dcee',1.5,[5,4]);dot(ctx,gx,gy,7,'#ffffff');ctx.save();ctx.strokeStyle=COL.grey;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(gx,gy,7,0,7);ctx.stroke();ctx.restore();
   line(ctx,cx,py,bx,by,'#8996b2',2);dot(ctx,bx,by,11,COL.blue);
   label(ctx,'θ = '+fmtNum(s.th*180/Math.PI,1)+'°',cx+14,py+Lpx+16,COL.blue,12);
   label(ctx,'θ₀ = '+p.ang0+'°',cx-46,py-10,'#6d7893',11);
   label(ctx,'实线：真实解  ·  空心圈：小角近似',W-262,26,'#6d7893',11);
   const span=Math.max(3,4*2*Math.PI/w0),t1=Math.max(span,s.t),t0=t1-span,lim=a0*1.25*180/Math.PI;
   plot(ctx,{x:44,y:H*.62,w:W-88,h:H*.30},[{pts:s.hist.filter(q=>q[0]>=t0).map(q=>[q[0],q[2]*180/Math.PI]),c:COL.grey,dash:[5,4]},{pts:s.hist.filter(q=>q[0]>=t0).map(q=>[q[0],q[1]*180/Math.PI]),c:COL.blue}],t0,t1,-lim,lim,'t / s','θ / °');
 },
 rows(s,p){
   const w0=Math.sqrt(p.g/p.L),T0=2*Math.PI/w0,a0=p.ang0*Math.PI/180,Tex=4*Math.sqrt(p.L/p.g)*agmK(Math.sin(a0/2));
   return[['物理时间 t',fmtNum(s.t,2)+' s'],['当前摆角 θ',fmtNum(s.th*180/Math.PI,2)+' °'],['角速度 ω',fmtNum(s.w,3)+' rad/s'],
    ['小角周期 T₀ = 2π√(L/g)',fmtNum(T0,4)+' s'],['精确周期（椭圆积分）',fmtNum(Tex,4)+' s'],
    ['数值实测周期',s.Tmeas===null?'等待过零':fmtNum(s.Tmeas,4)+' s'],
    ['真实周期比 T₀ 大',fmtNum((Tex/T0-1)*100,3)+' %'],['一阶估计 θ₀²/16',fmtNum(a0*a0/16*100,3)+' %'],
    ['阻尼系数 γ',p.damp+' s⁻¹'],['说明',p.damp>0?'有阻尼时精确周期公式仅作参照':'无阻尼时实测周期应收敛到精确周期']];
 }
}

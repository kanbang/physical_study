// 仿真 03 · 阻尼弹簧振子（RK4 / 实测周期 / 能量守恒校核）
import {COL,frame,line,arrow,label,plot,bars,rk4,fmtNum} from "../lib/canvasUtils.js"

export default {
 id:'spring',name:'阻尼弹簧振子',brief:'RK4 积分 / 实测周期 / 能量流向',rate:.35,
 legend:[{c:COL.blue,n:'数值 x(t)'},{c:COL.grey,n:'包络 ±Ae^(−βt)'},{c:COL.orange,n:'能量'}],
 note:'<b>物理要点：</b>方程 mx″ + bx′ + kx = 0。欠阻尼时 ω_d = √(ω₀²−β²)，β = b/(2m)，振幅按 e^(−βt) 衰减。「实测周期」由数值解同向过零点测出，可与理论 T_d 对照 —— 这是检验积分精度的直接办法。播放速度已放慢 0.35×，读数中的 t 仍是真实物理时间。',
 params:[{k:'k',label:'劲度系数 k',min:20,max:400,step:10,val:200,unit:'N/m'},{k:'m',label:'质量 m',min:.2,max:3,step:.1,val:.5,unit:'kg'},{k:'b',label:'阻尼系数 b',min:0,max:4,step:.1,val:.3,unit:'N·s/m'},{k:'A',label:'初始振幅 A',min:.02,max:.2,step:.01,val:.1,unit:'m'}],
 init(p){return{t:0,x:p.A,v:0,hist:[[0,p.A]],lastCross:null,Tmeas:null,prevX:p.A,diss:0}},
 step(dt,p,s){
   const f=a=>[a[1],(-p.k*a[0]-p.b*a[1])/p.m];
   const nx=rk4(f,[s.x,s.v],dt);
   s.diss+=p.b*Math.pow((s.v+nx[1])/2,2)*dt;
   if(s.prevX>0&&nx[0]<=0){const fr=s.prevX/(s.prevX-nx[0]);const tc=s.t+fr*dt;if(s.lastCross!==null)s.Tmeas=tc-s.lastCross;s.lastCross=tc}
   s.prevX=nx[0];s.x=nx[0];s.v=nx[1];s.t+=dt;s.hist.push([s.t,s.x]);if(s.hist.length>1800)s.hist.shift();
 },
 draw(ctx,W,H,s,p){
   frame(ctx,W,H);const w0=Math.sqrt(p.k/p.m),beta=p.b/(2*p.m),wd2=w0*w0-beta*beta,T0=2*Math.PI/w0;
   const topH=Math.round(H*.42),cx=W*.5,eq=W*.5;
   line(ctx,60,topH-30,60,topH+30,COL.grey,3);
   const px=cx+s.x*460;
   ctx.save();ctx.strokeStyle='#c3d0ee';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(60,topH);
   const coils=14,L=Math.max(20,px-60-22);for(let i=0;i<=coils*2;i++){const xx=60+L*i/(coils*2),yy=topH+(i%2?11:-11);ctx.lineTo(xx,yy)}ctx.lineTo(px-20,topH);ctx.stroke();ctx.restore();
   ctx.fillStyle='#e9efff';ctx.strokeStyle=COL.blue;ctx.lineWidth=2;ctx.fillRect(px-20,topH-24,40,48);ctx.strokeRect(px-20,topH-24,40,48);
   line(ctx,eq,topH-44,eq,topH+48,'#dfe6f4',1,[4,4]);label(ctx,'平衡位置',eq+6,topH+60,'#8a95ad',10);
   arrow(ctx,eq,topH+76,px,topH+76,COL.orange,2);label(ctx,'x = '+fmtNum(s.x,3)+' m',(eq+px)/2-30,topH+94,COL.orange,11);
   const span=Math.max(1.2,3*T0),t1=Math.max(span,s.t),t0=t1-span;
   const env=[];for(let i=0;i<=100;i++){const t=t0+(t1-t0)*i/100;env.push([t,p.A*Math.exp(-beta*t)])}
   const env2=env.map(q=>[q[0],-q[1]]);
   plot(ctx,{x:44,y:topH+112,w:W-88,h:H-topH-160},[{pts:env,c:'#d9c7b2',dash:[4,4]},{pts:env2,c:'#d9c7b2',dash:[4,4]},{pts:s.hist.filter(q=>q[0]>=t0),c:COL.blue}],t0,t1,-p.A*1.15,p.A*1.15,'t / s','x / m');
   const E=.5*p.m*s.v*s.v+.5*p.k*s.x*s.x;
   bars(ctx,W-250,20,230,[{n:'动能',v:.5*p.m*s.v*s.v,c:COL.blue},{n:'弹性势能',v:.5*p.k*s.x*s.x,c:COL.green},{n:'已耗散',v:s.diss,c:COL.orange}],Math.max(.5*p.k*p.A*p.A,.001));
 },
 rows(s,p){
   const w0=Math.sqrt(p.k/p.m),beta=p.b/(2*p.m),wd2=w0*w0-beta*beta,T0=2*Math.PI/w0,Td=wd2>0?2*Math.PI/Math.sqrt(wd2):null;
   const E=.5*p.m*s.v*s.v+.5*p.k*s.x*s.x;
   return[['物理时间 t',fmtNum(s.t,2)+' s'],['位移 x',fmtNum(s.x,4)+' m'],['速度 v',fmtNum(s.v,4)+' m/s'],
    ['无阻尼周期 T₀ = 2π√(m/k)',fmtNum(T0,4)+' s'],['阻尼周期 T_d',Td===null?'（过阻尼）':fmtNum(Td,4)+' s'],
    ['数值实测周期',s.Tmeas===null?'等待过零':fmtNum(s.Tmeas,4)+' s'],
    ['周期偏差（实测−T_d）',(Td===null||s.Tmeas===null)?'—':fmtNum((s.Tmeas-Td)/Td*100,3)+' %'],
    ['阻尼率 β = b/(2m)',fmtNum(beta,4)+' s⁻¹'],['阻尼状态',wd2>0?'欠阻尼':'过阻尼 / 临界'],
    ['当前机械能 E',fmtNum(E,4)+' J'],['累计耗散',fmtNum(s.diss,4)+' J'],
    ['E + 耗散（应恒为 ½kA²）',fmtNum(E+s.diss,4)+' J'],['理论总能量 ½kA²',fmtNum(.5*p.k*p.A*p.A,4)+' J']];
 }
}

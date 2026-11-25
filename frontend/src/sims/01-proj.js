// 仿真 01 · 抛体运动与空气阻力（RK4 数值解 vs 无阻力解析解）
import {COL,frame,gridAxes,line,arrow,dot,label,rk4,fmtNum} from "../lib/canvasUtils.js"

export default {
 id:'proj',name:'抛体运动与空气阻力',brief:'线性阻力下的轨迹 / 45° 最优角的前提',rate:1,
 legend:[{c:COL.blue,n:'数值积分轨迹'},{c:COL.grey,n:'无阻力解析解'},{c:COL.orange,n:'速度矢量'}],
 note:'<b>物理要点：</b>无阻力且起落等高时 45° 射程最大；一旦加入阻力 F = −bv，最优角小于 45°。图中虚线始终是无阻力解析解，用来观察数值解偏离多少。落地判定用线性插值，避免时间步离散造成的射程误差。',
 params:[{k:'v0',label:'初速度 v₀',min:5,max:40,step:1,val:20,unit:'m/s'},{k:'ang',label:'抛射角 θ',min:5,max:85,step:1,val:45,unit:'°'},{k:'g',label:'重力加速度 g',min:1,max:20,step:.1,val:9.8,unit:'m/s²'},{k:'drag',label:'线性阻力系数 β = b/m',min:0,max:.6,step:.01,val:0,unit:'s⁻¹'}],
 init(p){const r=p.ang*Math.PI/180;return{t:0,x:0,y:0,vx:p.v0*Math.cos(r),vy:p.v0*Math.sin(r),trail:[[0,0]],apex:0,landed:false,range:null,tLand:null}},
 step(dt,p,s){
   if(s.landed)return;
   const f=a=>[a[2],a[3],-p.drag*a[2],-p.g-p.drag*a[3]];
   const cur=[s.x,s.y,s.vx,s.vy],nx=rk4(f,cur,dt);
   if(nx[1]<=0&&cur[1]>0){const fr=cur[1]/(cur[1]-nx[1]);s.range=cur[0]+fr*(nx[0]-cur[0]);s.tLand=s.t+fr*dt;s.landed=true;s.x=s.range;s.y=0;s.vx=nx[2];s.vy=nx[3];}
   else{s.x=nx[0];s.y=nx[1];s.vx=nx[2];s.vy=nx[3];s.t+=dt}
   s.apex=Math.max(s.apex,s.y);s.trail.push([s.x,s.y]);if(s.trail.length>1400)s.trail.shift();
 },
 draw(ctx,W,H,s,p){
   frame(ctx,W,H);const r=p.ang*Math.PI/180,T=2*p.v0*Math.sin(r)/p.g,Hh=p.v0*p.v0*Math.sin(r)**2/(2*p.g),R=p.v0*p.v0*Math.sin(2*r)/p.g;
   const x1=Math.max(8,R*1.12,s.x*1.2)*1.02,y1=Math.max(4,Hh*1.35,s.apex*1.2)*1.05;
   const m=gridAxes(ctx,W,H,0,x1,0,y1,48,'x / m','y / m');
   const ana=[];for(let i=0;i<=120;i++){const t=T*i/120;ana.push([p.v0*Math.cos(r)*t,p.v0*Math.sin(r)*t-.5*p.g*t*t])}
   ctx.save();ctx.setLineDash([5,5]);ctx.strokeStyle=COL.grey;ctx.lineWidth=1.6;ctx.beginPath();ana.forEach((q,i)=>i?ctx.lineTo(m.X(q[0]),m.Y(q[1])):ctx.moveTo(m.X(q[0]),m.Y(q[1])));ctx.stroke();ctx.restore();
   ctx.save();ctx.strokeStyle=COL.blue;ctx.lineWidth=2.3;ctx.beginPath();s.trail.forEach((q,i)=>i?ctx.lineTo(m.X(q[0]),m.Y(q[1])):ctx.moveTo(m.X(q[0]),m.Y(q[1])));ctx.stroke();ctx.restore();
   dot(ctx,m.X(s.x),m.Y(s.y),6,COL.blue);
   const sc=Math.min(3.5,Math.max(.5,60/Math.max(1,p.v0)));
   arrow(ctx,m.X(s.x),m.Y(s.y),m.X(s.x)+s.vx*sc,m.Y(s.y)-s.vy*sc,COL.orange,2);
   line(ctx,m.X(0),m.Y(Hh),m.X(x1),m.Y(Hh),'#e6d4bd',1,[4,4]);label(ctx,'H = '+fmtNum(Hh,2)+' m',m.X(x1)-96,m.Y(Hh)-7,'#b98a54',10);
   if(s.range!==null){line(ctx,m.X(s.range),m.Y(0),m.X(s.range),m.Y(0)+1,'#fff',1);}
   label(ctx,'R解析 = '+fmtNum(R,2)+' m',m.X(x1)-150,H-58,COL.grey,11);
 },
 rows(s,p){
   const r=p.ang*Math.PI/180,R=p.v0*p.v0*Math.sin(2*r)/p.g,Hh=p.v0*p.v0*Math.sin(r)**2/(2*p.g),T=2*p.v0*Math.sin(r)/p.g;
   const dev=(s.range!==null&&p.drag===0)?Math.abs(s.range-R)/R*100:null;
   return[['模拟时间 t',fmtNum(s.t,2)+' s'],['当前位置 (x, y)',fmtNum(s.x,2)+' , '+fmtNum(s.y,2)+' m'],['速率 |v|',fmtNum(Math.hypot(s.vx,s.vy),2)+' m/s'],
    ['数值射程 R数值',s.range===null?'飞行中':fmtNum(s.range,3)+' m'],['解析射程 R = v₀²sin2θ/g',fmtNum(R,3)+' m'],['射程相对偏差',dev===null?'—':fmtNum(dev,3)+' %'],
    ['数值最高点',fmtNum(s.apex,3)+' m'],['解析最高点',fmtNum(Hh,3)+' m'],['解析飞行时间',fmtNum(T,3)+' s'],['阻力系数 β',p.drag+' s⁻¹']];
 }
}

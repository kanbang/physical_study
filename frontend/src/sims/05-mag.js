// 仿真 05 · 带电粒子在匀强磁场（回旋半径 / 螺旋线 / 洛伦兹力不做功）
import {COL,frame,line,arrow,dot,label,fmtNum} from "../lib/canvasUtils.js"

export default {
 id:'mag',name:'带电粒子在匀强磁场',brief:'回旋半径 / 螺旋线 / 洛伦兹力不做功',rate:1,
 legend:[{c:COL.blue,n:'粒子轨迹'},{c:COL.orange,n:'速度 v'},{c:COL.green,n:'洛伦兹力（指向圆心）'}],
 note:'<b>物理要点：</b>qv⊥B = mv⊥²/r ⇒ r = mv⊥/(qB)，T = 2πm/(qB) 与速率无关（回旋加速器原理）。v 有平行分量时轨迹为螺旋线。动画相位按可视化速率推进（真实周期可达 10⁻⁷ s 量级），但右侧读数全部是真实物理量；示意图半径已归一化，不代表真实长度比例。',
 params:[{k:'v',label:'速率 v',min:.5,max:5,step:.1,val:2,unit:'×10⁶ m/s'},{k:'B',label:'磁感应强度 B',min:.05,max:1,step:.01,val:.2,unit:'T'},{k:'tilt',label:'与垂直 B 平面的夹角',min:0,max:80,step:1,val:0,unit:'°'},{type:'select',k:'particle',label:'粒子种类',options:[{v:'proton',n:'质子 p⁺'},{v:'electron',n:'电子 e⁻'},{v:'alpha',n:'α 粒子'}],val:'proton'}],
 init(){return{phi:0,phis:[0],t:0}},
 step(dt,p,s){s.phi+=dt*1.15;s.t+=dt;s.phis.push(s.phi);if(s.phis.length>900)s.phis.shift()},
 draw(ctx,W,H,s,p){
   frame(ctx,W,H);
   const QM={proton:{qm:9.58e7,sgn:1,m:1.67e-27,q:1.6e-19,n:'质子 p⁺'},electron:{qm:1.76e11,sgn:-1,m:9.11e-31,q:1.6e-19,n:'电子 e⁻'},alpha:{qm:4.79e7,sgn:1,m:6.64e-27,q:3.2e-19,n:'α 粒子'}}[p.particle]||{qm:9.58e7,sgn:1,m:1.67e-27,q:1.6e-19,n:'质子 p⁺'};
   const w=QM.qm*p.B,vSI=p.v*1e6,til=p.tilt*Math.PI/180,vp=vSI*Math.cos(til),vl=vSI*Math.sin(til);
   const r=vp/w,T=2*Math.PI/w,pitch=vl*T,R=Math.min(W*.24,H*.30,125),dir=QM.sgn;
   ctx.save();ctx.fillStyle='#eef3fd';for(let x=40;x<W-30;x+=42)for(let y=40;y<H-30;y+=42){ctx.beginPath();ctx.arc(x,y,1.6,0,7);ctx.fill()}
   ctx.restore();
   let pos,cx,cy,ax0,ay,pitchPx;
   if(p.tilt===0){cx=W*.38;cy=H*.40;pos=ph=>[cx+R*Math.sin(ph),cy+dir*R*(1-Math.cos(ph))]}
   else{cx=W*.16;cy=H*.52;ax0=W*.12;ay=H*.58;pitchPx=Math.min(W*.55,420);pos=ph=>[ax0+(ph/(2*Math.PI))*pitchPx+R*Math.sin(ph),ay+R*Math.cos(ph)*.30+dir*R*(1-Math.cos(ph))*.55]}
   if(p.tilt===0){ctx.save();ctx.strokeStyle='#cddbf8';ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(cx,cy+dir*R,R,0,7);ctx.stroke();ctx.restore();dot(ctx,cx,cy+dir*R,3,COL.grey);label(ctx,'圆心',cx+6,cy+dir*R-6,COL.grey,10)}
   else{line(ctx,ax0-30,ay,W-30,ay,'#b7c6e6',1.5,[6,4]);arrow(ctx,ax0-30,ay+26,ax0+70,ay+26,COL.green,1.8);label(ctx,'B 方向 / v∥',ax0-30,ay+44,COL.green,10)}
   ctx.save();ctx.strokeStyle=COL.blue;ctx.lineWidth=2.4;ctx.beginPath();s.phis.forEach((ph,i)=>{const q=pos(ph);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.stroke();ctx.restore();
   const q0=pos(s.phi),qPrev=pos(Math.max(0,s.phi-.02));
   const vx=q0[0]-qPrev[0],vy=q0[1]-qPrev[1],n=Math.hypot(vx,vy)||1;
   dot(ctx,q0[0],q0[1],7,COL.blue);
   arrow(ctx,q0[0],q0[1],q0[0]+vx/n*48,q0[1]+vy/n*48,COL.orange,2.2);
   label(ctx,'v',q0[0]+vx/n*54,q0[1]+vy/n*54,COL.orange,11);
   if(p.tilt===0){const ccx=cx,ccy=cy+dir*R,fx=ccx-q0[0],fy=ccy-q0[1],fn=Math.hypot(fx,fy)||1;arrow(ctx,q0[0],q0[1],q0[0]+fx/fn*42,q0[1]+fy/fn*42,COL.green,2);label(ctx,'F',q0[0]+fx/fn*48,q0[1]+fy/fn*48,COL.green,11)}
   label(ctx,'B ⊙ 垂直纸面向外',W-186,26,'#6d7893',11);
   label(ctx,'r = '+fmtNum(r,4)+' m（示意图按半径归一化）',20,H-16,'#6d7893',11);
   label(ctx,'相位 φ = '+fmtNum(s.phi,2)+' rad',20,26,'#17223c',12);
 },
 rows(s,p){
   const QM={proton:{qm:9.58e7,m:1.67e-27,q:1.6e-19},electron:{qm:1.76e11,m:9.11e-31,q:1.6e-19},alpha:{qm:4.79e7,m:6.64e-27,q:3.2e-19}}[p.particle]||{qm:9.58e7,m:1.67e-27,q:1.6e-19};
   const w=QM.qm*p.B,vSI=p.v*1e6,til=p.tilt*Math.PI/180,vp=vSI*Math.cos(til),vl=vSI*Math.sin(til),r=vp/w,T=2*Math.PI/w,pitch=vl*T,E=.5*QM.m*vSI*vSI;
   return[['回旋角频率 ω = qB/m',w.toExponential(3)+' rad/s'],['回旋半径 r = mv⊥/(qB)',fmtNum(r,5)+' m = '+fmtNum(r*100,2)+' cm'],
    ['回旋周期 T = 2πm/(qB)',T.toExponential(3)+' s'],['垂直分量 v⊥',vSI.toExponential(3)+' m/s'],['平行分量 v∥',vl.toExponential(3)+' m/s'],
    ['螺距 h = v∥T',fmtNum(pitch,5)+' m'],['动能（恒定）',E.toExponential(3)+' J'],['动画相位 φ',fmtNum(s.phi,2)+' rad'],
    ['洛伦兹力做功','恒为 0（F ⊥ v）'],['轨迹类型',p.tilt===0?'匀速圆周':'螺旋线']];
 }
}

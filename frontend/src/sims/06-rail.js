// 仿真 06 · 电磁感应导轨（精确指数步 / 动量定理求位移与焦耳热）
import {COL,frame,line,arrow,label,plot,bars,fmtNum} from "../lib/canvasUtils.js"

export default {
 id:'rail',name:'电磁感应导轨',brief:'安培阻尼 / 动量定理求位移 / 焦耳热',rate:1,
 legend:[{c:COL.blue,n:'数值 v(t)'},{c:COL.grey,n:'解析 v₀e^(−t/τ)'},{c:COL.orange,n:'动能→焦耳热'}],
 note:'<b>物理要点：</b>ε = BLv ⇒ I = BLv/R ⇒ F安 = B²L²v/R，故 dv/dt = −v/τ（τ = mR/B²L²）。由动量定理 −BLq = m(v−v₀) 与 q = BLx/R 可绕过微分方程求总位移与总电荷。速度按指数渐近于零、理论上永不停止，但总位移有限 x∞ = v₀τ。本实验用精确指数步推进，数值解与解析解差异应接近机器精度。',
 params:[{k:'B',label:'磁感应强度 B',min:.2,max:2,step:.1,val:1,unit:'T'},{k:'L',label:'导轨间距 L',min:.2,max:1,step:.05,val:.5,unit:'m'},{k:'R',label:'电阻 R',min:.5,max:5,step:.5,val:2,unit:'Ω'},{k:'m',label:'导体棒质量 m',min:.2,max:2,step:.1,val:.5,unit:'kg'},{k:'v0',label:'初速度 v₀',min:1,max:10,step:.5,val:4,unit:'m/s'}],
 init(p){return{t:0,v:p.v0,x:0,q:0,Q:0,hist:[[0,p.v0]]}},
 step(dt,p,s){
   const tau=p.m*p.R/(p.B*p.B*p.L*p.L),v2=s.v*Math.exp(-dt/tau),dx=(s.v-v2)*tau;
   s.x+=dx;s.q+=(p.B*p.L/p.R)*dx;s.Q+=.5*p.m*(s.v*s.v-v2*v2);s.v=v2;s.t+=dt;
   s.hist.push([s.t,s.v]);if(s.hist.length>1600)s.hist.shift();
 },
 draw(ctx,W,H,s,p){
   frame(ctx,W,H);const tau=p.m*p.R/(p.B*p.B*p.L*p.L),xinf=p.v0*tau;
   const yT=H*.16,yB=H*.38,x0=70,x1=W-70;
   ctx.save();ctx.fillStyle='#dfe8fa';for(let x=x0+14;x<x1;x+=34)for(let y=yT+16;y<yB;y+=32){ctx.beginPath();ctx.arc(x,y,1.5,0,7);ctx.fill()}ctx.restore();
   label(ctx,'B ⊙ 匀强磁场',x0+4,yT-12,'#6d7893',11);
   line(ctx,x0,yT,x1,yT,'#8f9bb4',3);line(ctx,x0,yB,x1,yB,'#8f9bb4',3);
   line(ctx,x0,yT,x0,yB,'#8f9bb4',3);
   const rodX=x0+Math.min(1,s.x/(xinf||1))*(x1-x0-30);
   line(ctx,rodX,yT,rodX,yB,COL.blue,6);
   label(ctx,'导体棒',rodX-22,yB+18,COL.blue,11);
   arrow(ctx,rodX+16,(yT+yB)/2-16,rodX+58,(yT+yB)/2-16,COL.orange,2);label(ctx,'v',rodX+62,(yT+yB)/2-12,COL.orange,11);
   const I=p.B*p.L*s.v/p.R;
   label(ctx,'I = '+fmtNum(I,3)+' A',x1-130,yB+18,COL.green,11);
   const span=Math.max(4,4*tau),t1=Math.max(span,s.t),t0=t1-span,va=[];
   for(let i=0;i<=120;i++){const t=t0+(t1-t0)*i/120;va.push([t,p.v0*Math.exp(-t/tau)])}
   plot(ctx,{x:44,y:H*.48,w:W-88,h:H*.28},[{pts:va,c:COL.grey,dash:[5,4]},{pts:s.hist.filter(q=>q[0]>=t0),c:COL.blue}],t0,t1,0,p.v0*1.08,'t / s','v / (m/s)');
   bars(ctx,W-270,H-112,250,[{n:'动能',v:.5*p.m*s.v*s.v,c:COL.blue},{n:'焦耳热',v:s.Q,c:COL.orange}],Math.max(.5*p.m*p.v0*p.v0,.001));
 },
 rows(s,p){
   const tau=p.m*p.R/(p.B*p.B*p.L*p.L),xinf=p.v0*tau,qinf=p.m*p.v0/(p.B*p.L),Qinf=.5*p.m*p.v0*p.v0;
   const vAna=p.v0*Math.exp(-s.t/tau),I=p.B*p.L*s.v/p.R,Ek=.5*p.m*s.v*s.v;
   return[['物理时间 t',fmtNum(s.t,2)+' s'],['数值速度 v',fmtNum(s.v,6)+' m/s'],['解析速度 v₀e^(−t/τ)',fmtNum(vAna,6)+' m/s'],
    ['速度相对偏差',fmtNum(Math.abs(s.v-vAna)/Math.max(1e-12,p.v0)*100,6)+' %'],['时间常数 τ = mR/(B²L²)',fmtNum(tau,3)+' s'],
    ['瞬时电流 I',fmtNum(I,4)+' A'],['数值位移 x',fmtNum(s.x,4)+' m'],['解析总位移 x∞ = v₀τ',fmtNum(xinf,4)+' m'],
    ['数值电荷量 q',fmtNum(s.q,4)+' C'],['解析电荷量 mv₀/(BL)',fmtNum(qinf,4)+' C'],
    ['数值焦耳热 Q',fmtNum(s.Q,4)+' J'],['解析焦耳热 ½mv₀²',fmtNum(Qinf,4)+' J'],
    ['动量校核 BLq',fmtNum(p.B*p.L*s.q,4)+' N·s'],['动量校核 m(v₀−v)',fmtNum(p.m*(p.v0-s.v),4)+' N·s'],
    ['能量残差 Ek+Q−½mv₀²',fmtNum(Ek+s.Q-Qinf,8)+' J']];
 }
}

// 仿真 02 · 斜面滑块与自锁（分段加速度 / 摩擦换向 / 能量残差）
import {COL,frame,line,arrow,label,bars,fmtNum} from "../lib/canvasUtils.js"

export default {
 id:'incline',name:'斜面滑块与自锁',brief:'摩擦力换向 / 分段加速度 / 能量残差',rate:1,
 legend:[{c:COL.blue,n:'重力 mg'},{c:COL.green,n:'支持力 N'},{c:COL.orange,n:'摩擦力 f'}],
 note:'<b>物理要点：</b>上滑 a₁ = g(sinθ+μcosθ)，下滑 a₂ = g(sinθ−μcosθ)。最高点必须先判 tanθ ≤ μ 是否自锁。能量残差 = (E₀−E)−W_f，理想情况下应趋近 0，它同时检验了积分与摩擦做功的正确性。本模型按同一系数处理静/动摩擦，是教学简化。',
 params:[{k:'theta',label:'倾角 θ',min:5,max:60,step:1,val:30,unit:'°'},{k:'mu',label:'摩擦因数 μ',min:0,max:.8,step:.01,val:.29,unit:''},{k:'v0',label:'上滑初速度 v₀',min:0,max:12,step:.5,val:6,unit:'m/s'},{k:'m',label:'质量 m',min:.5,max:5,step:.1,val:1,unit:'kg'}],
 init(p){return{t:0,s:0,v:p.v0,a:0,Wf:0,smax:0,back:null,stopped:false,phase:'上滑'}},
 step(dt,p,s){
   if(s.stopped)return;const th=p.theta*Math.PI/180,sn=Math.sin(th),cs=Math.cos(th),g=10,fr=p.mu*p.m*g*cs;
   if(Math.abs(s.v)<1e-9){if(Math.tan(th)<=p.mu||s.s<=1e-9){s.v=0;s.a=0;s.stopped=true;s.phase='自锁静止';return}s.a=-g*(sn-p.mu*cs)}
   else s.a=(s.v>0)?-g*(sn+p.mu*cs):-g*(sn-p.mu*cs);
   let v2=s.v+s.a*dt;if(v2*s.v<0)v2=0;
   const ds=.5*(s.v+v2)*dt;
   s.s+=ds;s.Wf+=fr*Math.abs((s.v+v2)/2)*dt;s.t+=dt;s.v=v2;
   if(v2===0)s.phase='转向点';else if(v2>0)s.phase='上滑';else s.phase='下滑';
   if(s.s>s.smax)s.smax=s.s;
   if(s.s<=0&&v2<0){s.back=Math.abs(v2);s.s=0;s.v=0;s.stopped=true;s.phase='回到底端'}
 },
 draw(ctx,W,H,s,p){
   frame(ctx,W,H);const th=p.theta*Math.PI/180,g=10;
   const Lpx=Math.min(W-190,(H-160)/Math.max(.25,Math.sin(th))),ox=90,oy=H-72;
   const ex=ox+Lpx*Math.cos(th),ey=oy-Lpx*Math.sin(th);
   line(ctx,ox,oy,ex,ey,'#8f9bb4',3);line(ctx,ox,oy,ex,oy,'#d6deec',2);
   ctx.save();ctx.strokeStyle='#e7ecf6';ctx.setLineDash([3,4]);line(ctx,ex,oy,ex,ey,'#d6deec',1,[3,4]);ctx.restore();
   label(ctx,'θ = '+p.theta+'°',ox+16,oy-8,'#6d7893',11);
   const Lphy=Math.max(3,s.smax*1.3,p.v0*p.v0/(2*g*Math.sin(th))*1.2);
   const u=Math.min(1,Math.max(0,s.s/Lphy)),bx=ox+u*Lpx*Math.cos(th),by=oy-u*Lpx*Math.sin(th);
   ctx.save();ctx.translate(bx,by-14);ctx.rotate(-th);
   ctx.fillStyle='#e9efff';ctx.strokeStyle=COL.blue;ctx.lineWidth=2;ctx.fillRect(-19,-15,38,30);ctx.strokeRect(-19,-15,38,30);
   ctx.restore();
   const px=bx,py=by-14;
   arrow(ctx,px,py,px,py+62,COL.blue,2);label(ctx,'mg',px+7,py+56,COL.blue,11);
   arrow(ctx,px,py,px-52*Math.sin(th),py-52*Math.cos(th),COL.green,2);label(ctx,'N',px-56*Math.sin(th)-14,py-54*Math.cos(th),COL.green,11);
   const dir=s.v>0?-1:1;arrow(ctx,px,py,px+dir*52*Math.cos(th),py-dir*52*Math.sin(th),COL.orange,2);label(ctx,'f',px+dir*52*Math.cos(th)+5,py-dir*52*Math.sin(th),COL.orange,11);
   const E0=.5*p.m*p.v0*p.v0,E=.5*p.m*s.v*s.v+p.m*g*s.s*Math.sin(th);
   bars(ctx,W-330,H-118,300,[{n:'动能',v:.5*p.m*s.v*s.v,c:COL.blue},{n:'势能',v:p.m*g*s.s*Math.sin(th),c:COL.green},{n:'摩擦耗能',v:s.Wf,c:COL.orange}],Math.max(E0,.001));
   label(ctx,'E₀ = '+fmtNum(E0,2)+' J',W-330,H-134,'#6d7893',11);
   label(ctx,'阶段：'+s.phase,20,26,'#17223c',13);
   label(ctx,'s = '+fmtNum(s.s,2)+' m   v = '+fmtNum(s.v,2)+' m/s',20,46,'#4c5872',11);
 },
 rows(s,p){
   const th=p.theta*Math.PI/180,sn=Math.sin(th),cs=Math.cos(th),g=10;
   const smax=p.v0*p.v0/(2*g*(sn+p.mu*cs)),lock=Math.tan(th)<=p.mu;
   const vb=lock?0:p.v0*Math.sqrt(Math.max(0,(sn-p.mu*cs)/(sn+p.mu*cs)));
   const E0=.5*p.m*p.v0*p.v0,E=.5*p.m*s.v*s.v+p.m*g*s.s*sn,res=(E0-E)-s.Wf;
   return[['模拟时间 t',fmtNum(s.t,2)+' s'],['当前阶段',s.phase],['沿斜面位移 s',fmtNum(s.s,3)+' m'],['速度 v（上为正）',fmtNum(s.v,3)+' m/s'],
    ['瞬时加速度 a',fmtNum(s.a,3)+' m/s²'],['上滑加速度 a₁',fmtNum(-g*(sn+p.mu*cs),3)+' m/s²'],['下滑加速度 a₂',fmtNum(-g*(sn-p.mu*cs),3)+' m/s²'],
    ['数值最大位移',fmtNum(s.smax,3)+' m'],['解析最大位移',fmtNum(smax,3)+' m'],['数值返回速度',s.back===null?'—':fmtNum(s.back,3)+' m/s'],['解析返回速度',fmtNum(vb,3)+' m/s'],
    ['自锁判据 tanθ ≤ μ',lock?'成立（不下滑）':'不成立'],['摩擦耗能 W_f',fmtNum(s.Wf,3)+' J'],['能量残差 (E₀−E)−W_f',fmtNum(res,4)+' J']];
 }
}

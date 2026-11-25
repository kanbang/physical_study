// 仿真 11 · 光电效应与普朗克常数测定（爱因斯坦方程 / 截止电压 / 红限）
// hν[eV] = 0.4135668·ν，ν 以 10¹⁴ Hz 计；eU_c = hν − W，故 U_c(ν) 是斜率 h/e 的直线。
import {COL,frame,line,arrow,dot,label,plot,bars,fmtNum} from "../lib/canvasUtils.js"

const E_CHARGE = 1.602176634e-19, M_E = 9.1093837e-31
const H_SLOPE = 0.4135667696          // hν[eV] = H_SLOPE × ν[10¹⁴ Hz]（也等于 h/e，单位 V·s ×10¹⁴）
const H_STD = 6.62607015e-34          // 标准 h（J·s）
const WS = [1.90, 2.80, 3.70, 4.50]  // 参考金属逸出功，用于画平行线族

function th(p){
  const hn=H_SLOPE*p.nu, K=hn-p.W, active=K>0
  const Uc=active?K:0, nu0=p.W/H_SLOPE
  const vmax=active?Math.sqrt(2*K*E_CHARGE/M_E):0
  return {hn,K,active,Uc,nu0,lam:3000/p.nu,lam0:3000/nu0,vmax}
}
const photoI = (p,Uc,U) => (Uc>0 ? p.I0*Math.max(0,Math.min(1,(Uc-U)/Uc)) : 0)

export default {
 id:'photo',name:'光电效应 · 测定普朗克常数',brief:'eU_c = hν−W / 红限 / 截止电压−频率直线斜率 h/e',rate:1,
 legend:[{c:COL.blue,n:'当前金属的 I–U / U_c–ν'},{c:COL.grey,n:'其它逸出功 W 的对照'},{c:COL.orange,n:'当前扫描工作点'},{c:COL.red,n:'红限 ν₀'}],
 note:'<b>物理要点：</b>爱因斯坦方程 hν = W + K_max，反向电压增大到 eU_c = K_max 时光电流恰好为零。于是 U_c = (h/e)ν − W/e 是一条直线：<b>斜率 h/e = 4.136×10⁻¹⁵ V·s 与金属种类无关</b>，截距才由逸出功 W 决定；这正是密立根测定 h 的方法。ν < ν₀ = W/h（红限）时无论光多强、照多久都没有光电子，这是经典波动说无法解释的。光强只改变饱和电流，不改变截止电压。图中 I–U 曲线用「光电子初动能 0~K_max 均匀分布」的简化模型 I = I₀(1−U/U_c)；动画让反向电压 U 周期性扫描，橙点即当前工作点。右表由两个模拟测量点反推 h，与标准值 6.626×10⁻³⁴ J·s 对照。',
 params:[
  {k:'nu',label:'入射光频率 ν',min:4,max:12,step:.1,val:8,unit:'×10¹⁴ Hz'},
  {k:'W',label:'金属逸出功 W',min:1.8,max:4.5,step:.05,val:2.28,unit:'eV'},
  {k:'I0',label:'饱和光电流 I₀（∝光强）',min:.2,max:1,step:.05,val:.8,unit:'相对值'}
 ],
 init(p){ return {t:0,U:-.5,I:0,Tscan:9,hist:[[0,-.5,0]]} },
 step(dt,p,s){
  const o=th(p), Umin=-.5, Umax=o.Uc+.6, span=Umax-Umin
  s.t+=dt
  const ph=(s.t%s.Tscan)/s.Tscan
  s.U=ph<.5?Umin+span*2*ph:Umax-span*2*(ph-.5)
  s.I=photoI(p,o.Uc,s.U)
  s.hist.push([s.t,s.U,s.I]); if(s.hist.length>1200)s.hist.shift()
 },
 draw(ctx,W,H,s,p){
  frame(ctx,W,H)
  const o=th(p), Uc=o.Uc
  /* 入射光颜色按波长近似映射：380 nm（紫 280°）→ 750 nm（红 0°） */
  const frac=Math.max(0,Math.min(1,(o.lam-380)/370)), light='hsl('+fmtNum(280*(1-frac),0)+',72%,54%)'
  /* 左上：真空管示意 */
  const bx=20,by=H*.10,bw=W*.30,bh=H*.36
  ctx.save();ctx.strokeStyle='#cfd9ec';ctx.lineWidth=2;ctx.strokeRect(bx,by,bw,bh);ctx.restore()
  label(ctx,'真空光电管',bx+8,by-8,'#6d7893',11)
  const kx=bx+bw*.20, ax=bx+bw*.78, cy=by+bh*.52
  ctx.save();ctx.strokeStyle=COL.blue;ctx.lineWidth=3;ctx.beginPath();ctx.arc(kx+16,cy,26,-1.15,1.15);ctx.stroke();ctx.restore()
  line(ctx,ax,by+16,ax,by+bh-16,COL.orange,3)
  label(ctx,'K',kx-6,cy+4,COL.blue,11); label(ctx,'A',ax+6,cy+4,COL.orange,11)
  /* 入射光 */
  for(let j=0;j<3;j++){
    const yy=cy-16+j*16
    arrow(ctx,bx-14,yy,kx-6,yy,light,1.8)
    ctx.save();ctx.strokeStyle=light;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(bx-16,yy-5);ctx.lineTo(bx-10,yy+5);ctx.moveTo(bx-10,yy-5);ctx.lineTo(bx-4,yy+5);ctx.stroke();ctx.restore()
  }
  label(ctx,'λ = '+fmtNum(o.lam,1)+' nm',bx+4,by+bh-10,light,10)
  /* 光电子：数量与当前电流成正比，位置随时间流动 */
  if(o.active){
    const cnt=Math.round(5*s.I/Math.max(p.I0,.01))
    for(let j=0;j<cnt;j++){
      const f=((s.t*.6+j/Math.max(cnt,1))%1)
      dot(ctx,kx+16+(ax-kx-24)*f,cy-14+j*7,2.6,COL.blue)
    }
  }
  /* 电场方向：U>0 为反向电压，阻止电子到达阳极 */
  const eY=by+bh-44, dir=s.U>=0?-1:1
  arrow(ctx,bx+bw*.42,eY,bx+bw*.42+dir*54,eY,COL.green,1.8)
  label(ctx,'E（'+(s.U>=0?'反向':'正向')+'电压）',bx+bw*.18,eY+16,COL.green,10)
  label(ctx,'U = '+fmtNum(s.U,3)+' V   I = '+fmtNum(s.I,3),bx+bw*.18,eY+32,'#17223c',10)
  /* 中上：I–U 曲线族 */
  const B1={x:W*.36,y:H*.10,w:W*.30,h:H*.36}, U1=Math.max(Uc+.8,1.2)
  const curve=(w,c,dash)=>{
    const pts=[]
    for(let j=0;j<=120;j++){const U=-.6+(U1+.6)*j/120;const uu=Math.max(0,H_SLOPE*p.nu-w);pts.push([U,photoI(p,uu,U)])}
    return {pts,c,dash}
  }
  const s1=WS.map(w=>curve(w,'#dbe2ef',[4,4]))
  s1.push(curve(p.W,COL.blue))
  plot(ctx,B1,s1,-.6,U1,0,p.I0*1.15,'U / V','I / I₀')
  if(Uc>0){
    line(ctx,B1.x+6+(Uc+.6)/(U1+.6)*(B1.w-12),B1.y,B1.x+6+(Uc+.6)/(U1+.6)*(B1.w-12),B1.y+B1.h,COL.red,1,[4,4])
    label(ctx,'U_c',B1.x+8+(Uc+.6)/(U1+.6)*(B1.w-12),B1.y+12,COL.red,10)
  }
  const XU=v=>B1.x+6+(v+.6)/(U1+.6)*(B1.w-12), YI=v=>B1.y+B1.h-6-v/(p.I0*1.15)*(B1.h-12)
  dot(ctx,XU(s.U),YI(s.I),4.5,COL.orange)
  label(ctx,'当前工作点',XU(s.U)+7,YI(s.I)-6,COL.orange,10)
  /* 右上：U_c–ν 直线族，斜率 h/e 与 W 无关 */
  const B2={x:W*.70,y:H*.10,w:W*.27,h:H*.36}
  const lin=(w,c,dash)=>({pts:[[3,Math.max(0,H_SLOPE*3-w)],[13,Math.max(0,H_SLOPE*13-w)]],c,dash,lw:dash?1.3:2.2})
  const s2=WS.map(w=>lin(w,'#dbe2ef',[4,4])); s2.push(lin(p.W,COL.blue))
  plot(ctx,B2,s2,3,13,0,5.2,'ν / 10¹⁴ Hz','U_c / V')
  const XV=v=>B2.x+6+(v-3)/10*(B2.w-12), YV=v=>B2.y+B2.h-6-v/5.2*(B2.h-12)
  dot(ctx,XV(o.nu0),YV(0),4,COL.red)
  label(ctx,'ν₀',XV(o.nu0)-4,YV(0)-8,COL.red,10)
  dot(ctx,XV(p.nu),YV(Uc),4.5,COL.orange)
  /* 斜率小三角 */
  const n1=Math.max(p.nu-1,o.nu0+.5), n2=n1+2, ua=H_SLOPE*n1-p.W, ub=H_SLOPE*n2-p.W
  line(ctx,XV(n1),YV(ua),XV(n2),YV(ua),'#c9b48e',1.2)
  line(ctx,XV(n2),YV(ua),XV(n2),YV(ub),'#c9b48e',1.2)
  label(ctx,'ΔU_c/Δν = h/e',XV(n1)+4,YV(ua)-5,'#a8843f',9)
  label(ctx,'所有直线互相平行',B2.x+8,B2.y+16,'#8a95ad',10)
  /* 下部：光子能量分配 + 关键读数 */
  bars(ctx,44,H*.58,W*.34,[{n:'光子 hν',v:o.hn,c:COL.blue},{n:'逸出功 W',v:p.W,c:COL.green},{n:'K_max',v:Math.max(0,o.K),c:COL.orange}],Math.max(o.hn,p.W,.001))
  label(ctx,'扫描进度：t = '+fmtNum(s.t,2)+' s / 周期 9 s，U 在 [−0.5, '+(fmtNum(Uc+.6,2))+'] V 之间往复',W*.44,H*.60,'#6d7893',11)
  label(ctx,'是否发生光电效应：'+(o.active?'是，K_max = '+fmtNum(o.K,4)+' eV':'否（ν < ν₀）'),W*.44,H*.60+20,o.active?COL.green:COL.red,12)
  label(ctx,'红限 ν₀ = W/h = '+fmtNum(o.nu0,4)+' ×10¹⁴ Hz  (λ₀ = '+fmtNum(o.lam0,1)+' nm)',W*.44,H*.60+40,'#6d7893',11)
  label(ctx,'斜率 h/e = 4.136×10⁻¹⁵ V·s，与金属无关；截距 −W/e 才随金属变',W*.44,H*.60+60,'#6d7893',11)
  label(ctx,'光强只改变饱和电流 I₀，不改变 U_c 与红限',W*.44,H*.60+80,'#8a95ad',10)
  label(ctx,'光电子最大速率 v_max = √(2K/m_e) = '+(o.active?fmtNum(o.vmax,0)+' m/s':'—'),W*.44,H*.60+100,'#6d7893',11)
 },
 rows(s,p){
  const o=th(p), Uc=o.Uc
  /* 用两个模拟测量点做线性拟合，反推 h */
  const n1=Math.max(p.nu-1,o.nu0+.5), n2=n1+2
  const u1=Math.max(0,H_SLOPE*n1-p.W), u2=Math.max(0,H_SLOPE*n2-p.W)
  const slope=(u2-u1)/((n2-n1)*1e14)           // V·s = h/e
  const hMeas=E_CHARGE*slope
  return[
   ['入射光频率 ν',fmtNum(p.nu,3)+' ×10¹⁴ Hz'],['波长 λ = c/ν',fmtNum(o.lam,2)+' nm'],
   ['光子能量 hν',fmtNum(o.hn,5)+' eV'],['金属逸出功 W',fmtNum(p.W,3)+' eV'],
   ['最大初动能 K_max = hν−W',fmtNum(o.K,5)+' eV'],['截止电压 U_c = K_max/e',o.active?fmtNum(Uc,5)+' V':'0 V（无光电子）'],
   ['红限频率 ν₀ = W/h',fmtNum(o.nu0,5)+' ×10¹⁴ Hz'],['红限波长 λ₀',fmtNum(o.lam0,2)+' nm'],
   ['是否发生光电效应',o.active?'是':'否（ν < ν₀，再强也不出电子）'],
   ['当前反向电压 U',fmtNum(s.U,4)+' V'],['当前光电流 I',fmtNum(s.I,5)+'（相对值）'],
   ['饱和电流 I₀（∝光强）',fmtNum(p.I0,3)],
   ['光电子最大速率 v_max',o.active?fmtNum(o.vmax,0)+' m/s':'—'],
   ['拟合用两点 ν₁ / ν₂',fmtNum(n1,3)+' / '+fmtNum(n2,3)+' ×10¹⁴ Hz'],
   ['拟合用两点 U_c₁ / U_c₂',fmtNum(u1,5)+' / '+fmtNum(u2,5)+' V'],
   ['实测斜率 ΔU_c/Δν = h/e',slope.toExponential(5)+' V·s'],
   ['由此测得 h = e·斜率',hMeas.toExponential(6)+' J·s'],
   ['标准 h',H_STD.toExponential(6)+' J·s'],
   ['与标准值相对偏差',fmtNum((hMeas-H_STD)/H_STD*100,6)+' %'],
   ['扫描相位 t mod 9',fmtNum(s.t%s.Tscan,3)+' s']
  ]
 }
}

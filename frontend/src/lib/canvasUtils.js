// Canvas 绘图与数值工具：RK4、椭圆积分、坐标映射等（原样搬运）
export const COL = {blue:'#2f56cc', orange:'#d97633', green:'#0d8266', red:'#c33c42', grey:'#8a95ad', pale:'#e3e9f3'};
export function frame(ctx,W,H){ctx.clearRect(0,0,W,H);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H)}
export function ticks(a,b,n){
  const span=b-a; if(!(span>0)||!isFinite(span)) return [a];
  const raw=span/n, mag=Math.pow(10,Math.floor(Math.log10(raw))), norm=raw/mag;
  const st=(norm<1.5?1:norm<3?2:norm<7?5:10)*mag, out=[];
  for(let v=Math.ceil(a/st)*st;v<=b+st*1e-6;v+=st) out.push(Math.abs(v)<st*1e-9?0:v);
  return out;
}
export const fT=v=>Math.abs(v)>=1000||(Math.abs(v)<0.01&&v!==0)?v.toExponential(1):Number(v.toPrecision(3)).toString();
export function mapping(W,H,x0,x1,y0,y1,pad){const p=pad||44;return{p,X:v=>p+(v-x0)/((x1-x0)||1)*(W-2*p),Y:v=>H-p-(v-y0)/((y1-y0)||1)*(H-2*p)}}
export function gridAxes(ctx,W,H,x0,x1,y0,y1,pad,xlab,ylab){
  const m=mapping(W,H,x0,x1,y0,y1,pad),p=m.p;
  ctx.save();ctx.font='10.5px system-ui';ctx.fillStyle='#97a2b8';ctx.lineWidth=1;
  ticks(x0,x1,5).forEach(v=>{const X=m.X(v);ctx.strokeStyle='#f0f3f9';ctx.beginPath();ctx.moveTo(X,p);ctx.lineTo(X,H-p);ctx.stroke();ctx.fillText(fT(v),X-8,H-p+15)});
  ticks(y0,y1,4).forEach(v=>{const Y=m.Y(v);ctx.strokeStyle='#f0f3f9';ctx.beginPath();ctx.moveTo(p,Y);ctx.lineTo(W-p,Y);ctx.stroke();ctx.fillText(fT(v),6,Y+3)});
  ctx.strokeStyle='#c8d2e6';ctx.beginPath();ctx.moveTo(p,p);ctx.lineTo(p,H-p);ctx.lineTo(W-p,H-p);ctx.stroke();
  ctx.fillStyle='#6d7893';ctx.font='11px system-ui';
  if(xlab)ctx.fillText(xlab,W-p-58,H-p+30);
  if(ylab)ctx.fillText(ylab,8,p-14);
  ctx.restore();return m;
}
export function line(ctx,x1,y1,x2,y2,color,lw,dash){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=lw||1.5;if(dash)ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore()}
export function arrow(ctx,x1,y1,x2,y2,color,lw,head){
  const a=Math.atan2(y2-y1,x2-x1),h=head||8;line(ctx,x1,y1,x2,y2,color,lw||2);
  ctx.save();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-h*Math.cos(a-.42),y2-h*Math.sin(a-.42));ctx.lineTo(x2-h*Math.cos(a+.42),y2-h*Math.sin(a+.42));ctx.closePath();ctx.fill();ctx.restore();
}
export function dot(ctx,x,y,r,color){ctx.save();ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore()}
export function label(ctx,t,x,y,color,size,align){ctx.save();ctx.fillStyle=color||'#4c5872';ctx.font=(size||11)+'px system-ui';ctx.textAlign=align||'left';ctx.fillText(t,x,y);ctx.restore()}
export function plot(ctx,B,series,x0,x1,y0,y1,xlab,ylab){
  ctx.save();ctx.fillStyle='#fbfcff';ctx.fillRect(B.x,B.y,B.w,B.h);ctx.strokeStyle='#e8edf6';ctx.strokeRect(B.x,B.y,B.w,B.h);
  const X=v=>B.x+6+(v-x0)/((x1-x0)||1)*(B.w-12),Y=v=>B.y+B.h-6-(v-y0)/((y1-y0)||1)*(B.h-12);
  ctx.font='9.5px system-ui';ctx.fillStyle='#a2abc0';
  ticks(y0,y1,3).forEach(v=>{line(ctx,B.x,Y(v),B.x+B.w,Y(v),'#f0f3f9',1);ctx.fillText(fT(v),B.x+3,Y(v)-2)});
  ticks(x0,x1,4).forEach(v=>{line(ctx,X(v),B.y,X(v),B.y+B.h,'#f7f9fd',1)});
  ctx.beginPath();ctx.rect(B.x,B.y,B.w,B.h);ctx.clip();
  series.forEach(s=>{if(!s.pts||s.pts.length<2)return;ctx.beginPath();s.pts.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Y(q[1])):ctx.moveTo(X(q[0]),Y(q[1])));ctx.strokeStyle=s.c;ctx.lineWidth=s.lw||1.7;if(s.dash)ctx.setLineDash(s.dash);ctx.stroke();ctx.setLineDash([])});
  ctx.restore();if(xlab)label(ctx,xlab,B.x+B.w-56,B.y+B.h+12,'#8a95ad',10);if(ylab)label(ctx,ylab,B.x+2,B.y-5,'#8a95ad',10);
}
export function bars(ctx,x,y,w,items,total){
  const per=Math.min(26,(w/items.length)-6),gap=6;
  ctx.save();ctx.font='10px system-ui';
  items.forEach((it,i)=>{
    const bx=x+i*(per+gap+56),h=44,frac=Math.max(0,Math.min(1,Math.abs(it.v)/((total||1)||1)));
    ctx.fillStyle='#eef2f9';ctx.fillRect(bx,y,per,h);
    ctx.fillStyle=it.c;ctx.fillRect(bx,y+h*(1-frac),per,h*frac);
    ctx.fillStyle='#6d7893';ctx.fillText(it.n,bx,y+57);
    ctx.fillStyle='#17223c';ctx.font='10px monospace';ctx.fillText(it.v.toFixed(2),bx,y+h+12);ctx.font='10px system-ui';
  });ctx.restore();
}
export function rk4(f,s,dt){
  const add=(a,b,k)=>a.map((v,i)=>v+b[i]*k), k1=f(s),k2=f(add(s,k1,dt/2)),k3=f(add(s,k2,dt/2)),k4=f(add(s,k3,dt));
  return s.map((v,i)=>v+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
}
export function agmK(k){let a=1,b=Math.sqrt(Math.max(0,1-k*k));for(let i=0;i<40;i++){const na=(a+b)/2,nb=Math.sqrt(a*b);a=na;b=nb}return Math.PI/(2*a)}
export function fmtNum(v,d){return (!isFinite(v))?'—':Number(v.toFixed(d===undefined?3:d)).toString()}

// 自写递归下降解析器（不用 eval）+ 量纲分析（原样搬运）
export function tokenize(src){
 const out=[],re=/^((?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z_0-9]*|\*\*|[+\-*/^()]|.)/;
 let s=String(src);
 for(;;){s=s.replace(/^\s+/,'');if(!s.length)break;const m=re.exec(s);if(!m)break;out.push(m[1]==='**'?'^':m[1]);s=s.slice(m[0].length)}
 out.push('$');return out;
}
export function parseAST(src){
 const tk=tokenize(src);let i=0;
 const peek=()=>tk[i],take=()=>tk[i++];
 function atom(){const t=take();
  if(t==='-')return{t:'neg',a:factor()};if(t==='+')return factor();
  if(t==='('){const e=expr();if(take()!==')')throw new Error('括号不匹配');return e}
  if(/^[\d.]/.test(t))return{t:'num',v:Number(t)};
  if(/^[A-Za-z_]/.test(t)){if(peek()==='('){take();const e=expr();if(take()!==')')throw new Error('括号不匹配');return{t:'call',name:t,a:e}}return{t:'id',name:t}}
  throw new Error('无法解析符号「'+t+'」')}
 function factor(){let a=atom();while(peek()==='^'){take();a={t:'pow',a,b:atom()}}return a}
 function term(){let a=factor();while(peek()==='*'||peek()==='/'){const op=take();a={t:'bin',op,a,b:factor()}}return a}
 function expr(){let a=term();while(peek()==='+'||peek()==='-'){const op=take();a={t:'bin',op,a,b:term()}}return a}
 const ast=expr();if(peek()!=='$')throw new Error('多余符号「'+peek()+'」');return ast;
}
export function evalNum(ast,vars){
 switch(ast.t){
  case'num':return ast.v;
  case'id':{const v=vars[ast.name];if(typeof v==='number')return v;throw new Error('未知变量「'+ast.name+'」')}
  case'neg':return-evalNum(ast.a,vars);
  case'bin':{const a=evalNum(ast.a,vars),b=evalNum(ast.b,vars);return ast.op==='+'?a+b:ast.op==='-'?a-b:ast.op==='*'?a*b:a/b}
  case'pow':return Math.pow(evalNum(ast.a,vars),evalNum(ast.b,vars));
  case'call':{const v=evalNum(ast.a,vars),n=ast.name.toLowerCase();const M={sqrt:Math.sqrt,sin:Math.sin,cos:Math.cos,tan:Math.tan,abs:Math.abs,exp:Math.exp,ln:Math.log,log:Math.log10};if(!(n in M))throw new Error('未知函数「'+ast.name+'」');return M[n](v)}
 }
}
export function parseAnswer(src){
 const s=String(src).trim().replace(/[，,]/g,'').replace(/×/g,'*').replace(/÷/g,'/').replace(/π/g,'pi')
  .replace(/√\s*\(/g,'sqrt(').replace(/√\s*(\d+(?:\.\d+)?)/g,'sqrt($1)')
  .replace(/²/g,'^2').replace(/³/g,'^3').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/\s+/g,'');
 if(!s)throw new Error('请填写答案');
 return evalNum(parseAST(s),{pi:Math.PI,e:Math.E});
}
export const Z7=()=>[0,0,0,0,0,0,0];
export const DIMVARS={
 m:[1,0,0,0,0,0,0,'质量'],M:[1,0,0,0,0,0,0,'质量'],
 s:[0,1,0,0,0,0,0,'长度'],x:[0,1,0,0,0,0,0,'位移'],L:[0,1,0,0,0,0,0,'长度'],r:[0,1,0,0,0,0,0,'半径'],h:[0,1,0,0,0,0,0,'高度'],d:[0,1,0,0,0,0,0,'距离'],lambda:[0,1,0,0,0,0,0,'波长'],
 t:[0,0,1,0,0,0,0,'时间'],T:[0,0,1,0,0,0,0,'周期/时间'],
 v:[0,1,-1,0,0,0,0,'速度'],c:[0,1,-1,0,0,0,0,'光速'],a:[0,1,-2,0,0,0,0,'加速度'],g:[0,1,-2,0,0,0,0,'重力加速度'],
 omega:[0,0,-1,0,0,0,0,'角速度'],f:[0,0,-1,0,0,0,0,'频率'],rho:[1,-3,0,0,0,0,0,'密度'],
 F:[1,1,-2,0,0,0,0,'力'],N:[1,1,-2,0,0,0,0,'支持力/力'],
 E:[1,2,-2,0,0,0,0,'能量/功/热量'],W:[1,2,-2,0,0,0,0,'功/能量'],Ue:[1,2,-2,0,0,0,0,'能量'],
 P:[1,2,-3,0,0,0,0,'功率'],p:[1,1,-1,0,0,0,0,'动量'],k:[1,0,-2,0,0,0,0,'劲度系数'],
 J:[1,2,0,0,0,0,0,'转动惯量'],I:[0,0,0,1,0,0,0,'电流'],
 q:[0,0,1,1,0,0,0,'电荷量'],Q:[0,0,1,1,0,0,0,'电荷量'],
 U:[1,2,-3,-1,0,0,0,'电压/电动势'],V:[1,2,-3,-1,0,0,0,'电压'],
 R:[1,2,-3,-2,0,0,0,'电阻'],B:[1,0,-2,-1,0,0,0,'磁感应强度'],
 C:[-1,-2,4,2,0,0,0,'电容'],L_ind:[1,2,-2,-2,0,0,0,'电感'],
 eps0:[-1,-3,4,2,0,0,0,'真空介电常数'],mu0:[1,1,-2,-2,0,0,0,'真空磁导率'],
 G:[-1,3,-2,0,0,0,0,'引力常量'],h_planck:[1,2,-1,0,0,0,0,'普朗克常量'],
 R_gas:[1,2,-2,0,-1,-1,0,'气体常量'],Temp:[0,0,0,0,1,0,0,'温度'],n_mol:[0,0,0,0,0,1,0,'物质的量'],
 pi:[0,0,0,0,0,0,0,'无量纲常数']
};
export const DLAB=['M','L','T','I','Θ','N','J'];
export function sup(x){if(Number.isInteger(x)){const m={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};return String(x).split('').map(c=>m[c]).join('')}return'^'+Number(x.toFixed(2))}
export function dimStr(v){const p=v.slice(0,7).map((e,i)=>e?DLAB[i]+(e===1?'':sup(e)):'').filter(Boolean);return p.length?p.join('·'):'1（无量纲）'}
export function knownDim(v){const k=v.slice(0,7).join(',');const M={'1,1,-2,0,0,0,0':'力 / 重量','1,2,-2,0,0,0,0':'能量 / 功 / 热量','1,2,-3,0,0,0,0':'功率','0,1,-1,0,0,0,0':'速度','0,1,-2,0,0,0,0':'加速度','0,0,1,0,0,0,0':'时间 / 周期','0,1,0,0,0,0,0':'长度 / 位移','1,1,-1,0,0,0,0':'动量 / 冲量','1,0,-2,-1,0,0,0':'磁感应强度','1,2,-3,-1,0,0,0':'电压 / 电动势','1,2,-3,-2,0,0,0':'电阻','0,0,1,1,0,0,0':'电荷量','1,2,0,0,0,0,0':'转动惯量','1,2,-1,0,0,0,0':'角动量 / 作用量'};return M[k]||''}
export function evalDim(ast){
 const same=(x,y)=>x.slice(0,7).every((v,i)=>v===y[i]);
 switch(ast.t){
  case'num':case'id':{if(ast.t==='num')return Z7();const v=DIMVARS[ast.name];if(!v)throw new Error('未知变量「'+ast.name+'」');return v.slice(0,7)}
  case'neg':return evalDim(ast.a);
  case'bin':{const x=evalDim(ast.a),y=evalDim(ast.b);
   if(ast.op==='+'||ast.op==='-'){if(!same(x,y))throw new Error('量纲不一致的加减：'+dimStr(x)+' 与 '+dimStr(y));return x.slice()}
   return x.map((v,i)=>ast.op==='*'?v+y[i]:v-y[i])}
  case'pow':{const base=evalDim(ast.a);let ex;try{ex=evalNum(ast.b,{pi:Math.PI,e:Math.E})}catch(e){throw new Error('指数必须是无量纲常数')}return base.map(v=>v*ex)}
  case'call':{const n=ast.name.toLowerCase(),x=evalDim(ast.a);
   if(n==='sqrt')return x.map(v=>v/2);
   if(['sin','cos','tan','exp','ln','log'].includes(n)){const zero=x.slice(0,7).every(v=>v===0);if(!zero)throw new Error('「'+ast.name+'」的自变量必须无量纲，当前为 '+dimStr(x));return Z7()}
   throw new Error('未知函数「'+ast.name+'」')}
 }
}
export function analyzeDim(src){
 const parts=src.split('=');if(parts.length>2)throw new Error('只支持一个等号');
 const vals=parts.map(p=>{if(!p.trim())throw new Error('等号两侧都要有内容');return evalDim(parseAST(p))});
 const names=vals.map(v=>knownDim(v));
 if(vals.length===2){const ok=vals[0].every((v,i)=>v===vals[1][i]);return{ok,dims:vals,names,note:ok?'两侧量纲一致 —— 这一条通过。注意：量纲一致只是必要条件，不能保证系数与符号正确。':'两侧量纲不一致 —— 公式必然错误。'}}
 return{ok:true,dims:vals,names,note:'表达式量纲已算出。可用等号连接另一个表达式来检验一致性。'};
}

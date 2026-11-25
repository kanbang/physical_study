/* 公式排版层
   目标：让公式像课本/试卷 —— 分式横线、根号、真正的上下标、物理量斜体、单位正体。
   两条输入路径：
   1) 显式 LaTeX：字段里写 $...$ / $$...$$ / \(...\)，原样交给 KaTeX；
   2) 存量 Unicode 文本：a₁ = g(sinθ + μcosθ)、v = s / t、√(2gh) —— 由 autoTex() 启发式转 LaTeX。
   渲染失败一律回退为原文，绝不让公式崩坏整页。 */
import katex from 'katex'

const GREEK = {α:'\\alpha',β:'\\beta',γ:'\\gamma',δ:'\\delta',Δ:'\\Delta',ε:'\\varepsilon',ζ:'\\zeta',η:'\\eta',
  θ:'\\theta',Θ:'\\Theta',κ:'\\kappa',λ:'\\lambda',μ:'\\mu',ν:'\\nu',ξ:'\\xi',π:'\\pi',ρ:'\\rho',σ:'\\sigma',
  τ:'\\tau',φ:'\\varphi',ϕ:'\\phi',χ:'\\chi',ψ:'\\psi',ω:'\\omega',Ω:'\\Omega',Σ:'\\Sigma'}

const OPS = {'−':'-','–':'-','×':'\\times','·':'\\cdot','÷':'\\div','≤':'\\le','≥':'\\ge','≠':'\\ne','≈':'\\approx',
  '⇒':'\\Rightarrow','⇔':'\\Leftrightarrow','→':'\\to','±':'\\pm','∞':'\\infty','°':'^{\\circ}','½':'\\tfrac{1}{2}',
  '∴':'\\therefore','∵':'\\because','≡':'\\equiv','∝':'\\propto','⊥':'\\perp','∥':'\\parallel','∑':'\\sum',
  '∫':'\\int','∂':'\\partial','∇':'\\nabla','%':'\\%'}

/* 常用 Unicode 分数 → \frac */
const FRAC = {'⅓':'\\frac{1}{3}','⅔':'\\frac{2}{3}','½':'\\frac{1}{2}','¼':'\\frac{1}{4}','¾':'\\frac{3}{4}',
  '⅕':'\\frac{1}{5}','⅖':'\\frac{2}{5}','⅗':'\\frac{3}{5}','⅘':'\\frac{4}{5}','⅙':'\\frac{1}{6}','⅚':'\\frac{5}{6}',
  '⅛':'\\frac{1}{8}','⅜':'\\frac{3}{8}','⅝':'\\frac{5}{8}','⅞':'\\frac{7}{8}','⅑':'\\frac{1}{9}','⅒':'\\frac{1}{10}',
  '⅐':'\\frac{1}{7}','⅟':'\\frac{1}{x}'}

const SUB = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','₌':'=','ₙ':'n','ₓ':'x'}
const SUP = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-','ⁿ':'n','ⁱ':'i'}
const isSub = c => c in SUB, isSup = c => c in SUP

const FN = /(?<![\\A-Za-z])(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|lg|exp)(?![A-Za-z])/g
const TOKEN = String.raw`[A-Za-z0-9](?:\^\{?-?\d+\}?|_\{?[A-Za-z0-9]+\}?)?`

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))

/* Unicode 上下标 → _{} ^{} */
function foldScripts(s) {
  let out = '', i = 0
  while (i < s.length) {
    const c = s[i]
    if (isSub(c) || isSup(c)) {
      const sub = isSub(c)
      let run = ''
      while (i < s.length && (sub ? isSub(s[i]) : isSup(s[i]))) { run += (sub ? SUB : SUP)[s[i]]; i++ }
      out += (sub ? '_{' : '^{') + run + '}'
      continue
    }
    out += c; i++
  }
  return out
}

export function autoTex(src) {
  let s = String(src == null ? '' : src).trim()
  if (!s) return ''
  if (/\\[A-Za-z]/.test(s) || s.includes('$')) return s   // 已是 LaTeX，别再动
  s = foldScripts(s)
  /* Unicode 分数：字符分数 → \frac；^{a}⁄_{b} 形式 → \frac{a}{b} */
  s = s.replace(/[⅐-⅟]/g, c => FRAC[c] || c)
  s = s.replace(/\^\{([^}]*)\}\s*⁄\s*_\{([^}]*)\}/g, '\\frac{$1}{$2}')
  s = s.replace(/([A-Za-z0-9.]+)\s*⁄\s*([A-Za-z0-9.]+)/g, '\\frac{$1}{$2}')
  /* 公式里的中文多为下标（W有、v回），包成 \text{} 才能正确排版 */
  s = s.replace(/[\u4e00-\u9fff]+/g, m => '\\text{' + m + '}')
  s = s.replace(/[α-ωΑ-Ω]/g, c => (GREEK[c] || c) + ' ')
  /* 每个符号命令后面补空格，避免 \intr 这种与字母粘连变成未知命令 */
  s = s.replace(/[−–×·÷≤≥≠≈⇒⇔→±∞°½∴∵≡∝⊥∥∑∫∂∇%]/g, c => OPS[c] ? OPS[c] + ' ' : c)
  s = s.replace(/([A-Za-z0-9])\s*\\perp\s*/g, '$1_{\\perp}')   // v⊥ → v_{\perp}
  /* 根号：√(...)、√[...]、√x */
  s = s.replace(/√\s*\(([^()]*)\)/g, '\\sqrt{$1}')
  s = s.replace(/√\s*\[([^\[\]]*)\]/g, '\\sqrt{$1}')
  s = s.replace(/√\s*([A-Za-z0-9]+(?:\^\{?-?\d+\}?|_\{?[A-Za-z0-9]+\}?)?)/g, '\\sqrt{$1}')
  /* 分式：a/b → \frac{a}{b}，允许 \text{}、括号、上下标作为分子分母，连做两轮 */
  const SIDE = String.raw`(?:\([^()]*\)|\\text\{[^}]*\}|[_^]\{[^}]*\}|[^\s/+−×·=()\[\]{}])+`
  const frac = new RegExp('(' + SIDE + ')\\s*\\/\\s*(' + SIDE + ')', 'g')
  for (let k = 0; k < 2; k++) s = s.replace(frac, '\\frac{$1}{$2}')
  s = s.replace(FN, '\\$1')
  return s.replace(/\s+/g, ' ').trim()
}

/* 常见命令名：用于把 \SigmaM、\omegaR、\intr 这类"命令与字母粘连"拆开。
   LaTeX 把反斜杠后最长的字母串当命令名，\SigmaM 是未知命令，必须拆成 \Sigma M。 */
const CMD_LIST = ['int','iint','oint','sum','prod','lim','mathrm','mathbf','mathit','mathsf','mathtt','mathbb',
  'mathcal','mathfrak','boldsymbol','bm','operatorname','displaystyle','textbf','textit',
  'frac','dfrac','tfrac','sqrt','overline','overrightarrow','begin','end',
  'text','vec','hat','bar','dot','ddot','circ','degree','angle',
  'Sigma','sigma','Omega','omega','Theta','theta','Delta','delta','Gamma','gamma',
  'Lambda','lambda','Xi','xi','Pi','pi','Phi','varphi','phi','Psi','psi','Upsilon','upsilon',
  'Alpha','alpha','Beta','beta','Epsilon','varepsilon','epsilon','Zeta','zeta','Eta','eta',
  'Kappa','kappa','Mu','mu','Nu','nu','Rho','rho','Tau','tau','Chi','chi',
  'cdot','times','div','pm','mp','leq','le','geq','ge','neq','ne','approx','equiv','propto',
  'parallel','perp','infty','partial','nabla','therefore','because',
  'Rightarrow','Leftarrow','Leftrightarrow','rightarrow','leftarrow','longrightarrow','to',
  'sin','cos','tan','cot','sec','csc','sinh','cosh','tanh','arcsin','arccos','arctan','log','ln','exp',
  'max','min','sup','inf']
const CMD_SET = new Set(CMD_LIST)
const CMD_PREFIXES = [...new Set(CMD_LIST)].sort((a, b) => b.length - a.length)

/* 把 \SigmaM、\omegaR、\intr 这类"命令与字母粘连"拆开：
   LaTeX 把反斜杠后最长字母串整体当命令名，\SigmaM 是未知命令，必须拆成 \Sigma M。
   规则：整体名已是已知命令 → 不动；否则若整体名以某已知命令开头 → 在前缀处断开。 */
export function fixCmdSpacing(s) {
  return String(s == null ? '' : s).replace(/\\([A-Za-z]+)/g, (m, name) => {
    if (CMD_SET.has(name)) return m
    for (const c of CMD_PREFIXES) {
      if (name.startsWith(c)) return '\\' + c + ' ' + name.slice(c.length)
    }
    return m
  })
}

/* 去掉整段包裹的公式定界符：$$…$$ / $…$ / \(…\)。
   块级字段（formula、eq[]）常常整段就是一条公式，如果直接把 $ 交给 KaTeX，
   displayMode 下 $ 不是合法记号，会整条标红 —— 这正是"按提示词写的公式必然报错"的原因。 */
export function stripDelims(src) {
  let s = String(src == null ? '' : src).trim()
  const m = s.match(/^\$\$([\s\S]+?)\$\$$/) || s.match(/^\$([^$\n]+?)\$$/) || s.match(/^\\\(([\s\S]+?)\\\)$/)
  return m ? m[1].trim() : s
}

export function renderMath(src, display) {
  try {
    return katex.renderToString(fixCmdSpacing(stripDelims(src)), {displayMode: !!display, throwOnError: false, strict: false, output: 'html', trust: false})
  } catch (e) {
    return '<span class="mathfail">' + escHtml(src) + '</span>'
  }
}

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff01-\uff5e]+/
function looksMath(t) {
  if (t.length < 2) return false
  if (!/[A-Za-z0-9\u0370-\u03ff√]/.test(t)) return false
  return /[=√^_²³°≤≥≈×·±≠⇒→/]/.test(t) || /\b(sin|cos|tan|ln|log)\b/.test(t)
}

function pushText(out, txt) {
  if (!txt) return
  for (const p of txt.split(/([\u4e00-\u9fff]{2,})/)) {
    if (!p) continue
    if (CJK.test(p[0])) { out.push({text: p}); continue }
    const t = p.trim()
    if (looksMath(t)) {
      const tex = autoTex(t)
      out.push({tex: true, html: renderMath(tex, false), raw: tex})
      const lead = p.match(/^\s*/)[0], tail = p.match(/\s*$/)[0]
      if (lead) out.splice(out.length - 1, 0, {text: lead})
      if (tail) out.push({text: tail})
    } else out.push({text: p})
  }
}

/* 混排文本 → 片段数组；数学片段已渲染成 HTML */
export function toSegments(text) {
  const s = String(text == null ? '' : text)
  const out = []
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g
  let last = 0, m
  while ((m = re.exec(s))) {
    if (m.index > last) pushText(out, s.slice(last, m.index))
    out.push({tex: true, html: renderMath(autoTex(m[1] || m[2] || m[3]), !!m[1])})
    last = re.lastIndex
  }
  if (last < s.length) pushText(out, s.slice(last))
  return out
}

export {escHtml}

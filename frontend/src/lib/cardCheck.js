/* 卡片校验（纯函数，与 Vue 无关，便于 node --test 直接回归）

   早先的实现把校验结果压成一句中文提示，调用方再用中文文案正则去反推"是拦截还是提醒"。
   改一句文案就会静默改变拦截行为 —— 所以这里返回结构化结果：

     {blocking: '…', warning: '…'}
     blocking 非空 → 必填项缺失，禁止保存/入库
     warning  非空 → 可以保存，但存在影响使用的缺口（如没有可判分的答案）
     两者都为空  → 完全通过
*/
const filled = v => String(v == null ? '' : v).trim() !== ''

export function checkCard(c) {
  if (!c) return {blocking: '没有卡片内容', warning: ''}
  if (c.kind === 'problem') {
    const p = c.problem || {}
    if (!filled(p.title)) return {blocking: '请先填写标题', warning: ''}
    if (!filled(p.text)) return {blocking: '请先填写题干', warning: ''}
    const answers = Array.isArray(p.answers) ? p.answers : []
    const hasAnswer = answers.some(a => a && filled(a.label) && filled(a.value) && isFinite(Number(a.value)))
    if (!hasAnswer) {
      return {blocking: '', warning: '还没有可判分的标准答案（可以保存，但这道题只能阅读、不能自动判分）'}
    }
    return {blocking: '', warning: ''}
  }
  if (c.kind === 'wonder') {
    const w = c.wonder || {}
    if (!filled(w.title)) return {blocking: '请先填写标题', warning: ''}
    if (!filled(w.reveal)) return {blocking: '请先填写揭晓内容', warning: ''}
    return {blocking: '', warning: ''}
  }
  return {blocking: '未知的卡片类型：' + String(c.kind || '（空）'), warning: ''}
}

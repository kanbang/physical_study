/* 内置内容扩展点 · 纯合并逻辑（不依赖 Vite，可被 node --test 直接覆盖）

   约定：src/data/addons/*.js 每个文件可导出 ADDON_PROBLEMS / ADDON_WONDERS 数组。
   收集规则：文件名排序决定顺序；id 必填且同类内不重复；必填字段缺失就地跳过；
   单条内容出错只告警，不让整页白屏。新增内容 = 往 addons/ 丢文件。 */
export function collectAddons(files, onWarn) {
  const warn = typeof onWarn === 'function' ? onWarn : (m => console.warn(m))
  const problems = [], wonders = []
  const seen = new Set()

  const take = (arr, kind, path, out) => {
    if (!Array.isArray(arr)) return
    const need = kind === 'problem' ? ['title', 'text'] : ['title', 'reveal']
    arr.forEach((it, i) => {
      const at = path + '#' + i
      if (!it || typeof it !== 'object' || Array.isArray(it)) { warn('[addons] 跳过 ' + at + '：不是对象'); return }
      if (typeof it.id !== 'string' || !it.id.trim()) { warn('[addons] 跳过 ' + at + '：缺少 id'); return }
      const key = kind + ':' + it.id
      if (seen.has(key)) { warn('[addons] 跳过 ' + at + '：id「' + it.id + '」重复'); return }
      const miss = need.filter(k => !String(it[k] == null ? '' : it[k]).trim())
      if (miss.length) { warn('[addons] 跳过 ' + at + '：缺少 ' + miss.join(' / ')); return }
      seen.add(key)
      out.push(it)
    })
  }

  for (const path of Object.keys(files || {}).sort()) {
    const m = files[path]
    if (!m || typeof m !== 'object') continue
    take(m.ADDON_PROBLEMS || m.PROBLEMS, 'problem', path, problems)
    take(m.ADDON_WONDERS || m.WONDERS, 'wonder', path, wonders)
  }
  return {problems, wonders}
}

/* 交互仿真室 · 仿真注册表

   约定：src/sims/*.js 每个文件 default export 一个仿真定义，
   必须含 id / name / params / init / step / draw / rows，可选 brief / legend / note / rate。

   新增仿真 = 往 src/sims/ 丢一个文件（文件名前缀决定列表顺序），
   本文件、store.js、LabView.vue 都不用改。
   不合规或 id 重复的文件只在控制台告警并被跳过，不会拖白整页。 */

const files = import.meta.glob('../sims/*.js', {eager: true})
const FN = ['init', 'step', 'draw', 'rows']
const seen = new Set()

export const SIMS = Object.keys(files).sort().reduce((out, path) => {
  const def = files[path] && files[path].default
  if (!def || typeof def.id !== 'string' || typeof def.name !== 'string' || !Array.isArray(def.params)) {
    console.warn('[sims] 跳过 ' + path + '：缺少 id / name / params')
    return out
  }
  const miss = FN.filter(k => typeof def[k] !== 'function')
  if (miss.length) {
    console.warn('[sims] 跳过 ' + path + '：缺少函数 ' + miss.join(' / '))
    return out
  }
  if (seen.has(def.id)) {
    console.warn('[sims] 跳过 ' + path + '：id「' + def.id + '」重复')
    return out
  }
  seen.add(def.id)
  out.push(def)
  return out
}, [])

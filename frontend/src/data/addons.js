/* 内置内容扩展点 · Vite 装配层

   新增题目 / 趣味思考题：往 src/data/addons/ 丢一个 .js 文件即可，
   本文件、store.js、任何视图都不用改（与 src/sims/ 的仿真注册同一套思路）。
   校验与去重在 mergeAddons.js（纯函数，有单元测试）。 */
import {collectAddons} from './mergeAddons.js'

const files = import.meta.glob('./addons/*.js', {eager: true})
const merged = collectAddons(files)

export const ADDON_PROBLEMS = merged.problems
export const ADDON_WONDERS = merged.wonders

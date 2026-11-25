/* 竞物台 · 全局状态层（Vue3 reactive）
   学习数据 DB 与旧版格式完全兼容（physlab.v1）：
   - localStorage 本机缓存 + /api/state 服务端同步，取 updatedAt 较新者
   - 内置题库（已核验）与 AI 入库的 custom 题库合并渲染 */
import {reactive, computed, watch} from 'vue'
import {BASE_PROBLEMS} from './data/problems.js'
import {BASE_WONDERS} from './data/wonders.js'
import {TOPICS} from './data/topics.js'
import {MODELS} from './data/models.js'
import {SIMS} from './data/sims.js'
import {ADDON_PROBLEMS, ADDON_WONDERS} from './data/addons.js'

export {TOPICS, MODELS, SIMS, BASE_PROBLEMS, BASE_WONDERS}
export const DOMAINS = ['力学', '电磁', '热学', '光学', '近代', '方法']
export const LEVELS = ['全部', '初中', '高中']
const DAY = 86400000
export {DAY}

const KEY = 'physlab.v1', UIDKEY = 'physlab.uid'
const DEFAULTS = () => ({plan: {}, progress: {}, attempts: [], wrong: {}, days: [], taskOffset: 0, updatedAt: 0,
  wonder: {revealed: {}, notes: {}, fav: {}}, custom: {problems: [], wonders: []}, ai: {msgs: []}})

function normalize(o) {
  const d = DEFAULTS(), m = Object.assign(d, (o && typeof o === 'object') ? o : {})
  m.wonder = Object.assign({revealed: {}, notes: {}, fav: {}}, (o && o.wonder && typeof o.wonder === 'object') ? o.wonder : {})
  for (const k of ['revealed', 'notes', 'fav']) if (!m.wonder[k] || typeof m.wonder[k] !== 'object') m.wonder[k] = {}
  m.custom = Object.assign({problems: [], wonders: []}, (o && o.custom && typeof o.custom === 'object') ? o.custom : {})
  if (!Array.isArray(m.custom.problems)) m.custom.problems = []
  if (!Array.isArray(m.custom.wonders)) m.custom.wonders = []
  m.ai = Object.assign({msgs: []}, (o && o.ai && typeof o.ai === 'object') ? o.ai : {})
  if (!Array.isArray(m.ai.msgs)) m.ai.msgs = []
  /* 老数据补 meta：让每条自建内容都有生命周期（草稿 → 已核验），升级不丢内容 */
  for (const arr of [m.custom.problems, m.custom.wonders]) {
    arr.forEach(it => {
      if (it && (!it.meta || typeof it.meta !== 'object')) it.meta = {status: 'draft', source: 'ai', createdAt: 0, updatedAt: 0, verifiedAt: null}
    })
  }
  return m
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalize(JSON.parse(raw)) : DEFAULTS()
  } catch (e) { return DEFAULTS() }
}
export const DB = reactive(loadLocal())

/* updatedAt 是同步用的元数据，不是学习内容。
   早期实现把它写进 reactive DB，而下面的深度 watch 会把这次写入当成内容变更 → save() → watch → save()
   无限自循环（实测每 650ms 一次 PUT，单用户 version 刷到 4000+，history 堆积 70+ 份）。
   现在它只活在模块作用域里，并随请求体 / 本机缓存一起落盘，不再回到响应式对象。 */
let updatedAt = Number(DB.updatedAt) || 0
delete DB.updatedAt

function getUid() {
  let u = null
  try { u = localStorage.getItem(UIDKEY) } catch (e) {}
  if (!u) {
    u = 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    try { localStorage.setItem(UIDKEY, u) } catch (e) {}
  }
  return u
}
export const UID = getUid()

/* ---------- 同步层 ---------- */
export const API_BASE = (typeof window !== 'undefined' && window.PHYS_API_BASE ? String(window.PHYS_API_BASE) : '').replace(/\/$/, '')
export const SYNC = reactive({online: false, ideas: [], pillHtml: '正在检测后端…', sideHtml: '<b>正在检测后端…</b><br>学习数据优先写入服务端<br>未启动服务时自动降级到本机缓存'})
export function api(p, opt) {
  return fetch(API_BASE + p, Object.assign({headers: {'Content-Type': 'application/json'}}, opt))
    .then(async r => {
      let body = null
      try { body = await r.json() } catch (e) {}
      if (!r.ok) {
        /* 把服务端的 error 文案透传出去；只给状态码会让用户无从判断该改什么 */
        const raw = body && (body.error || body.detail || body.message)
        const msg = raw ? (typeof raw === 'string' ? raw : JSON.stringify(raw)) : 'HTTP ' + r.status
        const err = new Error(msg)
        err.status = r.status; err.body = body
        throw err
      }
      return body
    })
}
function withTimeout(pr, ms) { return Promise.race([pr, new Promise((_, rj) => setTimeout(() => rj(new Error('连接超时')), ms))]) }

export function setSync(status, msg) {
  if (status === 'ok') {
    SYNC.pillHtml = '服务端 <b>已同步</b>'
    SYNC.sideHtml = '<b>后端已连接</b> · 学习数据写入服务端<br>data/store.json · 猜想墙可共享 · AI 可用'
  } else if (status === 'busy') {
    SYNC.pillHtml = '正在连接服务端…'; SYNC.sideHtml = '<b>正在检测后端…</b><br>若服务未启动会自动降级'
  } else if (status === 'error') {
    SYNC.pillHtml = '<span style="color:var(--err)">同步失败 · 点此重试</span>'
    SYNC.sideHtml = '<b>同步失败</b> · 本机仍可正常使用<br>' + (msg || '')
  } else {
    SYNC.pillHtml = '<span style="color:var(--warn)">仅本机缓存 · 点此重试</span>'
    SYNC.sideHtml = '<b>后端未连接</b> · 数据暂存本机<br><code>poetry run python app.py</code> 后重试'
  }
}

let pushTimer = null
export function save() {
  updatedAt = Date.now()
  try { localStorage.setItem(KEY, JSON.stringify(Object.assign(toRawDB(), {updatedAt}))) } catch (e) {}
  clearTimeout(pushTimer); pushTimer = setTimeout(pushState, 650)
}
async function pushState() {
  if (!SYNC.online) return
  try {
    await api('/api/state?uid=' + encodeURIComponent(UID), {method: 'PUT', body: JSON.stringify({state: toRawDB(), updatedAt})})
    setSync('ok')
  } catch (e) { setSync('error', e.message) }
}
function toRawDB() {
  const o = JSON.parse(JSON.stringify(DB))
  delete o.updatedAt
  return o
}

export function replaceDB(state) {
  const m = normalize(state)
  delete m.updatedAt
  for (const k of Object.keys(m)) DB[k] = m[k]
}

/* ---------- 快照与导出（长期维护：误删可回滚）---------- */
export function exportURL() { return API_BASE + '/api/export?uid=' + encodeURIComponent(UID) }
export async function loadHistory() {
  try { const r = await api('/api/history?uid=' + encodeURIComponent(UID)); return Array.isArray(r.items) ? r.items : [] } catch (e) { return [] }
}
export async function restoreHistory(file) {
  return api('/api/history/restore?uid=' + encodeURIComponent(UID), {method: 'POST', body: JSON.stringify({file})})
}

export async function loadIdeas() {
  if (!SYNC.online) return
  try {
    const r = await api('/api/ideas')
    SYNC.ideas = Array.isArray(r.items) ? r.items : []
  } catch (e) {}
}
export async function postIdea(wid, text) {
  if (!SYNC.online) return {ok: false, msg: '未连接后端服务，猜想只保存在本机。'}
  try {
    const r = await api('/api/ideas', {method: 'POST', body: JSON.stringify({wid, text, uid: UID})})
    if (!r.ok) throw new Error(r.error || '发布失败')
    await loadIdeas(); return {ok: true}
  } catch (e) { return {ok: false, msg: '发布失败：' + e.message} }
}

export async function bootSync() {
  setSync('busy')
  try {
    const h = await withTimeout(api('/api/health'), 2200)
    if (!h.ok) throw new Error('服务返回异常')
    SYNC.online = true
    const r = await api('/api/state?uid=' + encodeURIComponent(UID))
    if (r.state && typeof r.state === 'object') {
      const rt = Number(r.updatedAt) || 0
      if (rt > updatedAt) {
        replaceDB(r.state)
        updatedAt = rt
        try { localStorage.setItem(KEY, JSON.stringify(Object.assign(toRawDB(), {updatedAt}))) } catch (e) {}
      }
    }
    await pushState(); await loadIdeas(); setSync('ok')
  } catch (e) { SYNC.online = false; setSync('offline', e.message) }
}

/* 任何 DB 深层修改自动防抖保存 */
let autoTimer = null
watch(DB, () => {
  clearTimeout(autoTimer); autoTimer = setTimeout(save, 650)
}, {deep: true})

/* ---------- 派生数据 ---------- */
export const problems = computed(() => BASE_PROBLEMS.concat(ADDON_PROBLEMS, DB.custom.problems))
export const wonders = computed(() => BASE_WONDERS.concat(ADDON_WONDERS, DB.custom.wonders))
export function findProblem(id) { return problems.value.find(p => p.id === id) }
export function findWonder(id) { return wonders.value.find(w => w.id === id) }

const todayStr = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
export function markToday() {
  const d = todayStr()
  if (!DB.days.includes(d)) { DB.days.push(d); DB.days.sort() }
}
export function streak() {
  if (!DB.days.length) return 0
  const set = new Set(DB.days); let d = new Date(), n = 0
  if (!set.has(todayStr())) d.setDate(d.getDate() - 1)
  for (;;) {
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    if (!set.has(k)) break
    n++; d.setDate(d.getDate() - 1)
  }
  return n
}
export const answered = () => DB.attempts.filter(a => a.mode === 'answer')
export function accByDom() {
  const o = {}; DOMAINS.forEach(d => o[d] = {n: 0, ok: 0})
  answered().forEach(a => {
    const p = problems.value.find(q => q.id === a.pid)
    if (!p || !(p.dom in o)) return
    o[p.dom].n++; if (a.correct) o[p.dom].ok++
  })
  return o
}
export function dueList() {
  const now = Date.now()
  return Object.entries(DB.wrong).filter(([, v]) => v.due <= now).map(([k]) => k)
}

/* ---------- 视图路由（hash 模式）---------- */
export const UI = reactive({
  view: 'dashboard',
  level: '全部', dom: '全部', topicQ: '',
  pracLevel: '全部', wonderRealm: '全部',
  focusTopic: null, focusWonder: null,
})
export const META = {
  dashboard: ['学习总览', '把知识点、模型、仿真和错题串成一条闭环'],
  graph: ['知识图谱', '公式必须连着适用条件一起记'],
  models: ['物理模型库', '识别信号 → 建模步骤 → 关键方程 → 陷阱'],
  wonder: ['奇思妙想', '先猜一猜，再揭晓，回家动手试'],
  ai: ['AI 助手', '想法和题目发给 AI，整理成卡片入库'],
  lab: ['交互仿真室', '数值积分实时推进，解析解并列校验'],
  practice: ['分级训练场', '先提示、再作答、后解析'],
  wrong: ['错题与间隔复习', '1 → 3 → 7 → 15 → 30 天'],
  toolbox: ['解题工具箱', '量纲 → 极限 → 特值，三道自检'],
  about: ['设计说明', '产品结构、后端接口、质量门与已知边界']
}
export function go(v) {
  if (!META[v]) v = 'dashboard'
  UI.view = v
  try { if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v) } catch (e) {}
  window.scrollTo({top: 0, behavior: 'smooth'})
}

/* ---------- 训练场选中态（跨视图跳转）---------- */
export const PRAC = reactive({current: null, hints: 0, checked: false, correct: false, showSol: false, msg: ''})
export function openProblem(pid) {
  PRAC.current = pid; PRAC.hints = 0; PRAC.checked = false; PRAC.correct = false; PRAC.showSol = false; PRAC.msg = ''
  go('practice')
}
/* 打开某条奇思妙想 / 某个知识点（跨视图跳转用） */
export function openWonder(wid) { UI.focusWonder = wid; UI.wonderRealm = '全部'; go('wonder') }
export function openTopic(tid) { UI.focusTopic = tid; UI.topicQ = ''; UI.level = '全部'; UI.dom = '全部'; go('graph') }

/* ---------- 仿真选中态 ---------- */
export const LABS = reactive({id: 'proj', def: null, params: {}, state: null, playing: true, speed: 1, lastTs: 0, lastUI: 0})
export function selectSim(id) {
  const d = SIMS.find(x => x.id === id) || SIMS[0]
  LABS.id = d.id; LABS.def = d; LABS.params = {}
  d.params.forEach(p => LABS.params[p.k] = p.type === 'select' ? p.val : Number(p.val))
  LABS.state = d.init(LABS.params); LABS.playing = true; LABS.lastTs = 0
}

/* ---------- 全局模态框 ---------- */
export const MODAL = reactive({on: false, html: '', actions: []})
export function openModal(html, actions) { MODAL.html = html; MODAL.actions = actions || []; MODAL.on = true }
export function closeModal() { MODAL.on = false; MODAL.actions = [] }

/* ---------- 卡片编辑器（AI 草稿与已入库卡片共用同一个组件） ---------- */
export const EDITOR = reactive({on: false, title: '', sub: '', card: null, onSave: null})
export function openEditor(opt) {
  EDITOR.title = opt.title || '编辑卡片'
  EDITOR.sub = opt.sub || ''
  EDITOR.card = opt.card
  EDITOR.onSave = opt.onSave || null
  EDITOR.on = true
}
export function closeEditor() { EDITOR.on = false; EDITOR.card = null; EDITOR.onSave = null }

/* 题目/奇思妙想 ⇄ 卡片草稿（字段形状只在这里定义一次） */
export function problemToCard(p) {
  return {kind: 'problem', summary: p.custom ? '我添加的题目 · 可随时修改' : '', problem: {
    title: p.title || '', level: p.level || '高中', dom: p.dom || '力学', text: p.text || '',
    hints: (p.hints || []).slice(), answers: (p.answers || []).map(a => ({label: a.label, value: String(a.value), unit: a.unit})),
    solution: (p.solution || []).slice(), trap: p.trap || ''
  }}
}
export function wonderToCard(w) {
  return {kind: 'wonder', summary: w.custom ? '我添加的思考题 · 可随时修改' : '', wonder: {
    title: w.title || '', realm: w.realm || '日常', level: w.level || '入门', hook: w.hook || '',
    think: (w.think || []).slice(), reveal: w.reveal || '', formula: w.formula || '',
    tryIt: w.tryIt || '', deeper: w.deeper || '', topics: (w.topics || []).slice()
  }}
}
export function cardToProblem(c, id) {
  const p = c.problem
  const answers = (p.answers || []).filter(a => a && String(a.label || '').trim() && String(a.value ?? '').trim() !== '' && isFinite(Number(a.value)))
    .map(a => ({label: String(a.label).trim(), value: Number(a.value), unit: String(a.unit || '—').trim() || '—', tol: 0.01}))
  return {
    id, custom: true, level: p.level === '初中' ? '初中' : '高中', dom: p.dom || '力学', model: '',
    title: String(p.title).trim(), text: String(p.text).trim(),
    hints: (p.hints && p.hints.length) ? p.hints : ['（暂无提示）'],
    answers, solution: (p.solution && p.solution.length) ? p.solution : ['（解析待补充）'],
    trap: String(p.trap || '').trim() || '（无）'
  }
}
export function cardToWonder(c, id) {
  const w = c.wonder
  return {
    id, custom: true, title: String(w.title).trim(), realm: String(w.realm || '日常').trim() || '日常',
    level: ['入门', '进阶', '脑洞'].includes(w.level) ? w.level : '入门',
    topics: Array.isArray(w.topics) ? w.topics : [],
    hook: String(w.hook || '').trim() || '直觉上会怎么回答？先写下来。',
    think: (w.think && w.think.length) ? w.think : ['第一反应的答案是什么？依据是什么假设？'],
    reveal: String(w.reveal).trim(), formula: String(w.formula || '').trim() || '—',
    tryIt: String(w.tryIt || '').trim() || '（待补充）', deeper: String(w.deeper || '').trim() || '（待补充）'
  }
}
/* 答案数组补齐到 3 行，供编辑器模板直接 v-model 到下标 */
export function padCard(c) {
  if (!c || c.kind !== 'problem' || !c.problem) return
  if (!Array.isArray(c.problem.answers)) c.problem.answers = []
  while (c.problem.answers.length < 3) c.problem.answers.push({label: '', value: '', unit: ''})
}
/* 校验逻辑在 lib/cardCheck.js（纯函数，可被 node --test 覆盖）；这里保留同名导出，避免调用方改动导入路径 */
export {checkCard} from './lib/cardCheck.js'

/* ---------- 内容生命周期：草稿 / 已核验、去重、成长统计 ---------- */
export const META_DEFAULT = () => ({status: 'draft', source: 'ai', createdAt: Date.now(), updatedAt: Date.now(), verifiedAt: null})
export const metaOf = it => (it && it.meta) || META_DEFAULT()
export const customList = kind => (kind === 'problem' ? DB.custom.problems : DB.custom.wonders)
/* 新入库：打上来源与时间戳 */
export function stampNew(rec, source) { rec.meta = Object.assign(META_DEFAULT(), {source: source || 'ai'}); return rec }
/* 编辑已存在条目：保留原有核验状态，只更新 updatedAt —— 改过内容应重新核验 */
export function restamp(rec, prev) {
  const m = Object.assign(META_DEFAULT(), metaOf(prev))
  rec.meta = Object.assign(m, {updatedAt: Date.now()})
  if (prev && metaOf(prev).status === 'verified') { rec.meta.status = 'draft'; rec.meta.needsReview = true }
  return rec
}
export function verifyItem(kind, id, ok = true) {
  const it = customList(kind).find(x => x.id === id)
  if (!it) return
  it.meta = Object.assign(META_DEFAULT(), metaOf(it), ok ? {status: 'verified', verifiedAt: Date.now(), needsReview: false} : {status: 'draft', verifiedAt: null})
  save()
}
export function pendingCount() {
  return DB.custom.problems.filter(x => metaOf(x).status !== 'verified').length +
    DB.custom.wonders.filter(x => metaOf(x).status !== 'verified').length
}
export function contentStats() {
  const wk = Date.now() - 7 * DAY
  const all = [].concat(DB.custom.problems, DB.custom.wonders)
  return {
    mine: DB.custom.problems.length, wonders: DB.custom.wonders.length,
    pending: pendingCount(),
    week: all.filter(x => (metaOf(x).createdAt || 0) >= wk).length,
    doms: new Set(DB.custom.problems.map(p => p.dom)).size,
    realms: new Set(DB.custom.wonders.map(w => w.realm)).size,
  }
}

/* 去重：先比标题，再用字符二元组 Dice 相似度兜底，避免同一道题被反复入库 */
const normText = s => String(s || '').toLowerCase().replace(/[\s\p{P}]/gu, '')
function bigrams(s) { const out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out }
function dice(a, b) { if (!a.size || !b.size) return 0; let n = 0; for (const g of a) if (b.has(g)) n++; return 2 * n / (a.size + b.size) }
export function findSimilar(kind, card, excludeId) {
  const isP = kind === 'problem'
  const src = isP ? (card.problem || {}) : (card.wonder || {})
  const t = normText(src.title), b = normText(isP ? src.text : (src.reveal || src.hook))
  if (!t && !b) return null
  let best = null
  for (const it of (isP ? problems.value : wonders.value)) {
    if (it.id === excludeId) continue
    const itt = normText(it.title), itb = normText(isP ? it.text : (it.reveal || it.hook))
    if (t && itt && t === itt) return {item: it, score: 1, why: '标题相同'}
    const s = dice(bigrams(t + b), bigrams(itt + itb))
    if (s >= 0.72 && (!best || s > best.score)) best = {item: it, score: s, why: '内容高度相似'}
  }
  return best
}

/* ---------- AI 配置状态 ---------- */
export const AICFG = reactive({loaded: false, configured: false, base_url: '', model: '', has_key: false})
export const AI_PRESETS = [
  {id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner']},
  {id: 'kimi', name: 'Kimi (Moonshot)', base: 'https://api.moonshot.cn/v1', models: ['kimi-k2-0711-preview', 'moonshot-v1-8k', 'moonshot-v1-32k']},
  {id: 'glm', name: 'GLM (智谱)', base: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-flash', 'glm-4-air', 'glm-4-plus', 'glm-4.6']},
  {id: 'moma', name: '移动云 MoMA', base: 'https://moma.cmecloud.cn/v1/chat/completions', models: ['glm-5.3-flash', 'glm-5.2', 'deepseek-v3.2', 'minimax-m2.5']},
  {id: 'custom', name: '自定义 / 本地', base: '', models: []}
]
export function testAI(base_url, model, api_key) {
  return api('/api/ai/test', {method: 'POST', body: JSON.stringify({base_url, model, api_key})})
}
export function fetchAIModels() {
  return api('/api/ai/models')
}
export async function loadAIConfig() {
  try {
    const r = await api('/api/ai/config')
    AICFG.loaded = true; AICFG.configured = !!r.configured
    AICFG.base_url = r.base_url || ''; AICFG.model = r.model || ''; AICFG.has_key = !!r.has_key
  } catch (e) { AICFG.loaded = true; AICFG.configured = false }
}
export async function saveAIConfig(base_url, model, api_key) {
  const body = {base_url: (base_url || '').trim(), model: (model || '').trim()}
  if ((api_key || '').trim()) body.api_key = api_key.trim()
  const r = await api('/api/ai/config', {method: 'PUT', body: JSON.stringify(body)})
  await loadAIConfig()
  return r
}
export async function aiChat(messages) {
  return api('/api/ai/chat', {method: 'POST', body: JSON.stringify({messages})})
}

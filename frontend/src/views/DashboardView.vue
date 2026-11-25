<template>
  <section class="view active">
    <h2 class="sec">今天从哪里开始</h2>
    <p class="sub">先诊断、再建模、后验证。系统按你的练习记录给出下一步建议，学习数据保存在服务端。</p>
    <div class="grid g4">
      <div class="card stat" v-for="s in stats" :key="s.lab">
        <div class="stripe" :style="{background:s.color}"></div>
        <div class="lab">{{ s.lab }}</div>
        <div class="num" :style="{color:s.color}">{{ s.num }}</div>
        <div class="foot">{{ s.foot }}</div>
      </div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card pad">
        <div class="spread"><h3>能力雷达</h3><span class="tag blue">按领域正确率</span></div>
        <div style="margin-top:8px" v-html="radarSvg"></div>
        <div class="tiny muted" style="margin-top:6px">未练习的领域显示为最内圈，不代表能力为零；数据只来自作答记录。</div>
      </div>
      <div class="card pad">
        <div class="spread"><h3>今日任务</h3><button class="btn sm" @click="DB.taskOffset=(DB.taskOffset||0)+1">换一批</button></div>
        <div style="margin-top:10px">
          <div v-for="(x,i) in tasks" :key="i" style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px dashed var(--line)">
            <span class="tag" :class="x.c">{{ i+1 }}</span>
            <div style="flex:1">
              <div style="font-size:12.8px;font-weight:600">{{ x.t }}</div>
              <div class="tiny muted">{{ x.d }}</div>
            </div>
            <button class="btn sm" @click="x.fn()">{{ x.act }}</button>
          </div>
        </div>
        <div class="divider"></div>
        <button class="btn primary" @click="go('practice')">进入训练场</button>
        <button class="btn" style="margin-left:8px" @click="go('lab')">去做个仿真</button>
        <button class="btn" style="margin-left:8px" @click="go('ai')">AI 整理一道题</button>
      </div>
    </div>
    <div class="card pad" style="margin-top:16px">
      <div class="spread">
        <h3>内容成长 · 长期维护</h3>
        <span class="tag" :class="gs.pending ? 'red' : 'green'">{{ gs.pending ? gs.pending + ' 条待核验' : '自建内容全部已核验' }}</span>
      </div>
      <div class="grid g4" style="margin-top:10px">
        <div v-for="k in growth" :key="k.lab" class="stat" style="padding:10px 12px">
          <div class="lab">{{ k.lab }}</div><div class="num" style="font-size:21px">{{ k.num }}</div><div class="foot">{{ k.foot }}</div>
        </div>
      </div>
      <div class="row" style="margin-top:12px;flex-wrap:wrap">
        <button class="btn sm" @click="goMine">核验我的题目</button>
        <button class="btn sm" @click="goMineWonder">看我的思考题</button>
        <a class="btn sm" :href="exportHref" download style="text-decoration:none">导出备份 JSON</a>
        <button class="btn sm" @click="openSnapshots">快照回滚</button>
      </div>
      <div class="tiny muted" style="margin-top:8px">数据存在服务端 <code>data/store.json</code>；每次改动前自动留快照（保留最近 20 份），误删可从快照恢复。AI 新增内容默认「待核验」，核对数值后再标记。</div>
    </div>
    <div class="card pad" style="margin-top:16px;background:linear-gradient(100deg,#fffdf8,#ffffff)">
      <div class="spread"><h3>每日一奇 · 今天物理哪里有点怪</h3><span class="tag orange">发现物理的奇妙</span></div>
      <div v-if="daily" style="margin-top:8px">
        <h3 style="font-size:15px;margin:0 0 6px">{{ daily.title }}</h3>
        <p style="font-size:12.8px;color:var(--ink2);margin:6px 0 10px">{{ daily.hook }}</p>
        <div class="row">
          <span class="tag orange">{{ daily.realm }}</span>
          <span class="tiny muted">已揭晓 {{ revCount }} / {{ wonders.length }} 个奇妙</span>
          <div style="flex:1"></div>
          <button class="btn primary sm" @click="goDaily">去猜一猜</button>
        </div>
      </div>
    </div>
    <h2 class="sec" style="margin-top:26px">四阶段进阶路径</h2>
    <p class="sub">勾选即保存进度。初中竞赛以「受力分析与守恒」为地基，高中竞赛再叠加微积分、刚体与场论方法。</p>
    <div class="grid g4">
      <div class="card stage" v-for="(st,i) in ROADMAP" :key="i">
        <div class="num">{{ st.n }}</div><h4>{{ st.t }}</h4>
        <div class="meta">{{ st.meta }} · {{ doneOf(i) }}/{{ st.items.length }}</div>
        <div class="bar" style="margin-bottom:8px"><i :style="{width:pctOf(i)+'%'}"></i></div>
        <label v-for="(it,j) in st.items" :key="j" class="check" :class="{done:!!DB.plan[i+'_'+j]}">
          <input type="checkbox" v-model="DB.plan[i+'_'+j]"><span>{{ it }}</span>
        </label>
      </div>
    </div>
  </section>
</template>

<script setup>
import {computed} from 'vue'
import {DB, go, answered, accByDom, dueList, streak, problems, wonders, openProblem, openWonder, selectSim, TOPICS, SIMS, UI, DAY,
  contentStats, exportURL, loadHistory, restoreHistory, replaceDB, save, api, UID, openModal, closeModal} from '../store.js'
import {ROADMAP} from '../data/misc.js'

const stats = computed(() => {
  const a = answered(), ok = a.filter(x => x.correct).length
  const mastered = Object.keys(DB.progress).filter(k => DB.progress[k]).length
  return [
    {lab: '累计作答', num: a.length, foot: '只统计提交答案，不含查看解析', color: '#2f56cc'},
    {lab: '总正确率', num: (a.length ? Math.round(ok / a.length * 100) : 0) + '%', foot: a.length ? '错因可在错题本查看' : '先去训练场做一题', color: '#0d8266'},
    {lab: '待复习错题', num: dueList().length, foot: '按间隔复习队列到期', color: '#d97633'},
    {lab: '已标记掌握', num: mastered + ' / ' + TOPICS.length, foot: '知识图谱中可勾选', color: '#5b7ee8'}
  ]
})

const radarSvg = computed(() => {
  const cx = 170, cy = 142, R = 98, n = 6
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n
  const acc = accByDom()
  const DOMS = ['力学', '电磁', '热学', '光学', '近代', '方法']
  const vals = DOMS.map(d => acc[d].n ? Math.max(.06, acc[d].ok / acc[d].n) : .06)
  let s = '<svg viewBox="0 0 340 290" style="width:100%;max-width:340px;display:block;margin:auto">'
  ;[.25, .5, .75, 1].forEach(f => {
    const pts = Array.from({length: n}, (_, i) => [cx + R * f * Math.cos(ang(i)), cy + R * f * Math.sin(ang(i))].map(v => v.toFixed(1)).join(',')).join(' ')
    s += '<polygon points="' + pts + '" fill="none" stroke="#e3e9f3" stroke-width="1"/>'
  })
  DOMS.forEach((d, i) => {
    const x = cx + R * Math.cos(ang(i)), y = cy + R * Math.sin(ang(i))
    s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" stroke="#e3e9f3"/>'
    const lx = cx + (R + 22) * Math.cos(ang(i)), ly = cy + (R + 22) * Math.sin(ang(i))
    s += '<text x="' + lx + '" y="' + (ly + 4) + '" text-anchor="middle" font-size="11" fill="#6d7893">' + d + '</text>'
  })
  const poly = vals.map((v, i) => [cx + R * v * Math.cos(ang(i)), cy + R * v * Math.sin(ang(i))].map(q => q.toFixed(1)).join(',')).join(' ')
  s += '<polygon points="' + poly + '" fill="rgba(47,86,204,.18)" stroke="#2f56cc" stroke-width="2"/>'
  vals.forEach((v, i) => { s += '<circle cx="' + (cx + R * v * Math.cos(ang(i))).toFixed(1) + '" cy="' + (cy + R * v * Math.sin(ang(i))).toFixed(1) + '" r="3.5" fill="#2f56cc"/>' })
  const detail = DOMS.map(d => acc[d].n ? d + ' ' + (acc[d].ok / acc[d].n * 100).toFixed(0) + '%' : d + ' 未练').join(' · ')
  s += '<text x="170" y="272" text-anchor="middle" font-size="10.5" fill="#8a95ad">' + detail + '</text></svg>'
  return s
})

const tasks = computed(() => {
  const due = dueList(), off = DB.taskOffset || 0, out = []
  due.slice(0, 2).forEach(pid => {
    const p = problems.value.find(q => q.id === pid)
    if (p) out.push({t: '复习到期错题：' + p.title, d: '错因：' + (DB.wrong[pid].reason || '未归类') + ' · 重新独立作答', act: '打开题目', fn: () => openProblem(pid), c: 'orange'})
  })
  const acc = accByDom()
  const weak = ['力学', '电磁', '热学', '光学', '近代', '方法'].filter(d => acc[d].n > 0).sort((x, y) => acc[x].ok / acc[x].n - acc[y].ok / acc[y].n)[0] || '力学'
  const cand = problems.value.filter(p => p.dom === weak && !DB.attempts.some(a => a.pid === p.id && a.correct))
  const pick = cand.length ? cand[(off + 1) % cand.length] : problems.value[(off + 3) % problems.value.length]
  out.push({t: '新题推荐：' + pick.title, d: '薄弱领域：' + weak + ' · ' + pick.level + ' · 建议先只用提示 1', act: '开始作答', fn: () => openProblem(pick.id), c: 'blue'})
  const sim = SIMS[(off + 2) % SIMS.length]
  out.push({t: '可视化实验：' + sim.name, d: '拖动参数，观察数值解与解析解是否吻合', act: '进入仿真', fn: () => { selectSim(sim.id); go('lab') }, c: 'green'})
  out.push({t: '自检习惯：量纲 + 极限 + 特值', d: '在工具箱用量纲分析器验算一个刚做过的公式', act: '打开工具箱', fn: () => go('toolbox'), c: ''})
  const wt = wonders.value[Math.floor(Date.now() / DAY) % wonders.value.length]
  out.push({t: '趣味思考：' + wt.title, d: '不求标准答案，先写下你的猜想再揭晓', act: '去想一想', fn: () => openWonder(wt.id), c: 'orange'})
  if (DB.custom.problems.length || DB.custom.wonders.length)
    out.push({t: '我的题库：' + (DB.custom.problems.length + DB.custom.wonders.length) + ' 张 AI 入库卡片', d: 'AI 整理的题目与想法，记得核对数值', act: '去检查', fn: () => go('practice'), c: ''})
  return out.slice(0, 5)
})

const gs = computed(() => contentStats())
const growth = computed(() => {
  const c = gs.value
  return [
    {lab: '我的题目', num: c.mine, foot: '训练场 · 我的题库'},
    {lab: '我的思考题', num: c.wonders, foot: '奇思妙想 · 我添加'},
    {lab: '待核验', num: c.pending, foot: c.pending ? '核对数值后标记' : '没有待办'},
    {lab: '近 7 天新增', num: c.week, foot: '覆盖 ' + c.doms + ' 个领域 / ' + c.realms + ' 类'},
  ]
})
const exportHref = exportURL()
const fmtTs = ts => { const d = new Date(ts); return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') }
function goMine() { UI.pracLevel = 'mine'; go('practice') }
function goMineWonder() { go('wonder') }
async function openSnapshots() {
  const items = await loadHistory()
  if (!items.length) { alert('还没有快照。改动一次学习数据后，服务端会自动留档。'); return }
  const rows = items.slice(0, 6).map(it => '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:12px"><span>' +
    new Date(it.ts).toLocaleString('zh-CN') + '</span><span class="muted">题 ' + it.problems + ' · 奇 ' + it.wonders + ' · 作答 ' + it.attempts + '</span></div>').join('')
  openModal('<h3>快照回滚</h3><p>恢复到所选时间点的学习数据。当前数据会先自动存一份，回滚后仍可再回来。</p>' + rows,
    items.slice(0, 4).map(it => ({label: fmtTs(it.ts), fn: () => doRestore(it.file)})).concat([{label: '取消', fn: closeModal}]))
}
async function doRestore(file) {
  const r = await restoreHistory(file)
  if (!r.ok) { alert('回滚失败：' + (r.error || '未知错误')); return }
  const st = await api('/api/state?uid=' + encodeURIComponent(UID))
  closeModal()
  if (st.state) { replaceDB(st.state); save() }
  location.reload()
}
const daily = computed(() => wonders.value[Math.floor(Date.now() / DAY) % wonders.value.length])
const revCount = computed(() => wonders.value.filter(w => DB.wonder.revealed[w.id]).length)
function goDaily() { openWonder(daily.value.id) }
const doneOf = i => ROADMAP[i].items.filter((_, j) => DB.plan[i + '_' + j]).length
const pctOf = i => Math.round(doneOf(i) / ROADMAP[i].items.length * 100)
</script>

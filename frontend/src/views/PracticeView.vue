<template>
  <section class="view active">
    <h2 class="sec">分级训练场</h2>
    <p class="sub">左侧筛选选题，右侧作答：先三级提示，再提交数值答案，最后看分步解析。答错可归档错因，自动进入间隔复习队列。</p>
    <div class="split">
      <div>
        <div class="card pad" style="margin-bottom:10px">
          <div class="row" style="flex-wrap:wrap">
            <button v-for="c in chips" :key="c[1]" class="chip" :class="{on:UI.pracLevel===c[1]}" @click="UI.pracLevel=c[1]">{{ c[0] }}</button>
          </div>
        </div>
        <div class="split-list" style="max-height:calc(100vh - 320px)">
          <div v-for="p in list" :key="p.id" class="srow" :class="{on:p.id===PRAC.current}" @click="openProblem(p.id)">
            <span class="tag" :class="p.level==='初中'?'green':'blue'">{{ p.level }}</span>
            <span class="tag">{{ p.dom }}</span>
            <span class="t">{{ p.title }}<br><span class="sub">{{ modelName(p) }} · {{ p.answers.length }} 个空</span></span>
          </div>
          <div v-if="!list.length" class="empty2">这个筛选下还没有题目。</div>
        </div>
      </div>
      <div class="split-detail">
        <div v-if="!cur" class="card pad"><div class="spread">
          <div><h3>从左侧题目列表选一题</h3><p class="muted tiny" style="margin:4px 0 0">训练流程：读题 → 逐级提示 → 提交数值答案 → 查看分步解析 → 错因归档。也可以把遇到的题发给 AI 助手整理入库。</p></div>
          <button class="btn" @click="go('ai')">用 AI 添加题目</button>
        </div></div>
        <div v-else class="card pad">
          <div class="spread">
            <div class="row">
              <span class="tag" :class="cur.level==='初中'?'green':'blue'">{{ cur.level }}竞赛</span>
              <span class="tag">{{ cur.dom }}</span>
              <span class="tag orange">{{ modelName(cur) }}</span>
              <span v-if="cur.custom" class="tag orange">我添加</span>
              <span v-if="cur.custom && !verified(cur)" class="tag red">待核验</span>
              <span v-else-if="cur.custom" class="tag green">已核验</span>
            </div>
            <div class="row">
              <button v-if="cur.custom && !verified(cur)" class="btn sm" @click="verifyItem('problem',cur.id,true)">标记已核验</button>
              <button v-if="cur.custom && verified(cur)" class="btn sm" @click="verifyItem('problem',cur.id,false)">撤销核验</button>
              <button v-if="cur.custom" class="btn sm" @click="editCustom(cur)">编辑</button>
              <button v-if="cur.custom" class="btn sm" @click="removeCustom(cur.id)">移除</button>
              <button class="btn sm" @click="PRAC.current=null">收起</button>
            </div>
          </div>
          <h3 style="margin:12px 0 6px">{{ cur.title }}</h3>
          <p style="font-size:13.4px;line-height:1.9;color:var(--ink2);margin:0 0 10px"><MathText :text="cur.text" /></p>
          <div class="row">
            <button class="btn sm" @click="PRAC.hints=Math.min(3,PRAC.hints+1)">给点提示（{{ Math.min(PRAC.hints,3) }}/3）</button>
            <button class="btn sm" @click="PRAC.showSol=true;PRAC.msg='仅查看解析，不计入正确率，也不进入错题本。'">直接看解析</button>
          </div>
          <div style="margin-top:10px">
            <div v-for="(x,i) in cur.hints.slice(0,PRAC.hints)" :key="i" class="hint"><b>提示 {{ i+1 }}：</b><MathText :text="x" /></div>
          </div>
          <template v-if="cur.answers.length">
            <div class="divider"></div>
            <div style="font-size:12.5px;font-weight:650;margin-bottom:4px">填写答案（可输入数值或简单算式，如 <code>2*sqrt(3)</code>）</div>
            <div v-for="(a,i) in cur.answers" :key="i" class="blankrow">
              <label><MathText :text="a.label" /></label>
              <input class="input" style="max-width:170px" v-model="inputs[i]" :disabled="PRAC.checked" placeholder="数值">
              <span class="unit">{{ a.unit }}</span>
            </div>
            <div class="row" style="margin-top:10px">
              <button class="btn primary" :disabled="PRAC.checked" @click="submit">提交答案</button>
              <button class="btn" @click="resetSel">换一题</button>
            </div>
          </template>
          <div v-else class="notice warn" style="margin-top:12px">这道题没有录入标准答案（AI 入库时未填），只供练习阅读，不能自动判分。</div>
          <div style="margin-top:10px" v-if="PRAC.msg" v-html="PRAC.msg"></div>
          <div v-if="PRAC.checked && !PRAC.correct" style="margin-top:10px">
            <label class="tiny muted">错因归类（用于错题本统计）</label>
            <div class="row">
              <button v-for="r in reasons" :key="r" class="btn sm" @click="setReason(r)">{{ r }}</button>
            </div>
          </div>
          <div v-if="PRAC.showSol" class="sol">
            <b style="color:var(--brand)">分步解析</b>
            <div v-for="(x,i) in cur.solution" :key="i" class="step"><b>{{ i+1 }}.</b> <MathText :text="x" /></div>
            <div class="notice warn" style="margin-top:10px"><b>易错点：</b><MathText :text="cur.trap" /></div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import {computed, reactive, watch, onMounted} from 'vue'
import {UI, DB, PRAC, openProblem, go, problems, findProblem, markToday, save, dueList,
  openEditor, problemToCard, cardToProblem, metaOf, verifyItem, restamp} from '../store.js'
import {MODELS} from '../store.js'
import {parseAnswer} from '../lib/expr.js'
import {fmtNum} from '../lib/canvasUtils.js'
import MathText from '../components/MathText.vue'
import {escHtml} from '../lib/tex.js'

const chips = [['全部', '全部'], ['初中', '初中'], ['高中', '高中'], ['我做错的', 'wrong'], ['待复习', 'due'], ['我的题库', 'mine']]
const reasons = ['概念不清', '模型识别', '计算失误', '审题漏条件']
const list = computed(() => problems.value.filter(p =>
  UI.pracLevel === '全部' ||
  (UI.pracLevel === '初中' || UI.pracLevel === '高中') && p.level === UI.pracLevel ||
  UI.pracLevel === 'wrong' && DB.wrong[p.id] ||
  UI.pracLevel === 'due' && dueList().includes(p.id) ||
  UI.pracLevel === 'mine' && p.custom))
const cur = computed(() => PRAC.current ? findProblem(PRAC.current) : null)
const modelName = p => { const m = MODELS.find(x => x.id === p.model); return m ? m.name : '综合' }

const inputs = reactive([])
watch(() => PRAC.current, () => { inputs.length = 0; if (cur.value) cur.value.answers.forEach(() => inputs.push('')) }, {immediate: true})
/* 首次进入且没有指定题目时，自动选中列表第一题，右栏不留空白 */
onMounted(() => { if (!PRAC.current && list.value.length) openProblem(list.value[0].id) })

const verified = p => metaOf(p).status === 'verified'
function resetSel() { PRAC.current = null }
function removeCustom(id) {
  const i = DB.custom.problems.findIndex(p => p.id === id)
  if (i >= 0) { DB.custom.problems.splice(i, 1); delete DB.wrong[id]; PRAC.current = null }
}
function editCustom(p) {
  openEditor({
    title: '修改我的题目',
    sub: '「我的题库」里的卡片可随时修改；修改答案后旧的作答记录不会删除，但下次判分按新答案。',
    card: problemToCard(p),
    onSave: c => {
      const i = DB.custom.problems.findIndex(q => q.id === p.id)
      if (i < 0) return false
      DB.custom.problems.splice(i, 1, restamp(cardToProblem(c, p.id), p))
    }
  })
}
function submit() {
  const p = cur.value; if (!p) return
  let vals = []
  try {
    for (let i = 0; i < p.answers.length; i++) vals.push(parseAnswer(inputs[i]))
  } catch (e) { PRAC.msg = '<div class="notice err">第 ' + (vals.length + 1) + ' 空：' + escHtml(e.message) + '</div>'; return }
  const results = p.answers.map((a, i) => {
    const d = Math.abs(vals[i] - a.value), tol = Math.max(Math.abs(a.value) * (a.tol || .01), .02)
    return {k: a.label, ok: d <= tol, yours: vals[i], right: a.value, unit: a.unit}
  })
  const correct = results.every(r => r.ok)
  PRAC.checked = true; PRAC.correct = correct; PRAC.showSol = correct
  DB.attempts.push({pid: p.id, correct, ts: Date.now(), mode: 'answer'}); markToday()
  if (correct) {
    const w = DB.wrong[p.id]
    if (w) {
      const ints = [1, 3, 7, 15, 30]; w.stage = (w.stage || 0) + 1
      if (w.stage >= ints.length) { delete DB.wrong[p.id]; PRAC.msg = '<div class="notice ok"><b>答对了！</b>这道题已完成全部复习轮次，移出错题本。</div>' }
      else { w.due = Date.now() + ints[w.stage] * 86400000; PRAC.msg = '<div class="notice ok"><b>答对了！</b>下次复习安排在 ' + ints[w.stage] + ' 天后。</div>' }
    } else PRAC.msg = '<div class="notice ok"><b>全对！</b> ' + results.map(r => escHtml(r.k) + ' = ' + fmtNum(r.yours, 4) + ' ' + escHtml(r.unit)).join('；') + '</div>'
  } else {
    const detail = results.map(r => (r.ok ? '✓ ' : '✗ ') + escHtml(r.k) + '：你填 ' + fmtNum(r.yours, 4) + (r.ok ? '' : '，正确 ' + fmtNum(r.right, 4)) + ' ' + escHtml(r.unit)).join('　')
    PRAC.msg = '<div class="notice err"><b>还差一点。</b><br>' + detail + '<br>先回到提示 ' + (PRAC.hints < 3 ? PRAC.hints + 1 : 3) + '，再试一次；也可以直接看解析并归档错因。</div>'
    const w = DB.wrong[p.id] || {added: Date.now(), stage: 0, count: 0, reason: '未归类'}
    w.stage = 0; w.count = (w.count || 0) + 1; w.due = Date.now() + 86400000; DB.wrong[p.id] = w
  }
  save()
}
function setReason(r) {
  if (DB.wrong[PRAC.current]) {
    DB.wrong[PRAC.current].reason = r
    PRAC.msg = '<div class="notice ok">已把错因记为「' + r + '」，并加入间隔复习队列。</div>'
  }
}
</script>

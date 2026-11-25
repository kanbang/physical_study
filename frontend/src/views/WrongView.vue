<template>
  <section class="view active">
    <h2 class="sec">错题与间隔复习</h2>
    <p class="sub">复习间隔 1 → 3 → 7 → 15 → 30 天；每次答对后延后，答错则退回第一档。到期题目会出现在总览的今日任务里。</p>
    <div class="grid g4">
      <div class="card stat" v-for="s in stats" :key="s.lab">
        <div class="stripe" :style="{background:s.color}"></div>
        <div class="lab">{{ s.lab }}</div>
        <div class="num" :style="{color:s.color}">{{ s.num }}</div>
        <div class="foot">{{ s.foot }}</div>
      </div>
    </div>
    <div class="card pad" style="margin-top:14px">
      <div class="spread"><h3>错题清单</h3><button class="btn sm" @click="reviewDue">开始复习到期题目</button></div>
      <div style="margin-top:12px">
        <div v-if="!entries.length" class="empty">错题本还是空的。答错或主动归档后会自动出现在这里。</div>
        <div v-for="[id,w] in entries" :key="id" style="margin-bottom:9px">
          <div style="display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;padding:11px 14px">
            <span class="tag" :class="w.due<=Date.now()?'red':'blue'">{{ w.due<=Date.now() ? '待复习' : Math.max(0,Math.ceil((w.due-Date.now())/86400000))+' 天后' }}</span>
            <span style="font-size:13px;font-weight:650;flex:1">{{ titleOf(id) }}</span>
            <span class="tag">错因：{{ w.reason || '未归类' }}</span>
            <button class="btn sm" @click="openProblem(id)">重新作答</button>
            <button class="btn sm" @click="remove(id)">移除</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card pad" style="margin-top:14px">
      <h3>错因分布</h3>
      <div style="margin-top:10px">
        <div v-if="!Object.keys(reasonCounts).length" class="empty">还没有错因数据。</div>
        <div v-for="(v,k) in reasonCounts" :key="k" style="display:flex;align-items:center;gap:10px;margin:7px 0">
          <span style="width:80px;font-size:12px;color:var(--ink2)">{{ k }}</span>
          <div class="bar" style="flex:1;height:12px"><i :style="{width:(v/maxReason*100)+'%',background:'var(--accent)'}"></i></div>
          <b class="mono" style="width:24px;text-align:right">{{ v }}</b>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import {computed} from 'vue'
import {DB, problems, dueList, openProblem, answered, save, openModal, findProblem} from '../store.js'

const entries = computed(() => Object.entries(DB.wrong))
const stats = computed(() => {
  const graded = answered().filter(a => a.correct).length
  return [
    {lab: '错题总数', num: entries.value.length, foot: '含已完成复习轮次的题目', color: '#c33c42'},
    {lab: '今日待复习', num: dueList().length, foot: '到期后会出现在总览', color: '#d97633'},
    {lab: '累计答对次数', num: graded, foot: '同一题多次作答分别计', color: '#0d8266'},
    {lab: '覆盖领域', num: new Set(entries.value.map(([id]) => (findProblem(id) || {}).dom).filter(Boolean)).size + ' / 6', foot: '按错题所属领域统计', color: '#2f56cc'}
  ]
})
const reasonCounts = computed(() => {
  const counts = {}
  entries.value.forEach(([, w]) => { const r = w.reason || '未归类'; counts[r] = (counts[r] || 0) + 1 })
  return counts
})
const maxReason = computed(() => Math.max(1, ...Object.values(reasonCounts.value)))
const titleOf = id => { const p = findProblem(id); return p ? p.title : id }
function remove(id) { delete DB.wrong[id]; save() }
function reviewDue() {
  const d = dueList()
  if (!d.length) { openModal('<h3>暂无到期题目</h3><p>当前没有需要复习的错题。可以先去训练场做新题，或稍后再来。</p>'); return }
  openProblem(d[0])
}
</script>

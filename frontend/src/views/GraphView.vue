<template>
  <section class="view active">
    <h2 class="sec">知识图谱</h2>
    <p class="sub">每条公式都标注适用条件与易错点 —— 竞赛里用错条件的代价比记不住公式更大。左侧选知识点，右侧看详情。</p>
    <div class="card pad" style="margin-bottom:14px">
      <div class="row">
        <div class="row">
          <button v-for="l in LEVELS" :key="l" class="chip" :class="{on:UI.level===l}" @click="UI.level=l">{{ l }}</button>
        </div>
        <div style="width:1px;height:22px;background:var(--line)"></div>
        <div class="row">
          <button class="chip" :class="{on:UI.dom==='全部'}" @click="UI.dom='全部'">全部</button>
          <button v-for="d in DOMAINS" :key="d" class="chip" :class="{on:UI.dom===d}" @click="UI.dom=d">{{ d }}</button>
        </div>
        <div style="flex:1"></div>
        <input class="input" v-model="UI.topicQ" placeholder="搜索知识点 / 公式…" style="max-width:230px">
      </div>
    </div>
    <div class="split">
      <div class="split-list">
        <div v-for="t in filtered" :key="t.id" class="srow" :class="{on:t.id===sel}" @click="sel=t.id">
          <span class="tag" :class="t.level==='初中'?'green':'blue'">{{ t.level }}</span>
          <span class="tag">{{ t.dom }}</span>
          <span class="t">{{ t.name }}</span>
          <span v-if="DB.progress[t.id]" class="tag green">掌握</span>
        </div>
        <div v-if="!filtered.length" class="empty2">没有匹配的知识点，换个关键词或筛选条件试试。</div>
      </div>
      <div class="split-detail card pad" v-if="topic">
        <div class="spread">
          <div class="row">
            <span class="tag" :class="topic.level==='初中'?'green':'blue'">{{ topic.level }}</span>
            <span class="tag">{{ topic.dom }}</span>
            <span style="font-size:15px;font-weight:700">{{ topic.name }}</span>
          </div>
          <label class="check" style="margin:0"><input type="checkbox" v-model="DB.progress[topic.id]"><span>已掌握</span></label>
        </div>
        <div class="blk" style="margin-top:14px"><label>核心公式与含义</label>
          <div v-for="(f,i) in topic.formulas" :key="i" style="margin-bottom:8px"><span class="eq"><MathText :text="f[0]" block /><span class="tiny" style="display:block;margin-top:5px;color:var(--ink3);line-height:1.7"><MathText :text="f[1]" /></span></span></div>
        </div>
        <div class="blk"><label>适用条件</label><div class="notice"><MathText :text="topic.cond" /></div></div>
        <div class="blk"><label>高频易错点</label><div class="notice warn"><MathText :text="topic.trap" /></div></div>
        <div class="blk"><label>竞赛延伸</label><p style="font-size:12.9px;line-height:1.8;color:var(--ink2);margin:0"><MathText :text="topic.ext" /></p></div>
      </div>
    </div>
  </section>
</template>

<script setup>
import {ref, computed, watch} from 'vue'
import {UI, DB, TOPICS, DOMAINS, LEVELS} from '../store.js'
import MathText from '../components/MathText.vue'

const sel = ref(UI.focusTopic || TOPICS[0].id)
watch(() => UI.focusTopic, id => { if (id) sel.value = id })
const filtered = computed(() => {
  const q = UI.topicQ.trim().toLowerCase()
  return TOPICS.filter(t =>
    (UI.level === '全部' || t.level === UI.level) &&
    (UI.dom === '全部' || t.dom === UI.dom) &&
    (!q || (t.name + t.formulas.map(f => f[0] + f[1]).join('') + t.cond + t.trap).toLowerCase().includes(q)))
})
/* 筛选结果不含当前选中项时，自动选中第一条，避免右栏停留在看不见的条目上 */
watch(filtered, f => { if (f.length && !f.some(t => t.id === sel.value)) sel.value = f[0].id })
const topic = computed(() => TOPICS.find(t => t.id === sel.value))
</script>

<style scoped>
.blk{margin-top:14px}
.blk>label{display:block;font-size:11px;letter-spacing:1px;color:var(--ink3);margin-bottom:6px}
</style>

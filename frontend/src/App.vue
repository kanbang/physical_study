<template>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><circle cx="12" cy="12" r="2.4" fill="#fff" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4.4"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(120 12 12)"/></svg></div>
        <div><b>竞物台</b><small>PHYSICS OLYMPIAD LAB</small></div>
      </div>
      <nav class="nav" id="nav">
        <div class="group">学习闭环</div>
        <button :class="{active:UI.view==='dashboard'}" @click="go('dashboard')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>学习总览</button>
        <button :class="{active:UI.view==='graph'}" @click="go('graph')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7.4l8 .7M7 8.2l4 7.6M16.5 9.3L13 15.8"/></svg>知识图谱</button>
        <button :class="{active:UI.view==='models'}" @click="go('models')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/></svg>物理模型库</button>
        <button :class="{active:UI.view==='wonder'}" @click="go('wonder')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.5.9 1.2.9 2.1h5.2c0-.9.3-1.6.9-2.1A6 6 0 0012 3z"/></svg>奇思妙想 <span class="badge" style="background:var(--accent)">趣</span></button>
        <button :class="{active:UI.view==='ai'}" @click="go('ai')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a8 8 0 01-8 8H4l2.2-2.6A8 8 0 1121 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>AI 助手<span class="badge" style="background:var(--brand2)">AI</span></button>
        <button :class="{active:UI.view==='lab'}" @click="go('lab')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3h6M10 3v7L5 19a1.5 1.5 0 001.3 2h11.4A1.5 1.5 0 0019 19l-5-9V3"/><path d="M7.5 15h9"/></svg>交互仿真室</button>
        <button :class="{active:UI.view==='practice'}" @click="go('practice')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>分级训练场</button>
        <button :class="{active:UI.view==='wrong'}" @click="go('wrong')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z"/><path d="M3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5"/></svg>错题与复习<span class="badge" v-if="dueCount" :style="{background:'var(--err)',color:'#fff'}">{{dueCount}}</span></button>
        <div class="group">工具</div>
        <button :class="{active:UI.view==='toolbox'}" @click="go('toolbox')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a4 4 0 00-5 5L3 18l3 3 6.7-6.7a4 4 0 005-5l-2.6 2.6-2.1-2.1L14.7 6.3z"/></svg>解题工具箱</button>
        <button :class="{active:UI.view==='about'}" @click="go('about')"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>设计说明</button>
      </nav>
      <div class="sidefoot" v-html="SYNC.sideHtml"></div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="crumb">{{ crumbTitle }} <span>{{ crumbSub }}</span></div>
        <div class="spacer"></div>
        <div class="pill" style="cursor:pointer" title="点击重新连接后端服务" v-html="SYNC.pillHtml" @click="bootSync"></div>
        <div class="pill">连续学习 <b>{{ streak() }}</b> 天</div>
        <div class="pill">已练 <b>{{ answered().length }}</b> 题 · 正确率 <b>{{ accPct }}%</b></div>
      </header>
      <div class="content">
        <component :is="viewComp"></component>
        <div class="footer">竞物台 Physics Olympiad Lab · Vue 3 组件化前端（Vite 构建）+ Poetry 隔离的 Python/FastAPI 后端 · 学习数据经 /api/state 落盘服务端，断线自动降级 localStorage<br>内容为教学辅助，公式与数值已标注适用条件；趣味思考题标注争议结论；AI 生成卡片需人工核对；不替代教材、真题与教师指导。</div>
      </div>
    </div>
  </div>
  <div class="mask" :class="{on:MODAL.on}" @click.self="closeModal"><div class="modal">
    <div v-html="MODAL.html"></div>
    <div class="row" style="margin-top:18px">
      <button v-for="(a,i) in MODAL.actions" :key="i" class="btn" :class="{primary:i===0}" @click="a.fn()">{{ a.label }}</button>
      <button class="btn" @click="closeModal">关闭</button>
    </div>
  </div></div>

  <div class="mask" :class="{on:EDITOR.on}" @click.self="closeEditor">
    <div class="modal" style="max-width:720px;max-height:88vh;overflow:auto">
      <h3>{{ EDITOR.title }}</h3>
      <p class="tiny muted" style="margin:5px 0 10px">{{ EDITOR.sub }}</p>
      <CardEditor v-if="EDITOR.card" :card="EDITOR.card" />
      <div class="row" style="margin-top:16px">
        <button class="btn primary" @click="saveEditor">保存修改</button>
        <button class="btn" @click="closeEditor">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, onMounted} from 'vue'
import {UI, META, go, SYNC, bootSync, MODAL, closeModal, EDITOR, closeEditor, streak, answered, dueList,
  selectSim, LABS, cardToProblem, cardToWonder, checkCard, save} from './store.js'
import CardEditor from './components/CardEditor.vue'
import DashboardView from './views/DashboardView.vue'
import GraphView from './views/GraphView.vue'
import ModelsView from './views/ModelsView.vue'
import WonderView from './views/WonderView.vue'
import AiChatView from './views/AiChatView.vue'
import LabView from './views/LabView.vue'
import PracticeView from './views/PracticeView.vue'
import WrongView from './views/WrongView.vue'
import ToolboxView from './views/ToolboxView.vue'
import AboutView from './views/AboutView.vue'

const COMPS = {dashboard: DashboardView, graph: GraphView, models: ModelsView, wonder: WonderView, ai: AiChatView,
  lab: LabView, practice: PracticeView, wrong: WrongView, toolbox: ToolboxView, about: AboutView}
const viewComp = computed(() => COMPS[UI.view] || DashboardView)
const crumbTitle = computed(() => (META[UI.view] || META.dashboard)[0])
const crumbSub = computed(() => (META[UI.view] || META.dashboard)[1])
const dueCount = computed(() => dueList().length)
const accPct = computed(() => {
  const a = answered()
  return a.length ? Math.round(a.filter(x => x.correct).length / a.length * 100) : 0
})
const escKey = e => { if (e.key === 'Escape') { closeModal(); closeEditor() } }

function saveEditor() {
  const c = EDITOR.card
  if (!c || !EDITOR.onSave) { closeEditor(); return }
  const {blocking} = checkCard(c)
  if (blocking) { alert(blocking + '。'); return }
  const ok = EDITOR.onSave(c)
  if (ok === false) return
  save()
  closeEditor()
}

onMounted(() => {
  const v = (location.hash || '').replace(/^#/, '')
  if (META[v]) UI.view = v
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace(/^#/, '')
    if (META[h] && h !== UI.view) UI.view = h
  })
  window.addEventListener('keydown', escKey)
  if (!LABS.def) selectSim('proj')
  bootSync()
})
</script>

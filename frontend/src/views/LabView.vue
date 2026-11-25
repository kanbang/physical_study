<template>
  <section class="view active">
    <h2 class="sec">交互仿真室</h2>
    <p class="sub">所有轨迹由数值积分实时计算（RK4 / 半隐式），右侧读数同时给出解析解作对照。拖参数会重置当前实验。</p>
    <div class="labwrap">
      <div class="card pad" style="align-self:start">
        <h3 style="margin-bottom:8px">实验选择</h3>
        <div class="simlist">
          <button v-for="s in SIMS" :key="s.id" :class="{on:s.id===LABS.id}" @click="selectSim(s.id)">
            <b>{{ s.name }}</b><br><span class="tiny muted">{{ s.brief }}</span>
          </button>
        </div>
        <div class="divider"></div>
        <h3>参数</h3>
        <div>
          <div v-for="p in LABS.def.params" :key="p.k" class="param">
            <template v-if="p.type==='select'">
              <div class="pl"><span>{{ p.label }}</span></div>
              <select class="input" :value="LABS.params[p.k]" @change="setParam(p.k,$event.target.value,true)">
                <option v-for="o in p.options" :key="o.v" :value="o.v">{{ o.n }}</option>
              </select>
            </template>
            <template v-else>
              <div class="pl"><span>{{ p.label }}</span><b>{{ fmtNum(LABS.params[p.k],2) }} {{ p.unit }}</b></div>
              <input type="range" :min="p.min" :max="p.max" :step="p.step" :value="LABS.params[p.k]" @input="setParam(p.k,$event.target.value)">
            </template>
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn primary sm" @click="togglePlay">{{ LABS.playing ? '暂停' : '继续' }}</button>
          <button class="btn sm" @click="resetSim">重置</button>
          <select class="input" style="width:auto;padding:4px 8px;font-size:11.5px" v-model.number="LABS.speed">
            <option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option>
          </select>
        </div>
      </div>
      <div>
        <div class="canvasbox"><canvas id="simCanvas" ref="canvasEl"></canvas></div>
        <div class="card pad" style="margin-top:12px">
          <div class="spread"><h3>实时读数 · 数值解 vs 解析解</h3><span class="tag green">{{ timeTag }}</span></div>
          <div class="readouts">
            <div v-for="(r,i) in rows" :key="i" class="kv"><span class="k">{{ r[0] }}</span><span class="v">{{ r[1] }}</span></div>
          </div>
          <div class="simnote" v-html="LABS.def.note"></div>
          <div class="legend"><span v-for="(x,i) in LABS.def.legend" :key="i"><i :style="{background:x.c}"></i>{{ x.n }}</span></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import {ref, computed, onMounted, onUnmounted} from 'vue'
import {UI, LABS, selectSim, SIMS} from '../store.js'
import {fmtNum} from '../lib/canvasUtils.js'

const canvasEl = ref(null)
const rows = ref([])
const timeTag = computed(() => {
  const s = LABS.state; if (!s) return ''
  return LABS.id === 'mag' ? 'φ = ' + fmtNum(s.phi, 2) + ' rad' : 't = ' + fmtNum(s.t, 2) + ' s'
})

function setParam(k, v, isSelect) {
  LABS.params[k] = isSelect ? v : Number(v)
  LABS.state = LABS.def.init(LABS.params)
  updateReadouts(); draw()
}
function togglePlay() { LABS.playing = !LABS.playing }
function resetSim() { LABS.state = LABS.def.init(LABS.params); LABS.playing = true; updateReadouts(); draw() }

function fitCanvas() {
  const c = canvasEl.value; if (!c) return null
  const W = c.clientWidth, H = c.clientHeight
  if (W < 60 || H < 60) return null
  const dpr = window.devicePixelRatio || 1, nw = Math.round(W * dpr), nh = Math.round(H * dpr)
  if (c.width !== nw || c.height !== nh) { c.width = nw; c.height = nh }
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return {ctx, W, H}
}
function draw() {
  if (UI.view !== 'lab' || !LABS.def || !LABS.state) return
  const f = fitCanvas()
  if (f) LABS.def.draw(f.ctx, f.W, f.H, LABS.state, LABS.params)
}
function updateReadouts() {
  if (!LABS.def || !LABS.state) return
  rows.value = LABS.def.rows(LABS.state, LABS.params)
}
function tick(ts) {
  if (UI.view === 'lab') {
    if (!LABS.lastTs) LABS.lastTs = ts
    const real = Math.min(.08, (ts - LABS.lastTs) / 1000); LABS.lastTs = ts
    if (LABS.playing && real > 0) {
      const total = real * LABS.def.rate * LABS.speed
      const n = Math.max(1, Math.min(400, Math.ceil(total / (1 / 240)))), h = total / n
      for (let i = 0; i < n; i++) LABS.def.step(h, LABS.params, LABS.state)
    }
    draw()
    if (ts - LABS.lastUI > 110) { updateReadouts(); LABS.lastUI = ts }
  } else LABS.lastTs = 0
  rafId = requestAnimationFrame(tick)
}
let rafId = 0
const onResize = () => { if (UI.view === 'lab') draw() }

onMounted(() => {
  if (!LABS.def) selectSim('proj')
  updateReadouts()
  rafId = requestAnimationFrame(tick)
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', onResize)
})
</script>

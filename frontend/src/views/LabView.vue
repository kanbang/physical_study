<template>
  <section class="view active">
    <h2 class="sec">交互仿真室</h2>
    <p class="sub">轨迹由数值积分实时计算；可直接拖动画面中的小球、测力计，也可点「自动演示」看它自己来回变化。拖参数会重置当前实验。</p>
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
              <select class="input" :value="LABS.params[p.k]" @change="onParamChange(p,$event)">
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
          <button v-if="LABS.def.autoKey" class="btn sm" @click="toggleAuto">
            {{ LABS.params[LABS.def.autoKey] === 'auto' ? '✋ 手动控制' : '▶ 自动演示' }}
          </button>
          <button class="btn sm" @click="resetSim">重置</button>
          <select class="input" style="width:auto;padding:4px 8px;font-size:11.5px" v-model.number="LABS.speed">
            <option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option>
          </select>
        </div>
      </div>
      <div>
        <div class="canvasbox">
          <canvas id="simCanvas" ref="canvasEl" style="touch-action:none"
                  @pointerdown="onPointerDown" @pointermove="onPointerMove"
                  @pointerup="onPointerUp" @pointercancel="onPointerUp" @pointerleave="onPointerLeave"></canvas>
        </div>
        <p v-if="LABS.def.tip" class="tiny muted" style="margin:6px 0 0">{{ LABS.def.tip }}</p>
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
  // 拖控制类滑块时自动切到手动，避免自动演示立刻把角度抢回去
  const d = LABS.def
  if (d.autoKey && (d.manualKeys || []).includes(k)) LABS.params[d.autoKey] = 'manual'
  LABS.state = d.init(LABS.params)
  updateReadouts(); draw()
}
function onParamChange(p, e) {
  if (p.k === LABS.def.autoKey) setAuto(e.target.value)
  else setParam(p.k, e.target.value, false)
}
function setAuto(v) {
  const d = LABS.def
  if (!d || !d.autoKey) return
  if (v === 'manual') d.sync?.(LABS.params, LABS.state)
  LABS.params[d.autoKey] = v
  if (v === 'auto') LABS.playing = true
  updateReadouts(); draw()
}
function toggleAuto() { setAuto(LABS.params[LABS.def.autoKey] === 'auto' ? 'manual' : 'auto') }
function togglePlay() { LABS.playing = !LABS.playing }
function resetSim() { LABS.state = LABS.def.init(LABS.params); LABS.playing = true; updateReadouts(); draw() }

/* 画布直接拖拽：仿真可选暴露 pointer(kind,x,y,s,p,W,H)，kind = down/move/up/hover */
const dragging = {on: false}
function canvasXY(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return {x: e.clientX - r.left, y: e.clientY - r.top}
}
function onPointerDown(e) {
  const f = fitCanvas(); if (!f || !LABS.def.pointer) return
  const {x, y} = canvasXY(e)
  if (!LABS.def.pointer('down', x, y, LABS.state, LABS.params, f.W, f.H)) return
  dragging.on = true
  LABS.playing = false
  try { canvasEl.value.setPointerCapture(e.pointerId) } catch (err) {}
  canvasEl.value.style.cursor = 'grabbing'
  e.preventDefault(); updateReadouts(); draw()
}
function onPointerMove(e) {
  const f = fitCanvas(); if (!f || !LABS.def.pointer) return
  const {x, y} = canvasXY(e)
  const hit = LABS.def.pointer(dragging.on ? 'move' : 'hover', x, y, LABS.state, LABS.params, f.W, f.H)
  if (dragging.on) { e.preventDefault(); updateReadouts(); draw() }
  else canvasEl.value.style.cursor = hit ? 'grab' : 'default'
}
function onPointerUp(e) {
  if (!dragging.on) return
  const f = fitCanvas()
  if (f) LABS.def.pointer?.('up', 0, 0, LABS.state, LABS.params, f.W, f.H)
  dragging.on = false
  try { canvasEl.value.releasePointerCapture(e.pointerId) } catch (err) {}
  canvasEl.value.style.cursor = 'grab'
}
function onPointerLeave() {
  if (dragging.on) return
  if (LABS.state) { LABS.state.hover = null }
  if (canvasEl.value) canvasEl.value.style.cursor = 'default'
}

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

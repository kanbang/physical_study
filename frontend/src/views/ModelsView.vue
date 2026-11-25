<template>
  <section class="view active">
    <h2 class="sec">物理模型库</h2>
    <p class="sub">竞赛解题的本质是「识别模型 → 还原约束 → 选守恒量」。左侧选模型，右侧看识别信号、建模流程、关键方程与陷阱。</p>
    <div class="split">
      <div class="split-list">
        <div v-for="m in MODELS" :key="m.id" class="srow" :class="{on:m.id===sel}" @click="sel=m.id">
          <span class="tag orange">{{ m.level }}</span>
          <span class="t">{{ m.name }}</span>
        </div>
      </div>
      <div class="split-detail card pad" v-if="model">
        <div class="row">
          <span class="tag orange">{{ model.level }}</span>
          <span style="font-size:15px;font-weight:700">{{ model.name }}</span>
        </div>
        <div class="blk"><label>识别信号</label><div class="notice"><MathText :text="model.signal" /></div></div>
        <div class="blk"><label>建模流程</label><ol class="clean"><li v-for="(x,i) in model.steps" :key="i"><MathText :text="x" /></li></ol></div>
        <div class="blk"><label>关键方程</label><div v-for="(x,i) in model.eq" :key="i" style="margin-bottom:6px"><span class="eq"><MathText :text="x" block /></span></div></div>
        <div class="blk"><label>常见陷阱</label><ul class="clean"><li v-for="(x,i) in model.traps" :key="i"><MathText :text="x" /></li></ul></div>
        <div class="blk"><label>一句话策略</label><div class="notice ok"><MathText :text="model.tactic" /></div></div>
        <div class="blk" v-if="model.problems.length">
          <label>配套练习</label>
          <div class="row">
            <button v-for="pid in model.problems" :key="pid" class="btn sm" @click="openProblem(pid)">去练：{{ probName(pid) }}</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import {ref, computed} from 'vue'
import {MODELS, openProblem, findProblem} from '../store.js'
import MathText from '../components/MathText.vue'

const sel = ref(MODELS[0].id)
const model = computed(() => MODELS.find(m => m.id === sel.value))
const probName = pid => { const p = findProblem(pid); return p ? p.title : pid }
</script>

<style scoped>
.blk{margin-top:14px}
.blk>label{display:block;font-size:11px;letter-spacing:1px;color:var(--ink3);margin-bottom:6px}
</style>

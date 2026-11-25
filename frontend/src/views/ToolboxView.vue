<template>
  <section class="view active">
    <h2 class="sec">解题工具箱</h2>
    <p class="sub">量纲是竞赛里最便宜的验算：先查量纲，再查极限，最后才代入数字。</p>
    <div class="grid g2">
      <div class="card pad">
        <div class="spread"><h3>量纲分析器</h3><span class="tag blue">支持 + − × ÷ ^ sqrt() =</span></div>
        <p class="tiny muted" style="margin:6px 0 10px">输入表达式或等式，例如 <code>F = m*a</code>、<code>T = 2*pi*sqrt(L/g)</code>。加减项量纲必须相同，乘除按指数运算。</p>
        <input class="input mono" v-model="dimExpr" placeholder="输入表达式">
        <div class="row" style="margin-top:9px">
          <button v-for="e in examples" :key="e" class="btn sm" @click="dimExpr=e">{{ e }}</button>
        </div>
        <div class="resultbox" v-if="dimResult" :class="{err:dimResult.err}">
          <template v-if="dimResult.err"><b style="color:var(--err)">✗ {{ dimResult.err }}</b></template>
          <template v-else>
            <div v-for="(d,i) in dimResult.parts" :key="i" class="kv">
              <span class="k mono">{{ d.src }}</span>
              <span class="v">{{ dimStr(d.dim) }}<template v-if="d.name"> · {{ d.name }}</template></span>
            </div>
            <div class="notice" :class="dimResult.ok?'ok':'err'" style="margin-top:10px">{{ dimResult.note }}</div>
          </template>
        </div>
        <div class="divider"></div>
        <details>
          <summary class="tiny" style="cursor:pointer;color:var(--brand)">可用变量与量纲（点击展开）</summary>
          <table class="dimtable" style="width:100%;margin-top:8px">
            <thead><tr><th>变量</th><th>含义</th><th>量纲</th></tr></thead>
            <tbody>
              <tr v-for="(v,k) in DIMVARS" :key="k"><td class="mono"><b>{{ k }}</b></td><td>{{ v[7] }}</td><td class="mono">{{ dimStr(v) }}</td></tr>
            </tbody>
          </table>
        </details>
      </div>
      <div class="card pad">
        <h3>物理常数速查</h3>
        <input class="input" v-model="constQ" placeholder="搜索常数…" style="margin:8px 0 10px">
        <div style="max-height:230px;overflow:auto">
          <div v-for="(c,i) in constRows" :key="i" class="kv"><span class="k">{{ c[0] }}</span><span class="v">{{ c[1] }} {{ c[2] }}</span></div>
          <div v-if="!constRows.length" class="empty">没有匹配的常数。</div>
        </div>
        <div class="divider"></div>
        <h3>解题自检清单</h3>
        <div style="margin-top:8px">
          <div v-for="(c,i) in CHECKLIST" :key="i" class="check"><span class="tag">{{ i+1 }}</span><span>{{ c }}</span></div>
        </div>
      </div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card pad">
        <h3>竞赛常用近似与展开</h3>
        <div style="margin-top:8px">
          <div v-for="(a,i) in APPROX" :key="i" class="kv"><span class="k mono">{{ a[0] }}</span><span class="v" style="font-family:inherit;font-weight:400;color:var(--ink2)">{{ a[1] }}</span></div>
        </div>
      </div>
      <div class="card pad">
        <h3>常用微元与积分结论</h3>
        <div style="margin-top:8px">
          <div v-for="(a,i) in INTEGRALS" :key="i" class="kv"><span class="k mono">{{ a[0] }}</span><span class="v" style="font-family:inherit;font-weight:400;color:var(--ink2)">{{ a[1] }}</span></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import {ref, computed, watch} from 'vue'
import {CONSTANTS, CHECKLIST, APPROX, INTEGRALS} from '../data/misc.js'
import {analyzeDim, dimStr, DIMVARS} from '../lib/expr.js'

const examples = ['F = m*a', 'E = 0.5*m*v^2', 'T = 2*pi*sqrt(L/g)', 'r = m*v/(q*B)', 'P = U*I', 'v + a']
const dimExpr = ref('F = m*a')
const dimResult = ref(null)
const constQ = ref('')

function runDim() {
  try {
    const r = analyzeDim(dimExpr.value)
    const parts = dimExpr.value.split('=').map((src, i) => ({src: src.trim(), dim: r.dims[i], name: r.names[i]}))
    dimResult.value = {ok: r.ok, note: r.note, parts}
  } catch (e) {
    dimResult.value = {err: e.message}
  }
}
watch(dimExpr, runDim, {immediate: true})

const constRows = computed(() => {
  const s = constQ.value.trim().toLowerCase()
  return CONSTANTS.filter(c => !s || c.join(' ').toLowerCase().includes(s))
})
</script>

<style scoped>
.resultbox.err{border-color:var(--err)}
</style>

<template>
  <div class="cardform">
    <template v-if="card.kind === 'problem'">
      <div v-if="card.summary" class="tiny muted">{{ card.summary }}</div>
      <div class="blk2"><label>标题</label><input class="input" v-model="card.problem.title" maxlength="40"></div>
      <div class="grid g2" style="margin-top:9px">
        <div><label>难度</label><select class="input" v-model="card.problem.level"><option value="初中">初中</option><option value="高中">高中</option></select></div>
        <div><label>领域</label><select class="input" v-model="card.problem.dom"><option v-for="d in DOMAINS" :key="d" :value="d">{{ d }}</option></select></div>
      </div>
      <div class="blk2"><label>题干（公式可直接写 LaTeX：$v_0=\sqrt{2gh}$）</label><textarea class="input" rows="4" v-model="card.problem.text"></textarea></div>
      <div class="blk2"><label>提示（每行一条，最多 6 条）</label>
        <textarea class="input" rows="3" :value="joinLines(card.problem.hints)" @input="card.problem.hints = splitLines($event.target.value)"></textarea>
      </div>
      <div class="blk2"><label>标准答案（填入你核验过的数值；留空则不能自动判分）</label>
        <div v-for="n in 3" :key="n" class="ansrow">
          <input class="input" placeholder="所求量名称" v-model="card.problem.answers[n-1].label">
          <input class="input mono" placeholder="数值" style="max-width:110px" v-model="card.problem.answers[n-1].value">
          <input class="input mono" placeholder="单位" style="max-width:80px" v-model="card.problem.answers[n-1].unit">
        </div>
      </div>
      <div class="blk2"><label>分步解析（每行一步）</label>
        <textarea class="input" rows="3" :value="joinLines(card.problem.solution)" @input="card.problem.solution = splitLines($event.target.value)"></textarea>
      </div>
      <div class="blk2"><label>易错点</label><input class="input" v-model="card.problem.trap"></div>
    </template>

    <template v-else>
      <div v-if="card.summary" class="tiny muted">{{ card.summary }}</div>
      <div class="blk2"><label>标题</label><input class="input" v-model="card.wonder.title" maxlength="40"></div>
      <div class="grid g2" style="margin-top:9px">
        <div><label>类别</label><input class="input" v-model="card.wonder.realm" placeholder="光学 / 力学 / 日常…"></div>
        <div><label>等级</label><select class="input" v-model="card.wonder.level"><option>入门</option><option>进阶</option><option>脑洞</option></select></div>
      </div>
      <div class="blk2"><label>直觉陷阱</label><textarea class="input" rows="2" v-model="card.wonder.hook"></textarea></div>
      <div class="blk2"><label>先想一想（每行一条）</label>
        <textarea class="input" rows="2" :value="joinLines(card.wonder.think)" @input="card.wonder.think = splitLines($event.target.value)"></textarea>
      </div>
      <div class="blk2"><label>揭晓</label><textarea class="input" rows="4" v-model="card.wonder.reveal"></textarea></div>
      <div class="blk2"><label>关键公式（写 LaTeX，如 $R=\frac{v_0^2\sin 2\theta}{g}$）</label><input class="input" v-model="card.wonder.formula"></div>
      <div class="blk2" v-if="card.wonder.formula"><label>公式预览</label><div class="eq"><MathText :text="card.wonder.formula" block /></div></div>
      <div class="blk2"><label>动手试试</label><textarea class="input" rows="2" v-model="card.wonder.tryIt"></textarea></div>
      <div class="blk2"><label>更奇妙的是</label><textarea class="input" rows="2" v-model="card.wonder.deeper"></textarea></div>
    </template>

    <div class="notice warn" style="margin-top:11px;font-size:11.5px">{{ note || '内容未经过独立核验；请确认公式、数值与适用条件。' }}</div>
  </div>
</template>

<script setup>
import {watch} from 'vue'
import {DOMAINS, padCard} from '../store.js'
import MathText from './MathText.vue'

const props = defineProps({
  card: {type: Object, required: true},
  note: {type: String, default: ''}
})

const joinLines = arr => (arr || []).join('\n')
const splitLines = s => s.split('\n').map(x => x.trim()).filter(Boolean)

/* 答案数组补齐到 3 行，模板才能直接 v-model 到具体下标 */
watch(() => props.card, c => padCard(c), {immediate: true, deep: false})
</script>

<style scoped>
.cardform{margin-top:6px}
.blk2{margin-top:9px}
.blk2>label,.cardform label{display:block;font-size:11.5px;color:var(--ink3);margin-bottom:4px}
.ansrow{display:flex;gap:8px;margin-bottom:7px}
</style>

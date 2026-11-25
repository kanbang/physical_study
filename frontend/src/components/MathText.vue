<template>
  <span v-if="block" class="mathblock" v-html="blockHtml"></span>
  <span v-else class="mathtext"><template v-for="(p, i) in parts" :key="i"><span v-if="p.tex" class="mathpart" v-html="p.html"></span><span v-else>{{ p.text }}</span></template></span>
</template>

<script setup>
import {computed} from 'vue'
import {autoTex, renderMath, toSegments, stripDelims} from '../lib/tex.js'

const props = defineProps({
  text: {type: String, default: ''},
  block: {type: Boolean, default: false},
})

/* 先剥掉整段 $…$ / $$…$$ 再走 Unicode→LaTeX，否则"整条公式带美元符"会整段标红 */
const blockHtml = computed(() => renderMath(autoTex(stripDelims(props.text)), true))
const parts = computed(() => toSegments(props.text))
</script>

<style scoped>
.mathtext { white-space: pre-line; }
.mathtext :deep(.katex) { font-size: 1.02em; }
.mathblock { display: block; text-align: center; margin: 9px 0; }
.mathblock :deep(.katex) { font-size: 1.12em; }
.mathblock :deep(.katex-display) { margin: .15em 0; }
.mathfail { font-family: var(--mono); }
</style>

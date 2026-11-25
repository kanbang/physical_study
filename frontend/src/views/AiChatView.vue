<template>
  <section class="view active">
    <h2 class="sec">AI 助手 · 把想法和题目整理入库</h2>
    <p class="sub">把你遇到的题目、冒出来的想法发给 AI，它会整理成卡片草稿；你核对、修改、补全后，一键添加到分级训练场或奇思妙想。未配置在线 AI 时自动使用本地规则模式（只搭骨架，不编答案）。</p>

    <div class="card pad">
      <div class="spread">
        <h3>对话</h3>
        <span class="tag" :class="modeClass">{{ modeText }}</span>
      </div>
      <div class="chatbox" ref="chatBoxEl" style="margin-top:10px">
        <div v-if="!msgs.length" class="empty" style="padding:20px 10px">跟我说说你遇到的题目，或某个觉得奇怪的物理现象。<br>AI 会整理成草稿卡片 —— 你核对补全后，才入库到对应栏目。</div>
        <template v-for="(m,i) in msgs" :key="i">
          <div v-if="m.role==='user'" class="chatmsg user">{{ m.text }}
            <div class="meta">{{ new Date(m.ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }}</div>
          </div>
          <div v-else class="chatmsg bot"><MathText :text="m.text" />
            <div v-if="m.err" class="notice warn" style="margin-top:8px;font-size:11.8px;line-height:1.75">
              <b>在线 AI 未成功</b><span v-if="m.err.status"> · HTTP {{ m.err.status }}</span><span v-if="m.err.code"> · {{ m.err.code }}</span>
              <br>{{ m.err.message }}
              <br v-if="m.err.hint"><b>怎么办：</b>{{ m.err.hint }}
              <div class="row" style="margin-top:6px"><button class="btn sm" @click="focusSettings">去设置</button></div>
            </div>
            <div v-if="m.card" class="cardform">
              <div v-if="m.card.added" class="notice ok">已添加到「{{ m.card.added==='practice' ? '分级训练场' : '奇思妙想' }}」，可在栏目内继续修改。</div>
              <template v-else>
                <h4>{{ m.card.kind==='problem' ? '卡片草稿 · 训练场题目' : '卡片草稿 · 奇思妙想' }}</h4>
                <CardEditor :card="m.card" />
                <div class="row" style="margin-top:10px">
                  <button class="btn primary sm" @click="addCard(i)">{{ m.card.kind==='problem' ? '核对无误，添加到训练场' : '核对无误，添加到奇思妙想' }}</button>
                  <button class="btn sm" @click="m.card=null">丢弃草稿</button>
                </div>
              </template>
            </div>
            <div class="meta">
              <span v-if="m.mode==='ai'" class="tag blue">在线 AI · {{ m.model }}</span>
              <span v-else-if="m.mode==='error'" class="tag red">服务不可用</span>
              <span v-else class="tag">本地规则模式</span>
              <span>{{ new Date(m.ts).toLocaleString('zh-CN') }}</span>
            </div>
          </div>
        </template>
      </div>
      <div class="divider"></div>
      <div class="row" style="margin-bottom:9px;flex-wrap:wrap">
        <button v-for="(q,i) in QUICK" :key="i" class="btn sm" @click="draft=q[0]">{{ q[0] }}</button>
      </div>
      <div class="row" style="align-items:flex-end;gap:9px">
        <textarea class="input" rows="3" style="flex:1" v-model="draft" @keydown.ctrl.enter.prevent="send" @keydown.meta.enter.prevent="send" placeholder="例如：我今天遇到一道题：光滑斜面高 1.8 m，滑块从顶端滑下，求底端速度……&#10;或者：我一直好奇，为什么地铁急刹车时吊环会向前摆？"></textarea>
        <button class="btn primary" :disabled="busy" @click="send">{{ busy ? '思考中…' : '发送' }}</button>
      </div>
      <div class="tiny muted" style="margin-top:7px">Ctrl+Enter 发送。对话记录随学习数据保存并同步；AI 生成的卡片入库前必须人工核对，数值答案未被独立核验。</div>
    </div>

    <div class="card pad" style="margin-top:14px">
      <details ref="settingsEl">
        <summary style="cursor:pointer;color:var(--brand);font-size:13px;font-weight:650">在线 AI 服务设置（可选）</summary>
        <p class="tiny muted" style="margin:9px 0">点选服务商快速填入接口地址与模型，粘贴你的 API Key 即可。接口地址支持三种写法，都能用：<code>https://api.deepseek.com/v1</code>（只到版本号）、<code>https://moma.cmecloud.cn/v1/chat/completions</code>（完整调用地址）、<code>https://xxx/v1/messages</code>（Anthropic 风格）。保存后点「测试连接」可直接看到失败原因与修复建议。配置保存在服务端 <code>data/ai_config.json</code>；也可用环境变量 <code>AI_BASE_URL / AI_API_KEY / AI_MODEL</code> 覆盖。不配置则使用本地规则模式。</p>
        <div class="row" style="flex-wrap:wrap;margin-bottom:10px">
          <button v-for="p in AI_PRESETS" :key="p.id" class="chip" :class="{on:preset===p.id}" @click="applyPreset(p)">{{ p.name }}</button>
        </div>
        <div class="grid g2">
          <div><label class="tiny muted">接口地址 base_url</label><input class="input mono" style="margin-top:4px" v-model="cfgBase" placeholder="https://api.deepseek.com/v1"></div>
          <div>
            <label class="tiny muted">模型名 model
              <button class="btn sm" style="float:right;padding:1px 7px;font-size:11px" :disabled="testing" @click="pullModels">拉取模型列表</button>
            </label>
            <select v-if="modelOptions.length && cfgModel!=='__custom__'" class="input mono" style="margin-top:4px" v-model="cfgModel">
              <option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</option>
              <option value="__custom__">手动输入…</option>
            </select>
            <input v-else class="input mono" style="margin-top:4px" v-model="cfgModelCustom" placeholder="deepseek-chat">
            <button v-if="modelOptions.length && cfgModel==='__custom__'" class="btn sm" style="margin-top:5px" @click="cfgModel=''">从列表选</button>
          </div>
        </div>
        <div style="margin-top:9px"><label class="tiny muted">API Key（{{ AICFG.has_key ? '已保存 · ' : '' }}留空则保持已保存的密钥不变）</label><input class="input mono" type="password" style="margin-top:4px" v-model="cfgKey" placeholder="sk-…"></div>
        <div class="row" style="margin-top:11px;flex-wrap:wrap">
          <button class="btn primary sm" :disabled="saving" @click="saveCfg">{{ saving ? '保存中…' : '保存配置' }}</button>
          <button class="btn sm" :disabled="testing" @click="runTest">{{ testing ? '测试中…' : '测试连接' }}</button>
          <span class="tiny muted" v-if="cfgMsg">{{ cfgMsg }}</span>
        </div>
        <div v-if="testRes" class="notice" :class="testRes.connected ? 'ok' : 'warn'" style="margin-top:10px;font-size:12px;line-height:1.8">
          <b>{{ testRes.connected ? '连接正常' : '连接失败' }}</b>
          <span v-if="testRes.connected"> · {{ testRes.model }} · {{ testRes.ms }} ms · 回显「{{ testRes.reply }}」</span>
          <template v-else-if="testRes.detail">
            <br><span class="mono">{{ testRes.detail.status ? 'HTTP ' + testRes.detail.status : '网络' }}{{ testRes.detail.code ? ' · ' + testRes.detail.code : '' }}</span>
            <br>{{ testRes.detail.message }}
            <br v-if="testRes.detail.hint"><b>怎么办：</b>{{ testRes.detail.hint }}
            <br v-if="testRes.detail.endpoint"><span class="tiny muted">请求地址：{{ testRes.detail.endpoint }}</span>
          </template>
        </div>
      </details>
    </div>
  </section>
</template>

<script setup>
import {ref, computed, onMounted, nextTick} from 'vue'
import {DB, SYNC, openModal, closeModal, AICFG, AI_PRESETS, loadAIConfig, saveAIConfig, aiChat, save,
  testAI, fetchAIModels,
  cardToProblem, cardToWonder, checkCard, padCard, openProblem, openWonder,
  stampNew, findSimilar} from '../store.js'
import MathText from '../components/MathText.vue'
import CardEditor from '../components/CardEditor.vue'

const QUICK = [
  ['我遇到一道题：'],
  ['我有个想法：为什么……'],
  ['帮我理解一个概念：']
]
const draft = ref('')
const busy = ref(false)
const chatBoxEl = ref(null)
const settingsEl = ref(null)
const preset = ref('')
const cfgBase = ref('')
const cfgModel = ref('')
const cfgModelCustom = ref('')
const cfgKey = ref('')
const cfgMsg = ref('')
const saving = ref(false)
const testing = ref(false)
const testRes = ref(null)
const remoteModels = ref([])

const msgs = computed(() => DB.ai.msgs)
const modeText = computed(() => {
  if (!SYNC.online) return '后端未连接'
  if (!AICFG.loaded) return '检测中…'
  return AICFG.configured ? '在线 AI · ' + AICFG.model : '本地规则模式（未配置）'
})
const modeClass = computed(() => !SYNC.online ? 'red' : AICFG.configured ? 'blue' : '')
const presetModels = computed(() => {
  const p = AI_PRESETS.find(x => x.id === preset.value)
  return p ? p.models : []
})
/* 下拉候选项：优先用服务端 /models 拉到的真实列表，并保证当前填写的模型一定在选项里 */
const modelOptions = computed(() => {
  const base = remoteModels.value.length ? remoteModels.value : presetModels.value
  const out = base.slice()
  const cur = cfgModel.value
  if (cur && cur !== '__custom__' && !out.includes(cur)) out.unshift(cur)
  return out
})
const curModel = () => (cfgModel.value && cfgModel.value !== '__custom__' ? cfgModel.value : cfgModelCustom.value)

const lines = arr => (arr || []).join('\n')

function applyPreset(p) {
  preset.value = p.id
  remoteModels.value = []
  testRes.value = null
  if (p.base) cfgBase.value = p.base
  cfgModel.value = p.models.length ? p.models[0] : '__custom__'
  cfgModelCustom.value = ''
}
async function runTest() {
  testing.value = true; testRes.value = null; cfgMsg.value = ''
  try {
    const r = await testAI(cfgBase.value, curModel(), cfgKey.value)
    testRes.value = r
    if (r.connected) cfgMsg.value = '测试通过，记得点「保存配置」'
  } catch (e) {
    testRes.value = {connected: false, detail: {status: null, code: 'request_failed', message: e.message, hint: '确认后端服务在线（poetry run python app.py）', endpoint: ''}}
  }
  testing.value = false
}
async function pullModels() {
  testing.value = true; cfgMsg.value = ''
  try {
    const r = await fetchAIModels()
    if (r.ok && r.models && r.models.length) {
      remoteModels.value = r.models
      cfgMsg.value = '拉到 ' + r.models.length + ' 个模型，从下拉里选一个'
      if (!curModel()) cfgModel.value = r.models[0]
    } else {
      cfgMsg.value = '拉取失败：' + (r.error || '未知原因') + (r.detail && r.detail.hint ? '（' + r.detail.hint + '）' : '')
    }
  } catch (e) {
    cfgMsg.value = '拉取失败：' + e.message
  }
  testing.value = false
}
async function saveCfg() {
  saving.value = true; cfgMsg.value = ''
  try {
    const r = await saveAIConfig(cfgBase.value, curModel(), cfgKey.value)
    cfgMsg.value = r.configured ? '已保存：在线 AI（' + r.model + '）' : '已保存：密钥/模型未填全，仍为本地规则模式'
    cfgKey.value = ''
    testRes.value = null
  } catch (e) { cfgMsg.value = '保存失败：' + e.message }
  saving.value = false
}

async function send() {
  if (busy.value) return
  const text = draft.value.trim()
  if (!text) return
  DB.ai.msgs.push({role: 'user', text, ts: Date.now()})
  if (DB.ai.msgs.length > 60) DB.ai.msgs = DB.ai.msgs.slice(-60)
  draft.value = ''
  await scrollBottom()
  busy.value = true
  try {
    const hist = DB.ai.msgs.slice(-16).map(m => ({role: m.role, content: m.text}))
    const r = await aiChat(hist)
    const clean = String(r.reply || '').replace(/^（在线 AI 未成功：[\s\S]*?）\n/, '')
    const msg = {role: 'assistant', text: clean || '（空回复）', card: r.card || null, mode: r.mode, model: r.model, err: r.error || null, ts: Date.now()}
    padCard(msg.card)
    DB.ai.msgs.push(msg)
  } catch (e) {
    DB.ai.msgs.push({role: 'assistant', text: 'AI 服务不可用：' + e.message + '\nAI 对话需要后端服务在线（poetry run python app.py）。', mode: 'error', ts: Date.now()})
  }
  if (DB.ai.msgs.length > 60) DB.ai.msgs = DB.ai.msgs.slice(-60)
  save()
  await scrollBottom()
  busy.value = false
}

function addCard(i) {
  const m = DB.ai.msgs[i]
  if (!m || !m.card) return
  const c = m.card
  const {blocking, warning} = checkCard(c)
  if (blocking) { alert(blocking + '。'); return }
  if (warning && !confirm(warning + '。\n\n确定仍要入库吗？')) return
  const sim = findSimilar(c.kind, c)
  if (sim) {
    const title = esc(sim.item.title || '（无标题）')
    openModal('<h3>可能已经在库里了</h3><p>检测到一张「' + sim.why + '」的卡片：<b>' + title + '</b>（相似度 ' +
      Math.round(sim.score * 100) + '%）。<br>同一内容反复入库会让「我的题库」变乱 —— 建议先核对已有条目，确认真是新内容再添加。</p>',
      [
        {label: '去看已有条目', fn: () => { closeModal(); c.kind === 'problem' ? openProblem(sim.item.id) : openWonder(sim.item.id) }},
        {label: '仍然添加', fn: () => { closeModal(); doAdd(c) }},
        {label: '取消', fn: closeModal}
      ])
    return
  }
  doAdd(c)
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]))
function doAdd(c) {
  if (c.kind === 'problem') {
    const id = 'cp' + Date.now().toString(36)
    DB.custom.problems.push(stampNew(cardToProblem(c, id), 'ai'))
    c.added = 'practice'
    finishAdd('practice', '题目已加入「我的题库」，状态为「待核验」—— 核对数值后点「标记已核验」，才算你自己的可信题。', () => openProblem(id))
  } else {
    const id = 'cw' + Date.now().toString(36)
    DB.custom.wonders.push(stampNew(cardToWonder(c, id), 'ai'))
    c.added = 'wonder'
    finishAdd('wonder', '已加入奇思妙想（待核验），可以在里面继续补充揭晓或动手实验。', () => openWonder(id))
  }
}
function finishAdd(dest, tip, jump) {
  save()
  openModal('<h3>已入库</h3><p>卡片已加入「' + (dest === 'practice' ? '分级训练场 · 我的题库' : '奇思妙想') +
    '」，栏目内会显示「我添加」标签，之后随时可以改。<br>' + tip + '</p>',
    [
      {label: '去看看', fn: () => { closeModal(); jump() }},
      {label: '继续聊天', fn: closeModal}
    ])
}

function focusSettings() {
  const d = settingsEl.value
  if (d) { d.open = true; d.scrollIntoView({behavior: 'smooth', block: 'center'}) }
}

async function scrollBottom() {
  await nextTick()
  if (chatBoxEl.value) chatBoxEl.value.scrollTop = chatBoxEl.value.scrollHeight
}

onMounted(() => {
  DB.ai.msgs.forEach(m => padCard(m.card))
  if (AICFG.base_url) { cfgBase.value = AICFG.base_url; cfgModel.value = AICFG.model || ''; cfgModelCustom.value = AICFG.model || '' }
  loadAIConfig().then(() => {
    if (AICFG.base_url) {
      if (!cfgBase.value) cfgBase.value = AICFG.base_url
      if (!cfgModel.value) cfgModel.value = AICFG.model || ''
      if (!cfgModelCustom.value) cfgModelCustom.value = AICFG.model || ''
    }
  })
  scrollBottom()
})
</script>

<template>
  <section class="view active">
    <h2 class="sec">奇思妙想 · 物理比想象中更奇怪</h2>
    <p class="sub">没有标准答案要填，只有「先猜一猜 → 再揭晓 → 回家动手试」。左侧选一题，右侧展开完整旅程；猜想可以分享到服务端猜想墙。</p>
    <div class="card pad" style="margin-bottom:14px;background:linear-gradient(100deg,#fffaf3,#ffffff)">
      <div class="spread">
        <div><h3>奇妙进度</h3><div class="tiny muted">已揭晓 {{ revCount }} / {{ wonders.length }} 个奇妙 · 收藏 {{ favCount }} 个</div></div>
        <button class="btn sm" @click="randomPick">随机来一题</button>
      </div>
      <div class="bar" style="margin-top:10px"><i :style="{width:pct+'%'}"></i></div>
    </div>
    <div class="split">
      <div>
        <div class="card pad" style="margin-bottom:10px">
          <div class="row" style="flex-wrap:wrap">
            <button v-for="r in realms" :key="r" class="chip" :class="{on:UI.wonderRealm===r}" @click="UI.wonderRealm=r">{{ r }}</button>
          </div>
        </div>
        <div class="split-list" style="max-height:calc(100vh - 400px)">
          <div v-for="w in list" :key="w.id" class="srow" :class="{on:w.id===sel}" @click="sel=w.id">
            <span class="tag orange">{{ w.realm }}</span>
            <span class="t">{{ w.title }}</span>
            <span v-if="DB.wonder.revealed[w.id]" class="tag green">已揭晓</span>
          </div>
        </div>
      </div>
      <div class="split-detail card pad" v-if="cur">
        <div class="spread">
          <div class="row">
            <span class="tag orange">{{ cur.realm }}</span>
            <span class="tag" :class="cur.level==='脑洞'?'blue':''">{{ cur.level }}</span>
            <span v-if="cur.custom" class="tag orange">我添加</span>
            <span v-if="cur.custom && !verified(cur)" class="tag red">待核验</span>
            <span v-else-if="cur.custom" class="tag green">已核验</span>
          </div>
          <div class="row">
            <button v-if="cur.custom && !verified(cur)" class="btn sm" @click="verifyItem('wonder',cur.id,true)">标记已核验</button>
            <button v-if="cur.custom && verified(cur)" class="btn sm" @click="verifyItem('wonder',cur.id,false)">撤销核验</button>
            <button v-if="cur.custom" class="btn sm" @click="editCustom(cur)">编辑</button>
            <button v-if="cur.custom" class="btn sm" @click="removeCustom(cur.id)">移除</button>
            <button class="btn sm" @click="toggleFav">{{ DB.wonder.fav[cur.id] ? '已收藏' : '收藏' }}</button>
          </div>
        </div>
        <h3 style="margin:10px 0 8px;font-size:15px">{{ cur.title }}</h3>
        <div class="notice warn"><MathText :text="cur.hook" /></div>
        <div class="lb">先想一想</div>
        <ol class="clean"><li v-for="(x,i) in cur.think" :key="i"><MathText :text="x" /></li></ol>
        <div class="lb">你的猜想（自动同步到服务端）</div>
        <textarea class="input" rows="2" v-model="DB.wonder.notes[cur.id]" placeholder="先别查资料，写下第一反应…"></textarea>
        <div class="row" style="margin-top:9px">
          <button class="btn sm" @click="share">分享到猜想墙</button>
          <button class="btn primary sm" @click="toggleReveal">{{ DB.wonder.revealed[cur.id] ? '收起谜底' : '揭晓谜底' }}</button>
        </div>
        <div class="tiny muted" style="margin-top:6px" v-if="shareMsg" v-html="shareMsg"></div>
        <div v-if="DB.wonder.revealed[cur.id]" class="sol">
          <b style="color:var(--brand)">揭晓</b>
          <p style="font-size:13px;line-height:1.95;color:var(--ink2);margin:7px 0"><MathText :text="cur.reveal" /></p>
          <span class="eq"><MathText :text="cur.formula" block /></span>
          <div class="lb">动手试试</div>
          <div class="notice ok"><MathText :text="cur.tryIt" /></div>
          <div class="lb">更奇妙的是</div>
          <p style="font-size:13px;line-height:1.9;color:var(--ink2);margin:0"><MathText :text="cur.deeper" /></p>
        </div>
        <template v-if="cur.topics && cur.topics.length">
          <div class="lb">关联知识点</div>
          <div class="row">
            <template v-for="tid in cur.topics" :key="tid">
              <button v-if="topicById(tid)" class="btn sm" @click="jumpTopic(tid)">{{ topicById(tid).name }}</button>
            </template>
          </div>
        </template>
      </div>
    </div>
    <div class="card pad" style="margin-top:14px">
      <div class="spread"><h3>共享猜想墙 <span class="tiny muted">服务端存储 · 所有访问者可见</span></h3><button class="btn sm" @click="refreshIdeas">刷新</button></div>
      <div style="margin-top:10px">
        <div v-if="!SYNC.online" class="empty">后端服务未连接，猜想墙需要服务端存储。运行 <code>poetry run python app.py</code> 后点击顶部「仅本机缓存」重试。</div>
        <div v-else-if="!SYNC.ideas.length" class="empty">还没有人分享猜想。在上面写下你的第一反应，点「分享到猜想墙」就能成为第一条。</div>
        <div v-for="it in SYNC.ideas.slice(0,10)" :key="it.id" style="padding:9px 0;border-bottom:1px dashed var(--line);display:flex;gap:10px;align-items:flex-start">
          <span class="tag orange" style="flex:0 0 auto">{{ realmOf(it.wid) }}</span>
          <div style="flex:1">
            <div style="font-size:12.8px">{{ it.text }}</div>
            <div class="tiny muted">关于「{{ titleOf(it.wid) }}」 · {{ new Date(it.ts).toLocaleString('zh-CN') }}</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import {ref, computed, watch} from 'vue'
import {UI, DB, SYNC, wonders, findWonder, go, openTopic, postIdea, loadIdeas, TOPICS, save,
  openEditor, wonderToCard, cardToWonder, metaOf, verifyItem, restamp} from '../store.js'
import MathText from '../components/MathText.vue'
import {escHtml} from '../lib/tex.js'

const sel = ref(UI.focusWonder || (wonders.value[0] ? wonders.value[0].id : null))
watch(() => UI.focusWonder, id => { if (id) sel.value = id })
const shareMsg = ref('')
const realms = computed(() => ['全部'].concat(Array.from(new Set(wonders.value.map(w => w.realm)))))
const list = computed(() => wonders.value.filter(w => UI.wonderRealm === '全部' || w.realm === UI.wonderRealm))
const cur = computed(() => sel.value ? findWonder(sel.value) : null)
const revCount = computed(() => wonders.value.filter(w => DB.wonder.revealed[w.id]).length)
const favCount = computed(() => wonders.value.filter(w => DB.wonder.fav[w.id]).length)
const pct = computed(() => Math.round(revCount.value / wonders.value.length * 100))

function topicById(tid) { return TOPICS.find(t => t.id === tid) }
function jumpTopic(tid) { if (topicById(tid)) openTopic(tid) }
function toggleFav() { if (!cur.value) return; const id = cur.value.id; DB.wonder.fav[id] = !DB.wonder.fav[id] }
function toggleReveal() { if (!cur.value) return; const id = cur.value.id; DB.wonder.revealed[id] = !DB.wonder.revealed[id] }
function randomPick() {
  const w = wonders.value[Math.floor(Math.random() * wonders.value.length)]
  UI.wonderRealm = '全部'; sel.value = w.id
}
async function share() {
  if (!cur.value) return
  const text = (DB.wonder.notes[cur.value.id] || '').trim()
  if (!text) { shareMsg.value = '<span style="color:var(--err)">先写一句猜想再分享。</span>'; return }
  shareMsg.value = '正在发布…'
  const r = await postIdea(cur.value.id, text)
  shareMsg.value = r.ok ? '<span style="color:var(--ok)">已发布到共享猜想墙。</span>' : '<span style="color:var(--warn)">' + escHtml(r.msg) + '</span>'
}
async function refreshIdeas() { await loadIdeas() }
function realmOf(wid) { const w = findWonder(wid); return w ? w.realm : '其他' }
function titleOf(wid) { const w = findWonder(wid); return w ? w.title : wid }
function removeCustom(id) {
  const i = DB.custom.wonders.findIndex(w => w.id === id)
  if (i >= 0) { DB.custom.wonders.splice(i, 1); sel.value = wonders.value[0] ? wonders.value[0].id : null; save() }
}
const verified = w => metaOf(w).status === 'verified'
function editCustom(w) {
  openEditor({
    title: '修改我的思考题',
    sub: '随时补充揭晓内容、动手实验或「更奇妙的是」—— 想清楚再写。',
    card: wonderToCard(w),
    onSave: c => {
      const i = DB.custom.wonders.findIndex(x => x.id === w.id)
      if (i < 0) return false
      DB.custom.wonders.splice(i, 1, restamp(cardToWonder(c, w.id), w))
    }
  })
}
</script>

<style scoped>
.lb{font-size:11px;letter-spacing:1px;color:var(--ink3);margin:12px 0 6px}
</style>

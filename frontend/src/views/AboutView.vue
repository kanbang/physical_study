<template>
  <section class="view active">
    <h2 class="sec">设计说明</h2>
    <p class="sub">这份说明既是产品设计文档，也是工具的边界声明 —— 哪些事能做、哪些近似被采用、哪些结论不该由它给出。</p>
    <div class="grid g2">
      <div class="card pad" v-for="x in sections" :key="x[0]">
        <h3 style="color:var(--brand)">{{ x[0] }}</h3>
        <p style="font-size:12.8px;color:var(--ink2);line-height:1.9;margin:8px 0 0">{{ x[1] }}</p>
      </div>
    </div>
    <div class="card pad" style="margin-top:14px">
      <h3>数据流与服务边界</h3>
      <div class="row" style="margin-top:10px;font-size:12.5px">
        <template v-for="(x,i) in flow" :key="i">
          <span class="tag blue" style="font-size:12.5px;padding:6px 12px">{{ x }}</span>
          <span v-if="i<flow.length-1" class="muted">→</span>
        </template>
      </div>
      <p class="tiny muted" style="margin-top:10px">所有学习状态经 /api/state 写入服务端 data/store.json；猜想墙经 /api/ideas 在访问者之间共享；AI 对话经 /api/ai/chat 由服务端代理调用（密钥不出服务端）；浏览器 localStorage 只作为断线缓存。</p>
    </div>
  </section>
</template>

<script setup>
const flow = ['知识图谱', '模型库', '奇思妙想', 'AI 助手', '仿真室', '训练场', '错题本', '今日任务']
const sections = [
  ['目标与痛点', '初高中物理竞赛的难点不在「记住公式」，而在识别模型、判断公式适用条件、把抽象过程可视化；更前置的问题是「为什么愿意学」。所以工具同时做两条线：一条通向解题能力，一条通向好奇心的保护 —— 先用反直觉现象把人拉进来，再给模型、仿真与错题闭环。'],
  ['设计原则', '① 先提示后答案：训练场分三级提示；趣味思考题先让你写下猜想再揭晓。② 每个公式带适用条件与易错点；有争议的现象（如姆潘巴效应）明确写「尚未确立」。③ 能验证的必须验证：仿真并列数值解与解析解，内置题库答案经独立计算核验。④ 错因归类 + 间隔复习。⑤ 数据落服务端，离线时明确标注降级，绝不假装已同步。'],
  ['模块架构', '总览（诊断/路径/雷达/每日一奇） → 知识图谱（20 个知识点） → 模型库（12 个竞赛模型） → 奇思妙想（15 个反直觉思考题） → AI 助手（对话整理入库） → 仿真室（6 个数值实验） → 训练场（14 道内置题 + 我的题库） → 错题本（1/3/7/15/30 天） → 工具箱（量纲分析器、常数、自检清单）。作答记录单向驱动雷达、薄弱领域推荐、错因分布与复习队列。'],
  ['前端：Vue 3 + Vite 组件化', 'frontend/ 是标准 Vite 工程：每个视图一个 .vue 单文件组件（GraphView / ModelsView / WonderView / AiChatView / LabView / PracticeView / WrongView / ToolboxView / AboutView），共享状态集中在 store.js（Vue reactive），数据与纯逻辑（题库、知识点、仿真定义、表达式解析器、量纲分析）放在 src/data 与 src/lib，与旧版单文件逐字一致地迁移，保证已核验内容零漂移。交互重设计：知识图谱 / 模型库 / 训练场 / 奇思妙想从「双排折叠卡片」改为「左列表 + 右详情」主从布局，折叠撑开导致的整行跳动不再存在。构建产物 frontend/dist 由后端直接托管；开发时 npm run dev（Vite 5173 端口，/api 代理到 3000）。'],
  ['Python 后端 + Poetry 隔离', '后端是 app.py（FastAPI + uvicorn）：静态托管 frontend/dist 与七个接口。GET /api/health 健康检查；GET/PUT /api/state?uid=… 读写按用户隔离的学习数据；GET/POST /api/ideas 共享猜想墙；GET/PUT /api/ai/config 在线 AI 配置（密钥存服务端 data/ai_config.json，支持环境变量覆盖）；POST /api/ai/chat AI 对话代理；GET /api/docs 自动接口文档。数据落盘 data/store.json（临时文件 + os.replace 原子替换，线程锁串行写入）。pyproject.toml + poetry.toml 把虚拟环境固定为项目内 .venv/，依赖 fastapi / uvicorn / httpx；启动：poetry install → poetry run python app.py。全程不执行全局 pip install。'],
  ['AI 助手与内容入库', '两种模式：① 在线 AI —— 在设置面板选 DeepSeek / Kimi / GLM / 移动云 MoMA 或自定义接口，粘贴 API Key 即可；调用由服务端代理，密钥不进浏览器。接口地址支持三种写法（只到 /v1、完整 /v1/chat/completions、Anthropic 风格 /v1/messages），后端按地址自动判别协议，遇到 404/405/415 会换另一种协议重试；「测试连接」直接回显 HTTP 状态、平台原始报错与修复建议，「拉取模型列表」列出账号真实可见的模型 ID，避免手抄模型名写错（标了供应商前缀的 ID 常需单独订阅）。② 本地规则模式 —— 未配置时的降级，按关键词归类、只搭卡片骨架，绝不编造数值答案。AI 回复末尾附结构化卡片（problem / wonder 两种），后端做白名单式字段与长度校验；卡片在前端以可编辑表单呈现，人工核对补全后才入库到训练场或奇思妙想，并打上「我添加」标签。内置题库的 27 个数值经过独立核验，AI 入库内容没有 —— 界面与本文档都明确区分这一点。'],
  ['同步与降级策略', '浏览器为每台设备生成 uid；启动时先探活，再比较服务端与本机 updatedAt，取较新的一份，随后回写。任何状态修改经 Vue 深度 watch 自动防抖保存（650 ms）；服务不可用时界面显示「仅本机缓存」，学习数据暂存 localStorage，恢复后点击顶部状态即可重新同步。猜想墙与 AI 对话必须服务端在线 —— 这两项不降级，避免出现「以为发出去了其实没有」。'],
  ['内容扩展：数据驱动，而不是一内容一组件', '题目与思考题都是纯数据对象（src/data/problems.js、wonders.js）：新增内置内容只要往数组里加一条记录，渲染层自动跟上。AI 入库的卡片写入 DB.custom，由 store 的 problems / wonders 合并计算属性统一渲染，所以「动态补充内容」全程不碰组件。真正的 Vue 组件只有三类：① 视图级 —— 每个栏目一个 .vue（共 10 个）；② 卡片类型级 —— CardEditor 按 problem / wonder 两种 kind 渲染表单，只有「新增一种内容形态」时才需要加一个分支；③ 通用件 —— 模态框、列表行、雷达图。判断标准很直接：变的是内容 → 改数据；变的是字段结构 → 改 CardEditor 的一个分支；变的是整块交互 → 才新建视图组件。'],
  ['修改与回滚', 'AI 草稿在入库前可逐字段修改；入库后训练场与奇思妙想里带「我添加」标签的卡片有「编辑」按钮，复用同一个 CardEditor 改标题、答案、解析或揭晓内容，保存后照常同步服务端；「移除」只删自定义卡片，内置 14 题与 15 个思考题是只读的 —— 它们经过独立核验，不允许被随手改掉。想改内置题，就让 AI 整理成你的版本另存一条。'],
  ['质量门（已执行）', '① 内置题库 14 题共 27 个数值结果用独立脚本逐条复算，全部一致（含 √30、2√3、15.4%、3.28×10⁻⁷ s）。② 公式均标注适用条件：单摆小角、线性阻力、纯电阻导轨、理想气体单原子等。③ 仿真内置解析对照：抛体射程/最高点、斜面往返速度、阻尼周期实测、单摆椭圆积分精确周期、导轨 v₀e^(−t/τ) 与动量/能量校核。④ 数据与逻辑层从旧版单文件逐字提取（脚本化），构建后经无头浏览器逐视图渲染回归与功能回归（答题流程、量纲分析、AI 规则模式对话、卡片入库）。⑤ Poetry 虚拟环境、依赖锁文件与全部接口逐条实测，全局 Python 未安装任何本项目依赖。'],
  ['已知边界（不夸大）', '① 斜面模型把静/动摩擦系数合并为同一个 μ。② 磁场实验动画相位按可视化速率推进（真实周期约 10⁻⁷ s），示意图半径已归一化。③ 单摆精确周期公式严格只适用于无阻尼。④ 抛体采用线性阻力 F = −bv，高速常为二次阻力。⑤ 服务端是单机轻量实现（JSON 文件存储、uid 未做登录鉴权、CORS 放开），适合本机/局域网教学，不是面向公网的多租户系统。⑥ AI 生成内容未经独立核验，可能有误，入库需人工确认；AI 的数值答案不参与自动判分除非你亲自核验填写。⑦ 训练场只判数值答案；趣味题不做评分；不替代教材、真题与教师指导。'],
  ['可扩展方向', '换 SQLite 或加账号登录；接入真题卷与限时模式；多解对照（能量法 vs 动力学法）；仿真参数与题目联动成「可改数的题」；AI 卡片自动关联知识点与模型；按竞赛考纲版本切换内容权重。']
]
</script>

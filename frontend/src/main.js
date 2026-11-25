import {createApp} from 'vue'
import App from './App.vue'
import './assets/style.css'
import 'katex/dist/katex.min.css'
import * as store from './store.js'
import * as expr from './lib/expr.js'

createApp(App).mount('#app')

/* 调试句柄：本机排查与自动化回归用（仅暴露已导出的状态与纯函数，不含密钥） */
window.__APP__ = Object.assign({}, store, expr)

import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 把站点挂在 /physical_study/ 下，CI 构建时通过 PAGES_BASE 指定子路径；
// 本地开发/构建仍用根路径 '/'，行为不变。
const base = process.env.PAGES_BASE || '/'

export default defineConfig({
  base,
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {'/api': 'http://127.0.0.1:3000'}
  },
  build: {
    outDir: 'dist',
    // 拆包而不是掩盖告警：katex（含字体）与 vue 运行时都很大且极少变化，
    // 单独成块后它们能被浏览器缓存，改业务代码只需重新下载业务块。
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('katex')) return 'vendor-katex'
          if (/node_modules[\\/](@vue|vue)[\\/]/.test(id)) return 'vendor-vue'
          return 'vendor'
        }
      }
    },
    // 拆完后仍可能有个别块偏大（数据文件与 KaTeX 字体索引），保留默认 500KB 阈值，
    // 一旦再超限就说明真的该再看一眼，而不是把阈值调高。
    chunkSizeWarningLimit: 600
  }
})

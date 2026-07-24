import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GH Pages serves each repo under /<repo>/ — derive the base from the repo
// the Actions build runs in, so the same branch deploys correctly from both
// the commonwealth-codex and ma-power-map remotes.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]

export default defineConfig({
  base: repo ? `/${repo}/` : '/commonwealth-codex/',
  plugins: [react(), tailwindcss()],
  build: {
    // Bundle was a single 2 MB chunk; split heavy deps into their own
    // files so the parser can stream them and the browser can cache
    // them independently.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('tldraw')) return 'tldraw'
            if (id.includes('firebase')) return 'firebase'
            if (id.includes('d3-')) return 'd3'
            if (id.includes('react')) return 'react'
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})

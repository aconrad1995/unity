import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore plain JavaScript module, no types needed
import { unityApi } from './server/api.mjs'

export default defineConfig({
  plugins: [react(), unityApi()],
  server: { port: 5173, watch: { ignored: ['**/.data/**'] } },
})

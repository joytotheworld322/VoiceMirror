import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    https: false, // dev는 localhost라 http OK; Vercel 배포 시 HTTPS 자동 적용
  },
})

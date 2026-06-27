import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// 1. Impor plugin Tailwind
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 2. Tambahkan di dalam array plugins
  ],
})
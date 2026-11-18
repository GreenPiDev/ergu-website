import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Aynı ağdaki cihazlardan (telefon, tablet) erişim için tüm arayüzlerde dinle
  server: { host: true },
  preview: { host: true },
})

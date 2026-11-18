import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Aynı ağdaki cihazlardan (telefon, tablet) erişim için tüm arayüzlerde dinle
  server: { host: true },
  preview: { host: true },
  build: {
    rolldownOptions: {
      output: {
        // İlk açılışta inen kütüphaneler ayrı parçalara ayrılır: site kodu değişince bunlar tarayıcı önbelleğinde
        // kalır, yalnızca küçük uygulama parçası yeniden iner. Genel bir node_modules grubu kullanılmaz, yoksa lazy
        // yüklenen three.js de ilk pakete çekilir.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/, priority: 30 },
            { name: 'motion', test: /node_modules[\\/](gsap|@gsap[\\/]react|lenis)[\\/]/, priority: 20 },
            { name: 'i18n', test: /node_modules[\\/](i18next|react-i18next)[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
})

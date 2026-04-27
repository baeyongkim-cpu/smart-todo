import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FocusFlow To-Do',
        short_name: 'FocusFlow',
        description: 'FocusFlow Premium To-Do App',
        theme_color: '#1C1C1E',
        background_color: '#1C1C1E',
        display: 'standalone',
        orientation: 'portrait'
      }
    })
  ],
})


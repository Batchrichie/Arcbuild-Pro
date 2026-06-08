import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase'
          }
          if (id.includes('pages/portals/AccountantPortal')) {
            return 'portal-accountant'
          }
          if (id.includes('pages/portals/CeoPortal')) {
            return 'portal-ceo'
          }
          if (id.includes('pages/portals/PmPortal')) {
            return 'portal-pm'
          }
          if (id.includes('pages/portals/HrPortal')) {
            return 'portal-hr'
          }
          if (id.includes('pages/portals/EmployeePortal')) {
            return 'portal-employee'
          }
          if (id.includes('pages/portals/ClientPortal')) {
            return 'portal-client'
          }
        }
      }
    }
  }
})


import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sites } from './build/sites-vite-plugin'

export default defineConfig(async () => {
  const { cloudflare } = await import('@cloudflare/vite-plugin')

  return {
    plugins: [
      react(),
      tailwindcss(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'server' },
        config: {
          main: './worker/index.ts',
          compatibility_date: '2026-07-14',
          assets: {
            binding: 'ASSETS',
            not_found_handling: 'single-page-application',
          },
        },
      }),
    ],
  }
})

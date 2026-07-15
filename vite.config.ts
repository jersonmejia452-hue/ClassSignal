import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sites } from './build/sites-vite-plugin'
import { workerAssetsConfig } from './build/worker-assets-config'

export default defineConfig(async ({ mode }) => {
  const { cloudflare } = await import('@cloudflare/vite-plugin')
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [
      react(),
      tailwindcss(),
      sites({ supabaseUrl: env.VITE_SUPABASE_URL }),
      cloudflare({
        viteEnvironment: { name: 'server' },
        config: {
          main: './worker/index.ts',
          compatibility_date: '2026-07-14',
          assets: workerAssetsConfig,
        },
      }),
    ],
  }
})

import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

import { createStaticAssetHeadersFile } from './security-headers'

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

interface SitesPluginOptions {
  supabaseUrl?: string
}

export function sites(options: SitesPluginOptions = {}): Plugin {
  let root = process.cwd()

  return {
    name: 'sites',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    async closeBundle() {
      const outputDirectory = resolve(root, 'dist', '.openai')
      const hostingConfig = resolve(root, '.openai', 'hosting.json')

      await rm(outputDirectory, { recursive: true, force: true })
      await mkdir(outputDirectory, { recursive: true })

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, 'hosting.json'))
      }

      const clientOutputDirectory = resolve(root, 'dist', 'client')

      if (await exists(clientOutputDirectory)) {
        await writeFile(
          resolve(clientOutputDirectory, '_headers'),
          createStaticAssetHeadersFile(options.supabaseUrl),
          'utf8',
        )
      }
    },
  }
}

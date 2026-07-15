import { access, cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

import { appShellAssetName } from './app-shell'

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export function sites(): Plugin {
  let root = process.cwd()

  return {
    name: 'sites',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const indexAsset = bundle['index.html']
        if (!indexAsset || indexAsset.type !== 'asset') return

        this.emitFile({
          type: 'asset',
          fileName: appShellAssetName,
          source: indexAsset.source,
        })
        delete bundle['index.html']
      },
    },
    async closeBundle() {
      const outputDirectory = resolve(root, 'dist', '.openai')
      const hostingConfig = resolve(root, '.openai', 'hosting.json')

      await rm(outputDirectory, { recursive: true, force: true })
      await mkdir(outputDirectory, { recursive: true })

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, 'hosting.json'))
      }
    },
  }
}

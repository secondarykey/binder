import { defineConfig } from 'vitest/config'
import path from 'path'

const sharedDir = path.resolve(__dirname, '../../shared/frontend')
// shared/frontend/licenses.js がルートの LICENSE / THIRD_PARTY_LICENSES を ?raw で読む。
// Vite は ?raw 付きの ID も allow と照合するので、ファイル単位では許可できずディレクトリで許可する
// （.env や .git は Vite 既定の deny で引き続き拒否される）。
const repoRoot = path.resolve(__dirname, '../../..')

function resolveSharedDeps() {
  const anchor = path.resolve(__dirname, 'src/main.jsx')
  return {
    name: 'resolve-shared-deps',
    async resolveId(source, importer, options) {
      if (!importer || !importer.replace(/\\/g, '/').includes('/shared/')) return null
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('@shared')) return null
      const resolved = await this.resolve(source, anchor, { ...options, skipSelf: true })
      return resolved
    },
  }
}

export default defineConfig({
  plugins: [resolveSharedDeps()],
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@shared': sharedDir,
    },
  },
  server: {
    fs: {
      allow: ['.', sharedDir, repoRoot],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'vmThreads',
    setupFiles: ['./src/__tests__/setup.js'],
    server: {
      deps: {
        inline: ['@mui/icons-material'],
      },
    },
  },
})

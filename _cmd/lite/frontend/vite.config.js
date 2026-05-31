import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const sharedDir = path.resolve(__dirname, '../../../shared')

/**
 * shared/ ディレクトリ内の bare import（react, @mui 等）を
 * 本プロジェクトの node_modules で解決するプラグイン
 */
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

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [resolveSharedDeps(), react()],
  resolve: {
    alias: {
      '@shared': sharedDir,
    },
  },
  server: {
    fs: {
      allow: ['.', sharedDir],
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      },
    },
  },
})

import { defineConfig } from 'vitest/config'
import path from 'path'

const sharedDir = path.resolve(__dirname, '../../shared/frontend')

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@shared': sharedDir,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
  },
})

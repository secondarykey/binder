import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const sharedDir = path.resolve(__dirname, '../../../shared')
const nodeModules = path.resolve(__dirname, 'node_modules')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': sharedDir,
      // shared/ 内の bare import を本プロジェクトの node_modules で解決
      '@mui/material': path.resolve(nodeModules, '@mui/material'),
      '@mui/icons-material': path.resolve(nodeModules, '@mui/icons-material'),
      'react': path.resolve(nodeModules, 'react'),
      'react-dom': path.resolve(nodeModules, 'react-dom'),
      'react-i18next': path.resolve(nodeModules, 'react-i18next'),
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

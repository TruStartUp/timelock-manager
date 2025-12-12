import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    // Avoid process forking in sandboxed environments (fixes EPERM kill errors)
    pool: 'threads',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/subgraph/**', // Exclude subgraph tests (use matchstick-as instead)
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

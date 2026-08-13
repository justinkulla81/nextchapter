import { defineConfig } from 'vitest/config'
import path from 'path'

// 'server-only' throws when imported outside a Next.js server-component
// bundle — aliasing it to a no-op here is what lets tests import
// classify-email.ts and friends DIRECTLY instead of hand-copying their logic
// (the trap the backfill scripts in scripts/ fell into: a copy that can
// silently drift from what's actually shipped).
export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      'server-only': path.resolve(__dirname, 'src/test/server-only-stub.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
})

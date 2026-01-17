import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    testTimeout: 30_000,
    setupFiles: ['src/test/setup.ts'],
    fileParallelism: false,
  },
})

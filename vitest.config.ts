import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Отдельный конфиг для тестов: Tailwind и React-плагин из vite.config.ts
 * им не нужны, поэтому сборка стилей не запускается.
 *
 * Окружение по умолчанию — node (быстрее всего). Тестам, которым нужен DOM,
 * достаточно первой строкой файла указать `// @vitest-environment jsdom`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Моки и подменённые глобалы не должны протекать между тестами.
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
})

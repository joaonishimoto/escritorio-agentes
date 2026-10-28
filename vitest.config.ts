import { defineConfig } from 'vitest/config'

// Testes das funções puras do app e da API (sem banco, sem rede, sem navegador).
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetMarketStore } from '../hooks/useMarket'
import { pendingResponse } from './fetch'

// Nenhum teste sai à rede: sem simulação própria, o fetch fica pendente (e
// respeita o cancelamento). Telas como a carteira leem a API ao montar.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => pendingResponse(init?.signal)),
  )
})

afterEach(() => {
  cleanup()
  // O mercado guarda o resultado em memória de módulo (cache de 60 s).
  resetMarketStore()
})

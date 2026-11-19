import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ApiError } from '../api/client'
import { getMarket, type MarketData } from '../api/market'

/**
 * Tempo em que o último resultado vale (desenho, seção 6.2). O limite do Core
 * API é global (10 requisições por 60 s, somando todos os usuários), então
 * entrar e sair da carteira não pode buscar de novo a cada vez.
 */
export const MARKET_CACHE_MS = 60_000
/** Espera do 429 quando o Retry-After não chega (é a janela do limite). */
export const DEFAULT_RETRY_AFTER_S = 60

export type MarketError = {
  /** Code do erro; o texto da tela vem de messageFor(code, serverMessage). */
  code: string
  serverMessage?: string
}

type Snapshot = {
  status: 'idle' | 'loading' | 'ok' | 'error'
  /** Última leitura boa. Fica durante uma releitura e depois de uma falha nela. */
  data: MarketData | null
  /** Relógio local quando a última leitura boa chegou. */
  fetchedAt: number | null
  error: MarketError | null
  /** Relógio local quando o 429 chegou e até quando o botão fica desabilitado. */
  blockedAt: number | null
  blockedUntil: number | null
}

const INITIAL: Snapshot = {
  status: 'idle',
  data: null,
  fetchedAt: null,
  error: null,
  blockedAt: null,
  blockedUntil: null,
}

// ---------------------------------------------------------------------------
// Estado de módulo: um resultado e no máximo uma requisição para o app todo.
// O tempo é sempre o relógio local contra valores do próprio relógio local
// (fetchedAt, blockedUntil); nunca contra os instantes da série.
// ---------------------------------------------------------------------------

let snapshot: Snapshot = INITIAL
const listeners = new Set<() => void>()
let controller: AbortController | null = null
let mounted = 0

function setSnapshot(next: Snapshot) {
  snapshot = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return snapshot
}

function isBlocked(now: number) {
  return snapshot.blockedUntil !== null && now < snapshot.blockedUntil
}

function isFresh(now: number) {
  return snapshot.fetchedAt !== null && now - snapshot.fetchedAt < MARKET_CACHE_MS
}

function toMarketError(error: unknown): MarketError {
  if (error instanceof ApiError) return { code: error.code, serverMessage: error.message }
  return { code: 'INTERNAL_ERROR' }
}

/** Busca o mercado, salvo se já há uma requisição em voo ou o 429 ainda vale. */
function fetchMarket(token: string) {
  if (controller || isBlocked(Date.now())) return
  const current = new AbortController()
  controller = current
  setSnapshot({ ...snapshot, status: 'loading', error: null })

  getMarket(token, current.signal).then(
    (data) => {
      if (current.signal.aborted) return
      controller = null
      setSnapshot({ ...snapshot, status: 'ok', data, fetchedAt: Date.now(), error: null })
    },
    (error: unknown) => {
      if (current.signal.aborted) return
      controller = null
      const marketError = toMarketError(error)
      let { blockedAt, blockedUntil } = snapshot
      if (marketError.code === 'RATE_LIMIT_EXCEEDED') {
        const retryAfter = error instanceof ApiError ? error.retryAfter : undefined
        blockedAt = Date.now()
        blockedUntil = blockedAt + (retryAfter ?? DEFAULT_RETRY_AFTER_S) * 1_000
      }
      setSnapshot({ ...snapshot, status: 'error', error: marketError, blockedAt, blockedUntil })
    },
  )
}

/**
 * Sem ninguém na tela: cancela a requisição em voo e esquece o erro, menos o
 * 429 ainda valendo (voltar à tela segue a mesma contagem, sem nova chamada).
 */
function release() {
  controller?.abort()
  controller = null
  const keepBlock = isBlocked(Date.now())
  setSnapshot({
    ...snapshot,
    status: keepBlock ? 'error' : snapshot.data ? 'ok' : 'idle',
    error: keepBlock ? snapshot.error : null,
    blockedAt: keepBlock ? snapshot.blockedAt : null,
    blockedUntil: keepBlock ? snapshot.blockedUntil : null,
  })
}

/** Zera o estado de módulo. Para os testes (src/test/setup.ts). */
export function resetMarketStore() {
  controller?.abort()
  controller = null
  mounted = 0
  snapshot = INITIAL
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Mercado do ETH para o painel (CT17, desenho, seção 6.2), sem polling.
 *
 * - Ao montar, busca só se o último resultado tem mais de 60 s e o 429 não
 *   vale mais. A busca sai num setTimeout(0): a montagem dupla do StrictMode
 *   não dispara uma requisição que seria cancelada e gastaria vaga do limite.
 * - refresh() força a busca (botão "Atualizar" e "Tentar de novo"), mas nunca
 *   com outra em voo nem durante o 429.
 * - 429: o botão fica desabilitado por Retry-After segundos (60 sem o
 *   cabeçalho), com `retryIn` caindo a cada segundo.
 * - Sair da tela (último painel desmontado) cancela a requisição em voo.
 * - O TOKEN_INVALID é tratado no cliente e no AuthContext, não aqui.
 */
export function useMarket(token: string) {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  const [tick, setTick] = useState(() => Date.now())

  useEffect(() => {
    mounted += 1
    const timer = setTimeout(() => {
      const now = Date.now()
      if (!controller && !isBlocked(now) && !isFresh(now)) fetchMarket(token)
    }, 0)
    return () => {
      clearTimeout(timer)
      mounted -= 1
      if (mounted === 0) release()
    }
  }, [token])

  // Contagem do 429: acorda em cada virada de segundo até o fim da espera.
  const { blockedUntil } = state
  useEffect(() => {
    if (blockedUntil === null) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const left = blockedUntil - Date.now()
      if (left <= 0) return
      timer = setTimeout(() => {
        setTick(Date.now())
        schedule()
      }, left % 1_000 || 1_000)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [blockedUntil])

  const refresh = useCallback(() => fetchMarket(token), [token])

  // "Agora" para a contagem: o último tique ou, se o 429 é mais novo, o instante dele.
  const now = Math.max(tick, state.blockedAt ?? 0)
  const retryIn =
    blockedUntil === null ? 0 : Math.max(0, Math.ceil((blockedUntil - now) / 1_000))
  const loading = state.status === 'idle' || state.status === 'loading'

  return {
    status: loading ? ('loading' as const) : state.status,
    data: state.data,
    fetchedAt: state.fetchedAt,
    error: state.error,
    /** Segundos até o botão voltar, depois de um 429. Zero fora disso. */
    retryIn,
    /** false com requisição em voo ou durante a contagem do 429. */
    canRefresh: !loading && retryIn === 0,
    refresh,
  }
}

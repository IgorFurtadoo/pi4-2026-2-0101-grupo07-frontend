import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { getTransaction, isFinalStatus, type Transaction } from '../api/transactions'

/** Intervalo normal enquanto PENDING (desenho, seção 6.5). */
export const POLL_INTERVAL_MS = 3_000
/** Espera depois da 1ª, 2ª e 3ª falha seguidas; da 3ª em diante fica na última. */
export const BACKOFF_MS = [3_000, 6_000, 10_000] as const
/** Depois disso em PENDING (contado desde que a tela abriu), liga o aviso de demora. */
export const SLOW_AFTER_MS = 10 * 60_000
/** Intervalo depois do aviso de demora. */
export const SLOW_INTERVAL_MS = 10_000

export type PollingError = {
  /** Code do erro; o texto da tela vem de messageFor(code, serverMessage). */
  code: string
  serverMessage?: string
}

export type TransactionPollingState = {
  /** Última leitura boa. Fica depois de uma falha. */
  transaction: Transaction | null
  /** Última falha; some com a próxima leitura boa. */
  error: PollingError | null
  /** 404 TRANSACTION_NOT_FOUND: o polling parou. */
  notFound: boolean
  /** Falha passageira (rede ou servidor): o polling segue com recuo. */
  reconnecting: boolean
  /** PENDING há mais de 10 minutos: o polling segue a cada 10 s. */
  slow: boolean
}

const INITIAL_STATE: TransactionPollingState = {
  transaction: null,
  error: null,
  notFound: false,
  reconnecting: false,
  slow: false,
}

function toPollingError(error: unknown): PollingError {
  if (error instanceof ApiError) return { code: error.code, serverMessage: error.message }
  return { code: 'INTERNAL_ERROR' }
}

/** Espera depois de `failures` falhas seguidas (1, 2, 3, …), por índice e sem Math. */
function backoffFor(failures: number): number {
  return failures >= BACKOFF_MS.length ? BACKOFF_MS[BACKOFF_MS.length - 1] : BACKOFF_MS[failures - 1]
}

/**
 * Acompanhamento de uma transação (CT13, desenho, seção 6.5): lê na hora ao
 * montar e repete enquanto PENDING, até CONFIRMED ou FAILED.
 *
 * - Encadeia setTimeout depois de CADA resposta (nunca setInterval): no
 *   máximo uma requisição em voo, com trava síncrona e AbortController.
 * - Falha passageira (NETWORK_ERROR, INTERNAL_ERROR ou code desconhecido):
 *   mantém o último estado, liga `reconnecting` e recua 3, 6, 10, 10 s. Uma
 *   resposta boa zera o recuo.
 * - 404 TRANSACTION_NOT_FOUND e 401 TOKEN_INVALID param, sem retentativa (o
 *   TOKEN_INVALID é tratado no cliente e no AuthContext).
 * - Aba escondida: cancela o timer e não agenda outro (uma leitura já em voo
 *   termina). Ao voltar, lê na hora e retoma.
 * - 10 minutos depois de montar, ainda sem estado final: liga `slow` e passa
 *   a ler a cada 10 s. Não inventa estado novo.
 * - Desmontar cancela timer e requisição; resposta de leitura cancelada nunca
 *   vira estado. O estado do ciclo (trava, timer, recuo) vive no fechamento de
 *   cada execução do efeito, então a montagem dupla do StrictMode não deixa
 *   dois ciclos vivos.
 *
 * `retry()` existe para o "Tentar novamente" da primeira leitura sem dado; o
 * recuo automático continua de qualquer forma.
 */
export function useTransactionPolling(token: string, taskId: string) {
  const [state, setState] = useState<TransactionPollingState>(INITIAL_STATE)
  const retryRef = useRef<() => void>(() => {})

  useEffect(() => {
    /** Final, 404, 401 ou desmontado: nada mais é lido nem agendado. */
    let stopped = false
    /** Trava síncrona: no máximo uma requisição em voo. */
    let inFlight = false
    let controller: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let slow = false

    function clearTimer() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    }

    function schedule(ms: number) {
      clearTimer()
      if (stopped || document.hidden) return
      timer = setTimeout(() => {
        timer = undefined
        read()
      }, ms)
    }

    function read() {
      if (stopped || inFlight) return
      clearTimer()
      inFlight = true
      const current = new AbortController()
      controller = current

      getTransaction(token, taskId, current.signal).then(
        (transaction) => {
          if (current.signal.aborted) return
          inFlight = false
          failures = 0
          const final = isFinalStatus(transaction.status)
          if (final) stopped = true
          setState({
            transaction,
            error: null,
            notFound: false,
            reconnecting: false,
            slow: slow && !final,
          })
          if (!final) schedule(slow ? SLOW_INTERVAL_MS : POLL_INTERVAL_MS)
        },
        (cause: unknown) => {
          if (current.signal.aborted) return
          inFlight = false
          const error = toPollingError(cause)

          if (error.code === 'TRANSACTION_NOT_FOUND' || error.code === 'TOKEN_INVALID') {
            stopped = true
            setState((previous) => ({
              ...previous,
              error,
              notFound: error.code === 'TRANSACTION_NOT_FOUND',
              reconnecting: false,
              slow: false,
            }))
            return
          }

          failures += 1
          setState((previous) => ({ ...previous, error, reconnecting: true }))
          schedule(slow ? SLOW_INTERVAL_MS : backoffFor(failures))
        },
      )
    }

    function onVisibilityChange() {
      if (document.hidden) {
        clearTimer()
        return
      }
      // Com um timer pendente a aba não chegou a esconder: o ciclo segue como está.
      if (stopped || inFlight || timer !== undefined) return
      read()
    }

    const slowTimer = setTimeout(() => {
      if (stopped) return
      slow = true
      setState((previous) => ({ ...previous, slow: true }))
    }, SLOW_AFTER_MS)

    retryRef.current = () => {
      if (stopped || inFlight) return
      setState((previous) => ({ ...previous, error: null, reconnecting: false }))
      read()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    read()

    return () => {
      stopped = true
      clearTimer()
      clearTimeout(slowTimer)
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      retryRef.current = () => {}
    }
  }, [token, taskId])

  const retry = useCallback(() => retryRef.current(), [])

  return { ...state, retry }
}

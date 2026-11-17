import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { getBalance, type Balance } from '../api/wallet'

export type BalanceError = {
  /** Code do erro; o texto da tela vem de messageFor(code, serverMessage). */
  code: string
  serverMessage?: string
}

export type BalanceState = {
  status: 'loading' | 'ok' | 'error'
  /** Última leitura bem-sucedida. Fica durante uma releitura e depois de uma falha nela. */
  balance: Balance | null
  error: BalanceError | null
}

const INITIAL_STATE: BalanceState = { status: 'loading', balance: null, error: null }

function toBalanceError(error: unknown): BalanceError {
  if (error instanceof ApiError) return { code: error.code, serverMessage: error.message }
  return { code: 'INTERNAL_ERROR' }
}

/**
 * Saldo da carteira (desenho, seção 6.2): lê ao montar e por reload(), sem
 * polling. No máximo uma requisição em voo: a trava síncrona (ref) barra o
 * segundo reload antes de o React redesenhar, e cada nova leitura cancela a
 * anterior. Desmontar cancela a leitura em andamento; resposta de leitura
 * cancelada nunca vira estado. O TOKEN_INVALID é tratado no cliente e no
 * AuthContext, não aqui.
 */
export function useBalance(token: string) {
  const [state, setState] = useState<BalanceState>(INITIAL_STATE)
  const controllerRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)

  const start = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    inFlightRef.current = true

    getBalance(token, controller.signal).then(
      (balance) => {
        if (controller.signal.aborted) return
        inFlightRef.current = false
        setState({ status: 'ok', balance, error: null })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        inFlightRef.current = false
        setState((previous) => ({
          status: 'error',
          balance: previous.balance,
          error: toBalanceError(error),
        }))
      },
    )
  }, [token])

  useEffect(() => {
    // O estado inicial já é "loading": aqui só começa a leitura.
    start()
    return () => {
      controllerRef.current?.abort()
      controllerRef.current = null
      inFlightRef.current = false
    }
  }, [start])

  const reload = useCallback(() => {
    if (inFlightRef.current) return
    setState((previous) => ({ status: 'loading', balance: previous.balance, error: null }))
    start()
  }, [start])

  return { ...state, reload }
}

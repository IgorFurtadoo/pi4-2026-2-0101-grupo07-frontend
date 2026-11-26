import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { getWalletTransactions, type WalletActivity } from '../api/wallet'

export type ActivityError = {
  /** Code do erro; o texto da tela vem de messageFor(code, serverMessage). */
  code: string
  serverMessage?: string
}

export type ActivityState = {
  status: 'loading' | 'ok' | 'error'
  /** Última leitura boa. Fica durante uma releitura e depois de uma falha nela. */
  data: WalletActivity | null
  error: ActivityError | null
}

/** O que useActivity devolve: o estado e a releitura. */
export type ActivityHandle = ActivityState & { refresh: () => void }

const INITIAL_STATE: ActivityState = { status: 'loading', data: null, error: null }

function toActivityError(error: unknown): ActivityError {
  if (error instanceof ApiError) return { code: error.code, serverMessage: error.message }
  return { code: 'INTERNAL_ERROR' }
}

/**
 * Atividade da carteira (CT26, desenho, seção 7): lê ao montar e por
 * refresh(), sem polling e sem cache próprio (o External Data Service já
 * guarda 12 s por endereço). Voltar à carteira depois de uma transação
 * chegar ao estado final monta a tela de novo e, com ela, relê a lista, como
 * o saldo.
 *
 * - A primeira busca sai num setTimeout(0), como no useMarket: a montagem
 *   dupla do StrictMode não dispara uma requisição que seria cancelada.
 * - Nunca duas requisições em voo: a trava síncrona (ref) faz refresh() ser
 *   ignorado enquanto a anterior não volta (não cancela a anterior).
 * - Desmontar cancela a leitura em andamento; resposta cancelada nunca vira
 *   estado.
 * - O TOKEN_INVALID é tratado no cliente e no AuthContext, não aqui.
 */
export function useActivity(token: string): ActivityHandle {
  const [state, setState] = useState<ActivityState>(INITIAL_STATE)
  const controllerRef = useRef<AbortController | null>(null)

  const refresh = useCallback(() => {
    if (controllerRef.current) return
    const controller = new AbortController()
    controllerRef.current = controller
    setState((previous) => ({ status: 'loading', data: previous.data, error: null }))

    getWalletTransactions(token, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return
        controllerRef.current = null
        setState({ status: 'ok', data, error: null })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        controllerRef.current = null
        setState((previous) => ({
          status: 'error',
          data: previous.data,
          error: toActivityError(error),
        }))
      },
    )
  }, [token])

  useEffect(() => {
    const timer = setTimeout(refresh, 0)
    return () => {
      clearTimeout(timer)
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [refresh])

  return { ...state, refresh }
}

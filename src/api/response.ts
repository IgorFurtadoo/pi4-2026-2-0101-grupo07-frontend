import { ApiError } from './client'
import { messageFor } from './errors'

/**
 * Conferência das respostas 2xx (usada por auth.ts, wallet.ts e
 * transactions.ts). Não conhece React.
 */

/** Decimal em notação plana, como o Core API garante (WRITE_BIGDECIMAL_AS_PLAIN). */
export const PLAIN_DECIMAL = /^\d+(\.\d+)?$/

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Resposta 2xx fora do formato da ficha: tratada como falha do servidor. */
export function unexpectedResponse(): ApiError {
  return new ApiError({ code: 'INTERNAL_ERROR', message: messageFor('INTERNAL_ERROR') })
}

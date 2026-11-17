import { normalizeAmountInput } from '../lib/format'
import { apiRequest } from './client'
import { isRecord, unexpectedResponse } from './response'

/**
 * Envio de ETH (ficha CT9). Rota protegida: leva o token. Só chama
 * apiRequest; não conhece React.
 */

export type SendTransactionInput = {
  /** Endereço como digitado; vai sem os espaços das pontas e sem mudar a caixa. */
  destinationAddress: string
  /** Valor como digitado (vírgula ou ponto); vai normalizado, como texto. */
  amountEth: string
}

/** CT9: 202 { taskId, status: "PENDING" }. Aceito, ainda não confirmado na rede. */
export type SendTransactionResult = {
  taskId: string
  status: 'PENDING'
}

/**
 * CT9 sendTransaction: POST /transactions. O amountEth vai como TEXTO com
 * ponto ("0.01"), nunca como número, para não perder precisão. Sem
 * cancelamento além do tempo limite do cliente: cancelar não desfaz o que o
 * servidor já processou. Resposta 2xx fora da ficha vira INTERNAL_ERROR; os
 * erros do servidor chegam pelo code. Sem idempotência: cada chamada é uma
 * transação, e quem chama nunca deve repetir sozinho.
 */
export async function sendTransaction(
  token: string,
  input: SendTransactionInput,
): Promise<SendTransactionResult> {
  const body = await apiRequest<unknown>('/transactions', {
    method: 'POST',
    token,
    body: {
      destinationAddress: input.destinationAddress.trim(),
      amountEth: normalizeAmountInput(input.amountEth),
    },
  })

  if (
    !isRecord(body) ||
    typeof body.taskId !== 'string' ||
    body.taskId.trim() === '' ||
    body.status !== 'PENDING'
  ) {
    throw unexpectedResponse()
  }
  return { taskId: body.taskId, status: 'PENDING' }
}

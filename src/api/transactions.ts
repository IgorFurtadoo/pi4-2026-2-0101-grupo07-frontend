import { normalizeAmountInput } from '../lib/format'
import { apiRequest, decimalToText } from './client'
import { PLAIN_DECIMAL, isRecord, unexpectedResponse } from './response'

/**
 * Envio de ETH (ficha CT9) e acompanhamento (ficha CT13). Rotas protegidas:
 * levam o token. Só chamam apiRequest; não conhecem React.
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

// ---------------------------------------------------------------------------
// Acompanhamento (CT13)
// ---------------------------------------------------------------------------

export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'FAILED'

const STATUSES: ReadonlySet<string> = new Set<TransactionStatus>(['PENDING', 'CONFIRMED', 'FAILED'])

/** CT13: 200 { taskId, status, destinationAddress, amountEth, transactionHash?, failureReason?, updatedAt }. */
export type Transaction = {
  taskId: string
  status: TransactionStatus
  /** Endereço como o Core API devolveu; exibido como texto. */
  destinationAddress: string
  /** Valor em ETH como texto, em notação plana. Nunca passa por Number. */
  amountEth: string
  /**
   * Hash informado pelo Blockchain Service. Em PENDING é PROVISÓRIO (pode ser
   * apagado se a rede recusar). Exibido como texto qualquer que seja; o link
   * do explorador só existe com o formato validado (lib/explorer.ts).
   */
  transactionHash?: string
  /** Só em FAILED. O texto da tela vem de failureReasonMessage, nunca daqui. */
  failureReason?: string
  /** Instante da última mudança, em ISO 8601 UTC (texto como veio). */
  updatedAt: string
}

/**
 * CT13 getTransaction: GET /transactions/{taskId}. O taskId vai codificado
 * no caminho. A resposta precisa ser da task pedida: o Core API compara o
 * taskId sem diferença de maiúsculas e devolve o gravado, então a conferência
 * também ignora a caixa. Resposta fora da ficha vira INTERNAL_ERROR; os erros
 * do servidor (TOKEN_INVALID, TRANSACTION_NOT_FOUND, INTERNAL_ERROR) chegam
 * pelo code. Cancelamento pelo signal rejeita com AbortError.
 */
export async function getTransaction(
  token: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<Transaction> {
  const body = await apiRequest<unknown>(`/transactions/${encodeURIComponent(taskId)}`, {
    token,
    signal,
  })

  if (
    !isRecord(body) ||
    typeof body.taskId !== 'string' ||
    body.taskId.toLowerCase() !== taskId.toLowerCase() ||
    typeof body.status !== 'string' ||
    !STATUSES.has(body.status) ||
    typeof body.destinationAddress !== 'string' ||
    typeof body.updatedAt !== 'string' ||
    (body.transactionHash !== undefined && typeof body.transactionHash !== 'string') ||
    (body.failureReason !== undefined && typeof body.failureReason !== 'string')
  ) {
    throw unexpectedResponse()
  }

  const raw = body.amountEth
  if (typeof raw !== 'string' && typeof raw !== 'number') throw unexpectedResponse()
  const amountEth = decimalToText(raw)
  if (!PLAIN_DECIMAL.test(amountEth)) throw unexpectedResponse()

  const transaction: Transaction = {
    taskId: body.taskId,
    status: body.status as TransactionStatus,
    destinationAddress: body.destinationAddress,
    amountEth,
    updatedAt: body.updatedAt,
  }
  if (typeof body.transactionHash === 'string') transaction.transactionHash = body.transactionHash
  if (typeof body.failureReason === 'string') transaction.failureReason = body.failureReason
  return transaction
}

/** true em CONFIRMED e FAILED: o Core API não muda mais o estado. */
export function isFinalStatus(status: TransactionStatus): boolean {
  return status === 'CONFIRMED' || status === 'FAILED'
}

/** Motivos de falha do CT13 em português (desenho, seção 6.5). */
export const FAILURE_REASON_MESSAGES = {
  REJECTED_BY_NETWORK: 'A rede recusou a transação. Verifique se o saldo cobre o valor mais a taxa.',
  TRANSACTION_REVERTED: 'A transação foi executada e revertida.',
  INTERNAL_ERROR: 'Falha interna ao processar. Tente novamente.',
} as const

/** Texto de FAILED sem motivo ou com motivo que o Frontend não conhece. */
export const FAILED_GENERIC_MESSAGE = 'A transação falhou.'

/**
 * Explicação da falha para a tela. Motivo desconhecido ou ausente usa o texto
 * genérico: o texto vindo do servidor nunca vira explicação.
 */
export function failureReasonMessage(reason?: string): string {
  if (reason !== undefined && Object.hasOwn(FAILURE_REASON_MESSAGES, reason)) {
    return FAILURE_REASON_MESSAGES[reason as keyof typeof FAILURE_REASON_MESSAGES]
  }
  return FAILED_GENERIC_MESSAGE
}

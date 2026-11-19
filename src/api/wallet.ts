import { parseIsoInstant } from '../lib/instant'
import { isValidAddress } from '../lib/validate'
import { apiRequest, decimalToText } from './client'
import { PLAIN_DECIMAL, isRecord, unexpectedResponse } from './response'

/**
 * Saldo (ficha CT6) e histórico (ficha CT26) da carteira. Rotas protegidas:
 * levam o token. Só chamam apiRequest; não conhecem React.
 */

/** CT6: 200 { ethereumAddress, balanceEth, network }. */
export type Balance = {
  /** Endereço da carteira do usuário do token (o do app_user). */
  ethereumAddress: string
  /** Saldo em ETH como texto, em notação plana. Nunca passa por Number. */
  balanceEth: string
  network: 'SEPOLIA'
  /**
   * true quando o texto é o exato do JSON (reviver com context.source).
   * false no navegador sem esse suporte: o número já perdeu dígitos no
   * JSON.parse e serve só para exibir com 6 casas, nunca para conta.
   */
  exact: boolean
}

/**
 * CT6 getBalance: GET /wallet/balance. Resposta fora da ficha (endereço,
 * rede ou saldo fora do formato) vira INTERNAL_ERROR. Os erros do servidor
 * (TOKEN_INVALID, BLOCKCHAIN_UNAVAILABLE, INTERNAL_ERROR) chegam pelo code.
 */
export async function getBalance(token: string, signal?: AbortSignal): Promise<Balance> {
  const body = await apiRequest<unknown>('/wallet/balance', { token, signal })
  if (
    !isRecord(body) ||
    typeof body.ethereumAddress !== 'string' ||
    !isValidAddress(body.ethereumAddress) ||
    body.ethereumAddress.trim() !== body.ethereumAddress ||
    body.network !== 'SEPOLIA'
  ) {
    throw unexpectedResponse()
  }

  const raw = body.balanceEth
  if (typeof raw !== 'string' && typeof raw !== 'number') throw unexpectedResponse()
  const balanceEth = decimalToText(raw)
  if (!PLAIN_DECIMAL.test(balanceEth)) throw unexpectedResponse()

  return {
    ethereumAddress: body.ethereumAddress,
    balanceEth,
    network: 'SEPOLIA',
    exact: typeof raw === 'string',
  }
}

// ---------------------------------------------------------------------------
// Histórico (CT26)
// ---------------------------------------------------------------------------

/** Teto da lista no CT26: as 20 transações mais recentes. */
export const MAX_ACTIVITY_ITEMS = 20

export type ActivityDirection = 'SENT' | 'RECEIVED' | 'SELF'
export type ActivityStatus = 'CONFIRMED' | 'FAILED'

const DIRECTIONS: ReadonlySet<string> = new Set<ActivityDirection>(['SENT', 'RECEIVED', 'SELF'])
const ACTIVITY_STATUSES: ReadonlySet<string> = new Set<ActivityStatus>(['CONFIRMED', 'FAILED'])

/** Hash de transação: 0x e 64 hexadecimais. */
const TX_HASH = /^0x[0-9a-fA-F]{64}$/

/** Valor em ETH como o Core API confere: até 20 dígitos inteiros e até 18 casas (1 wei). */
const ETH_AMOUNT = /^\d{1,20}(\.\d{1,18})?$/

/** Item do CT26, já minerado (o PENDING segue no acompanhamento, CT13). */
export type WalletTransaction = {
  /** Hash validado (^0x[0-9a-fA-F]{64}$). */
  hash: string
  /** Do ponto de vista da carteira do usuário. */
  direction: ActivityDirection
  /** A outra ponta, como endereço; null só na criação de contrato que falhou. */
  counterpartyAddress: string | null
  /** Valor em ETH como texto, em notação plana. Nunca passa por Number. */
  amountEth: string
  /** Instante ISO 8601 UTC, como veio do Core API. */
  timestamp: string
  /** FAILED é transação minerada que reverteu. */
  status: ActivityStatus
}

/** CT26: 200 { ethereumAddress, network, transactions }. */
export type WalletActivity = {
  ethereumAddress: string
  network: 'SEPOLIA'
  /** Até 20, mais recentes primeiro (na ordem do Core API); vazia se não há transações. */
  transactions: WalletTransaction[]
}

function isAddressText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && isValidAddress(value)
}

function parseActivityItem(item: unknown): WalletTransaction {
  if (
    !isRecord(item) ||
    typeof item.hash !== 'string' ||
    !TX_HASH.test(item.hash) ||
    typeof item.direction !== 'string' ||
    !DIRECTIONS.has(item.direction) ||
    typeof item.status !== 'string' ||
    !ACTIVITY_STATUSES.has(item.status) ||
    // Campo obrigatório: ausente (undefined) também é fora da ficha.
    (item.counterpartyAddress !== null && !isAddressText(item.counterpartyAddress)) ||
    parseIsoInstant(item.timestamp) === null
  ) {
    throw unexpectedResponse()
  }

  const raw = item.amountEth
  if (typeof raw !== 'string' && typeof raw !== 'number') throw unexpectedResponse()
  const amountEth = decimalToText(raw)
  if (!ETH_AMOUNT.test(amountEth)) throw unexpectedResponse()

  return {
    hash: item.hash,
    direction: item.direction as ActivityDirection,
    counterpartyAddress: item.counterpartyAddress as string | null,
    amountEth,
    timestamp: item.timestamp as string,
    status: item.status as ActivityStatus,
  }
}

/**
 * CT26 getWalletTransactions: GET /wallet/transactions. O corpo é conferido
 * inteiro: um item fora da ficha invalida a lista toda (nada de lista
 * parcial) e vira INTERNAL_ERROR. Os erros do servidor (TOKEN_INVALID,
 * HISTORY_UNAVAILABLE, INTERNAL_ERROR) chegam pelo code. Cancelamento pelo
 * signal rejeita com AbortError.
 */
export async function getWalletTransactions(
  token: string,
  signal?: AbortSignal,
): Promise<WalletActivity> {
  const body = await apiRequest<unknown>('/wallet/transactions', { token, signal })
  if (
    !isRecord(body) ||
    !isAddressText(body.ethereumAddress) ||
    body.network !== 'SEPOLIA' ||
    !Array.isArray(body.transactions) ||
    body.transactions.length > MAX_ACTIVITY_ITEMS
  ) {
    throw unexpectedResponse()
  }

  return {
    ethereumAddress: body.ethereumAddress,
    network: 'SEPOLIA',
    transactions: (body.transactions as unknown[]).map(parseActivityItem),
  }
}

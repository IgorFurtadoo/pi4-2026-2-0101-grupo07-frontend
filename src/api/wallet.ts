import { isValidAddress } from '../lib/validate'
import { apiRequest, decimalToText } from './client'
import { PLAIN_DECIMAL, isRecord, unexpectedResponse } from './response'

/**
 * Saldo da carteira (ficha CT6). Rota protegida: leva o token. Só chama
 * apiRequest; não conhece React.
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

/**
 * Corpo do CT26 para os testes, escrito como o Core API manda: amountEth
 * como número JSON cru (sem passar por JSON.stringify, que perderia dígitos).
 */

export const ACTIVITY_URL = 'http://localhost:8080/wallet/transactions'

export const WALLET_ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
export const COUNTERPARTY = '0x6bdB5129e34773c822044a2078e6ba1576A258E6'

/** Hash válido de 64 hexadecimais, distinto por `n`. */
export function txHash(n = 1): string {
  return `0x${n.toString(16).padStart(64, '0')}`
}

export type ActivityItemInit = {
  hash?: string
  direction?: string
  /** Texto JSON do campo: `"0x…"`, `null` ou outro valor cru. */
  counterpartyAddress?: string
  /** Texto JSON cru do número (ou de outro valor). */
  amountEth?: string
  timestamp?: string
  status?: string
}

/** Item do CT26 como texto JSON. Os campos crus entram sem aspas extras. */
export function activityItem(init: ActivityItemInit = {}): string {
  const {
    hash = txHash(1),
    direction = 'RECEIVED',
    counterpartyAddress = `"${COUNTERPARTY}"`,
    amountEth = '0.0005',
    timestamp = '2026-11-16T04:12:00Z',
    status = 'CONFIRMED',
  } = init
  return `{"hash":"${hash}","direction":"${direction}","counterpartyAddress":${counterpartyAddress},"amountEth":${amountEth},"timestamp":"${timestamp}","status":"${status}"}`
}

/** Corpo 200 do CT26 com os itens dados (texto JSON de cada um). */
export function activityBody(items: string[] = [], address = WALLET_ADDRESS): string {
  return `{"ethereumAddress":"${address}","network":"SEPOLIA","transactions":[${items.join(',')}]}`
}

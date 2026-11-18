/** Hash de transação Ethereum: 0x e 64 hexadecimais. */
const TX_HASH = /^0x[0-9a-fA-F]{64}$/

/** Explorador da Sepolia (desenho, seções 6.2 e 10). */
const ETHERSCAN_TX_URL = 'https://sepolia.etherscan.io/tx/'

/**
 * Link do Etherscan da Sepolia para um hash, ou null se o hash não estiver no
 * formato: o link só existe com o hash validado.
 */
export function etherscanTxUrl(hash: string): string | null {
  return TX_HASH.test(hash) ? `${ETHERSCAN_TX_URL}${hash}` : null
}

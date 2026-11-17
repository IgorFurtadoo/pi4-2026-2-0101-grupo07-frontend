/**
 * Formatação de ETH por manipulação de texto, sem passar por Number: o saldo e
 * o valor chegam da API como texto exato (reviver decimal do client.ts) e
 * Number perde dígitos acima de ~15 algarismos.
 */

/** Decimal em texto, com ponto: "0", "12", "0.25". */
const DECIMAL_TEXT = /^\d+(\.\d+)?$/

/**
 * Normaliza o valor digitado para o texto enviado ao Core API: tira os
 * espaços das pontas, aceita vírgula ou ponto como separador decimal e
 * completa ".5" para "0.5" e "5." para "5". Não valida (ver validate.ts).
 */
export function normalizeAmountInput(raw: string): string {
  let text = raw.trim().replace(',', '.')
  if (text.startsWith('.')) text = `0${text}`
  if (text.endsWith('.')) text = text.slice(0, -1)
  return text
}

/**
 * ETH para exibir em pt-BR: milhares com ponto, decimais com vírgula, até
 * `maxDecimals` casas CORTADAS (nunca arredonda para cima) e sem zeros à
 * direita. Um valor positivo menor que a menor casa exibida aparece como
 * "< 0,000001", nunca como "0". Texto fora do formato volta como veio.
 */
export function formatEth(value: string, maxDecimals = 6): string {
  if (!DECIMAL_TEXT.test(value)) return value

  const [rawInteger, fraction = ''] = value.split('.')
  const integer = rawInteger.replace(/^0+(?=\d)/, '')
  const shown = fraction.slice(0, maxDecimals).replace(/0+$/, '')

  if (integer === '0' && shown === '' && /[1-9]/.test(fraction)) {
    return maxDecimals > 0 ? `< 0,${'0'.repeat(maxDecimals - 1)}1` : '< 1'
  }

  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return shown === '' ? grouped : `${grouped},${shown}`
}

/** Maior número de casas do ETH (1 wei). Com ele, formatEth mostra o valor inteiro. */
export const ETH_DECIMALS = 18

/** Saldo zero, decidido pelo texto: "0", "0.000000000000000000". */
export function isZeroEth(value: string): boolean {
  return /^0+(\.0+)?$/.test(value)
}

/** Endereço abreviado para o chip: os 6 primeiros e os 4 últimos ("0x71C7…976F"). */
export function shortenAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Corpo do CT17 para os testes, com os decimais como número JSON (sem passar
 * por JSON.stringify, como o Core API manda). Um ponto por hora a partir de
 * `start`.
 */
export function marketBody(
  prices: string[] = ['2000', '2100', '2200'],
  currentPrice = '3200.45',
  start = Date.UTC(2026, 10, 12, 3),
): string {
  const series = prices
    .map((price, index) => {
      const timestamp = new Date(start + index * 3_600_000).toISOString().replace('.000Z', 'Z')
      return `{"timestamp":"${timestamp}","price":${price}}`
    })
    .join(',')
  return `{"assetId":"ethereum","currency":"USD","currentPrice":${currentPrice},"series":[${series}]}`
}

export const MARKET_URL = 'http://localhost:8080/market/ethereum'

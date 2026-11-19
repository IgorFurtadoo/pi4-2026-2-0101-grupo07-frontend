import { parseIsoInstant } from '../lib/instant'
import { apiRequest, decimalToText } from './client'
import { PLAIN_DECIMAL, isRecord, unexpectedResponse } from './response'

/**
 * Mercado do ETH (ficha CT17). Rota protegida: leva o token. Só chama
 * apiRequest; não conhece React.
 */

/** O Frontend só mostra o ETH (E6, passo 1). */
export const MARKET_ASSET_ID = 'ethereum'

/** Teto de pontos aceitos na série (a CoinGecko devolve ~169 em 7 dias). */
export const MAX_SERIES_POINTS = 1_000

export type PricePoint = {
  /** Instante ISO 8601 UTC, como veio do Core API. */
  timestamp: string
  /** Milissegundos desde a época, do mesmo instante. */
  time: number
  /** Preço em USD como texto plano (exato quando o navegador expõe context.source). */
  price: string
}

/** CT17: 200 { assetId, currency, currentPrice, series }. */
export type MarketData = {
  assetId: typeof MARKET_ASSET_ID
  currency: 'USD'
  currentPrice: string
  /** Ao menos um ponto, em ordem de tempo não decrescente. */
  series: PricePoint[]
}

/** Decimal do corpo em texto plano, ou null fora do formato. */
function plainDecimal(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  // Depois do reviver, string é o texto exato do número JSON (como no saldo,
  // um texto JSON entre aspas também chega aqui e passa pela mesma regra).
  const text = decimalToText(raw)
  return PLAIN_DECIMAL.test(text) ? text : null
}

/**
 * Confere o corpo contra a ficha. Qualquer campo fora do formato invalida a
 * resposta inteira: nada de série parcial. Os instantes só são conferidos
 * entre si (formato e ordem), nunca contra o relógio local, que pode estar
 * atrasado em relação ao último ponto.
 */
function parseMarket(body: unknown): MarketData {
  if (
    !isRecord(body) ||
    body.assetId !== MARKET_ASSET_ID ||
    body.currency !== 'USD' ||
    !Array.isArray(body.series) ||
    body.series.length === 0 ||
    body.series.length > MAX_SERIES_POINTS
  ) {
    throw unexpectedResponse()
  }

  const currentPrice = plainDecimal(body.currentPrice)
  if (currentPrice === null) throw unexpectedResponse()

  const series: PricePoint[] = []
  for (const point of body.series as unknown[]) {
    if (!isRecord(point)) throw unexpectedResponse()
    const time = parseIsoInstant(point.timestamp)
    const price = plainDecimal(point.price)
    if (time === null || price === null) throw unexpectedResponse()
    const previous = series.at(-1)
    if (previous && time < previous.time) throw unexpectedResponse()
    series.push({ timestamp: point.timestamp as string, time, price })
  }

  return { assetId: MARKET_ASSET_ID, currency: 'USD', currentPrice, series }
}

/**
 * CT17 getMarketData: GET /market/ethereum. Resposta fora da ficha vira
 * INTERNAL_ERROR. Os erros do servidor chegam pelo code: TOKEN_INVALID,
 * ASSET_NOT_FOUND, RATE_LIMIT_EXCEEDED (com retryAfter em segundos, do
 * Retry-After), MARKET_DATA_UNAVAILABLE e INTERNAL_ERROR.
 */
export async function getMarket(token: string, signal?: AbortSignal): Promise<MarketData> {
  const body = await apiRequest<unknown>(`/market/${MARKET_ASSET_ID}`, { token, signal })
  return parseMarket(body)
}

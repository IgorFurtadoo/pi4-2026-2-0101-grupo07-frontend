import { describe, expect, it, vi } from 'vitest'
import { MAX_SERIES_POINTS, getMarket } from './market'

type FetchArgs = [url: string, init: RequestInit]

const TOKEN = 'token-de-teste'

/** Corpo cru: os decimais vão como número JSON, sem passar por JSON.stringify. */
function mockFetchText(status: number, text: string, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>().mockResolvedValue(
    new Response(text, { status, headers: { 'Content-Type': 'application/json', ...headers } }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const SERIES =
  '[{"timestamp":"2026-11-12T03:00:00Z","price":2055.7338345700337},' +
  '{"timestamp":"2026-11-12T04:00:00Z","price":3187.9},' +
  '{"timestamp":"2026-11-19T02:50:10Z","price":3200.4500}]'

function marketBody({
  assetId = '"ethereum"',
  currency = '"USD"',
  currentPrice = '3200.4500',
  series = SERIES,
} = {}) {
  return `{"assetId":${assetId},"currency":${currency},"currentPrice":${currentPrice},"series":${series}}`
}

describe('getMarket (CT17)', () => {
  it('faz GET /market/ethereum com Authorization Bearer', async () => {
    const fetchMock = mockFetchText(200, marketBody())

    await getMarket(TOKEN)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/market/ethereum')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('devolve preço e série com o texto exato do JSON (sem normalizar zeros)', async () => {
    mockFetchText(200, marketBody())

    const result = await getMarket(TOKEN)

    expect(result).toEqual({
      assetId: 'ethereum',
      currency: 'USD',
      currentPrice: '3200.4500',
      series: [
        {
          timestamp: '2026-11-12T03:00:00Z',
          time: Date.UTC(2026, 10, 12, 3),
          price: '2055.7338345700337',
        },
        { timestamp: '2026-11-12T04:00:00Z', time: Date.UTC(2026, 10, 12, 4), price: '3187.9' },
        {
          timestamp: '2026-11-19T02:50:10Z',
          time: Date.UTC(2026, 10, 19, 2, 50, 10),
          price: '3200.4500',
        },
      ],
    })
  })

  it('aceita série de um ponto e pontos no mesmo instante', async () => {
    mockFetchText(
      200,
      marketBody({
        series:
          '[{"timestamp":"2026-11-12T03:00:00Z","price":1},{"timestamp":"2026-11-12T03:00:00Z","price":2}]',
      }),
    )
    await expect(getMarket(TOKEN)).resolves.toMatchObject({ series: [{ price: '1' }, { price: '2' }] })

    mockFetchText(200, marketBody({ series: '[{"timestamp":"2026-11-12T03:00:00Z","price":1}]' }))
    await expect(getMarket(TOKEN)).resolves.toMatchObject({ series: [{ price: '1' }] })
  })

  it('não compara a série com o relógio local: ponto no futuro é aceito', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 0, 1))
    try {
      mockFetchText(200, marketBody())
      await expect(getMarket(TOKEN)).resolves.toMatchObject({ currentPrice: '3200.4500' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('sem context.source no reviver (navegador antigo) devolve o texto do número', async () => {
    const parse = JSON.parse
    vi.spyOn(JSON, 'parse').mockImplementation((text: string) => parse(text))
    mockFetchText(200, marketBody({ currentPrice: '3200.45' }))

    const result = await getMarket(TOKEN)

    expect(result.currentPrice).toBe('3200.45')
    expect(result.series[0].price).toBe('2055.7338345700337')
  })

  const point = (timestamp: string, price: string) => `{"timestamp":${timestamp},"price":${price}}`
  const tooMany = `[${Array.from({ length: MAX_SERIES_POINTS + 1 }, () => point('"2026-11-12T03:00:00Z"', '1')).join(',')}]`

  it.each([
    ['corpo nulo', 'null'],
    ['corpo lista', '[]'],
    ['assetId diferente', marketBody({ assetId: '"bitcoin"' })],
    ['assetId em maiúsculas', marketBody({ assetId: '"ETHEREUM"' })],
    ['sem assetId', '{"currency":"USD","currentPrice":1,"series":' + SERIES + '}'],
    ['moeda diferente', marketBody({ currency: '"BRL"' })],
    ['preço atual nulo', marketBody({ currentPrice: 'null' })],
    ['preço atual negativo', marketBody({ currentPrice: '-1' })],
    ['preço atual com expoente', marketBody({ currentPrice: '3.2E3' })],
    ['preço atual não numérico', marketBody({ currentPrice: '"abc"' })],
    ['série ausente', '{"assetId":"ethereum","currency":"USD","currentPrice":1}'],
    ['série vazia', marketBody({ series: '[]' })],
    ['série objeto', marketBody({ series: '{}' })],
    ['série grande demais', marketBody({ series: tooMany })],
    ['ponto nulo', marketBody({ series: '[null]' })],
    ['ponto sem preço', marketBody({ series: '[{"timestamp":"2026-11-12T03:00:00Z"}]' })],
    ['ponto com preço negativo', marketBody({ series: `[${point('"2026-11-12T03:00:00Z"', '-5')}]` })],
    ['ponto sem instante', marketBody({ series: '[{"price":1}]' })],
    ['instante sem fuso', marketBody({ series: `[${point('"2026-11-12T03:00:00"', '1')}]` })],
    ['instante em milissegundos', marketBody({ series: `[${point('1763000000000', '1')}]` })],
    [
      'série fora de ordem',
      marketBody({
        series: `[${point('"2026-11-12T04:00:00Z"', '1')},${point('"2026-11-12T03:00:00Z"', '2')}]`,
      }),
    ],
    [
      'um ponto ruim no meio',
      marketBody({
        series: `[${point('"2026-11-12T03:00:00Z"', '1')},${point('"x"', '2')},${point('"2026-11-12T05:00:00Z"', '3')}]`,
      }),
    ],
  ])('resposta fora da ficha (%s) vira INTERNAL_ERROR, sem série parcial', async (_name, text) => {
    mockFetchText(200, text)

    await expect(getMarket(TOKEN)).rejects.toMatchObject({ name: 'ApiError', code: 'INTERNAL_ERROR' })
  })

  it('429 RATE_LIMIT_EXCEEDED expõe o Retry-After em segundos', async () => {
    mockFetchText(429, '{"code":"RATE_LIMIT_EXCEEDED","message":"Muitas requisições."}', {
      'Retry-After': '37',
    })

    await expect(getMarket(TOKEN)).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 37,
    })
  })

  it('429 sem Retry-After chega com retryAfter indefinido', async () => {
    mockFetchText(429, '{"code":"RATE_LIMIT_EXCEEDED","message":"Muitas requisições."}')

    const error = await getMarket(TOKEN).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' })
    expect((error as { retryAfter?: number }).retryAfter).toBeUndefined()
  })

  it.each([
    [502, 'MARKET_DATA_UNAVAILABLE'],
    [404, 'ASSET_NOT_FOUND'],
    [401, 'TOKEN_INVALID'],
    [500, 'INTERNAL_ERROR'],
  ])('%i %s chega pelo code', async (status, code) => {
    mockFetchText(status, JSON.stringify({ code, message: 'Mensagem do servidor.' }))

    await expect(getMarket(TOKEN)).rejects.toMatchObject({ status, code })
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(getMarket(TOKEN)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })
})

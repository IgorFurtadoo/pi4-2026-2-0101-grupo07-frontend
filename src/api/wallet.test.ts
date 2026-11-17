import { describe, expect, it, vi } from 'vitest'
import { getBalance } from './wallet'

type FetchArgs = [url: string, init: RequestInit]

const ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
const TOKEN = 'token-de-teste'

/** Corpo cru: os decimais vão como número JSON, sem passar por JSON.stringify. */
function mockFetchText(status: number, text: string) {
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>().mockResolvedValue(
    new Response(text, { status, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function balanceBody(balanceEth: string, overrides = '') {
  return `{"ethereumAddress":"${ADDRESS}","balanceEth":${balanceEth},"network":"SEPOLIA"${overrides}}`
}

describe('getBalance (CT6)', () => {
  it('faz GET /wallet/balance com Authorization Bearer', async () => {
    const fetchMock = mockFetchText(200, balanceBody('0.25'))

    const result = await getBalance(TOKEN)

    expect(result).toEqual({
      ethereumAddress: ADDRESS,
      balanceEth: '0.25',
      network: 'SEPOLIA',
      exact: true,
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/wallet/balance')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it.each([
    '123456789.123456789012345678',
    '0.002499999999601',
    '0.000000000000000001',
    '0.000000000000000000',
    '0',
  ])('preserva o texto exato de %s', async (value) => {
    mockFetchText(200, balanceBody(value))

    const result = await getBalance(TOKEN)

    expect(result.balanceEth).toBe(value)
    expect(result.exact).toBe(true)
  })

  it('cancelamento pelo chamador rejeita com o AbortError, não com ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) =>
        init.signal?.aborted
          ? Promise.reject(new DOMException('Cancelado', 'AbortError'))
          : Promise.resolve(new Response(balanceBody('1'), { status: 200 })),
      ),
    )
    const controller = new AbortController()
    controller.abort()

    await expect(getBalance(TOKEN, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('sem context.source no reviver (navegador antigo) devolve o texto do número e exact: false', async () => {
    const parse = JSON.parse
    vi.spyOn(JSON, 'parse').mockImplementation((text: string) => parse(text))
    mockFetchText(200, balanceBody('0.002499999999601'))

    const result = await getBalance(TOKEN)

    expect(result.balanceEth).toBe('0.002499999999601')
    expect(result.exact).toBe(false)
  })

  it.each([
    ['sem endereço', '{"balanceEth":0.25,"network":"SEPOLIA"}'],
    ['endereço curto', '{"ethereumAddress":"0x71C7","balanceEth":0.25,"network":"SEPOLIA"}'],
    ['endereço com espaço', `{"ethereumAddress":" ${ADDRESS}","balanceEth":0.25,"network":"SEPOLIA"}`],
    ['rede diferente', `{"ethereumAddress":"${ADDRESS}","balanceEth":0.25,"network":"MAINNET"}`],
    ['sem rede', `{"ethereumAddress":"${ADDRESS}","balanceEth":0.25}`],
    ['sem saldo', `{"ethereumAddress":"${ADDRESS}","network":"SEPOLIA"}`],
    ['saldo nulo', balanceBody('null')],
    ['saldo negativo', balanceBody('-1')],
    ['saldo com expoente', balanceBody('1E-18')],
    ['saldo com expoente em texto', balanceBody('"1E-18"')],
    ['saldo em texto não numérico', balanceBody('"abc"')],
    ['saldo booleano', balanceBody('true')],
    ['saldo objeto', balanceBody('{"valor":1}')],
    ['corpo nulo', 'null'],
    ['corpo lista', '[]'],
  ])('resposta fora da ficha (%s) vira INTERNAL_ERROR', async (_name, text) => {
    mockFetchText(200, text)

    await expect(getBalance(TOKEN)).rejects.toMatchObject({ name: 'ApiError', code: 'INTERNAL_ERROR' })
  })

  it('502 BLOCKCHAIN_UNAVAILABLE chega pelo code', async () => {
    mockFetchText(502, '{"code":"BLOCKCHAIN_UNAVAILABLE","message":"Indisponível."}')

    await expect(getBalance(TOKEN)).rejects.toMatchObject({
      status: 502,
      code: 'BLOCKCHAIN_UNAVAILABLE',
    })
  })

  it('401 TOKEN_INVALID chega pelo code', async () => {
    mockFetchText(401, '{"code":"TOKEN_INVALID","message":"Token inválido."}')

    await expect(getBalance(TOKEN)).rejects.toMatchObject({ status: 401, code: 'TOKEN_INVALID' })
  })
})

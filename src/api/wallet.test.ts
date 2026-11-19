import { describe, expect, it, vi } from 'vitest'
import { ACTIVITY_URL, COUNTERPARTY, WALLET_ADDRESS, activityBody, activityItem, txHash } from '../test/activity'
import { MAX_ACTIVITY_ITEMS, getBalance, getWalletTransactions } from './wallet'

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

describe('getWalletTransactions (CT26)', () => {
  it('faz GET /wallet/transactions com Bearer e devolve os itens na ordem do Core API', async () => {
    const fetchMock = mockFetchText(
      200,
      activityBody([
        activityItem({ hash: txHash(2), direction: 'SENT', amountEth: '0.000000000000000001' }),
        activityItem({ hash: txHash(1), direction: 'RECEIVED', amountEth: '0.000500000000000000' }),
      ]),
    )

    const result = await getWalletTransactions(TOKEN)

    expect(result).toEqual({
      ethereumAddress: WALLET_ADDRESS,
      network: 'SEPOLIA',
      transactions: [
        {
          hash: txHash(2),
          direction: 'SENT',
          counterpartyAddress: COUNTERPARTY,
          amountEth: '0.000000000000000001',
          timestamp: '2026-11-16T04:12:00Z',
          status: 'CONFIRMED',
        },
        {
          hash: txHash(1),
          direction: 'RECEIVED',
          counterpartyAddress: COUNTERPARTY,
          amountEth: '0.000500000000000000',
          timestamp: '2026-11-16T04:12:00Z',
          status: 'CONFIRMED',
        },
      ],
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(ACTIVITY_URL)
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('o exemplo da ficha CT26, literal, é aceito', async () => {
    mockFetchText(
      200,
      `{
  "ethereumAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "network": "SEPOLIA",
  "transactions": [
    {
      "hash": "0x336be534b01ce174e559209ffdde79b15ffeb5f47a66b16f77737d45fcef7598",
      "direction": "RECEIVED",
      "counterpartyAddress": "0x6bdB5129e34773c822044a2078e6ba1576A258E6",
      "amountEth": 0.0005,
      "timestamp": "2026-11-16T04:12:00Z",
      "status": "CONFIRMED"
    }
  ]
}`,
    )

    const { transactions } = await getWalletTransactions(TOKEN)

    expect(transactions).toHaveLength(1)
    expect(transactions[0].amountEth).toBe('0.0005')
  })

  it('lista vazia é válida', async () => {
    mockFetchText(200, activityBody([]))

    await expect(getWalletTransactions(TOKEN)).resolves.toEqual({
      ethereumAddress: WALLET_ADDRESS,
      network: 'SEPOLIA',
      transactions: [],
    })
  })

  it('aceita SELF, FAILED, counterpartyAddress nulo, 20 itens e campos extras', async () => {
    const items = Array.from({ length: MAX_ACTIVITY_ITEMS }, (_, i) =>
      activityItem({ hash: txHash(i + 1) }),
    )
    items[0] = activityItem({ direction: 'SELF', status: 'FAILED', counterpartyAddress: 'null' })
    mockFetchText(200, activityBody(items).replace('"network"', '"extra":1,"network"'))

    const { transactions } = await getWalletTransactions(TOKEN)

    expect(transactions).toHaveLength(20)
    expect(transactions[0]).toMatchObject({ direction: 'SELF', status: 'FAILED', counterpartyAddress: null })
  })

  it('sem context.source no reviver, o número vira texto plano', async () => {
    const parse = JSON.parse
    vi.spyOn(JSON, 'parse').mockImplementation((text: string) => parse(text))
    mockFetchText(200, activityBody([activityItem({ amountEth: '0.0000001' })]))

    const { transactions } = await getWalletTransactions(TOKEN)

    expect(transactions[0].amountEth).toBe('0.0000001')
  })

  it.each([
    ['corpo nulo', 'null'],
    ['corpo lista', '[]'],
    ['sem endereço', '{"network":"SEPOLIA","transactions":[]}'],
    ['endereço curto', activityBody([], '0x71C7')],
    ['endereço com espaço', activityBody([], ` ${WALLET_ADDRESS}`)],
    ['rede diferente', activityBody([]).replace('SEPOLIA', 'MAINNET')],
    ['sem rede', `{"ethereumAddress":"${WALLET_ADDRESS}","transactions":[]}`],
    ['sem lista', `{"ethereumAddress":"${WALLET_ADDRESS}","network":"SEPOLIA"}`],
    ['lista nula', `{"ethereumAddress":"${WALLET_ADDRESS}","network":"SEPOLIA","transactions":null}`],
    ['lista objeto', `{"ethereumAddress":"${WALLET_ADDRESS}","network":"SEPOLIA","transactions":{}}`],
    [
      'lista com 21 itens',
      activityBody(Array.from({ length: MAX_ACTIVITY_ITEMS + 1 }, (_, i) => activityItem({ hash: txHash(i + 1) }))),
    ],
    ['item nulo', activityBody(['null'])],
    ['item texto', activityBody(['"x"'])],
    ['item lista', activityBody(['[]'])],
    ['hash curto', activityBody([activityItem({ hash: '0x336be534' })])],
    ['hash sem 0x', activityBody([activityItem({ hash: '1'.repeat(64) })])],
    ['hash com 65 dígitos', activityBody([activityItem({ hash: `0x${'a'.repeat(65)}` })])],
    ['hash com caractere não hexadecimal', activityBody([activityItem({ hash: `0x${'g'.repeat(64)}` })])],
    ['hash com HTML', activityBody([activityItem({ hash: `0x${'a'.repeat(62)}<b` })])],
    ['sem hash', activityBody([activityItem().replace(/"hash":"[^"]*",/, '')])],
    ['direction desconhecida', activityBody([activityItem({ direction: 'OUT' })])],
    ['direction em minúsculas', activityBody([activityItem({ direction: 'sent' })])],
    ['status PENDING', activityBody([activityItem({ status: 'PENDING' })])],
    ['status em minúsculas', activityBody([activityItem({ status: 'confirmed' })])],
    ['sem counterpartyAddress', activityBody([activityItem().replace(/"counterpartyAddress":"[^"]*",/, '')])],
    ['counterpartyAddress número', activityBody([activityItem({ counterpartyAddress: '1' })])],
    ['counterpartyAddress vazio', activityBody([activityItem({ counterpartyAddress: '""' })])],
    ['counterpartyAddress curto', activityBody([activityItem({ counterpartyAddress: '"0x6bdB"' })])],
    ['counterpartyAddress com espaço', activityBody([activityItem({ counterpartyAddress: `" ${COUNTERPARTY}"` })])],
    ['sem amountEth', activityBody([activityItem().replace(/"amountEth":[^,]*,/, '')])],
    ['amountEth nulo', activityBody([activityItem({ amountEth: 'null' })])],
    ['amountEth negativo', activityBody([activityItem({ amountEth: '-0.5' })])],
    ['amountEth com expoente', activityBody([activityItem({ amountEth: '1E-18' })])],
    ['amountEth com expoente em texto', activityBody([activityItem({ amountEth: '"1E-18"' })])],
    ['amountEth texto não numérico', activityBody([activityItem({ amountEth: '"abc"' })])],
    ['amountEth com 19 casas', activityBody([activityItem({ amountEth: '0.0000000000000000001' })])],
    ['amountEth com 21 dígitos inteiros', activityBody([activityItem({ amountEth: '1'.repeat(21) })])],
    ['amountEth booleano', activityBody([activityItem({ amountEth: 'true' })])],
    ['sem timestamp', activityBody([activityItem().replace(/,"timestamp":"[^"]*"/, '')])],
    ['timestamp sem Z', activityBody([activityItem({ timestamp: '2026-11-16T04:12:00' })])],
    ['timestamp com fuso', activityBody([activityItem({ timestamp: '2026-11-16T04:12:00+00:00' })])],
    ['timestamp inválido', activityBody([activityItem({ timestamp: '2026-13-45T99:12:00Z' })])],
    ['timestamp só data', activityBody([activityItem({ timestamp: '2026-11-16' })])],
    ['um item ruim entre bons', activityBody([activityItem(), activityItem({ hash: 'x' }), activityItem()])],
  ])('resposta fora da ficha (%s) vira INTERNAL_ERROR, sem lista parcial', async (_name, text) => {
    mockFetchText(200, text)

    await expect(getWalletTransactions(TOKEN)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
    })
  })

  it('502 HISTORY_UNAVAILABLE chega pelo code', async () => {
    mockFetchText(502, '{"code":"HISTORY_UNAVAILABLE","message":"Não foi possível obter o histórico agora. Tente novamente."}')

    await expect(getWalletTransactions(TOKEN)).rejects.toMatchObject({
      status: 502,
      code: 'HISTORY_UNAVAILABLE',
    })
  })

  it('401 TOKEN_INVALID chega pelo code', async () => {
    mockFetchText(401, '{"code":"TOKEN_INVALID","message":"Token inválido."}')

    await expect(getWalletTransactions(TOKEN)).rejects.toMatchObject({ status: 401, code: 'TOKEN_INVALID' })
  })

  it('cancelamento pelo chamador rejeita com o AbortError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('Cancelado', 'AbortError'))),
    )
    const controller = new AbortController()
    controller.abort()

    await expect(getWalletTransactions(TOKEN, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

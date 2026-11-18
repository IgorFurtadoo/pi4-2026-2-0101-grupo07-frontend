import { describe, expect, it, vi } from 'vitest'
import {
  FAILED_GENERIC_MESSAGE,
  FAILURE_REASON_MESSAGES,
  failureReasonMessage,
  getTransaction,
  isFinalStatus,
  sendTransaction,
} from './transactions'

type FetchArgs = [url: string, init: RequestInit]

const ADDRESS = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4'
const TOKEN = 'token-de-teste'
const TASK_ID = 'a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b'

function mockFetchText(status: number, text: string) {
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>().mockResolvedValue(
    new Response(text, { status, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const ACCEPTED = `{"taskId":"${TASK_ID}","status":"PENDING"}`

describe('sendTransaction (CT9)', () => {
  it('faz POST /transactions com Authorization Bearer e devolve o taskId', async () => {
    const fetchMock = mockFetchText(202, ACCEPTED)

    const result = await sendTransaction(TOKEN, { destinationAddress: ADDRESS, amountEth: '0.01' })

    expect(result).toEqual({ taskId: TASK_ID, status: 'PENDING' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/transactions')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('envia o valor como TEXTO com ponto, no corpo exato', async () => {
    const fetchMock = mockFetchText(202, ACCEPTED)

    await sendTransaction(TOKEN, { destinationAddress: ADDRESS, amountEth: '0.01' })

    expect(fetchMock.mock.calls[0][1].body).toBe(
      `{"destinationAddress":"${ADDRESS}","amountEth":"0.01"}`,
    )
  })

  it('apara o endereço sem mudar a caixa e normaliza o valor digitado', async () => {
    const fetchMock = mockFetchText(202, ACCEPTED)

    await sendTransaction(TOKEN, { destinationAddress: `  ${ADDRESS}\t`, amountEth: ' 0,5 ' })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      destinationAddress: ADDRESS,
      amountEth: '0.5',
    })
  })

  it('mantém todos os dígitos de um valor longo', async () => {
    const fetchMock = mockFetchText(202, ACCEPTED)
    const amount = '12345678901234567890.123456789012345678'

    await sendTransaction(TOKEN, { destinationAddress: ADDRESS, amountEth: amount })

    expect(fetchMock.mock.calls[0][1].body).toContain(`"amountEth":"${amount}"`)
  })

  it.each([
    ['sem taskId', '{"status":"PENDING"}'],
    ['taskId vazio', '{"taskId":"","status":"PENDING"}'],
    ['taskId só espaços', '{"taskId":"  ","status":"PENDING"}'],
    ['taskId numérico', '{"taskId":42,"status":"PENDING"}'],
    ['status diferente', `{"taskId":"${TASK_ID}","status":"CONFIRMED"}`],
    ['sem status', `{"taskId":"${TASK_ID}"}`],
    ['corpo nulo', 'null'],
    ['corpo lista', '[]'],
    ['corpo vazio', ''],
    ['JSON quebrado', '{"taskId":'],
  ])('202 fora da ficha (%s) vira INTERNAL_ERROR', async (_name, text) => {
    mockFetchText(202, text)

    await expect(
      sendTransaction(TOKEN, { destinationAddress: ADDRESS, amountEth: '0.01' }),
    ).rejects.toMatchObject({ name: 'ApiError', code: 'INTERNAL_ERROR' })
  })

  it.each([
    [400, 'REQUEST_INVALID'],
    [400, 'ADDRESS_INVALID'],
    [400, 'AMOUNT_INVALID'],
    [401, 'TOKEN_INVALID'],
    [502, 'BLOCKCHAIN_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
  ])('%i %s chega pelo code', async (status, code) => {
    mockFetchText(status, `{"code":"${code}","message":"Mensagem do servidor."}`)

    await expect(
      sendTransaction(TOKEN, { destinationAddress: ADDRESS, amountEth: '0.01' }),
    ).rejects.toMatchObject({ name: 'ApiError', status, code })
  })

  it('falha de rede vira NETWORK_ERROR, sem status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = await sendTransaction(TOKEN, { destinationAddress: ADDRESS, amountEth: '0.01' }).catch(
      (e: unknown) => e,
    )

    expect(error).toMatchObject({ name: 'ApiError', code: 'NETWORK_ERROR' })
    expect((error as { status?: number }).status).toBeUndefined()
  })
})

const HASH = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060'

/** Corpo do CT13 com o amountEth como número JSON (como o Core API manda). */
function txBody(fields: Record<string, string> = {}, amountEth = '0.01') {
  const base: Record<string, string> = {
    taskId: TASK_ID,
    status: 'PENDING',
    destinationAddress: ADDRESS,
    updatedAt: '2026-10-20T14:36:10Z',
    ...fields,
  }
  const parts = Object.entries(base).map(([key, value]) => `"${key}":${JSON.stringify(value)}`)
  return `{${parts.join(',')},"amountEth":${amountEth}}`
}

describe('getTransaction (CT13)', () => {
  it('faz GET /transactions/{taskId} com Authorization Bearer e devolve a transação', async () => {
    const fetchMock = mockFetchText(200, txBody())

    const result = await getTransaction(TOKEN, TASK_ID)

    expect(result).toEqual({
      taskId: TASK_ID,
      status: 'PENDING',
      destinationAddress: ADDRESS,
      amountEth: '0.01',
      updatedAt: '2026-10-20T14:36:10Z',
    })
    expect(result).not.toHaveProperty('transactionHash')
    expect(result).not.toHaveProperty('failureReason')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`http://localhost:8080/transactions/${TASK_ID}`)
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(init.body).toBeUndefined()
  })

  it('codifica o taskId no caminho', async () => {
    const odd = 'a/b?c#d e'
    const fetchMock = mockFetchText(404, '{"code":"TRANSACTION_NOT_FOUND","message":"x"}')

    await getTransaction(TOKEN, odd).catch(() => {})

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/transactions/a%2Fb%3Fc%23d%20e')
  })

  it('CONFIRMED com hash', async () => {
    mockFetchText(200, txBody({ status: 'CONFIRMED', transactionHash: HASH }))

    const result = await getTransaction(TOKEN, TASK_ID)

    expect(result.status).toBe('CONFIRMED')
    expect(result.transactionHash).toBe(HASH)
  })

  it('FAILED com motivo e sem hash', async () => {
    mockFetchText(200, txBody({ status: 'FAILED', failureReason: 'REJECTED_BY_NETWORK' }))

    const result = await getTransaction(TOKEN, TASK_ID)

    expect(result.status).toBe('FAILED')
    expect(result.failureReason).toBe('REJECTED_BY_NETWORK')
    expect(result).not.toHaveProperty('transactionHash')
  })

  it('FAILED com hash e motivo (revertida)', async () => {
    mockFetchText(
      200,
      txBody({ status: 'FAILED', transactionHash: HASH, failureReason: 'TRANSACTION_REVERTED' }),
    )

    const result = await getTransaction(TOKEN, TASK_ID)

    expect(result.transactionHash).toBe(HASH)
    expect(result.failureReason).toBe('TRANSACTION_REVERTED')
  })

  it('motivo desconhecido e hash fora do padrão passam como texto (a tela decide)', async () => {
    mockFetchText(200, txBody({ status: 'FAILED', transactionHash: 'abc', failureReason: 'OUTRO' }))

    const result = await getTransaction(TOKEN, TASK_ID)

    expect(result.transactionHash).toBe('abc')
    expect(result.failureReason).toBe('OUTRO')
  })

  it.each([
    ['1 wei', '0.000000000000000001'],
    ['valor longo', '12345678901234567890.123456789012345678'],
    ['inteiro', '100'],
  ])('amountEth exato como texto (%s)', async (_name, amount) => {
    mockFetchText(200, txBody({}, amount))

    expect((await getTransaction(TOKEN, TASK_ID)).amountEth).toBe(amount)
  })

  it('sem context.source no reviver (navegador antigo) devolve o texto do número', async () => {
    const parse = JSON.parse
    vi.spyOn(JSON, 'parse').mockImplementation((text: string) => parse(text))
    mockFetchText(200, txBody({}, '0.002499999999601'))

    const result = await getTransaction(TOKEN, TASK_ID)

    expect(result.amountEth).toBe('0.002499999999601')
  })

  it('aceita o taskId do corpo com outra caixa (o Core API compara sem caixa)', async () => {
    mockFetchText(200, txBody())

    const result = await getTransaction(TOKEN, TASK_ID.toUpperCase())

    expect(result.taskId).toBe(TASK_ID)
  })

  it.each([
    ['status desconhecido', txBody({ status: 'SUBMITTED' })],
    ['taskId diferente', txBody({ taskId: 'b3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b' })],
    ['sem taskId', `{"status":"PENDING","destinationAddress":"${ADDRESS}","amountEth":0.01,"updatedAt":"2026-10-20T14:36:10Z"}`],
    ['destino ausente', `{"taskId":"${TASK_ID}","status":"PENDING","amountEth":0.01,"updatedAt":"2026-10-20T14:36:10Z"}`],
    ['destino numérico', txBody({}).replace(`"${ADDRESS}"`, '42')],
    ['sem amountEth', `{"taskId":"${TASK_ID}","status":"PENDING","destinationAddress":"${ADDRESS}","updatedAt":"x"}`],
    ['amountEth negativo', txBody({}, '-1')],
    ['amountEth com expoente', txBody({}, '"1E-18"')],
    ['amountEth nulo', txBody({}, 'null')],
    ['sem updatedAt', `{"taskId":"${TASK_ID}","status":"PENDING","destinationAddress":"${ADDRESS}","amountEth":0.01}`],
    ['hash de tipo errado', txBody({}).replace('}', ',"transactionHash":123}')],
    ['hash nulo', txBody({}).replace('}', ',"transactionHash":null}')],
    ['motivo de tipo errado', txBody({ status: 'FAILED' }).replace('}', ',"failureReason":["X"]}')],
    ['corpo nulo', 'null'],
    ['corpo lista', '[]'],
    ['corpo vazio', ''],
    ['JSON quebrado', '{"taskId":'],
  ])('200 fora da ficha (%s) vira INTERNAL_ERROR', async (_name, text) => {
    mockFetchText(200, text)

    await expect(getTransaction(TOKEN, TASK_ID)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
    })
  })

  it.each([
    [404, 'TRANSACTION_NOT_FOUND'],
    [401, 'TOKEN_INVALID'],
    [500, 'INTERNAL_ERROR'],
  ])('%i %s chega pelo code', async (status, code) => {
    mockFetchText(status, `{"code":"${code}","message":"Mensagem do servidor."}`)

    await expect(getTransaction(TOKEN, TASK_ID)).rejects.toMatchObject({
      name: 'ApiError',
      status,
      code,
    })
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(getTransaction(TOKEN, TASK_ID)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('cancelamento pelo chamador rejeita com AbortError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) =>
        init.signal?.aborted
          ? Promise.reject(new DOMException('Cancelado', 'AbortError'))
          : Promise.resolve(new Response(txBody(), { status: 200 })),
      ),
    )
    const controller = new AbortController()
    controller.abort()

    await expect(getTransaction(TOKEN, TASK_ID, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

describe('isFinalStatus', () => {
  it('só CONFIRMED e FAILED são finais', () => {
    expect(isFinalStatus('PENDING')).toBe(false)
    expect(isFinalStatus('CONFIRMED')).toBe(true)
    expect(isFinalStatus('FAILED')).toBe(true)
  })
})

describe('failureReasonMessage', () => {
  it.each([
    ['REJECTED_BY_NETWORK', 'A rede recusou a transação. Verifique se o saldo cobre o valor mais a taxa.'],
    ['TRANSACTION_REVERTED', 'A transação foi executada e revertida.'],
    ['INTERNAL_ERROR', 'Falha interna ao processar. Tente novamente.'],
  ])('%s tem o texto em português', (reason, text) => {
    expect(failureReasonMessage(reason)).toBe(text)
    expect(FAILURE_REASON_MESSAGES[reason as keyof typeof FAILURE_REASON_MESSAGES]).toBe(text)
  })

  it.each([
    ['ausente', undefined],
    ['desconhecido', 'OUT_OF_GAS'],
    ['chave do protótipo', 'constructor'],
    ['caixa diferente', 'rejected_by_network'],
    ['texto do servidor', '<b>Falhou</b> por motivo X'],
  ])('motivo %s usa o texto genérico', (_name, reason) => {
    expect(failureReasonMessage(reason)).toBe(FAILED_GENERIC_MESSAGE)
    expect(FAILED_GENERIC_MESSAGE).toBe('A transação falhou.')
  })
})

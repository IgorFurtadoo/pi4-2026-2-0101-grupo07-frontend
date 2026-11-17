import { describe, expect, it, vi } from 'vitest'
import { sendTransaction } from './transactions'

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

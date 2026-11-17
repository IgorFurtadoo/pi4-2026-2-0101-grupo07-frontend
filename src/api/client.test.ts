import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  API_BASE_URL,
  ApiError,
  REQUEST_TIMEOUT_MS,
  apiRequest,
  setTokenInvalidHandler,
} from './client'

type FetchArgs = [url: string, init: RequestInit]

function mockFetch(response: Response) {
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

/** fetch que só termina quando o sinal aborta, como o fetch real. */
function hangingFetch() {
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        )
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('a promessa deveria ter sido rejeitada')
}

afterEach(() => {
  setTokenInvalidHandler(null)
  vi.useRealTimers()
})

describe('apiRequest: requisição', () => {
  it('usa a URL base padrão e envia o Bearer quando a chamada leva token', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { ok: true }))

    await apiRequest('/wallet/balance', { token: 'abc.def.ghi' })

    expect(API_BASE_URL).toBe('http://localhost:8080')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/wallet/balance')
    expect(init.method).toBe('GET')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer abc.def.ghi')
    expect(headers.Accept).toBe('application/json')
    expect(headers['Content-Type']).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('não envia Authorization sem token e manda o corpo como JSON', async () => {
    const fetchMock = mockFetch(jsonResponse(201, { userId: 1 }))

    await apiRequest('/users', {
      method: 'POST',
      body: { email: 'ana@example.com', password: 'Senha@12345' },
    })

    const [, init] = fetchMock.mock.calls[0]
    const headers = init.headers as Record<string, string>
    expect(headers).not.toHaveProperty('Authorization')
    expect(headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"email":"ana@example.com","password":"Senha@12345"}')
  })

  it('devolve o corpo com os decimais exatos', async () => {
    mockFetch(
      new Response(
        '{"ethereumAddress":"0x71C7656EC7ab88b098defB751B7401B5f6d8976F","balanceEth":123456789.123456789012345678,"network":"SEPOLIA"}',
        { status: 200 },
      ),
    )

    const body = await apiRequest<{ balanceEth: string }>('/wallet/balance', { token: 't' })

    expect(body.balanceEth).toBe('123456789.123456789012345678')
  })

  it('resolve com undefined quando a resposta não tem corpo', async () => {
    mockFetch(new Response(null, { status: 204 }))
    await expect(apiRequest('/qualquer')).resolves.toBeUndefined()
  })
})

describe('apiRequest: ApiError', () => {
  it('lança ApiError com status, code e message do servidor', async () => {
    mockFetch(
      jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' }),
    )

    const error = await catchError(
      apiRequest('/auth/login', { method: 'POST', body: { email: 'a@b.c', password: 'x' } }),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha incorretos',
      retryAfter: undefined,
    })
  })

  it('lê o Retry-After do 429 em segundos', async () => {
    mockFetch(
      jsonResponse(
        429,
        { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas requisições. Tente novamente em instantes.' },
        { 'Retry-After': '7' },
      ),
    )

    const error = await catchError(apiRequest('/market/ethereum', { token: 't' }))

    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMIT_EXCEEDED', retryAfter: 7 })
  })

  it('ignora Retry-After fora do formato de inteiro', async () => {
    mockFetch(
      jsonResponse(429, { code: 'RATE_LIMIT_EXCEEDED', message: 'x' }, { 'Retry-After': '1.5' }),
    )

    const error = await catchError(apiRequest('/market/ethereum', { token: 't' }))

    expect(error).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', retryAfter: undefined })
  })

  it('transforma corpo de erro ilegível em INTERNAL_ERROR com o status real', async () => {
    mockFetch(new Response('<html>Bad Gateway</html>', { status: 502 }))

    const error = await catchError(apiRequest('/wallet/balance', { token: 't' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' })
  })

  it('aciona o gancho de TOKEN_INVALID numa chamada com token e lança o erro', async () => {
    const handler = vi.fn()
    setTokenInvalidHandler(handler)
    mockFetch(jsonResponse(401, { code: 'TOKEN_INVALID', message: 'Token inválido' }))

    const error = await catchError(apiRequest('/wallet/balance', { token: 'vencido' }))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(error).toMatchObject({ status: 401, code: 'TOKEN_INVALID' })
  })

  it('não aciona o gancho de TOKEN_INVALID numa chamada sem token', async () => {
    const handler = vi.fn()
    setTokenInvalidHandler(handler)
    mockFetch(jsonResponse(401, { code: 'TOKEN_INVALID', message: 'Token inválido' }))

    await catchError(apiRequest('/wallet/balance'))

    expect(handler).not.toHaveBeenCalled()
  })

  it('não aciona o gancho para INVALID_CREDENTIALS, que também é 401', async () => {
    const handler = vi.fn()
    setTokenInvalidHandler(handler)
    mockFetch(jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'x' }))

    await catchError(apiRequest('/wallet/balance', { token: 't' }))

    expect(handler).not.toHaveBeenCalled()
  })
})

describe('apiRequest: rede e tempo limite', () => {
  it('transforma falha de rede em NETWORK_ERROR sem status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = await catchError(apiRequest('/wallet/balance', { token: 't' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: undefined })
  })

  it('desiste em 20 s com NETWORK_ERROR, e não antes', async () => {
    vi.useFakeTimers()
    hangingFetch()
    let settled = false
    const promise = apiRequest('/transactions', {
      method: 'POST',
      token: 't',
      body: { destinationAddress: '0x0', amountEth: '0.01' },
    }).finally(() => {
      settled = true
    })
    const result = catchError(promise)

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const error = await result

    expect(REQUEST_TIMEOUT_MS).toBe(20_000)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: undefined })
  })

  it('repassa o AbortError quando quem cancela é o chamador', async () => {
    hangingFetch()
    const controller = new AbortController()
    const promise = catchError(apiRequest('/transactions/x', { token: 't', signal: controller.signal }))

    controller.abort()
    const error = await promise

    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'AbortError' })
  })
})

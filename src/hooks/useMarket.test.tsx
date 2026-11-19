import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeResponse, pendingResponse } from '../test/fetch'
import { MARKET_URL, marketBody } from '../test/market'
import { DEFAULT_RETRY_AFTER_S, MARKET_CACHE_MS, useMarket } from './useMarket'

type FetchArgs = [url: string, init: RequestInit]

const TOKEN = 'token-de-teste'

const ok = (prices?: string[], current?: string) => fakeResponse(200, marketBody(prices, current))

function apiError(status: number, code: string, headers: Record<string, string> = {}) {
  return fakeResponse(status, JSON.stringify({ code, message: 'Mensagem do servidor.' }), headers)
}

const rateLimited = (seconds?: number) =>
  apiError(429, 'RATE_LIMIT_EXCEEDED', seconds === undefined ? {} : { 'Retry-After': String(seconds) })

type Deferred = { promise: Promise<Response>; resolve: (response: Response) => void }

function deferred(): Deferred {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((r) => (resolve = r))
  return { promise, resolve }
}

type Reply = Response | Error | Deferred | 'pendente'

/** fetch simulado: responde na ordem dada e respeita o signal. Fila vazia fica pendente. */
function stubFetch(...replies: Reply[]) {
  const queue = [...replies]
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((_url, init) => {
    const next = queue.shift() ?? 'pendente'
    const pending = pendingResponse(init.signal)
    if (next === 'pendente') return pending
    if (next instanceof Error) return Promise.reject(next)
    if ('promise' in next) return Promise.race([pending, next.promise])
    return Promise.race([pending, Promise.resolve(next)])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

const flush = () => advance(0)

function render(options: { reactStrictMode?: boolean } = {}) {
  return renderHook(() => useMarket(TOKEN), options)
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.UTC(2026, 10, 18, 12))
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  vi.useRealTimers()
  expect(consoleError).not.toHaveBeenCalled()
})

describe('useMarket', () => {
  it('começa em loading, busca com o token e passa a ok', async () => {
    const fetchMock = stubFetch(ok(['2000', '2200'], '3200.4500'))

    const { result } = render()
    expect(result.current.status).toBe('loading')
    expect(result.current.canRefresh).toBe(false)

    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(MARKET_URL)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(result.current.status).toBe('ok')
    expect(result.current.data?.currentPrice).toBe('3200.4500')
    expect(result.current.data?.series).toHaveLength(2)
    expect(result.current.fetchedAt).toBe(Date.now())
    expect(result.current.canRefresh).toBe(true)
  })

  it('não refaz dentro de 60 s ao voltar à tela; refaz depois', async () => {
    const fetchMock = stubFetch(ok(['1']), ok(['2']))
    const first = render()
    await flush()
    first.unmount()

    await advance(MARKET_CACHE_MS - 1)
    const second = render()
    expect(second.result.current.status).toBe('ok')
    expect(second.result.current.data?.series[0].price).toBe('1')
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    second.unmount()

    await advance(1)
    const third = render()
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(third.result.current.data?.series[0].price).toBe('2')
  })

  it('refresh força a busca mesmo com o resultado novo, mantendo o anterior enquanto lê', async () => {
    const reply = deferred()
    const fetchMock = stubFetch(ok(['1']), reply)
    const { result } = render()
    await flush()

    act(() => result.current.refresh())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('loading')
    expect(result.current.data?.series[0].price).toBe('1')
    expect(result.current.canRefresh).toBe(false)

    await act(async () => reply.resolve(ok(['2'])))
    expect(result.current.status).toBe('ok')
    expect(result.current.data?.series[0].price).toBe('2')
  })

  it('nunca duas requisições em voo: cliques repetidos e dois painéis fazem uma chamada', async () => {
    const reply = deferred()
    const fetchMock = stubFetch(reply)
    const a = render()
    const b = render()
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => {
      a.result.current.refresh()
      a.result.current.refresh()
      b.result.current.refresh()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => reply.resolve(ok(['7'])))
    expect(a.result.current.data?.series[0].price).toBe('7')
    expect(b.result.current.data?.series[0].price).toBe('7')
  })

  it('StrictMode (montar, desmontar, montar) faz uma chamada só, sem cancelar nenhuma', async () => {
    const fetchMock = stubFetch(ok())

    const { result } = render({ reactStrictMode: true })
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false)
    expect(result.current.status).toBe('ok')
  })

  it('sair da tela cancela a requisição em voo e a resposta não vira estado', async () => {
    const fetchMock = stubFetch('pendente', ok(['9']))
    const first = render()
    await flush()
    const signal = fetchMock.mock.calls[0][1].signal

    first.unmount()
    expect(signal?.aborted).toBe(true)

    const second = render()
    expect(second.result.current.status).toBe('loading')
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(second.result.current.data?.series[0].price).toBe('9')
  })

  it('429 conta o Retry-After de segundo em segundo e libera o refresh no zero', async () => {
    const fetchMock = stubFetch(rateLimited(3), ok())
    const { result } = render()
    await flush()

    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(result.current.retryIn).toBe(3)
    expect(result.current.canRefresh).toBe(false)

    act(() => result.current.refresh())
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await advance(1_000)
    expect(result.current.retryIn).toBe(2)
    await advance(1_000)
    expect(result.current.retryIn).toBe(1)
    await advance(999)
    expect(result.current.retryIn).toBe(1)
    expect(result.current.canRefresh).toBe(false)
    await advance(1)
    expect(result.current.retryIn).toBe(0)
    expect(result.current.canRefresh).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => result.current.refresh())
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ok')
  })

  it('429 sem Retry-After espera 60 s', async () => {
    stubFetch(rateLimited())
    const { result } = render()
    await flush()

    expect(result.current.retryIn).toBe(DEFAULT_RETRY_AFTER_S)
    await advance(DEFAULT_RETRY_AFTER_S * 1_000 - 1)
    expect(result.current.canRefresh).toBe(false)
    await advance(1)
    expect(result.current.canRefresh).toBe(true)
  })

  it('voltar à tela no meio do 429 segue a mesma contagem, sem nova chamada', async () => {
    const fetchMock = stubFetch(rateLimited(10), ok())
    const first = render()
    await flush()
    first.unmount()

    await advance(4_000)
    const second = render()
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second.result.current.error?.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(second.result.current.status).toBe('error')
    expect(second.result.current.retryIn).toBe(6)
    expect(second.result.current.canRefresh).toBe(false)

    await advance(6_000)
    expect(second.result.current.canRefresh).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('429 numa releitura mantém o preço anterior', async () => {
    const fetchMock = stubFetch(ok(['5']), rateLimited(2))
    const { result } = render()
    await flush()

    act(() => result.current.refresh())
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('error')
    expect(result.current.data?.series[0].price).toBe('5')
    expect(result.current.retryIn).toBe(2)
  })

  it('502 vira erro com o code e refresh tenta de novo na hora', async () => {
    const fetchMock = stubFetch(apiError(502, 'MARKET_DATA_UNAVAILABLE'), ok())
    const { result } = render()
    await flush()

    expect(result.current.status).toBe('error')
    expect(result.current.error).toEqual({
      code: 'MARKET_DATA_UNAVAILABLE',
      serverMessage: 'Mensagem do servidor.',
    })
    expect(result.current.retryIn).toBe(0)
    expect(result.current.canRefresh).toBe(true)

    act(() => result.current.refresh())
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ok')
  })

  it('o 502 não fica guardado: voltar à tela busca de novo sem mostrar o erro antigo', async () => {
    const fetchMock = stubFetch(apiError(502, 'MARKET_DATA_UNAVAILABLE'), ok())
    const first = render()
    await flush()
    first.unmount()

    const second = render()
    expect(second.result.current.status).toBe('loading')
    expect(second.result.current.error).toBeNull()
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resposta fora da ficha vira INTERNAL_ERROR, sem dado parcial', async () => {
    stubFetch(fakeResponse(200, '{"assetId":"ethereum","currency":"USD","currentPrice":1,"series":[]}'))
    const { result } = render()
    await flush()

    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('INTERNAL_ERROR')
    expect(result.current.data).toBeNull()
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    const { result } = render()
    await flush()

    expect(result.current.error?.code).toBe('NETWORK_ERROR')
  })

  it('série com o último ponto à frente do relógio local é aceita', async () => {
    vi.setSystemTime(Date.UTC(2026, 0, 1))
    stubFetch(ok(['1', '2']))
    const { result } = render()
    await flush()

    expect(result.current.status).toBe('ok')
    expect(result.current.data?.series[1].time).toBeGreaterThan(Date.now())
  })
})

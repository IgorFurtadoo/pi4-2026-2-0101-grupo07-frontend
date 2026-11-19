import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTIVITY_URL, activityBody, activityItem, txHash } from '../test/activity'
import { fakeResponse, pendingResponse } from '../test/fetch'
import { useActivity } from './useActivity'

type FetchArgs = [url: string, init: RequestInit]

const TOKEN = 'token-de-teste'

const ok = (items: string[] = [activityItem()]) => fakeResponse(200, activityBody(items))

function apiError(status: number, code: string) {
  return fakeResponse(status, JSON.stringify({ code, message: 'Mensagem do servidor.' }))
}

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
  return renderHook(() => useActivity(TOKEN), options)
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  vi.useRealTimers()
  expect(consoleError).not.toHaveBeenCalled()
})

describe('useActivity', () => {
  it('começa em loading, busca com o token e passa a ok com o valor exato', async () => {
    const fetchMock = stubFetch(ok([activityItem({ amountEth: '0.000000000000000001' })]))

    const { result } = render()
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()

    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(ACTIVITY_URL)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(result.current.status).toBe('ok')
    expect(result.current.data?.transactions[0].amountEth).toBe('0.000000000000000001')
    expect(result.current.error).toBeNull()
  })

  it('StrictMode (montar, desmontar, montar) faz uma chamada só, sem cancelar nenhuma', async () => {
    const fetchMock = stubFetch(ok())

    const { result } = render({ reactStrictMode: true })
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false)
    expect(result.current.status).toBe('ok')
  })

  it('dois refresh seguidos com a leitura em voo fazem UMA chamada; a em voo não é cancelada', async () => {
    const first = deferred()
    const fetchMock = stubFetch(first)
    const { result } = render()
    await flush()

    act(() => {
      result.current.refresh()
      result.current.refresh()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false)
    await act(async () => first.resolve(ok()))
    expect(result.current.status).toBe('ok')
  })

  it('refresh depois da resposta busca de novo e mantém a lista durante a releitura', async () => {
    const second = deferred()
    const fetchMock = stubFetch(ok([activityItem({ hash: txHash(1) })]), second)
    const { result } = render()
    await flush()

    act(() => result.current.refresh())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('loading')
    expect(result.current.data?.transactions[0].hash).toBe(txHash(1))

    await act(async () => second.resolve(ok([activityItem({ hash: txHash(2) }), activityItem({ hash: txHash(3) })])))
    expect(result.current.data?.transactions.map((t) => t.hash)).toEqual([txHash(2), txHash(3)])
  })

  it('502 HISTORY_UNAVAILABLE guarda o code; "Tentar de novo" (refresh) busca de novo', async () => {
    const fetchMock = stubFetch(apiError(502, 'HISTORY_UNAVAILABLE'), ok([]))
    const { result } = render()
    await flush()

    expect(result.current.status).toBe('error')
    expect(result.current.error).toEqual({ code: 'HISTORY_UNAVAILABLE', serverMessage: 'Mensagem do servidor.' })
    expect(result.current.data).toBeNull()

    act(() => result.current.refresh())
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ok')
    expect(result.current.data?.transactions).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('falha numa releitura mantém a lista anterior', async () => {
    stubFetch(ok(), apiError(500, 'INTERNAL_ERROR'))
    const { result } = render()
    await flush()

    act(() => result.current.refresh())
    await flush()

    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('INTERNAL_ERROR')
    expect(result.current.data?.transactions).toHaveLength(1)
  })

  it('corpo fora da ficha vira INTERNAL_ERROR, sem lista parcial', async () => {
    stubFetch(ok([activityItem(), activityItem({ status: 'PENDING' })]))
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

  it('sair da tela cancela a requisição em voo e a resposta não vira estado', async () => {
    const fetchMock = stubFetch('pendente')
    const { result, unmount } = render()
    await flush()
    const signal = fetchMock.mock.calls[0][1].signal

    unmount()
    expect(signal?.aborted).toBe(true)
    await flush()
    expect(result.current.status).toBe('loading')
  })

  it('sair antes do setTimeout(0) não faz chamada nenhuma', async () => {
    const fetchMock = stubFetch(ok())
    const { unmount } = render()

    unmount()
    await flush()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sem polling: nenhuma chamada nova com o tempo passando', async () => {
    const fetchMock = stubFetch(ok(), ok())
    render()
    await flush()

    await advance(10 * 60_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

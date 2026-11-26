import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeResponse, pendingResponse } from '../test/fetch'
import {
  BACKOFF_MS,
  POLL_INTERVAL_MS,
  SLOW_AFTER_MS,
  SLOW_INTERVAL_MS,
  useTransactionPolling,
} from './useTransactionPolling'

type FetchArgs = [url: string, init: RequestInit]

const TOKEN = 'token-de-teste'
const TASK_ID = 'a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b'
const ADDRESS = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4'
const HASH = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060'

function tx(status: string, extra: Record<string, string> = {}, amountEth = '0.01') {
  const fields = { taskId: TASK_ID, status, destinationAddress: ADDRESS, updatedAt: '2026-10-20T14:36:10Z', ...extra }
  const parts = Object.entries(fields).map(([key, value]) => `"${key}":${JSON.stringify(value)}`)
  return fakeResponse(200, `{${parts.join(',')},"amountEth":${amountEth}}`)
}

function apiError(status: number, code: string) {
  return fakeResponse(status, JSON.stringify({ code, message: 'Mensagem do servidor.' }))
}

const NETWORK = () => new TypeError('Failed to fetch')

type Deferred = { promise: Promise<Response>; resolve: (response: Response) => void }

function deferred(): Deferred {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((r) => (resolve = r))
  return { promise, resolve }
}

type Reply = Response | Error | Deferred | 'pendente'

/**
 * fetch simulado: responde na ordem dada e respeita o signal (cancelada,
 * rejeita com AbortError). Fila vazia usa `fallback` (PENDING por padrão).
 */
function stubFetch(replies: Reply[], fallback: () => Reply = () => tx('PENDING')) {
  const queue = [...replies]
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((_url, init) => {
    const next = queue.length > 0 ? queue.shift()! : fallback()
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

let hidden = false

function setHidden(value: boolean) {
  hidden = value
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function render(options: { reactStrictMode?: boolean } = {}) {
  return renderHook(() => useTransactionPolling(TOKEN, TASK_ID), options)
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(document, 'hidden')
  expect(consoleError).not.toHaveBeenCalled()
})

describe('useTransactionPolling', () => {
  it('lê na hora ao montar, com o token e o taskId', async () => {
    const fetchMock = stubFetch([tx('PENDING')])

    const { result } = render()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`http://localhost:8080/transactions/${TASK_ID}`)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(result.current.transaction).toBeNull()

    await flush()
    expect(result.current.transaction?.status).toBe('PENDING')
    expect(result.current.transaction?.amountEth).toBe('0.01')
    expect(result.current.error).toBeNull()
  })

  it('repete a cada 3 s enquanto PENDING', async () => {
    const fetchMock = stubFetch([])
    render()
    await flush()

    await advance(POLL_INTERVAL_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await advance(POLL_INTERVAL_MS)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(POLL_INTERVAL_MS).toBe(3_000)
  })

  it('NUNCA duas requisições em voo: uma resposta lenta segura o ciclo', async () => {
    const slow = deferred()
    const fetchMock = stubFetch([tx('PENDING'), slow])
    render()
    await flush()
    await advance(POLL_INTERVAL_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Abaixo dos 20 s do tempo limite do cliente.
    await advance(15_000)
    setHidden(false) // um "visível" sem esconder antes não lê de novo
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => slow.resolve(tx('PENDING')))
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await advance(POLL_INTERVAL_MS)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('para em CONFIRMED', async () => {
    const fetchMock = stubFetch([tx('PENDING'), tx('CONFIRMED', { transactionHash: HASH })])
    const { result } = render()
    await flush()
    await advance(POLL_INTERVAL_MS)

    expect(result.current.transaction?.status).toBe('CONFIRMED')
    expect(result.current.transaction?.transactionHash).toBe(HASH)
    await advance(60 * 60_000)
    setHidden(true)
    setHidden(false)
    await advance(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('para em FAILED', async () => {
    const fetchMock = stubFetch([tx('FAILED', { failureReason: 'REJECTED_BY_NETWORK' })])
    const { result } = render()
    await flush()

    expect(result.current.transaction?.status).toBe('FAILED')
    expect(result.current.transaction?.failureReason).toBe('REJECTED_BY_NETWORK')
    await advance(60 * 60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.slow).toBe(false)
  })

  it('recua 3, 6, 10, 10 s em falhas seguidas e volta a 3 s depois de uma resposta boa', async () => {
    const fetchMock = stubFetch([
      tx('PENDING', {}, '0.5'),
      NETWORK(),
      NETWORK(),
      apiError(500, 'INTERNAL_ERROR'),
      NETWORK(),
      tx('PENDING', {}, '0.5'),
      tx('PENDING', {}, '0.5'),
    ])
    const { result } = render()
    await flush()
    expect(BACKOFF_MS).toEqual([3_000, 6_000, 10_000])

    // 1ª falha
    await advance(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.reconnecting).toBe(true)
    expect(result.current.error?.code).toBe('NETWORK_ERROR')
    expect(result.current.transaction?.amountEth).toBe('0.5')

    // 2ª falha depois de 3 s
    await advance(2_999)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await advance(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    // 3ª falha (500) depois de 6 s
    await advance(5_999)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await advance(1)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(result.current.error?.code).toBe('INTERNAL_ERROR')
    expect(result.current.transaction?.status).toBe('PENDING')

    // 4ª falha depois de 10 s
    await advance(9_999)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    await advance(1)
    expect(fetchMock).toHaveBeenCalledTimes(5)

    // resposta boa depois de mais 10 s (a 3ª em diante fica em 10)
    await advance(9_999)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    await advance(1)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(result.current.reconnecting).toBe(false)
    expect(result.current.error).toBeNull()

    // de volta aos 3 s
    await advance(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(7)
  })

  it('code desconhecido também recua, sem parar', async () => {
    const fetchMock = stubFetch([tx('PENDING'), apiError(503, 'ALGO_NOVO')])
    const { result } = render()
    await flush()
    await advance(3_000)

    expect(result.current.reconnecting).toBe(true)
    expect(result.current.error?.code).toBe('ALGO_NOVO')
    await advance(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('falha na primeira leitura: sem dado, com o erro, e o recuo continua sozinho', async () => {
    const fetchMock = stubFetch([NETWORK(), tx('PENDING')])
    const { result } = render()
    await flush()

    expect(result.current.transaction).toBeNull()
    expect(result.current.error?.code).toBe('NETWORK_ERROR')

    await advance(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.transaction?.status).toBe('PENDING')
    expect(result.current.error).toBeNull()
  })

  it('404 TRANSACTION_NOT_FOUND para o polling', async () => {
    const fetchMock = stubFetch([apiError(404, 'TRANSACTION_NOT_FOUND')])
    const { result } = render()
    await flush()

    expect(result.current.notFound).toBe(true)
    expect(result.current.reconnecting).toBe(false)
    await advance(60 * 60_000)
    setHidden(true)
    setHidden(false)
    act(() => result.current.retry())
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('401 TOKEN_INVALID para o polling', async () => {
    const fetchMock = stubFetch([tx('PENDING'), apiError(401, 'TOKEN_INVALID')])
    const { result } = render()
    await flush()
    await advance(3_000)

    expect(result.current.error?.code).toBe('TOKEN_INVALID')
    expect(result.current.notFound).toBe(false)
    expect(result.current.reconnecting).toBe(false)
    await advance(60 * 60_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('aba escondida cancela o timer; ao voltar lê na hora e retoma o ciclo', async () => {
    const fetchMock = stubFetch([])
    render()
    await flush()

    setHidden(true)
    await advance(5 * 60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    setHidden(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await flush()
    await advance(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('leitura em voo ao esconder a aba termina sem agendar outra', async () => {
    const slow = deferred()
    const fetchMock = stubFetch([slow])
    const { result } = render()

    setHidden(true)
    await act(async () => slow.resolve(tx('PENDING', {}, '2')))
    await flush()
    expect(result.current.transaction?.amountEth).toBe('2')
    await advance(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    setHidden(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falha com a aba escondida não agenda; ao voltar lê na hora', async () => {
    const fetchMock = stubFetch([tx('PENDING'), NETWORK()])
    const { result } = render()
    await flush()
    await advance(3_000)
    expect(result.current.reconnecting).toBe(true)

    setHidden(true)
    await advance(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    setHidden(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('aos 10 minutos em PENDING liga slow e passa a ler a cada 10 s', async () => {
    const fetchMock = stubFetch([])
    const { result } = render()
    await flush()

    await advance(SLOW_AFTER_MS - 1)
    expect(result.current.slow).toBe(false)
    await advance(1)
    expect(result.current.slow).toBe(true)
    expect(result.current.transaction?.status).toBe('PENDING')
    expect(SLOW_AFTER_MS).toBe(600_000)
    expect(SLOW_INTERVAL_MS).toBe(10_000)

    // Um ciclo de 3 s já agendado pode cair logo depois; a partir daí, 10 s.
    await advance(3_000)
    const before = fetchMock.mock.calls.length
    await advance(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(before)
    await advance(SLOW_INTERVAL_MS - 3_000)
    expect(fetchMock).toHaveBeenCalledTimes(before + 1)
    await advance(SLOW_INTERVAL_MS)
    expect(fetchMock).toHaveBeenCalledTimes(before + 2)
  })

  it('slow desliga quando chega o estado final', async () => {
    let final = false
    stubFetch([], () => (final ? tx('CONFIRMED', { transactionHash: HASH }) : tx('PENDING')))
    const { result } = render()
    await flush()
    await advance(SLOW_AFTER_MS)
    expect(result.current.slow).toBe(true)

    final = true
    await advance(SLOW_INTERVAL_MS)
    expect(result.current.transaction?.status).toBe('CONFIRMED')
    expect(result.current.slow).toBe(false)
  })

  it('desmontar cancela a requisição em voo, sem aviso do React', async () => {
    const fetchMock = stubFetch(['pendente'])
    const { unmount } = render()
    const signal = fetchMock.mock.calls[0][1].signal

    unmount()
    await flush()

    expect(signal?.aborted).toBe(true)
    await advance(60 * 60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('desmontar cancela o timer pendente', async () => {
    const fetchMock = stubFetch([])
    const { unmount } = render()
    await flush()

    unmount()
    await advance(60 * 60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sob StrictMode: a primeira leitura é cancelada, nunca vira estado, e há um ciclo só', async () => {
    const fetchMock = stubFetch([tx('PENDING', {}, '9'), tx('PENDING', {}, '3')])
    const { result } = render({ reactStrictMode: true })
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true)
    expect(fetchMock.mock.calls[1][1].signal?.aborted).toBe(false)
    expect(result.current.transaction?.amountEth).toBe('3')

    await advance(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await advance(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('retry depois de falha na primeira leitura lê na hora e limpa o erro', async () => {
    const fetchMock = stubFetch([NETWORK(), 'pendente'])
    const { result } = render()
    await flush()
    expect(result.current.error?.code).toBe('NETWORK_ERROR')

    act(() => result.current.retry())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()

    act(() => result.current.retry()) // em voo: nada
    await advance(15_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('requisição presa: o tempo limite de 20 s do cliente a cancela antes da próxima', async () => {
    const fetchMock = stubFetch(['pendente', 'pendente'])
    const { result } = render()

    await advance(19_999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true)
    expect(result.current.error?.code).toBe('NETWORK_ERROR')
    expect(result.current.reconnecting).toBe(true)

    await advance(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('useTransactionPolling com intervalMs', () => {
  it('usa o intervalo dado enquanto PENDING (a lista "Em andamento" usa 5 s)', async () => {
    const fetchMock = stubFetch([tx('PENDING'), tx('PENDING')])
    renderHook(() => useTransactionPolling(TOKEN, TASK_ID, { intervalMs: 5_000 }))
    await flush()

    await advance(POLL_INTERVAL_MS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await advance(5_000 - POLL_INTERVAL_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBalance } from './useBalance'

type FetchArgs = [url: string, init: RequestInit]

const ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
const TOKEN = 'token-de-teste'

function balanceResponse(balanceEth: string) {
  return new Response(
    `{"ethereumAddress":"${ADDRESS}","balanceEth":${balanceEth},"network":"SEPOLIA"}`,
    { status: 200 },
  )
}

function errorResponse(status: number, code: string) {
  return new Response(JSON.stringify({ code, message: 'Mensagem do servidor.' }), { status })
}

/**
 * fetch simulado que responde na ordem dada e respeita o signal: uma
 * requisição cancelada rejeita com AbortError, como no navegador.
 */
function stubFetch(...responses: Array<Response | Error | 'pendente'>) {
  const queue = [...responses]
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const next = queue.shift() ?? 'pendente'
    return new Promise<Response>((resolve, reject) => {
      const abort = () => reject(new DOMException('Cancelado', 'AbortError'))
      if (init.signal?.aborted) return abort()
      init.signal?.addEventListener('abort', abort, { once: true })
      if (next === 'pendente') return
      if (next instanceof Error) reject(next)
      else resolve(next)
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock as unknown as ReturnType<typeof vi.fn<(...args: FetchArgs) => Promise<Response>>>
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled()
})

describe('useBalance', () => {
  it('começa em loading e passa a ok com o saldo em texto', async () => {
    const fetchMock = stubFetch(balanceResponse('0.002499999999601'))

    const { result } = renderHook(() => useBalance(TOKEN))
    expect(result.current.status).toBe('loading')
    expect(result.current.balance).toBeNull()

    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.balance?.balanceEth).toBe('0.002499999999601')
    expect(result.current.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falha na primeira leitura dá error com o code e sem saldo', async () => {
    stubFetch(errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE'))

    const { result } = renderHook(() => useBalance(TOKEN))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.code).toBe('BLOCKCHAIN_UNAVAILABLE')
    expect(result.current.balance).toBeNull()
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    stubFetch(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useBalance(TOKEN))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.code).toBe('NETWORK_ERROR')
  })

  it('falha numa releitura mantém o saldo anterior', async () => {
    stubFetch(balanceResponse('1.5'), errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE'))
    const { result } = renderHook(() => useBalance(TOKEN))
    await waitFor(() => expect(result.current.status).toBe('ok'))

    act(() => result.current.reload())
    expect(result.current.status).toBe('loading')
    expect(result.current.balance?.balanceEth).toBe('1.5')

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.balance?.balanceEth).toBe('1.5')
    expect(result.current.error?.code).toBe('BLOCKCHAIN_UNAVAILABLE')
  })

  it('reload depois de um erro lê de novo', async () => {
    const fetchMock = stubFetch(errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE'), balanceResponse('2'))
    const { result } = renderHook(() => useBalance(TOKEN))
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => result.current.reload())

    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.balance?.balanceEth).toBe('2')
    expect(result.current.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('dois reload no mesmo instante fazem uma chamada só (trava síncrona)', async () => {
    const fetchMock = stubFetch(balanceResponse('1'), 'pendente')
    const { result } = renderHook(() => useBalance(TOKEN))
    await waitFor(() => expect(result.current.status).toBe('ok'))

    act(() => {
      result.current.reload()
      result.current.reload()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reload com a primeira leitura em voo não faz outra chamada', () => {
    const fetchMock = stubFetch('pendente')
    const { result } = renderHook(() => useBalance(TOKEN))

    act(() => result.current.reload())

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sob StrictMode cancela a primeira leitura e fica com a segunda', async () => {
    const fetchMock = stubFetch(balanceResponse('9'), balanceResponse('3'))

    const { result } = renderHook(() => useBalance(TOKEN), { reactStrictMode: true })

    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true)
    expect(fetchMock.mock.calls[1][1].signal?.aborted).toBe(false)
    expect(result.current.balance?.balanceEth).toBe('3')
  })

  it('desmontar cancela a leitura em andamento, sem aviso do React', async () => {
    const fetchMock = stubFetch('pendente')
    const { unmount } = renderHook(() => useBalance(TOKEN))
    const signal = fetchMock.mock.calls[0][1].signal

    unmount()
    await act(async () => {})

    expect(signal?.aborted).toBe(true)
  })
})

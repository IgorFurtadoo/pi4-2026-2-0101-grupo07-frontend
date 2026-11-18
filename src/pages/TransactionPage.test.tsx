import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGES } from '../api/errors'
import { FAILED_GENERIC_MESSAGE, FAILURE_REASON_MESSAGES } from '../api/transactions'
import { SESSION_KEY } from '../auth/sessionStorage'
import { formatInstant } from '../lib/instant'
import { fakeResponse, pendingResponse } from '../test/fetch'
import { TEST_TOKEN, renderApp, storeValidSession } from '../test/renderApp'

type FetchArgs = [url: string, init: RequestInit]

const TASK_ID = 'a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b'
const ADDRESS = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4'
const HASH = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060'
const UPDATED_AT = '2026-10-20T14:36:10Z'

function tx(status: string, extra: Record<string, string> = {}, amountEth = '0.01') {
  const fields = { taskId: TASK_ID, status, destinationAddress: ADDRESS, updatedAt: UPDATED_AT, ...extra }
  const parts = Object.entries(fields).map(([key, value]) => `"${key}":${JSON.stringify(value)}`)
  return fakeResponse(200, `{${parts.join(',')},"amountEth":${amountEth}}`)
}

function apiError(status: number, code: string) {
  return fakeResponse(status, JSON.stringify({ code, message: 'Mensagem do servidor.' }))
}

type Reply = Response | Error | 'pendente'

/**
 * fetch simulado: GET /transactions/{taskId} responde na ordem dada (fila
 * vazia: PENDING) e respeita o signal; qualquer outra rota fica pendente.
 */
function stubFetch(...replies: Reply[]) {
  const queue = [...replies]
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((url, init) => {
    const pending = pendingResponse(init.signal)
    if (!url.includes('/transactions/')) return pending
    const next = queue.length > 0 ? queue.shift()! : tx('PENDING')
    if (next === 'pendente') return pending
    if (next instanceof Error) return Promise.reject(next)
    return Promise.race([pending, Promise.resolve(next)])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function trackerCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(([url]) => url.includes('/transactions/')).length
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

async function openTracker(taskId = TASK_ID) {
  storeValidSession()
  const view = renderApp(`/transacoes/${taskId}`)
  await advance(0)
  return view
}

function liveRegion() {
  const region = document.querySelector('p[aria-live="polite"].sr-only')
  if (!region) throw new Error('sem região aria-live')
  return region
}

function timeline() {
  return screen.getByRole('list', { name: 'Andamento da transação' })
}

function etherscanLink() {
  return screen.queryByRole('link', { name: /Ver no Etherscan/ })
}

function noMascot(container: HTMLElement) {
  expect(container.querySelector('img[src*="mascote"]')).toBeNull()
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  vi.useRealTimers()
  window.sessionStorage.clear()
  expect(consoleError).not.toHaveBeenCalled()
})

describe('TransactionPage', () => {
  it('carregando: título, esqueleto claro com aria-busy e "Voltar à carteira"', async () => {
    const fetchMock = stubFetch('pendente')
    const { container } = await openTracker()

    expect(screen.getByRole('heading', { name: 'Acompanhamento da transação' })).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    const skeleton = container.querySelector('[data-skeleton]')
    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    expect(skeleton).toHaveClass('from-divider')
    expect(screen.getByText('Carregando transação…')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar à carteira' })).toHaveAttribute('href', '/carteira')
    expect(screen.queryByRole('link', { name: 'Fazer outro envio' })).toBeNull()
    noMascot(container)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`http://localhost:8080/transactions/${TASK_ID}`)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TEST_TOKEN}`)
  })

  it('PENDING com hash: hash provisório, SEM link, e nada anunciado a cada leitura', async () => {
    const fetchMock = stubFetch(tx('PENDING', { transactionHash: HASH }))
    const { container } = await openTracker()

    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
    expect(within(timeline()).getByText('Aguardando confirmação').closest('li')).toHaveAttribute(
      'data-state',
      'active',
    )
    expect(screen.getByText('Hash provisório')).toBeInTheDocument()
    expect(screen.getByText(HASH)).toHaveClass('font-mono')
    expect(screen.queryByText('Hash da transação')).toBeNull()
    expect(etherscanLink()).toBeNull()
    expect(liveRegion()).toHaveTextContent('')

    await advance(3_000)
    await advance(3_000)
    expect(trackerCalls(fetchMock)).toBe(3)
    expect(liveRegion()).toHaveTextContent('')
    expect(etherscanLink()).toBeNull()
    expect(screen.queryByRole('link', { name: 'Fazer outro envio' })).toBeNull()
  })

  it('PENDING vira CONFIRMED sem recarregar: link do Etherscan e anúncio uma vez', async () => {
    const fetchMock = stubFetch(
      tx('PENDING', { transactionHash: HASH }),
      tx('CONFIRMED', { transactionHash: HASH }),
    )
    const { container } = await openTracker()
    expect(etherscanLink()).toBeNull()

    await advance(3_000)

    const link = etherscanLink()
    expect(link).toHaveAttribute('href', `https://sepolia.etherscan.io/tx/${HASH}`)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('Hash da transação')).toBeInTheDocument()
    expect(screen.queryByText('Hash provisório')).toBeNull()
    expect(within(timeline()).getByText('Confirmada').closest('li')).toHaveAttribute(
      'data-state',
      'success',
    )
    expect(liveRegion()).toHaveTextContent('Transação confirmada.')
    expect(screen.getAllByText('Transação confirmada.')).toHaveLength(1)
    expect(screen.getByText('O saldo é atualizado quando você abre a carteira.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fazer outro envio' })).toHaveAttribute('href', '/enviar')
    expect(screen.getByRole('link', { name: 'Voltar à carteira' })).toBeInTheDocument()
    noMascot(container)

    await advance(60 * 60_000)
    expect(trackerCalls(fetchMock)).toBe(2)
    expect(screen.getAllByText('Transação confirmada.')).toHaveLength(1)
  })

  it('FAILED sem hash: motivo em português e sem bloco de hash', async () => {
    stubFetch(tx('FAILED', { failureReason: 'REJECTED_BY_NETWORK' }))
    const { container } = await openTracker()

    const failed = within(timeline()).getByText('Falhou').closest('li')
    expect(failed).toHaveAttribute('data-state', 'error')
    expect(failed).toHaveTextContent(FAILURE_REASON_MESSAGES.REJECTED_BY_NETWORK)
    expect(screen.queryByText('Hash da transação')).toBeNull()
    expect(screen.queryByText('Hash provisório')).toBeNull()
    expect(etherscanLink()).toBeNull()
    expect(liveRegion()).toHaveTextContent('A transação falhou.')
    expect(screen.queryByText('O saldo é atualizado quando você abre a carteira.')).toBeNull()
    expect(screen.getByRole('link', { name: 'Fazer outro envio' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    noMascot(container)
  })

  it('FAILED com hash (revertida): motivo e link do Etherscan', async () => {
    stubFetch(tx('FAILED', { transactionHash: HASH, failureReason: 'TRANSACTION_REVERTED' }))
    await openTracker()

    expect(timeline()).toHaveTextContent(FAILURE_REASON_MESSAGES.TRANSACTION_REVERTED)
    expect(screen.getByText('Hash da transação')).toBeInTheDocument()
    expect(etherscanLink()).toHaveAttribute('href', `https://sepolia.etherscan.io/tx/${HASH}`)
  })

  it('motivo desconhecido usa o texto genérico, nunca o do servidor', async () => {
    stubFetch(tx('FAILED', { failureReason: '<b>MOTIVO_NOVO</b>' }))
    const { container } = await openTracker()

    expect(timeline()).toHaveTextContent(FAILED_GENERIC_MESSAGE)
    expect(container).not.toHaveTextContent('MOTIVO_NOVO')
    expect(container.querySelector('b')).toBeNull()
  })

  it('hash fora do padrão aparece como texto, sem link', async () => {
    stubFetch(tx('CONFIRMED', { transactionHash: 'javascript:alert(1)' }))
    await openTracker()

    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
    expect(etherscanLink()).toBeNull()
    expect(screen.queryAllByRole('link').map((link) => link.getAttribute('href'))).not.toContain(
      'javascript:alert(1)',
    )
  })

  it('mostra o endereço COMPLETO, o valor com 18 casas, a rede, o taskId e a data', async () => {
    stubFetch(tx('PENDING', {}, '12345678901234567890.123456789012345678'))
    await openTracker()

    expect(screen.getByText(ADDRESS)).toHaveClass('font-mono', 'break-all')
    expect(screen.getByText('12.345.678.901.234.567.890,123456789012345678 ETH')).toBeInTheDocument()
    expect(screen.getByText('Sepolia · testnet')).toBeInTheDocument()
    expect(screen.getByText(TASK_ID)).toHaveClass('font-mono')
    expect(screen.getByText(formatInstant(UPDATED_AT))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar endereço' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar identificador' })).toBeInTheDocument()
  })

  it('1 wei aparece inteiro, sem arredondar', async () => {
    stubFetch(tx('PENDING', {}, '0.000000000000000001'))
    await openTracker()

    expect(screen.getByText('0,000000000000000001 ETH')).toBeInTheDocument()
  })

  it('data fora do formato aparece crua', async () => {
    stubFetch(tx('PENDING', { updatedAt: 'ontem à tarde' }))
    await openTracker()

    expect(screen.getByText('ontem à tarde')).toBeInTheDocument()
  })

  it('copiar copia o endereço completo e o identificador', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    stubFetch(tx('PENDING'))
    await openTracker()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar endereço' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar identificador' }))
    })

    expect(writeText).toHaveBeenNthCalledWith(1, ADDRESS)
    expect(writeText).toHaveBeenNthCalledWith(2, TASK_ID)
  })

  it('404: "Transação não encontrada." com "Voltar à carteira", sem nova tentativa', async () => {
    const fetchMock = stubFetch(apiError(404, 'TRANSACTION_NOT_FOUND'))
    const { container } = await openTracker()

    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.TRANSACTION_NOT_FOUND)
    expect(screen.getByRole('alert')).toHaveTextContent('Transação não encontrada.')
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Voltar à carteira' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Fazer outro envio' })).toBeNull()
    noMascot(container)

    await advance(60 * 60_000)
    expect(trackerCalls(fetchMock)).toBe(1)
  })

  it('falha na primeira leitura: alerta e "Tentar novamente" lê de novo', async () => {
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), tx('PENDING'))
    const { container } = await openTracker()

    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.NETWORK_ERROR)
    noMascot(container)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await advance(0)

    expect(trackerCalls(fetchMock)).toBe(2)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(ADDRESS)).toBeInTheDocument()
  })

  it('falha na primeira leitura: o recuo automático continua sem clique', async () => {
    const fetchMock = stubFetch(apiError(500, 'INTERNAL_ERROR'), tx('PENDING'))
    await openTracker()
    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.INTERNAL_ERROR)

    await advance(3_000)

    expect(trackerCalls(fetchMock)).toBe(2)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(ADDRESS)).toBeInTheDocument()
  })

  it('falha depois de ter dado: o dado fica e aparece "Reconectando…"', async () => {
    stubFetch(tx('PENDING'), new TypeError('Failed to fetch'), tx('PENDING'))
    await openTracker()

    await advance(3_000)
    expect(screen.getByText('Reconectando…')).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(ADDRESS)).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('')

    await advance(3_000)
    expect(screen.queryByText('Reconectando…')).toBeNull()
  })

  it('aviso de demora aos 10 minutos em PENDING, sem estado novo', async () => {
    stubFetch()
    await openTracker()
    const warning = 'Está demorando mais que o normal. Você pode sair e voltar a esta página.'

    await advance(10 * 60_000 - 1)
    expect(screen.queryByText(warning)).toBeNull()
    await advance(1)

    expect(screen.getByText(warning)).toBeInTheDocument()
    expect(within(timeline()).getByText('Aguardando confirmação').closest('li')).toHaveAttribute(
      'data-state',
      'active',
    )
  })

  it('sair da tela cancela a requisição e o polling', async () => {
    const fetchMock = stubFetch(tx('PENDING'), 'pendente')
    const { router } = await openTracker()
    await advance(3_000)
    expect(trackerCalls(fetchMock)).toBe(2)
    const signal = fetchMock.mock.calls.filter(([url]) => url.includes('/transactions/'))[1][1].signal

    fireEvent.click(screen.getByRole('link', { name: 'Voltar à carteira' }))
    await advance(0)

    expect(router.state.location.pathname).toBe('/carteira')
    expect(signal?.aborted).toBe(true)
    await advance(60 * 60_000)
    expect(trackerCalls(fetchMock)).toBe(2)
  })

  it('desmontar com a leitura em andamento cancela, sem aviso do React', async () => {
    const fetchMock = stubFetch('pendente')
    const { unmount } = await openTracker()
    const signal = fetchMock.mock.calls[0][1].signal

    unmount()
    await advance(0)

    expect(signal?.aborted).toBe(true)
  })
})

describe('TransactionPage com 401 TOKEN_INVALID (integração com o AuthContext)', () => {
  it('termina em /entrar com o aviso de sessão expirada e o storage limpo', async () => {
    const fetchMock = stubFetch(apiError(401, 'TOKEN_INVALID'))
    storeValidSession()
    expect(window.sessionStorage.getItem(SESSION_KEY)).not.toBeNull()
    const { router } = renderApp(`/transacoes/${TASK_ID}`)
    await advance(0)

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou. Entre novamente.')
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
    expect(trackerCalls(fetchMock)).toBe(1)
    expect(screen.queryByRole('heading', { name: 'Acompanhamento da transação' })).toBeNull()

    await advance(60 * 60_000)
    expect(trackerCalls(fetchMock)).toBe(1)
  })
})

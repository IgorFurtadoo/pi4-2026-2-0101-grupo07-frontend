import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGES } from '../../api/errors'
import { formatClock } from '../../lib/market'
import { fakeResponse, pendingResponse } from '../../test/fetch'
import { marketBody } from '../../test/market'
import { MarketPanel } from './MarketPanel'

type FetchArgs = [url: string, init: RequestInit]
type Reply = Response | Error | 'pendente'

const plain = (text: string | null | undefined) => (text ?? '').replace(/\u00a0/g, ' ')

const ok = (prices?: string[], current?: string) => fakeResponse(200, marketBody(prices, current))

function apiError(status: number, code: string, headers: Record<string, string> = {}) {
  return fakeResponse(status, JSON.stringify({ code, message: 'Mensagem do servidor.' }), headers)
}

function stubFetch(...replies: Reply[]) {
  const queue = [...replies]
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((_url, init) => {
    const next = queue.shift() ?? 'pendente'
    const pending = pendingResponse(init.signal)
    if (next === 'pendente') return pending
    if (next instanceof Error) return Promise.reject(next)
    return Promise.race([pending, Promise.resolve(next)])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

const flush = () => advance(0)

function panel() {
  return screen.getByRole('region', { name: 'Mercado · ETH' })
}

const refreshButton = () => screen.getByRole('button', { name: /Atualizar|Atualizando/ })

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.UTC(2026, 10, 18, 14, 5))
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  vi.useRealTimers()
  expect(consoleError).not.toHaveBeenCalled()
})

describe('MarketPanel', () => {
  it('mostra o esqueleto e depois o preço, a variação, o gráfico e a hora da leitura', async () => {
    stubFetch(ok(['2000', '2100', '2200'], '3200.45'))
    const { container } = render(<MarketPanel token="t" />)

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('[data-skeleton]')).not.toBeNull()
    expect(screen.getByText('Carregando mercado…')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()

    await flush()
    const region = panel()
    expect(plain(region.textContent)).toContain('US$ 3.200,45')
    expect(region).toHaveTextContent('+10,00% em 7 dias')
    expect(screen.getByText('+10,00% em 7 dias')).toHaveClass('text-success')
    expect(within(region).getByRole('img')).toHaveAccessibleName(/Preço do ETH nos últimos 7 dias/)
    expect(region).toHaveTextContent(`Atualizado às ${formatClock(Date.now())}`)
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
    expect(container.querySelector('[data-skeleton]')).toBeNull()
    expect(refreshButton()).toBeEnabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('queda tem ícone e sinal, não só cor; série de um ponto fica estável', async () => {
    stubFetch(ok(['2000', '1500']))
    const first = render(<MarketPanel token="t" />)
    await flush()
    expect(screen.getByText('-25,00% em 7 dias')).toHaveClass('text-error')
    expect(screen.getByText('-25,00% em 7 dias').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    first.unmount()
    await advance(60_000)

    stubFetch(ok(['3000']))
    render(<MarketPanel token="t" />)
    await flush()
    expect(screen.getByText('0,00% em 7 dias')).toHaveClass('text-text-muted')
  })

  it('429: contagem pelo Retry-After com "Atualizar" desabilitado até zerar', async () => {
    const fetchMock = stubFetch(apiError(429, 'RATE_LIMIT_EXCEEDED', { 'Retry-After': '3' }), ok())
    render(<MarketPanel token="t" />)
    await flush()

    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED)
    expect(panel()).toHaveTextContent('Tente de novo em 3 s.')
    expect(refreshButton()).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()

    await advance(1_000)
    expect(panel()).toHaveTextContent('Tente de novo em 2 s.')
    await advance(1_000)
    expect(panel()).toHaveTextContent('Tente de novo em 1 s.')
    expect(refreshButton()).toBeDisabled()
    await advance(1_000)
    expect(panel()).toHaveTextContent('Você já pode atualizar.')
    expect(refreshButton()).toBeEnabled()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(refreshButton())
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(plain(panel().textContent)).toContain('US$ 3.200,45')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a contagem do 429 fica fora do alerta (o leitor de tela não a repete a cada segundo)', async () => {
    stubFetch(apiError(429, 'RATE_LIMIT_EXCEEDED', { 'Retry-After': '5' }))
    render(<MarketPanel token="t" />)
    await flush()

    expect(screen.getByRole('alert')).not.toHaveTextContent('Tente de novo em')
    expect(screen.getByText('Tente de novo em 5 s.').closest('[aria-live]')).toBeNull()
  })

  it('502: "Mercado indisponível" e "Tentar de novo" busca outra vez', async () => {
    const fetchMock = stubFetch(apiError(502, 'MARKET_DATA_UNAVAILABLE'), ok())
    render(<MarketPanel token="t" />)
    await flush()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Mercado indisponível')
    expect(alert).toHaveTextContent(ERROR_MESSAGES.MARKET_DATA_UNAVAILABLE)
    expect(screen.queryByRole('button', { name: 'Atualizar' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(plain(panel().textContent)).toContain('US$ 3.200,45')
  })

  it.each([
    ['ASSET_NOT_FOUND', 404, ERROR_MESSAGES.ASSET_NOT_FOUND],
    ['INTERNAL_ERROR', 500, ERROR_MESSAGES.INTERNAL_ERROR],
  ])('outro erro (%s) mostra a mensagem do mapa e "Tentar de novo"', async (code, status, message) => {
    stubFetch(apiError(status, code))
    render(<MarketPanel token="t" />)
    await flush()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(alert).not.toHaveTextContent('Mercado indisponível')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
  })

  it('corpo fora da ficha mostra o erro genérico e nenhum preço', async () => {
    stubFetch(fakeResponse(200, '{"assetId":"ethereum","currency":"USD","currentPrice":1,"series":[]}'))
    render(<MarketPanel token="t" />)
    await flush()

    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.INTERNAL_ERROR)
    expect(panel()).not.toHaveTextContent('US$')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('falha numa releitura mantém o preço anterior com a hora da leitura', async () => {
    stubFetch(ok(['1', '2'], '1768.12'), apiError(502, 'MARKET_DATA_UNAVAILABLE'))
    render(<MarketPanel token="t" />)
    await flush()
    const readAt = formatClock(Date.now())

    await advance(5 * 60_000)
    fireEvent.click(refreshButton())
    expect(refreshButton()).toHaveAccessibleName('Atualizando…')
    await flush()

    expect(screen.getByRole('alert')).toHaveTextContent('Mercado indisponível')
    expect(plain(panel().textContent)).toContain('US$ 1.768,12')
    expect(panel()).toHaveTextContent(`Atualizado às ${readAt}`)
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(refreshButton()).toBeEnabled()
  })

  it('anuncia "Mercado atualizado" depois de atualizar pelo botão', async () => {
    stubFetch(ok(), ok())
    render(<MarketPanel token="t" />)
    await flush()
    expect(screen.queryByText('Mercado atualizado')).toBeNull()

    fireEvent.click(refreshButton())
    await flush()
    expect(screen.getByText('Mercado atualizado')).toHaveAttribute('aria-live', 'polite')
  })
})

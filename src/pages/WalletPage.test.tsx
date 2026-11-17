import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGES } from '../api/errors'
import { SESSION_KEY } from '../auth/sessionStorage'
import { pendingResponse } from '../test/fetch'
import { TEST_TOKEN, renderApp, storeValidSession } from '../test/renderApp'

type FetchArgs = [url: string, init: RequestInit]

const ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'

function balanceResponse(balanceEth: string) {
  return new Response(
    `{"ethereumAddress":"${ADDRESS}","balanceEth":${balanceEth},"network":"SEPOLIA"}`,
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function errorResponse(status: number, code: string) {
  return new Response(JSON.stringify({ code, message: 'Mensagem do servidor.' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * fetch simulado que responde na ordem dada e respeita o signal, como o
 * navegador. "pendente" nunca responde; uma Promise responde quando o teste quiser.
 */
function stubFetch(...responses: Array<Response | Promise<Response> | Error | 'pendente'>) {
  const queue = [...responses]
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

function openWallet() {
  storeValidSession()
  return renderApp('/carteira')
}

function balanceCard() {
  return screen.findByRole('region', { name: 'Saldo' })
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  window.sessionStorage.clear()
  expect(consoleError).not.toHaveBeenCalled()
})

describe('WalletPage', () => {
  it('mostra o esqueleto com aria-busy e depois o saldo, lido com o token da sessão', async () => {
    let respond: (response: Response) => void = () => {}
    const fetchMock = stubFetch(new Promise<Response>((resolve) => (respond = resolve)))
    const { container } = openWallet()

    await screen.findByRole('heading', { name: 'Carteira' })
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('[data-skeleton]')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Carregando saldo…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Atualizar saldo' })).toBeNull()

    await act(async () => respond(balanceResponse('0.002499999999601')))
    const card = await balanceCard()
    expect(card).toHaveTextContent('0,002499 ETH')
    expect(card).toHaveTextContent('Valor exato: 0,002499999999601 ETH')
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
    expect(container.querySelector('[data-skeleton]')).toBeNull()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/wallet/balance')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TEST_TOKEN}`)
  })

  it('saldo zero mostra "0" e a frase sobre receber ETH de teste', async () => {
    stubFetch(balanceResponse('0'))
    openWallet()

    const card = await balanceCard()
    expect(card).toHaveTextContent('0 ETH')
    expect(card).toHaveTextContent('Use o endereço desta carteira para receber ETH de teste.')
  })

  it('502 BLOCKCHAIN_UNAVAILABLE mostra a mensagem, e "Tentar novamente" refaz a chamada', async () => {
    const fetchMock = stubFetch(errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE'), balanceResponse('1.5'))
    openWallet()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ERROR_MESSAGES.BLOCKCHAIN_UNAVAILABLE)
    expect(screen.queryByRole('region', { name: 'Saldo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Atualizar saldo' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await balanceCard()).toHaveTextContent('1,5 ETH')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falha de rede mostra NETWORK_ERROR', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    openWallet()

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGES.NETWORK_ERROR)
  })

  it('resposta fora da ficha mostra o erro genérico', async () => {
    stubFetch(balanceResponse('"1E-18"'))
    openWallet()

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGES.INTERNAL_ERROR)
  })

  it('falha numa releitura mantém o cartão e mostra o alerta', async () => {
    stubFetch(balanceResponse('2'), errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE'))
    openWallet()
    await balanceCard()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar saldo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGES.BLOCKCHAIN_UNAVAILABLE)
    expect(screen.getByRole('region', { name: 'Saldo' })).toHaveTextContent('2 ETH')
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Atualizar saldo' })).toBeEnabled()
  })

  it('dois cliques em "Atualizar saldo" fazem UMA chamada; o botão fica desabilitado', async () => {
    const fetchMock = stubFetch(balanceResponse('1'), 'pendente')
    openWallet()
    await balanceCard()

    const button = screen.getByRole('button', { name: 'Atualizar saldo' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleName('Atualizando…')
    expect(screen.getByRole('region', { name: 'Saldo' })).toHaveTextContent('1 ETH')
  })

  it('anuncia "Saldo atualizado" depois de atualizar', async () => {
    stubFetch(balanceResponse('1'), balanceResponse('3'))
    openWallet()
    await balanceCard()
    expect(screen.queryByText('Saldo atualizado')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar saldo' }))

    expect(await screen.findByText('Saldo atualizado')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('region', { name: 'Saldo' })).toHaveTextContent('3 ETH')
  })

  it('sair da tela com a leitura em andamento cancela a requisição, sem aviso do React', async () => {
    const fetchMock = stubFetch('pendente')
    const { unmount } = openWallet()
    await screen.findByRole('heading', { name: 'Carteira' })
    const signal = fetchMock.mock.calls[0][1].signal

    unmount()
    await act(async () => {})

    expect(signal?.aborted).toBe(true)
  })

  it('copiar no cartão copia o endereço COMPLETO', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    stubFetch(balanceResponse('1'))
    openWallet()
    await balanceCard()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar endereço' }))
    })

    expect(writeText).toHaveBeenCalledWith(ADDRESS)
  })

  it('"Receber" abre e fecha o painel com o endereço completo', async () => {
    stubFetch(balanceResponse('1'))
    openWallet()
    await balanceCard()

    const receive = screen.getByRole('button', { name: 'Receber' })
    const panelId = receive.getAttribute('aria-controls') ?? ''
    const panel = document.getElementById(panelId)
    expect(receive).toHaveAttribute('aria-expanded', 'false')
    expect(panel).not.toBeVisible()

    fireEvent.click(receive)
    expect(receive).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toBeVisible()
    expect(screen.getByRole('region', { name: 'Receber ETH' })).toHaveTextContent(ADDRESS)

    fireEvent.click(receive)
    expect(receive).toHaveAttribute('aria-expanded', 'false')
    expect(panel).not.toBeVisible()
  })

  it('não mostra o mascote em nenhum estado', async () => {
    stubFetch(errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE'), balanceResponse('1'))
    const { container } = openWallet()

    await screen.findByRole('alert')
    expect(container.querySelector('img[src*="mascote"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await balanceCard()
    expect(container.querySelector('img[src*="mascote"]')).toBeNull()
  })
})

describe('WalletPage com 401 TOKEN_INVALID (integração com o AuthContext)', () => {
  it('termina em /entrar com o aviso de sessão expirada e o storage limpo', async () => {
    const fetchMock = stubFetch(errorResponse(401, 'TOKEN_INVALID'))
    const { router } = openWallet()
    expect(window.sessionStorage.getItem(SESSION_KEY)).not.toBeNull()

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou. Entre novamente.')
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Carteira' })).toBeNull())
  })
})

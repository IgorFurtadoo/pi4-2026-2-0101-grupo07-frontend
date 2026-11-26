import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGES } from '../api/errors'
import { SESSION_KEY } from '../auth/sessionStorage'
import { ACTIVITY_URL, activityBody, activityItem, txHash } from '../test/activity'
import { pendingResponse } from '../test/fetch'
import { MARKET_URL, marketBody } from '../test/market'
import { addPending, pendingKey, readPending } from '../lib/pendingTransactions'
import { pendingRecord, taskResponse } from '../test/pending'
import { TEST_TOKEN, renderApp, storeValidSession, tokenWithSubject } from '../test/renderApp'

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

type Reply = Response | Promise<Response> | Error | 'pendente'

/** Resposta simulada que respeita o signal, como o navegador. */
function reply(next: Reply, init: RequestInit): Promise<Response> {
  const pending = pendingResponse(init.signal)
  if (next === 'pendente') return pending
  if (next instanceof Error) return Promise.reject(next)
  return Promise.race([pending, Promise.resolve(next)])
}

/**
 * fetch simulado por rota: o saldo responde na ordem de `balance`, o
 * mercado na de `market` e a atividade na de `activity`. Fila vazia fica
 * pendente ("pendente" nunca responde; uma Promise responde quando o teste
 * quiser).
 */
function stubRoutes(balance: Reply[], market: Reply[] = [], activity: Reply[] = []) {
  const balanceQueue = [...balance]
  const marketQueue = [...market]
  const activityQueue = [...activity]
  const balanceMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((_url, init) =>
    reply(balanceQueue.shift() ?? 'pendente', init),
  )
  const marketMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((_url, init) =>
    reply(marketQueue.shift() ?? 'pendente', init),
  )
  const activityMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((_url, init) =>
    reply(activityQueue.shift() ?? 'pendente', init),
  )
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) =>
      url === MARKET_URL
        ? marketMock(url, init)
        : url === ACTIVITY_URL
          ? activityMock(url, init)
          : balanceMock(url, init),
    ),
  )
  return { balanceMock, marketMock, activityMock }
}

/** Só o saldo; o mercado fica pendente. Devolve o mock do saldo. */
function stubFetch(...responses: Reply[]) {
  return stubRoutes(responses).balanceMock
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
    // Só o bloco do saldo: o painel de mercado (pendente aqui) tem o seu próprio aria-busy.
    const area = container.querySelector('[data-block="saldo"]')
    expect(area).toHaveAttribute('aria-busy', 'true')
    expect(area?.querySelector('[data-skeleton]')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Carregando saldo…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Atualizar saldo' })).toBeNull()

    await act(async () => respond(balanceResponse('0.002499999999601')))
    const card = await balanceCard()
    expect(card).toHaveTextContent('0,002499 ETH')
    expect(card).toHaveTextContent('Valor exato: 0,002499999999601 ETH')
    expect(area).toHaveAttribute('aria-busy', 'false')
    expect(area?.querySelector('[data-skeleton]')).toBeNull()

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

  it('não mostra o mascote no saldo em nenhum estado (a atividade fica pendente)', async () => {
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

describe('WalletPage com o painel de mercado', () => {
  function marketResponse(prices?: string[], current?: string) {
    return new Response(marketBody(prices, current), { status: 200 })
  }

  function marketPanel() {
    return screen.findByRole('region', { name: 'Mercado · ETH' })
  }

  it('mostra o saldo e o mercado, cada um pela sua rota', async () => {
    const { balanceMock, marketMock } = stubRoutes(
      [balanceResponse('1.5')],
      [marketResponse(['2000', '2200'], '3200.45')],
    )
    openWallet()

    expect(await balanceCard()).toHaveTextContent('1,5 ETH')
    const panel = await marketPanel()
    await waitFor(() => expect(panel.textContent?.replace(/\u00a0/g, ' ')).toContain('US$ 3.200,45'))
    expect(balanceMock).toHaveBeenCalledTimes(1)
    expect(marketMock).toHaveBeenCalledTimes(1)
    expect((marketMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TEST_TOKEN}`,
    )
  })

  it('502 do mercado fica no painel: o saldo e as ações seguem funcionando', async () => {
    const { balanceMock } = stubRoutes(
      [balanceResponse('2'), balanceResponse('3')],
      [errorResponse(502, 'MARKET_DATA_UNAVAILABLE')],
    )
    openWallet()

    const panel = await marketPanel()
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Mercado indisponível')
    expect(await balanceCard()).toHaveTextContent('2 ETH')
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar saldo' }))
    await waitFor(() => expect(screen.getByRole('region', { name: 'Saldo' })).toHaveTextContent('3 ETH'))
    expect(balanceMock).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('link', { name: 'Enviar' })).toBeInTheDocument()
  })

  it('429 do mercado não afeta o saldo', async () => {
    stubRoutes(
      [balanceResponse('2')],
      [
        new Response(JSON.stringify({ code: 'RATE_LIMIT_EXCEEDED', message: 'x' }), {
          status: 429,
          headers: { 'Retry-After': '30' },
        }),
      ],
    )
    openWallet()

    const panel = await marketPanel()
    expect(await within(panel).findByText('Tente de novo em 30 s.')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Atualizar' })).toBeDisabled()
    expect(await balanceCard()).toHaveTextContent('2 ETH')
  })

  it('falha do saldo não impede o mercado', async () => {
    stubRoutes([errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE')], [marketResponse()])
    openWallet()

    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    const panel = await marketPanel()
    await waitFor(() => expect(panel.textContent?.replace(/\u00a0/g, ' ')).toContain('US$ 3.200,45'))
  })

  it('401 TOKEN_INVALID no mercado segue o tratamento central e leva a /entrar', async () => {
    stubRoutes(['pendente'], [errorResponse(401, 'TOKEN_INVALID')])
    const { router } = openWallet()

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou. Entre novamente.')
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('sair e voltar à carteira dentro de 60 s não busca o mercado de novo', async () => {
    const { marketMock } = stubRoutes(
      [balanceResponse('1'), balanceResponse('1')],
      [marketResponse(), marketResponse()],
    )
    const { router } = openWallet()
    const panel = await marketPanel()
    await waitFor(() => expect(panel.textContent).toContain('3.200,45'))

    await act(() => router.navigate('/enviar'))
    await act(() => router.navigate('/carteira'))
    const again = await marketPanel()
    expect(again.textContent).toContain('3.200,45')
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
    expect(marketMock).toHaveBeenCalledTimes(1)
  })
})

describe('WalletPage com a lista de atividade', () => {
  function activityResponse(items: string[]) {
    return new Response(activityBody(items), { status: 200 })
  }

  function activityPanel() {
    return screen.findByRole('region', { name: 'Atividade' })
  }

  it('lista a atividade abaixo do mercado, pela sua rota, com o token', async () => {
    const { activityMock } = stubRoutes(
      [balanceResponse('1')],
      [],
      [activityResponse([activityItem({ amountEth: '0.000000000000000001' })])],
    )
    const { container } = openWallet()

    const panel = await activityPanel()
    expect(await within(panel).findByText(/0,000000000000000001 ETH/)).toBeInTheDocument()
    expect(within(panel).getAllByRole('listitem')).toHaveLength(1)
    expect(activityMock).toHaveBeenCalledTimes(1)
    expect((activityMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TEST_TOKEN}`,
    )
    // Ordem na página: saldo, mercado, atividade.
    const sections = [...container.querySelectorAll('section[aria-labelledby]')].map((s) =>
      s.getAttribute('aria-labelledby'),
    )
    expect(sections.indexOf('titulo-mercado')).toBeLessThan(sections.indexOf('titulo-atividade'))
  })

  it('a atividade aparece mesmo com o saldo e o mercado pendentes', async () => {
    stubRoutes(['pendente'], ['pendente'], [activityResponse([activityItem()])])
    openWallet()

    const panel = await activityPanel()
    expect(await within(panel).findAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Carregando saldo…')).toBeInTheDocument()
  })

  it.each([
    ['502 HISTORY_UNAVAILABLE', errorResponse(502, 'HISTORY_UNAVAILABLE'), 'Histórico indisponível'],
    ['500 INTERNAL_ERROR', errorResponse(500, 'INTERNAL_ERROR'), ERROR_MESSAGES.INTERNAL_ERROR],
  ])('%s do histórico fica no painel: saldo, mercado e ações seguem', async (_name, failure, text) => {
    const { balanceMock, activityMock } = stubRoutes(
      [balanceResponse('2'), balanceResponse('3')],
      [new Response(marketBody(), { status: 200 })],
      [failure],
    )
    openWallet()

    const panel = await activityPanel()
    expect(await within(panel).findByRole('alert')).toHaveTextContent(text)
    expect(await balanceCard()).toHaveTextContent('2 ETH')
    const market = await screen.findByRole('region', { name: 'Mercado · ETH' })
    await waitFor(() => expect(market.textContent).toContain('3.200,45'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar saldo' }))
    await waitFor(() => expect(screen.getByRole('region', { name: 'Saldo' })).toHaveTextContent('3 ETH'))
    expect(balanceMock).toHaveBeenCalledTimes(2)
    // Atualizar o saldo não relê a atividade.
    expect(activityMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Enviar' })).toBeInTheDocument()
  })

  it('falha do saldo não impede a atividade', async () => {
    stubRoutes([errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE')], [], [activityResponse([activityItem()])])
    openWallet()

    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    const panel = await activityPanel()
    expect(await within(panel).findAllByRole('listitem')).toHaveLength(1)
  })

  it('o mascote só aparece no vazio da atividade', async () => {
    stubRoutes([errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE')], [], [activityResponse([])])
    const { container } = openWallet()

    const panel = await activityPanel()
    await within(panel).findByText(/Nenhuma transação ainda/)
    const mascots = container.querySelectorAll('img[src*="mascote"]')
    expect(mascots).toHaveLength(1)
    expect(panel.contains(mascots[0])).toBe(true)
  })

  it('401 TOKEN_INVALID no histórico segue o tratamento central e leva a /entrar', async () => {
    stubRoutes(['pendente'], ['pendente'], [errorResponse(401, 'TOKEN_INVALID')])
    const { router } = openWallet()

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou. Entre novamente.')
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('voltar à carteira relê a atividade (como o saldo, depois de uma transação final)', async () => {
    const { activityMock } = stubRoutes(
      [balanceResponse('1'), balanceResponse('1')],
      [],
      [activityResponse([]), activityResponse([activityItem()])],
    )
    const { router } = openWallet()
    await within(await activityPanel()).findByText(/Nenhuma transação ainda/)

    await act(() => router.navigate('/enviar'))
    await act(() => router.navigate('/carteira'))

    const panel = await activityPanel()
    expect(await within(panel).findAllByRole('listitem')).toHaveLength(1)
    expect(activityMock).toHaveBeenCalledTimes(2)
  })

  it('sair da tela com a atividade em voo cancela a requisição', async () => {
    const { activityMock } = stubRoutes(['pendente'], ['pendente'], ['pendente'])
    const { unmount } = openWallet()
    await waitFor(() => expect(activityMock).toHaveBeenCalledTimes(1))
    const signal = activityMock.mock.calls[0][1].signal

    unmount()
    await act(async () => {})

    expect(signal?.aborted).toBe(true)
  })
})

describe('WalletPage com envios "Em andamento"', () => {
  const USER_TOKEN = tokenWithSubject('42')
  const TASK_URL = 'http://localhost:8080/transactions/t1'

  /**
   * Como stubRoutes, mais o CT13 da task t1 (fila `task`). O mercado fica
   * pendente.
   */
  function stubWithTask(balance: Reply[], activity: Reply[], task: Reply[]) {
    const queues: Record<string, Reply[]> = { balance: [...balance], activity: [...activity], task: [...task] }
    const mocks = {
      balance: vi.fn<(...args: FetchArgs) => Promise<Response>>((_u, init) => reply(queues.balance.shift() ?? 'pendente', init)),
      activity: vi.fn<(...args: FetchArgs) => Promise<Response>>((_u, init) => reply(queues.activity.shift() ?? 'pendente', init)),
      task: vi.fn<(...args: FetchArgs) => Promise<Response>>((_u, init) => reply(queues.task.shift() ?? 'pendente', init)),
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) =>
        url === MARKET_URL
          ? pendingResponse(init.signal)
          : url === ACTIVITY_URL
            ? mocks.activity(url, init)
            : url === TASK_URL
              ? mocks.task(url, init)
              : mocks.balance(url, init),
      ),
    )
    return mocks
  }

  function activityResponse(items: string[]) {
    return new Response(activityBody(items), { status: 200 })
  }

  function openWalletAs(token = USER_TOKEN) {
    storeValidSession(Date.now(), token)
    return renderApp('/carteira')
  }

  const pendingSection = () => screen.findByRole('region', { name: 'Em andamento' })

  it('mostra o envio guardado logo depois do saldo, com link para o acompanhamento', async () => {
    addPending('42', pendingRecord('t1'))
    stubWithTask([balanceResponse('1')], [activityResponse([])], [taskResponse('t1', 'PENDING')])
    const { container } = openWalletAs()

    const section = await pendingSection()
    await waitFor(() => expect(within(section).getByRole('link')).toHaveTextContent('Pendente'))
    expect(within(section).getByRole('link')).toHaveAttribute('href', '/transacoes/t1')

    const order = [...container.querySelectorAll('section[aria-labelledby]')].map((s) =>
      s.getAttribute('aria-labelledby'),
    )
    // Ordem do DOM (a do celular): saldo, em andamento, mercado, atividade.
    expect(order.indexOf('titulo-saldo')).toBeLessThan(order.indexOf('titulo-em-andamento'))
    expect(order.indexOf('titulo-em-andamento')).toBeLessThan(order.indexOf('titulo-mercado'))
    expect(order.indexOf('titulo-mercado')).toBeLessThan(order.indexOf('titulo-atividade'))
  })

  it('sem envios guardados a seção não aparece', async () => {
    stubWithTask([balanceResponse('1')], [activityResponse([])], [])
    openWalletAs()
    await within(await screen.findByRole('region', { name: 'Atividade' })).findByText(/Nenhuma transação ainda/)
    expect(screen.queryByRole('region', { name: 'Em andamento' })).toBeNull()
  })

  it('um usuário não vê os envios de outro no mesmo navegador', async () => {
    addPending('7', pendingRecord('t1'))
    const mocks = stubWithTask([balanceResponse('1')], [activityResponse([])], [])
    openWalletAs()
    await within(await screen.findByRole('region', { name: 'Atividade' })).findByText(/Nenhuma transação ainda/)
    expect(screen.queryByRole('region', { name: 'Em andamento' })).toBeNull()
    expect(mocks.task).not.toHaveBeenCalled()
    expect(readPending('7')).toHaveLength(1)
  })

  it('PENDING que confirma relê saldo e atividade; com o hash no histórico, o item sai', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      addPending('42', pendingRecord('t1'))
      const mocks = stubWithTask(
        [balanceResponse('1'), balanceResponse('0.99')],
        [activityResponse([]), activityResponse([activityItem({ hash: txHash(9), direction: 'SENT' })])],
        [taskResponse('t1', 'PENDING'), taskResponse('t1', 'CONFIRMED', { transactionHash: txHash(9) })],
      )
      openWalletAs()
      const section = await pendingSection()
      await waitFor(() => expect(within(section).getByRole('link')).toHaveTextContent('Pendente'))
      expect(mocks.balance).toHaveBeenCalledTimes(1)
      expect(mocks.activity).toHaveBeenCalledTimes(1)

      await act(() => vi.advanceTimersByTimeAsync(5_000))

      await waitFor(() => expect(mocks.balance).toHaveBeenCalledTimes(2))
      expect(mocks.activity).toHaveBeenCalledTimes(2)
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Em andamento' })).toBeNull())
      expect(await balanceCard()).toHaveTextContent('0,99 ETH')
      expect(window.localStorage.getItem(pendingKey('42'))).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('hash já presente no histórico ao abrir: não duplica e sai do armazenamento', async () => {
    addPending('42', pendingRecord('t1'))
    stubWithTask(
      [balanceResponse('1')],
      [activityResponse([activityItem({ hash: txHash(9), direction: 'SENT' })])],
      [taskResponse('t1', 'CONFIRMED', { transactionHash: txHash(9) })],
    )
    openWalletAs()
    const activity = await screen.findByRole('region', { name: 'Atividade' })
    await within(activity).findAllByRole('listitem')
    await waitFor(() => expect(readPending('42')).toEqual([]))
    expect(screen.queryByRole('region', { name: 'Em andamento' })).toBeNull()
  })

  it('FAILED: "Dispensar" tira o item da tela e do armazenamento', async () => {
    addPending('42', pendingRecord('t1'))
    stubWithTask(
      [balanceResponse('1')],
      [activityResponse([])],
      [taskResponse('t1', 'FAILED', { failureReason: 'REJECTED_BY_NETWORK' })],
    )
    openWalletAs()
    const section = await pendingSection()
    fireEvent.click(await within(section).findByRole('button', { name: /Dispensar/ }))

    expect(screen.queryByRole('region', { name: 'Em andamento' })).toBeNull()
    expect(readPending('42')).toEqual([])
  })

  it('404 TRANSACTION_NOT_FOUND tira o item do armazenamento', async () => {
    addPending('42', pendingRecord('t1'))
    stubWithTask([balanceResponse('1')], [activityResponse([])], [errorResponse(404, 'TRANSACTION_NOT_FOUND')])
    openWalletAs()
    await pendingSection()
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Em andamento' })).toBeNull())
    expect(readPending('42')).toEqual([])
  })

  it('localStorage que lança não derruba a carteira: saldo e atividade aparecem', async () => {
    const blocked = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Bloqueado', 'SecurityError')
    })
    try {
      stubWithTask([balanceResponse('1')], [activityResponse([activityItem()])], [])
      openWalletAs()

      expect(await balanceCard()).toHaveTextContent('1 ETH')
      const activity = await screen.findByRole('region', { name: 'Atividade' })
      expect(await within(activity).findAllByRole('listitem')).toHaveLength(1)
      expect(screen.queryByRole('region', { name: 'Em andamento' })).toBeNull()
      expect(blocked).toHaveBeenCalled()
    } finally {
      blocked.mockRestore()
    }
  })
})

describe('WalletPage: grade de blocos', () => {
  const USER_TOKEN = tokenWithSubject('42')

  /** Os quatro blocos são os filhos diretos da grade, na ordem do DOM. */
  async function blocks() {
    const balance = await screen.findByRole('region', { name: 'Saldo' })
    const grid = balance.closest('[data-block="saldo"]')!.parentElement!
    return { grid, children: [...grid.children] as HTMLElement[] }
  }

  function openWalletAs(token = USER_TOKEN) {
    storeValidSession(Date.now(), token)
    return renderApp('/carteira')
  }

  /** Saldo 1 ETH e atividade vazia; mercado e CT13 ficam pendentes. */
  function stubGrid() {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        if (url === 'http://localhost:8080/wallet/balance') return reply(balanceResponse('1'), init)
        if (url === ACTIVITY_URL) return reply(new Response(activityBody([]), { status: 200 }), init)
        return pendingResponse(init.signal)
      }),
    )
  }

  it('sem "Em andamento": Saldo e Mercado em cima, Atividade nas 12 colunas', async () => {
    stubGrid()
    openWalletAs()

    const { grid, children } = await blocks()
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-12', 'gap-3', 'lg:gap-4')
    expect(children).toHaveLength(3)
    const [balance, market, activity] = children
    expect(within(balance).getByRole('region', { name: 'Saldo' })).toBeInTheDocument()
    expect(market).toBe(screen.getByRole('region', { name: 'Mercado · ETH' }))
    expect(activity).toBe(screen.getByRole('region', { name: 'Atividade' }))

    expect(balance).toHaveClass('lg:col-span-5', 'lg:row-start-1')
    expect(market).toHaveClass('lg:col-span-7', 'lg:col-start-6', 'lg:row-start-1', 'sm:col-start-2')
    expect(activity).toHaveClass('lg:col-span-12', 'lg:row-start-2', 'sm:col-span-2')
    expect(activity).not.toHaveClass('lg:col-span-7')
  })

  it('com "Em andamento": ordem do celular no DOM e as duas colunas embaixo no desktop', async () => {
    addPending('42', pendingRecord('t1'))
    stubGrid()
    openWalletAs()

    const { children } = await blocks()
    expect(children).toHaveLength(4)
    const [balance, pending, market, activity] = children
    expect(within(balance).getByRole('region', { name: 'Saldo' })).toBeInTheDocument()
    expect(pending).toBe(screen.getByRole('region', { name: 'Em andamento' }))
    expect(market).toBe(screen.getByRole('region', { name: 'Mercado · ETH' }))
    expect(activity).toBe(screen.getByRole('region', { name: 'Atividade' }))

    expect(pending).toHaveClass('lg:col-span-5', 'lg:col-start-1', 'lg:row-start-2', 'sm:col-span-2')
    expect(activity).toHaveClass('lg:col-span-7', 'lg:col-start-6', 'lg:row-start-2')
    expect(activity).not.toHaveClass('lg:col-span-12')
  })

  it('"Dispensar" o último envio devolve a Atividade às 12 colunas', async () => {
    addPending('42', pendingRecord('t1'))
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/transactions/t1')) {
        return Promise.resolve(
          new Response('{"taskId":"t1","status":"FAILED","destinationAddress":"0x5B38Da6a701c568545dCfcB03FcB875f56beddC4","updatedAt":"2026-11-26T12:00:00Z","failureReason":"REJECTED_BY_NETWORK","amountEth":0.01}', { status: 200 }),
        )
      }
      if (url === ACTIVITY_URL) return Promise.resolve(new Response(activityBody([]), { status: 200 }))
      return pendingResponse(init.signal)
    })
    vi.stubGlobal('fetch', fetchMock)
    openWalletAs()

    const pending = await screen.findByRole('region', { name: 'Em andamento' })
    fireEvent.click(await within(pending).findByRole('button', { name: /Dispensar/ }))

    expect(screen.getByRole('region', { name: 'Atividade' })).toHaveClass('lg:col-span-12')
  })

  it('alvos de toque de 44 px (min-h-11) e o cartão de saldo ocupando a altura do bloco', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        if (url === 'http://localhost:8080/wallet/balance') return reply(balanceResponse('1'), init)
        if (url === ACTIVITY_URL) {
          return reply(new Response(activityBody([activityItem()]), { status: 200 }), init)
        }
        return pendingResponse(init.signal)
      }),
    )
    openWalletAs()

    const card = await balanceCard()
    expect(card).toHaveClass('flex', 'flex-col', 'flex-1')
    expect(card.closest('[data-block="saldo"]')).toHaveClass('flex', 'flex-col')
    const activity = screen.getByRole('region', { name: 'Atividade' })
    const targets = [
      screen.getByRole('link', { name: 'Enviar' }),
      screen.getByRole('button', { name: 'Receber' }),
      screen.getByRole('button', { name: 'Copiar endereço' }),
      within(screen.getByRole('banner')).getAllByRole('link')[0],
      screen.getByRole('button', { name: 'Sair' }),
      await within(activity).findByRole('link', { name: /Ver no Etherscan/ }),
    ]
    targets.forEach((target) => expect(target).toHaveClass('min-h-11'))
  })

  it('a ordem dos títulos segue h1 Carteira e depois os h2 dos blocos', async () => {
    addPending('42', pendingRecord('t1'))
    stubGrid()
    openWalletAs()
    await blocks()

    const headings = screen
      .getAllByRole('heading')
      .filter((heading) => heading.closest('[hidden]') === null)
      .map((heading) => `${heading.tagName} ${heading.textContent}`)
    expect(headings).toEqual(['H1 Carteira', 'H2 Saldo', 'H2 Em andamento', 'H2 Mercado · ETH', 'H2 Atividade'])
  })
})

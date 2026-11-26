import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGES, UNCERTAIN_SEND_MESSAGE } from '../api/errors'
import { pendingKey, readPending } from '../lib/pendingTransactions'
import { pendingResponse } from '../test/fetch'
import { TEST_TOKEN, renderApp, storeValidSession, tokenWithSubject } from '../test/renderApp'

type FetchArgs = [url: string, init: RequestInit]
type Reply = Response | Promise<Response> | Error | 'pendente'

const ADDRESS = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4'
const TASK_ID = 'a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b'
const AMOUNT_HINT =
  'Use vírgula ou ponto só para os decimais, sem separador de milhar. Deixe uma pequena folga para a taxa de rede.'

function accepted(taskId = TASK_ID) {
  return new Response(`{"taskId":"${taskId}","status":"PENDING"}`, {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(status: number, code: string) {
  return new Response(JSON.stringify({ code, message: 'Mensagem do servidor.' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Resposta que o teste entrega quando quiser. */
function deferred() {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((r) => (resolve = r))
  return { promise, resolve }
}

/** URL do envio (CT9). A atividade da carteira (/wallet/transactions) não é ela. */
const SEND_URL = 'http://localhost:8080/transactions'

/**
 * fetch simulado: POST /transactions responde na ordem dada e respeita o
 * signal; qualquer outra rota (saldo, mercado e atividade da carteira) fica
 * pendente.
 */
function stubFetch(...replies: Reply[]) {
  const queue = [...replies]
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((url, init) => {
    const pending = pendingResponse(init.signal)
    if (url !== SEND_URL) return pending
    const next = queue.shift() ?? 'pendente'
    if (next === 'pendente') return pending
    if (next instanceof Error) return Promise.reject(next)
    return Promise.race([pending, Promise.resolve(next)])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sendCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(([url]) => url === SEND_URL).length
}

async function openSend(entry: Parameters<typeof renderApp>[0] = '/enviar') {
  storeValidSession()
  const view = renderApp(entry)
  await screen.findByRole('heading', { name: 'Enviar ETH' })
  return view
}

const addressField = () => screen.getByLabelText('Endereço de destino')
const amountField = () => screen.getByLabelText('Valor (ETH)')

function fill(address: string, amount: string) {
  fireEvent.change(addressField(), { target: { value: address } })
  fireEvent.change(amountField(), { target: { value: amount } })
}

function clickContinue() {
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

const confirmButton = () => screen.getByRole('button', { name: 'Confirmar envio' })

async function reachReview(address = ADDRESS, amount = '0,01', entry?: Parameters<typeof renderApp>[0]) {
  const view = await openSend(entry)
  fill(address, amount)
  clickContinue()
  expect(screen.getByRole('heading', { name: 'Revise o envio' })).toBeInTheDocument()
  return view
}

function noMascot(container: HTMLElement) {
  expect(container.querySelector('img[src*="mascote"]')).toBeNull()
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  vi.useRealTimers()
  window.sessionStorage.clear()
  expect(consoleError).not.toHaveBeenCalled()
})

describe('SendPage: formulário', () => {
  it('campos com rótulo e os atributos de digitação', async () => {
    await openSend()

    expect(addressField()).toHaveAttribute('type', 'text')
    expect(addressField()).toHaveAttribute('autocomplete', 'off')
    expect(addressField()).toHaveAttribute('spellcheck', 'false')
    expect(addressField()).toHaveAttribute('autocapitalize', 'none')
    expect(amountField()).toHaveAttribute('type', 'text')
    expect(amountField()).toHaveAttribute('inputmode', 'decimal')
  })

  it('o campo de valor tem o texto de ajuda ligado por aria-describedby', async () => {
    await openSend()

    const describedBy = amountField().getAttribute('aria-describedby') ?? ''
    expect(describedBy).not.toBe('')
    expect(document.getElementById(describedBy)).toHaveTextContent(AMOUNT_HINT)
    expect(amountField()).toHaveAccessibleDescription(AMOUNT_HINT)
  })

  it('não altera o endereço digitado', async () => {
    await openSend()
    const typed = '  0xABCdef0123456789abcdef0123456789ABCDEF01 '

    fill(typed, '1')

    expect(addressField()).toHaveValue(typed)
  })

  it('campos vazios mostram as mensagens, focam o endereço e não chamam a API', async () => {
    const fetchMock = stubFetch(accepted())
    await openSend()

    fill('   ', ' ')
    clickContinue()

    expect(addressField()).toHaveAttribute('aria-invalid', 'true')
    expect(addressField()).toHaveAccessibleDescription('Informe o endereço de destino.')
    expect(amountField()).toHaveAccessibleDescription(`${AMOUNT_HINT} Informe o valor.`)
    expect(addressField()).toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Enviar ETH' })).toBeInTheDocument()
    expect(sendCalls(fetchMock)).toBe(0)
  })

  it('endereço fora do formato', async () => {
    const fetchMock = stubFetch(accepted())
    await openSend()

    fill('0x123', '0,01')
    clickContinue()

    expect(addressField()).toHaveAccessibleDescription(
      'O endereço precisa começar com 0x e ter mais 40 caracteres, de 0 a 9 ou de a a f.',
    )
    expect(amountField()).not.toHaveAttribute('aria-invalid')
    expect(sendCalls(fetchMock)).toBe(0)
  })

  it.each([
    ['abc', 'Use só números, com vírgula ou ponto para os decimais (por exemplo, 0,01).'],
    ['1.000,50', 'Use só números, com vírgula ou ponto para os decimais (por exemplo, 0,01).'],
    ['0,000', 'O valor precisa ser maior que zero.'],
    ['0.' + '0'.repeat(18) + '1', 'Use no máximo 18 casas decimais.'],
    ['1' + '0'.repeat(20), 'Use no máximo 20 dígitos antes da vírgula.'],
  ])('valor "%s" mostra a mensagem do motivo e foca o campo', async (amount, message) => {
    const fetchMock = stubFetch(accepted())
    await openSend()

    fill(ADDRESS, amount)
    clickContinue()

    expect(amountField()).toHaveAttribute('aria-invalid', 'true')
    expect(amountField()).toHaveAccessibleDescription(`${AMOUNT_HINT} ${message}`)
    expect(amountField()).toHaveFocus()
    expect(sendCalls(fetchMock)).toBe(0)
  })

  it('"Continuar" só muda de etapa: não chama a API', async () => {
    const fetchMock = stubFetch(accepted())
    await reachReview()

    expect(sendCalls(fetchMock)).toBe(0)
  })
})

describe('SendPage: revisão', () => {
  it('mostra o valor, o endereço completo, a rede e o aviso, com o foco no título', async () => {
    await reachReview(`  ${ADDRESS} `, '0,01')

    expect(screen.getByText(/Você vai enviar/)).toHaveTextContent(
      'Você vai enviar 0,01 ETH para o endereço:',
    )
    expect(screen.getByText(ADDRESS)).toHaveClass('font-mono', 'break-all')
    expect(screen.getByText('Sepolia · testnet')).toBeInTheDocument()
    expect(screen.getByText(/não pode ser desfeita/)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Revise o envio' })).toHaveFocus(),
    )
  })

  it('mostra o valor com todas as casas, sem arredondar', async () => {
    await reachReview(ADDRESS, '12345.123456789012345678')

    expect(screen.getByText('12.345,123456789012345678 ETH')).toBeInTheDocument()
  })

  it('"1.000" é revisado como 1 ETH', async () => {
    await reachReview(ADDRESS, '1.000')

    expect(screen.getByText('1 ETH')).toBeInTheDocument()
  })

  it('"Voltar e editar" mantém o que foi digitado e foca o título do formulário', async () => {
    await reachReview(` ${ADDRESS}`, '0,5')

    fireEvent.click(screen.getByRole('button', { name: 'Voltar e editar' }))

    expect(addressField()).toHaveValue(` ${ADDRESS}`)
    expect(amountField()).toHaveValue('0,5')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Enviar ETH' })).toHaveFocus())
  })

  it('não mostra o mascote em nenhuma etapa', async () => {
    stubFetch(errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE'))
    const { container } = await openSend()
    noMascot(container)

    fill(ADDRESS, '0,01')
    clickContinue()
    noMascot(container)

    fireEvent.click(confirmButton())
    await screen.findByRole('alert')
    noMascot(container)
  })
})

describe('SendPage: envio', () => {
  it('202 vai para /transacoes/{taskId} e substitui a revisão no histórico', async () => {
    const fetchMock = stubFetch(accepted())
    const { router } = await reachReview(ADDRESS, '0,01', ['/carteira', '/enviar'])

    fireEvent.click(confirmButton())

    expect(
      await screen.findByRole('heading', { name: 'Acompanhamento da transação' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/transacoes/${TASK_ID}`)
    expect(router.state.historyAction).toBe('REPLACE')
    expect(sendCalls(fetchMock)).toBe(1)

    const [, init] = fetchMock.mock.calls.find(([url]) => url === SEND_URL)!
    expect(init.body).toBe(`{"destinationAddress":"${ADDRESS}","amountEth":"0.01"}`)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TEST_TOKEN}`)

    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe('/carteira')
  })

  it('dois cliques seguidos em "Confirmar envio" fazem uma só chamada', async () => {
    const reply = deferred()
    const fetchMock = stubFetch(reply.promise)
    await reachReview()

    const button = confirmButton()
    fireEvent.click(button)
    fireEvent.click(button)

    expect(sendCalls(fetchMock)).toBe(1)
    await act(async () => reply.resolve(accepted()))
    await screen.findByRole('heading', { name: 'Acompanhamento da transação' })
    expect(sendCalls(fetchMock)).toBe(1)
  })

  it('a trava por ref barra o segundo clique antes de o React redesenhar', async () => {
    const fetchMock = stubFetch('pendente')
    await reachReview()

    const button = confirmButton()
    // Dentro de um só act, o disabled ainda não foi aplicado no segundo clique.
    act(() => {
      button.click()
      expect(button).not.toBeDisabled()
      button.click()
    })

    expect(sendCalls(fetchMock)).toBe(1)
  })

  it('dois Enter (submits) seguidos fazem uma só chamada', async () => {
    const fetchMock = stubFetch('pendente')
    await reachReview()

    const form = screen.getByRole('form', { name: 'Revise o envio' })
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(sendCalls(fetchMock)).toBe(1)
  })

  it('o segundo clique de um duplo clique não envia (detail 2)', async () => {
    const fetchMock = stubFetch(accepted())
    await reachReview()

    fireEvent.click(confirmButton(), { detail: 2 })

    expect(sendCalls(fetchMock)).toBe(0)
    expect(confirmButton()).toBeEnabled()
  })

  it('o botão fica desabilitado com "Enviando…" e "Voltar e editar" também', async () => {
    stubFetch('pendente')
    await reachReview()

    fireEvent.click(confirmButton())

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Voltar e editar' })).toBeDisabled()
  })
})

describe('SendPage: erros', () => {
  it.each([
    ['ADDRESS_INVALID', 'Endereço de destino'],
    ['AMOUNT_INVALID', 'Valor (ETH)'],
  ])('400 %s volta ao formulário com a mensagem no campo', async (code, label) => {
    stubFetch(errorResponse(400, code))
    await reachReview(ADDRESS, '0,01')

    fireEvent.click(confirmButton())

    await screen.findByRole('heading', { name: 'Enviar ETH' })
    const field = screen.getByLabelText(label)
    const message = ERROR_MESSAGES[code as 'ADDRESS_INVALID' | 'AMOUNT_INVALID']
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(
      code === 'AMOUNT_INVALID' ? `${AMOUNT_HINT} ${message}` : message,
    )
    await waitFor(() => expect(field).toHaveFocus())
    expect(addressField()).toHaveValue(ADDRESS)
    expect(amountField()).toHaveValue('0,01')
  })

  it.each([
    [502, 'BLOCKCHAIN_UNAVAILABLE'],
    [400, 'REQUEST_INVALID'],
  ] as const)('%i %s fica na revisão com o alerta e o botão "Confirmar envio"', async (status, code) => {
    const fetchMock = stubFetch(errorResponse(status, code), accepted())
    await reachReview()

    fireEvent.click(confirmButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ERROR_MESSAGES[code])
    await waitFor(() => expect(alert).toHaveFocus())
    expect(screen.getByRole('heading', { name: 'Revise o envio' })).toBeInTheDocument()
    expect(screen.queryByText(UNCERTAIN_SEND_MESSAGE)).not.toBeInTheDocument()

    // A trava foi liberada: o usuário decide enviar de novo.
    fireEvent.click(confirmButton())
    await screen.findByRole('heading', { name: 'Acompanhamento da transação' })
    expect(sendCalls(fetchMock)).toBe(2)
  })

  it.each([
    ['500 INTERNAL_ERROR', () => errorResponse(500, 'INTERNAL_ERROR')],
    ['202 com corpo fora da ficha', () => new Response('{"status":"PENDING"}', { status: 202 })],
    ['code desconhecido', () => errorResponse(503, 'SERVICE_OVERLOADED')],
    ['falha de rede', () => new TypeError('Failed to fetch')],
  ])('%s: resultado incerto, fica na revisão e não reenvia sozinho', async (_name, reply) => {
    const fetchMock = stubFetch(reply())
    await reachReview()

    fireEvent.click(confirmButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(UNCERTAIN_SEND_MESSAGE)
    await waitFor(() => expect(alert).toHaveFocus())
    expect(screen.getByRole('heading', { name: 'Revise o envio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar de novo' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Confirmar envio' })).not.toBeInTheDocument()
    expect(sendCalls(fetchMock)).toBe(1)
  })

  it('tempo esgotado (20 s): resultado incerto e nenhuma segunda chamada, mesmo muito depois', async () => {
    const fetchMock = stubFetch('pendente')
    await reachReview()
    vi.useFakeTimers()

    fireEvent.click(confirmButton())
    await act(() => vi.advanceTimersByTimeAsync(20_000))

    expect(screen.getByRole('alert')).toHaveTextContent(UNCERTAIN_SEND_MESSAGE)
    expect(screen.getByRole('button', { name: 'Enviar de novo' })).toBeEnabled()

    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    await act(() => vi.advanceTimersByTimeAsync(60_000))

    expect(sendCalls(fetchMock)).toBe(1)
    expect(screen.getByRole('heading', { name: 'Revise o envio' })).toBeInTheDocument()
  })

  it('"Enviar de novo" faz uma nova chamada só por decisão do usuário', async () => {
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), accepted())
    await reachReview()

    fireEvent.click(confirmButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar de novo' }))

    await screen.findByRole('heading', { name: 'Acompanhamento da transação' })
    expect(sendCalls(fetchMock)).toBe(2)
  })

  it('o aviso de resultado incerto continua depois de um 502 e no formulário', async () => {
    stubFetch(errorResponse(500, 'INTERNAL_ERROR'), errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE'))
    await reachReview()

    fireEvent.click(confirmButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar de novo' }))

    await screen.findByText(ERROR_MESSAGES.BLOCKCHAIN_UNAVAILABLE)
    expect(screen.getByText(UNCERTAIN_SEND_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar de novo' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Voltar e editar' }))
    expect(screen.getByRole('heading', { name: 'Enviar ETH' })).toBeInTheDocument()
    expect(screen.getByText(UNCERTAIN_SEND_MESSAGE)).toBeInTheDocument()
  })

  it('401 TOKEN_INVALID leva ao /entrar com o aviso de sessão expirada', async () => {
    stubFetch(errorResponse(401, 'TOKEN_INVALID'))
    const { router } = await reachReview()

    fireEvent.click(confirmButton())

    await screen.findByRole('heading', { name: 'Entrar' })
    expect(router.state.location.pathname).toBe('/entrar')
    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.TOKEN_INVALID)
  })
})

describe('SendPage: sair com o envio em voo', () => {
  it.each([
    ['202', () => accepted()],
    ['502', () => errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE')],
  ])('resposta %s depois de sair é ignorada, sem aviso do React', async (_name, reply) => {
    const pending = deferred()
    const fetchMock = stubFetch(pending.promise)
    const { router } = await reachReview()

    fireEvent.click(confirmButton())
    await act(() => router.navigate('/carteira'))
    await screen.findByRole('heading', { name: 'Carteira' })

    // A requisição não foi cancelada ao sair.
    const [, init] = fetchMock.mock.calls.find(([url]) => url === SEND_URL)!
    expect(init.signal?.aborted).toBe(false)

    await act(async () => pending.resolve(reply()))

    expect(router.state.location.pathname).toBe('/carteira')
    expect(screen.getByRole('heading', { name: 'Carteira' })).toBeInTheDocument()
    expect(sendCalls(fetchMock)).toBe(1)
  })
})

describe('SendPage: envio guardado para "Em andamento"', () => {
  const USER_TOKEN = tokenWithSubject('42')

  /** Como reachReview, mas com a sessão de um token que tem `sub`. */
  async function reachReviewAs(token: string, entry: Parameters<typeof renderApp>[0] = '/enviar') {
    storeValidSession(Date.now(), token)
    const view = renderApp(entry)
    await screen.findByRole('heading', { name: 'Enviar ETH' })
    fill(ADDRESS, ' 0,01 ')
    clickContinue()
    expect(screen.getByRole('heading', { name: 'Revise o envio' })).toBeInTheDocument()
    return view
  }

  it('no 202 grava taskId, valor, destino e instante na chave do usuário do token', async () => {
    stubFetch(accepted())
    const before = Date.now()
    await reachReviewAs(USER_TOKEN)

    fireEvent.click(confirmButton())
    await screen.findByRole('heading', { name: 'Acompanhamento da transação' })

    expect(window.localStorage.getItem(pendingKey('42'))).not.toBeNull()
    const [record, ...rest] = readPending('42')
    expect(rest).toEqual([])
    expect(record).toEqual({
      taskId: TASK_ID,
      amountEth: '0.01',
      destinationAddress: ADDRESS,
      createdAt: expect.stringMatching(/Z$/),
    })
    expect(Date.parse(record.createdAt)).toBeGreaterThanOrEqual(before - 1000)
    // Outro usuário no mesmo navegador não vê.
    expect(readPending('7')).toEqual([])
  })

  it('grava mesmo se o usuário saiu da tela antes do 202', async () => {
    const pending = deferred()
    stubFetch(pending.promise)
    const { router } = await reachReviewAs(USER_TOKEN)

    fireEvent.click(confirmButton())
    await act(() => router.navigate('/carteira'))
    await act(async () => pending.resolve(accepted()))

    expect(router.state.location.pathname).toBe('/carteira')
    expect(readPending('42').map((record) => record.taskId)).toEqual([TASK_ID])
  })

  it('erro no envio não grava nada', async () => {
    stubFetch(errorResponse(502, 'BLOCKCHAIN_UNAVAILABLE'))
    await reachReviewAs(USER_TOKEN)

    fireEvent.click(confirmButton())
    await screen.findByRole('alert')

    expect(readPending('42')).toEqual([])
  })

  it('token sem `sub` legível: envia normalmente e não grava nada', async () => {
    stubFetch(accepted())
    await reachReviewAs(TEST_TOKEN)

    fireEvent.click(confirmButton())
    await screen.findByRole('heading', { name: 'Acompanhamento da transação' })

    expect(window.localStorage.length).toBe(0)
  })

  it('armazenamento que lança não impede ir ao acompanhamento', async () => {
    stubFetch(accepted())
    const { router } = await reachReviewAs(USER_TOKEN)
    const fail = () => {
      throw new DOMException('Bloqueado', 'SecurityError')
    }
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(fail)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(fail)

    try {
      fireEvent.click(confirmButton())
      await screen.findByRole('heading', { name: 'Acompanhamento da transação' })
      expect(router.state.location.pathname).toBe(`/transacoes/${TASK_ID}`)
      expect(setItem).toHaveBeenCalled()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})

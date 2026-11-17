import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/client'
import { ERROR_MESSAGES } from '../api/errors'
import { SESSION_KEY } from '../auth/sessionStorage'
import { TEST_TOKEN, renderApp, storeValidSession } from '../test/renderApp'

type FetchArgs = [url: string, init: RequestInit]

const EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente.'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(response: Response | Promise<Response>) {
  const fetchMock = vi
    .fn<(...args: FetchArgs) => Promise<Response>>()
    .mockImplementation(() => Promise.resolve(response))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function futureIso(hours = 4) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, 'Z')
}

async function openLogin(entry: Parameters<typeof renderApp>[0] = '/entrar') {
  const view = renderApp(entry)
  await screen.findByRole('heading', { name: 'Entrar' })
  return view
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

function stored() {
  return window.sessionStorage.getItem(SESSION_KEY)
}

afterEach(() => {
  window.sessionStorage.clear()
})

describe('LoginPage', () => {
  it('200 guarda a sessão e vai a /carteira', async () => {
    const expiresAt = futureIso()
    const fetchMock = stubFetch(jsonResponse(200, { token: TEST_TOKEN, expiresAt }))
    const { router } = await openLogin()

    fill('ana@example.com', 'Senha@12345')
    submit()

    expect(await screen.findByRole('heading', { name: 'Carteira' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/carteira')
    expect(JSON.parse(stored() ?? '')).toEqual({ token: TEST_TOKEN, expiresAt })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('e-mail com espaço no fim é aceito e enviado sem o espaço; a senha vai como digitada', async () => {
    const fetchMock = stubFetch(jsonResponse(200, { token: TEST_TOKEN, expiresAt: futureIso() }))
    await openLogin()

    fill('ana@example.com ', ' Senha@12345 ')
    submit()

    await screen.findByRole('heading', { name: 'Carteira' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/auth/login')
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'ana@example.com',
      password: ' Senha@12345 ',
    })
  })

  it('INVALID_CREDENTIALS mostra a mensagem com foco, não guarda nada, mantém o e-mail e limpa a senha', async () => {
    stubFetch(jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' }))
    const { router } = await openLogin()

    fill('ana@example.com', 'errada123')
    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ERROR_MESSAGES.INVALID_CREDENTIALS)
    await waitFor(() => expect(alert).toHaveFocus())
    expect(stored()).toBeNull()
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@example.com')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('resposta fora da ficha não guarda nada e mostra erro genérico', async () => {
    stubFetch(jsonResponse(200, { token: TEST_TOKEN, expiresAt: 1792521000 }))
    await openLogin()

    fill('ana@example.com', 'Senha@12345')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGES.INTERNAL_ERROR)
    expect(stored()).toBeNull()
  })

  it('falha de rede mostra NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await openLogin()

    fill('ana@example.com', 'Senha@12345')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGES.NETWORK_ERROR)
  })

  it('campos vazios mostram as mensagens e não chamam a API', async () => {
    const fetchMock = stubFetch(jsonResponse(200, {}))
    await openLogin()

    fill('   ', '')
    submit()

    expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription('Informe o e-mail.')
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription('Informe a senha.')
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('não confere formato no login: "ana@" vai ao servidor', async () => {
    const fetchMock = stubFetch(
      jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' }),
    )
    await openLogin()

    fill('ana@', 'x')
    submit()

    await screen.findByRole('alert')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('preenche o e-mail vindo da confirmação do cadastro', async () => {
    await openLogin({ pathname: '/entrar', state: { email: 'ana@example.com' } })
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@example.com')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
  })

  it('ignora router state que não é texto', async () => {
    await openLogin({ pathname: '/entrar', state: { email: { html: '<b>x</b>' } } })
    expect(screen.getByLabelText('E-mail')).toHaveValue('')
  })

  it('usa autocomplete email e current-password', async () => {
    await openLogin()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('dois envios seguidos geram uma só chamada', async () => {
    let resolve: (response: Response) => void = () => {}
    const fetchMock = stubFetch(new Promise<Response>((r) => (resolve = r)))
    await openLogin()

    fill('ana@example.com', 'Senha@12345')
    const form = screen.getByRole('form', { name: 'Entrar' })
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()

    await act(async () => {
      resolve(jsonResponse(200, { token: TEST_TOKEN, expiresAt: futureIso() }))
    })
    await screen.findByRole('heading', { name: 'Carteira' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('sessão expirada', () => {
  /** Uma chamada com token recebe 401 TOKEN_INVALID enquanto o usuário está na carteira. */
  async function expireOnWallet() {
    storeValidSession()
    const view = renderApp('/carteira')
    await screen.findByRole('heading', { name: 'Carteira' })

    stubFetch(jsonResponse(401, { code: 'TOKEN_INVALID', message: 'Token inválido.' }))
    await act(async () => {
      await apiRequest('/wallet/balance', { token: TEST_TOKEN }).catch(() => undefined)
    })
    await screen.findByRole('heading', { name: 'Entrar' })
    return view
  }

  it('TOKEN_INVALID leva ao /entrar com "Sua sessão expirou. Entre novamente."', async () => {
    const { router } = await expireOnWallet()

    expect(router.state.location.pathname).toBe('/entrar')
    expect(screen.getByRole('alert')).toHaveTextContent(EXPIRED_MESSAGE)
    expect(stored()).toBeNull()
  })

  it('o aviso some ao tentar entrar de novo', async () => {
    await expireOnWallet()
    stubFetch(jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' }))

    fill('ana@example.com', 'errada123')
    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ERROR_MESSAGES.INVALID_CREDENTIALS)
    expect(screen.queryByText(EXPIRED_MESSAGE)).not.toBeInTheDocument()
  })

  it('não reaparece no login depois de passar pelo cadastro', async () => {
    await expireOnWallet()
    expect(screen.getByText(EXPIRED_MESSAGE)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Criar conta' }))
    await screen.findByRole('heading', { name: 'Criar conta' })
    fireEvent.click(screen.getByRole('link', { name: 'Entrar' }))
    await screen.findByRole('heading', { name: 'Entrar' })

    expect(screen.queryByText(EXPIRED_MESSAGE)).not.toBeInTheDocument()
  })
})

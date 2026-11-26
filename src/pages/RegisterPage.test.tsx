import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGES } from '../api/errors'
import { SESSION_KEY } from '../auth/sessionStorage'
import { renderApp } from '../test/renderApp'

type FetchArgs = [url: string, init: RequestInit]

const ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'

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

async function openRegister() {
  const view = renderApp('/cadastro')
  await screen.findByRole('heading', { name: 'Criar conta' })
  return view
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
}

afterEach(() => {
  window.sessionStorage.clear()
})

describe('RegisterPage: validação por campo', () => {
  it('campos vazios mostram as mensagens, focam o e-mail e não chamam a API', async () => {
    const fetchMock = stubFetch(jsonResponse(201, {}))
    await openRegister()

    submit()

    const email = screen.getByLabelText('E-mail')
    expect(email).toHaveAccessibleDescription('Informe o e-mail.')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription(
      expect.stringContaining('Informe a senha.'),
    )
    expect(email).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('e-mail inválido e senha curta', async () => {
    const fetchMock = stubFetch(jsonResponse(201, {}))
    await openRegister()

    fill('ana@', '1234567')
    submit()

    expect(screen.getByText('Informe um e-mail válido, como nome@exemplo.com.')).toBeInTheDocument()
    expect(screen.getByText('A senha precisa ter no mínimo 8 caracteres.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('senha acima de 72 bytes mostra a mensagem de limite de caracteres', async () => {
    const fetchMock = stubFetch(jsonResponse(201, {}))
    await openRegister()

    fill('ana@example.com', 'ç'.repeat(37))
    submit()

    const password = screen.getByLabelText('Senha')
    expect(password).toHaveAccessibleDescription(expect.stringContaining('A senha passou do limite de caracteres'))
    expect(password).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('depois da primeira tentativa, a mensagem some ao corrigir o campo', async () => {
    stubFetch(jsonResponse(201, {}))
    await openRegister()

    fill('ana@', 'Senha@12345')
    submit()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
    expect(screen.getByLabelText('E-mail')).not.toHaveAttribute('aria-invalid')
  })

  it('e-mail com espaço no fim é aceito e enviado sem o espaço; a senha vai como digitada', async () => {
    const fetchMock = stubFetch(
      jsonResponse(201, { userId: 1, email: 'ana@example.com', ethereumAddress: ADDRESS }),
    )
    await openRegister()

    fill('ana@example.com  ', ' Senha@12345 ')
    submit()

    await screen.findByRole('heading', { name: 'Sua carteira foi criada' })
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'ana@example.com',
      password: ' Senha@12345 ',
    })
  })
})

describe('RegisterPage: resposta do servidor', () => {
  it('201 mostra o endereço, não faz login e "Entrar" leva ao login com o e-mail', async () => {
    const fetchMock = stubFetch(
      jsonResponse(201, { userId: 7, email: 'ana@example.com', ethereumAddress: ADDRESS }),
    )
    const { router } = await openRegister()

    fill('Ana@Example.com', 'Senha@12345')
    submit()

    const heading = await screen.findByRole('heading', { name: 'Sua carteira foi criada' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.getByText(ADDRESS)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar endereço' })).toBeInTheDocument()
    expect(screen.queryByText(/chave privada/i)).not.toBeInTheDocument()

    // Sem login automático: nada guardado e nenhuma chamada além do cadastro.
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/cadastro')

    fireEvent.click(screen.getByRole('link', { name: 'Entrar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'))
    expect(router.state.location.state).toEqual({ email: 'ana@example.com' })
  })

  it('EMAIL_ALREADY_REGISTERED mostra o alerta com foco e um link para entrar', async () => {
    stubFetch(jsonResponse(409, { code: 'EMAIL_ALREADY_REGISTERED', message: 'E-mail já cadastrado.' }))
    await openRegister()

    fill('ana@example.com', 'Senha@12345')
    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ERROR_MESSAGES.EMAIL_ALREADY_REGISTERED)
    await waitFor(() => expect(alert).toHaveFocus())
    expect(screen.getByRole('link', { name: 'Entrar com este e-mail' })).toBeInTheDocument()
    // O formulário continua com o que foi digitado, para tentar de novo.
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@example.com')
    expect(screen.getByLabelText('Senha')).toHaveValue('Senha@12345')
  })

  it.each([
    ['WALLET_UNAVAILABLE', 502],
    ['INTERNAL_ERROR', 500],
    ['REQUEST_INVALID', 400],
  ] as const)('%s mostra a mensagem do Frontend para o code', async (code, status) => {
    stubFetch(jsonResponse(status, { code, message: 'texto do servidor' }))
    await openRegister()

    fill('ana@example.com', 'Senha@12345')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGES[code])
  })

  it('a decisão é pelo code, não pelo status', async () => {
    stubFetch(jsonResponse(400, { code: 'WALLET_UNAVAILABLE', message: 'x' }))
    await openRegister()

    fill('ana@example.com', 'Senha@12345')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGES.WALLET_UNAVAILABLE)
  })

  it('falha de rede mostra NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await openRegister()

    fill('ana@example.com', 'Senha@12345')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGES.NETWORK_ERROR)
  })

  it('code desconhecido mostra a mensagem do servidor como texto', async () => {
    stubFetch(jsonResponse(400, { code: 'NOVO_CODIGO', message: '<b>texto</b> do servidor' }))
    await openRegister()

    fill('ana@example.com', 'Senha@12345')
    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('<b>texto</b> do servidor')
    expect(alert.querySelector('b')).toBeNull()
  })

  it.each([
    ['EMAIL_INVALID', 'E-mail'],
    ['PASSWORD_INVALID', 'Senha'],
  ] as const)('%s do servidor aparece no campo %s', async (code, label) => {
    stubFetch(jsonResponse(400, { code, message: 'x' }))
    await openRegister()

    fill('ana@example.com', 'Senha@12345')
    submit()

    const field = screen.getByLabelText(label)
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'))
    expect(field).toHaveAccessibleDescription(expect.stringContaining(ERROR_MESSAGES[code]))
    expect(field).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('RegisterPage: clique duplo', () => {
  it('dois envios seguidos geram uma só chamada, e o botão fica desabilitado', async () => {
    let resolve: (response: Response) => void = () => {}
    const fetchMock = stubFetch(new Promise<Response>((r) => (resolve = r)))
    await openRegister()

    fill('ana@example.com', 'Senha@12345')
    const form = screen.getByRole('form', { name: 'Criar conta' })
    // submit direto no formulário: passa por cima do disabled do botão.
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Criando conta…' })).toBeDisabled()

    await act(async () => {
      resolve(jsonResponse(201, { userId: 1, email: 'ana@example.com', ethereumAddress: ADDRESS }))
    })
    await screen.findByRole('heading', { name: 'Sua carteira foi criada' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

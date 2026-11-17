import { describe, expect, it, vi } from 'vitest'
import { authenticateUser, registerUser } from './auth'

type FetchArgs = [url: string, init: RequestInit]

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'

describe('registerUser (CT1)', () => {
  it('faz POST /users com e-mail e senha, sem Authorization', async () => {
    const fetchMock = mockFetch(201, { userId: 1, email: 'ana@example.com', ethereumAddress: ADDRESS })

    const result = await registerUser({ email: 'ana@example.com', password: ' Senha@12345 ' })

    expect(result).toEqual({ userId: 1, email: 'ana@example.com', ethereumAddress: ADDRESS })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/users')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'ana@example.com',
      password: ' Senha@12345 ',
    })
    expect(init.headers as Record<string, string>).not.toHaveProperty('Authorization')
  })

  it.each([
    ['sem endereço', { userId: 1, email: 'ana@example.com' }],
    ['endereço vazio', { userId: 1, email: 'ana@example.com', ethereumAddress: '' }],
    ['userId em texto', { userId: '1', email: 'ana@example.com', ethereumAddress: ADDRESS }],
    ['corpo nulo', null],
  ])('resposta fora da ficha (%s) vira INTERNAL_ERROR', async (_name, body) => {
    mockFetch(201, body)

    await expect(
      registerUser({ email: 'ana@example.com', password: 'Senha@12345' }),
    ).rejects.toMatchObject({ name: 'ApiError', code: 'INTERNAL_ERROR' })
  })

  it('repassa o erro do servidor pelo code', async () => {
    mockFetch(409, { code: 'EMAIL_ALREADY_REGISTERED', message: 'E-mail já cadastrado.' })

    await expect(
      registerUser({ email: 'ana@example.com', password: 'Senha@12345' }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_ALREADY_REGISTERED' })
  })
})

describe('authenticateUser (CT3)', () => {
  it('faz POST /auth/login sem Authorization e devolve token e expiresAt em texto', async () => {
    const fetchMock = mockFetch(200, { token: 'abc.def.ghi', expiresAt: '2026-10-20T18:30:00Z' })

    const result = await authenticateUser({ email: 'ana@example.com', password: 'Senha@12345' })

    expect(result).toEqual({ token: 'abc.def.ghi', expiresAt: '2026-10-20T18:30:00Z' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/auth/login')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'ana@example.com',
      password: 'Senha@12345',
    })
    expect(init.headers as Record<string, string>).not.toHaveProperty('Authorization')
  })

  it.each([
    ['sem token', { expiresAt: '2026-10-20T18:30:00Z' }],
    ['token vazio', { token: '', expiresAt: '2026-10-20T18:30:00Z' }],
    ['expiresAt numérico', { token: 'abc', expiresAt: 1792521000 }],
    ['expiresAt fora do ISO UTC', { token: 'abc', expiresAt: '20/10/2026 18:30' }],
  ])('resposta fora da ficha (%s) vira INTERNAL_ERROR', async (_name, body) => {
    mockFetch(200, body)

    await expect(
      authenticateUser({ email: 'ana@example.com', password: 'Senha@12345' }),
    ).rejects.toMatchObject({ name: 'ApiError', code: 'INTERNAL_ERROR' })
  })

  it('INVALID_CREDENTIALS chega pelo code', async () => {
    mockFetch(401, { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' })

    await expect(
      authenticateUser({ email: 'ana@example.com', password: 'errada123' }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
  })
})

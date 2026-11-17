import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/client'
import { AuthProvider, MAX_TIMEOUT_MS } from './AuthContext'
import { SESSION_KEY, writeSession } from './sessionStorage'
import { useAuth } from './useAuth'

const NOW = Date.parse('2026-11-17T12:00:00Z')

/** Expõe o contexto ao teste. */
let auth: ReturnType<typeof useAuth>
function Probe({ onAuth }: { onAuth: (value: ReturnType<typeof useAuth>) => void }) {
  const value = useAuth()
  useEffect(() => {
    onAuth(value)
  })
  return (
    <p>
      {value.session ? 'com sessão' : 'sem sessão'} / {value.sessionExpired ? 'expirada' : 'normal'}
    </p>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe
        onAuth={(value) => {
          auth = value
        }}
      />
    </AuthProvider>,
  )
}

function stored() {
  return window.sessionStorage.getItem(SESSION_KEY)
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  window.sessionStorage.clear()
})

describe('AuthProvider', () => {
  it('começa sem sessão quando o storage está vazio', () => {
    renderProvider()
    expect(screen.getByText('sem sessão / normal')).toBeInTheDocument()
  })

  it('recupera a sessão válida do storage ao carregar', () => {
    writeSession({ token: 'abc', expiresAt: '2026-11-17T16:00:00Z' })
    renderProvider()
    expect(screen.getByText('com sessão / normal')).toBeInTheDocument()
  })

  it('descarta sem aviso a sessão vencida encontrada ao carregar', () => {
    writeSession({ token: 'abc', expiresAt: '2026-11-17T11:59:59Z' })
    renderProvider()
    expect(screen.getByText('sem sessão / normal')).toBeInTheDocument()
    expect(stored()).toBeNull()
  })

  it('login guarda a sessão e logout a apaga', () => {
    renderProvider()

    act(() => auth.login({ token: 'abc.def.ghi', expiresAt: '2026-11-17T16:00:00Z' }))
    expect(screen.getByText('com sessão / normal')).toBeInTheDocument()
    expect(JSON.parse(stored() ?? '')).toEqual({
      token: 'abc.def.ghi',
      expiresAt: '2026-11-17T16:00:00Z',
    })

    act(() => auth.logout())
    expect(screen.getByText('sem sessão / normal')).toBeInTheDocument()
    expect(stored()).toBeNull()
  })

  it('encerra a sessão no expiresAt e liga o aviso', () => {
    renderProvider()
    act(() => auth.login({ token: 'abc', expiresAt: '2026-11-17T12:00:10Z' }))

    act(() => vi.advanceTimersByTime(9_999))
    expect(screen.getByText('com sessão / normal')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByText('sem sessão / expirada')).toBeInTheDocument()
    expect(stored()).toBeNull()
  })

  it('prazo acima do limite do setTimeout reagenda e só encerra no fim', () => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    renderProvider()
    act(() =>
      auth.login({ token: 'abc', expiresAt: new Date(NOW + thirtyDaysMs).toISOString() }),
    )

    act(() => vi.advanceTimersByTime(MAX_TIMEOUT_MS + 1))
    expect(screen.getByText('com sessão / normal')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(thirtyDaysMs - MAX_TIMEOUT_MS - 2))
    expect(screen.getByText('com sessão / normal')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByText('sem sessão / expirada')).toBeInTheDocument()
  })

  it('logout desliga o temporizador da sessão anterior', () => {
    renderProvider()
    act(() => auth.login({ token: 'abc', expiresAt: '2026-11-17T12:00:10Z' }))
    act(() => auth.logout())

    act(() => vi.advanceTimersByTime(20_000))
    expect(screen.getByText('sem sessão / normal')).toBeInTheDocument()
  })

  it('TOKEN_INVALID numa chamada com token limpa a sessão e liga o aviso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(401, { code: 'TOKEN_INVALID', message: 'Token inválido.' }),
      ),
    )
    renderProvider()
    act(() => auth.login({ token: 'abc', expiresAt: '2026-11-17T16:00:00Z' }))

    await act(async () => {
      await expect(apiRequest('/wallet/balance', { token: 'abc' })).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
      })
    })

    expect(screen.getByText('sem sessão / expirada')).toBeInTheDocument()
    expect(stored()).toBeNull()
  })

  it('erro 401 sem token (INVALID_CREDENTIALS do login) não mexe na sessão', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' }),
      ),
    )
    renderProvider()
    act(() => auth.login({ token: 'abc', expiresAt: '2026-11-17T16:00:00Z' }))

    await act(async () => {
      await expect(
        apiRequest('/auth/login', { method: 'POST', body: { email: 'a@b.c', password: 'x' } }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    })

    expect(screen.getByText('com sessão / normal')).toBeInTheDocument()
  })

  it('dismissSessionExpired apaga o aviso', () => {
    renderProvider()
    act(() => auth.login({ token: 'abc', expiresAt: '2026-11-17T12:00:01Z' }))
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('sem sessão / expirada')).toBeInTheDocument()

    act(() => auth.dismissSessionExpired())
    expect(screen.getByText('sem sessão / normal')).toBeInTheDocument()
  })
})

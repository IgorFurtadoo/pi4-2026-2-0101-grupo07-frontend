import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderApp, storeValidSession } from '../test/renderApp'
import { SESSION_KEY, writeSession } from './sessionStorage'

afterEach(() => {
  window.sessionStorage.clear()
})

describe('RequireAuth e RequireGuest', () => {
  it.each(['/carteira', '/enviar', '/transacoes/a3f1c2d4'])(
    '%s sem sessão vai a /entrar',
    async (path) => {
      const { router } = renderApp(path)

      expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/entrar')
    },
  )

  it('sessão vencida no storage conta como sem sessão', async () => {
    writeSession({ token: 'abc', expiresAt: '2020-01-01T00:00:00Z' })
    const { router } = renderApp('/carteira')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('/carteira com sessão válida mostra a carteira', async () => {
    storeValidSession()
    const { router } = renderApp('/carteira')

    expect(await screen.findByRole('heading', { name: 'Carteira' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/carteira')
  })

  it.each(['/cadastro', '/entrar'])('%s com sessão válida vai a /carteira', async (path) => {
    storeValidSession()
    const { router } = renderApp(path)

    expect(await screen.findByRole('heading', { name: 'Carteira' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/carteira')
  })

  it('"/" sem sessão vai a /entrar', async () => {
    const { router } = renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('"/" com sessão vai a /carteira', async () => {
    storeValidSession()
    const { router } = renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Carteira' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/carteira')
  })
})

describe('cabeçalho', () => {
  it('sem sessão mostra "Entrar" e "Criar conta" (no 404)', async () => {
    renderApp('/nao-existe')

    await screen.findByRole('heading', { name: 'Página não encontrada' })
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro')
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })

  it('"Sair" apaga a sessão e leva a /entrar', async () => {
    storeValidSession()
    const { router } = renderApp('/carteira')
    await screen.findByRole('heading', { name: 'Carteira' })

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('"Sair" numa rota pública também leva a /entrar', async () => {
    storeValidSession()
    const { router } = renderApp('/nao-existe')
    await screen.findByRole('heading', { name: 'Página não encontrada' })

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
  })
})

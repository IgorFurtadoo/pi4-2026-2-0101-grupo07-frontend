import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'
import { AUTH_PANEL_PHRASE } from './AuthLayout'

afterEach(() => {
  window.sessionStorage.clear()
})

describe('AuthLayout', () => {
  it.each(['/entrar', '/cadastro'])(
    '%s usa o logo escuro no painel, o mascote e a frase, sem o cabeçalho do app',
    async (path) => {
      const { container } = renderApp(path)
      await screen.findByRole('heading', { level: 1 })

      // Faixa do celular e painel do desktop: só a versão escura do logo.
      const logos = container.querySelectorAll('img[alt="Lemma"]')
      expect(logos.length).toBeGreaterThan(0)
      logos.forEach((logo) => expect(logo.getAttribute('src')).toContain('lemma-logo-escuro.svg'))
      expect(container.querySelector('img[src*="lemma-logo-claro"]')).toBeNull()

      // Mascote decorativo: fora da árvore de acessibilidade.
      const mascot = container.querySelector('img[src*="lemma-mascote"]')
      expect(mascot).not.toBeNull()
      expect(mascot?.closest('[aria-hidden="true"]')).not.toBeNull()

      expect(screen.getByText(AUTH_PANEL_PHRASE)).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Conta' })).not.toBeInTheDocument()
    },
  )

  it('o mascote não aparece nas outras telas', async () => {
    const { container } = renderApp('/nao-existe')
    await screen.findByRole('heading', { name: 'Página não encontrada' })

    expect(container.querySelector('img[src*="lemma-mascote"]')).toBeNull()
  })
})

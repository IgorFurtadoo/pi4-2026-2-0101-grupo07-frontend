import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Logo } from './components/brand/Logo'
import { renderApp, storeValidSession } from './test/renderApp'

afterEach(() => {
  window.sessionStorage.clear()
})

describe('rotas', () => {
  it('mostra a página não encontrada com o logo no cabeçalho', async () => {
    renderApp('/rota-que-nao-existe')

    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    const logo = screen.getByRole('img', { name: 'Lemma' })
    expect(logo).toHaveAttribute('height', '40')
  })

  it('a rota de acompanhamento abre a tela e consulta o taskId da URL', async () => {
    storeValidSession()
    renderApp('/transacoes/a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b')

    expect(
      await screen.findByRole('heading', { name: 'Acompanhamento da transação' }),
    ).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      'http://localhost:8080/transactions/a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b',
    )
  })
})

describe('Logo', () => {
  it.each([
    ['light', 'lemma-logo-claro.svg'],
    ['night', 'lemma-logo-escuro.svg'],
    ['blue', 'lemma-logo-fundo-azul.svg'],
  ] as const)('no fundo %s usa %s', (background, file) => {
    render(<Logo background={background} />)
    expect(screen.getByRole('img', { name: 'Lemma' }).getAttribute('src')).toContain(file)
  })

  it('não fica abaixo de 32 px de altura', () => {
    render(<Logo background="light" height={20} />)
    const logo = screen.getByRole('img', { name: 'Lemma' })
    expect(logo).toHaveAttribute('height', '32')
    expect(logo).toHaveAttribute('width', '88')
  })
})

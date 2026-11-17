import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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

  it('mostra o taskId da rota de acompanhamento como texto', async () => {
    storeValidSession()
    renderApp('/transacoes/a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b')

    expect(await screen.findByText('a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b')).toBeInTheDocument()
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

import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Logo } from './components/brand/Logo'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('rotas', () => {
  it('mostra a página não encontrada com o logo no cabeçalho', async () => {
    renderAt('/rota-que-nao-existe')

    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    const logo = screen.getByRole('img', { name: 'Lemma' })
    expect(logo).toHaveAttribute('height', '40')
  })

  it('leva "/" para /carteira', async () => {
    const router = renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Carteira' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/carteira')
  })

  it('mostra o taskId da rota de acompanhamento como texto', async () => {
    renderAt('/transacoes/a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b')

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

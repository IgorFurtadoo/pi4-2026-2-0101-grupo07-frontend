import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderApp, storeValidSession } from '../../test/renderApp'

afterEach(() => {
  window.sessionStorage.clear()
})

describe('AppLayout', () => {
  it('na carteira, o main ocupa a largura (até 1600 px) com margem de 12, 16 e 24 px', async () => {
    storeValidSession()
    renderApp('/carteira')
    await screen.findByRole('heading', { name: 'Carteira' })

    const main = screen.getByRole('main')
    expect(main).toHaveClass('mx-auto', 'w-full', 'max-w-[1600px]', 'px-3', 'sm:px-4', 'lg:px-6')
    expect(main).not.toHaveClass('max-w-5xl')
  })

  it.each([
    ['/enviar', 'Enviar ETH'],
    ['/rota-que-nao-existe', undefined],
  ])('em %s, o main segue na coluna de sempre (max-w-5xl)', async (path, heading) => {
    storeValidSession()
    renderApp(path)
    await screen.findByRole('heading', heading ? { name: heading } : { level: 1 })

    const main = screen.getByRole('main')
    expect(main).toHaveClass('max-w-5xl', 'px-4', 'py-8')
    expect(main).not.toHaveClass('max-w-[1600px]')
  })

  it('o cabeçalho ocupa a largura da janela (até 1600 px), com o logo e a navegação', async () => {
    storeValidSession()
    renderApp('/enviar')
    await screen.findByRole('heading', { name: 'Enviar ETH' })

    const nav = screen.getByRole('navigation', { name: 'Conta' })
    const bar = nav.parentElement!
    expect(bar).toHaveClass('max-w-[1600px]', 'px-3', 'sm:px-4', 'lg:px-6')
    expect(bar).not.toHaveClass('max-w-5xl')
    expect(screen.getByRole('banner')).toContainElement(nav)
  })
})

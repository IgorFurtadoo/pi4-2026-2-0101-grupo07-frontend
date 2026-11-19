import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PricePoint } from '../../api/market'
import { formatPointTime } from '../../lib/market'
import { PriceChart } from './PriceChart'

const START = Date.UTC(2026, 10, 12, 3)
const plain = (text: string | null) => (text ?? '').replace(/\u00a0/g, ' ')

function points(...prices: string[]): PricePoint[] {
  return prices.map((price, i) => {
    const time = START + i * 3_600_000
    return { timestamp: new Date(time).toISOString(), time, price }
  })
}

function chart() {
  return screen.getByRole('img')
}

function readout() {
  return plain(screen.getByTestId('chart-readout').textContent)
}

/** Nenhum atributo numérico do SVG pode virar NaN ou Infinity. */
function expectFiniteGeometry(container: HTMLElement) {
  for (const element of container.querySelectorAll('svg, svg *')) {
    for (const attribute of element.attributes) {
      expect(attribute.value, `${element.tagName}.${attribute.name}`).not.toMatch(/NaN|Infinity/)
    }
  }
}

const when = (i: number) => formatPointTime(START + i * 3_600_000)

describe('PriceChart', () => {
  it('é uma imagem com rótulo e um resumo em texto', () => {
    render(<PriceChart series={points('2000', '2500', '1500', '2200')} />)

    const svg = chart()
    expect(plain(svg.getAttribute('aria-label'))).toBe(
      'Preço do ETH nos últimos 7 dias, de US$ 2.000,00 a US$ 2.200,00',
    )
    const summary = document.getElementById(svg.getAttribute('aria-describedby') ?? '')
    expect(plain(summary?.textContent ?? '')).toBe(
      `Início: US$ 2.000,00 em ${when(0)}. Fim: US$ 2.200,00 em ${when(3)}. ` +
        'Mínimo: US$ 1.500,00. Máximo: US$ 2.500,00. Use as setas para percorrer os 4 pontos.',
    )
    expect(svg).toHaveAttribute('tabindex', '0')
  })

  it('desenha linha e área, sem ponto destacado até a interação', () => {
    const { container } = render(<PriceChart series={points('1', '3', '2')} />)

    const paths = container.querySelectorAll('path')
    expect(paths).toHaveLength(2)
    expect(paths[1]).toHaveAttribute('d', 'M6.0 168.0 L300.0 12.0 L594.0 90.0')
    expect(paths[1]).toHaveAttribute('stroke', 'var(--color-primary)')
    expect(paths[1]).toHaveClass('animate-draw')
    expect(paths[0].getAttribute('fill')).toMatch(/^url\(#area-/)
    expect(screen.queryByTestId('chart-dot')).toBeNull()
    expectFiniteGeometry(container)
  })

  it('série de um ponto: um ponto no centro, sem linha e sem divisão por zero', () => {
    const { container } = render(<PriceChart series={points('3200.45')} />)

    expect(container.querySelectorAll('path')).toHaveLength(0)
    const dot = screen.getByTestId('chart-dot')
    expect(dot).toHaveAttribute('cx', '300')
    expect(dot).toHaveAttribute('cy', '90')
    expectFiniteGeometry(container)
  })

  it('série plana: linha reta no meio, sem divisão por zero', () => {
    const { container } = render(<PriceChart series={points('5', '5', '5')} />)

    expect(container.querySelectorAll('path')[1]).toHaveAttribute('d', 'M6.0 90.0 L300.0 90.0 L594.0 90.0')
    expectFiniteGeometry(container)
  })

  it('pelo teclado: o foco mostra o último ponto e as teclas percorrem a série', () => {
    render(<PriceChart series={points('1000', '2000', '3000', '4000')} />)
    const svg = chart()

    act(() => svg.focus())
    expect(readout()).toBe(`US$ 4.000,00 em ${when(3)}`)
    expect(screen.getByTestId('chart-dot')).toBeInTheDocument()

    fireEvent.keyDown(svg, { key: 'ArrowLeft' })
    expect(readout()).toBe(`US$ 3.000,00 em ${when(2)}`)
    fireEvent.keyDown(svg, { key: 'Home' })
    expect(readout()).toBe(`US$ 1.000,00 em ${when(0)}`)
    fireEvent.keyDown(svg, { key: 'ArrowLeft' })
    expect(readout()).toBe(`US$ 1.000,00 em ${when(0)}`)
    fireEvent.keyDown(svg, { key: 'End' })
    expect(readout()).toBe(`US$ 4.000,00 em ${when(3)}`)
    fireEvent.keyDown(svg, { key: 'PageUp' })
    expect(readout()).toBe(`US$ 1.000,00 em ${when(0)}`)

    // A região aria-live repete o ponto escolhido pelo teclado.
    expect(plain(screen.getByText((_, el) => el?.getAttribute('aria-live') === 'polite').textContent)).toBe(
      `US$ 1.000,00 em ${when(0)}`,
    )

    act(() => svg.blur())
    expect(screen.queryByTestId('chart-dot')).toBeNull()
  })

  it('outras teclas não são capturadas', () => {
    render(<PriceChart series={points('1', '2')} />)
    const event = fireEvent.keyDown(chart(), { key: 'Tab' })
    expect(event).toBe(true)
  })

  it('pelo mouse: o ponto mais próximo da posição aparece; sair do gráfico esconde', () => {
    render(<PriceChart series={points('1000', '2000', '3000')} />)
    const svg = chart()
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      width: 300,
      top: 0,
      height: 90,
      right: 400,
      bottom: 90,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerMove(svg, { clientX: 260 })
    expect(readout()).toBe(`US$ 2.000,00 em ${when(1)}`)
    fireEvent.pointerMove(svg, { clientX: 399 })
    expect(readout()).toBe(`US$ 3.000,00 em ${when(2)}`)
    fireEvent.pointerMove(svg, { clientX: 0 })
    expect(readout()).toBe(`US$ 1.000,00 em ${when(0)}`)

    fireEvent.pointerLeave(svg)
    expect(screen.queryByTestId('chart-dot')).toBeNull()
    expect(readout()).toBe('Passe o mouse ou use as setas para ver cada ponto.')
  })
})

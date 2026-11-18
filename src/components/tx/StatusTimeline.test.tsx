import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusTimeline } from './StatusTimeline'

function steps() {
  return within(screen.getByRole('list', { name: 'Andamento da transação' })).getAllByRole('listitem')
}

function icon(step: HTMLElement) {
  const svg = step.querySelector('svg')
  if (!svg) throw new Error('passo sem ícone')
  return svg
}

describe('StatusTimeline', () => {
  it('PENDING: aceita concluída, aguardando com indicador animado, resultado ainda não', () => {
    render(<StatusTimeline status="PENDING" />)
    const [accepted, waiting, result] = steps()

    expect(accepted).toHaveAttribute('data-state', 'done')
    expect(accepted).toHaveTextContent('Solicitação aceita: concluída')
    expect(icon(accepted)).toHaveClass('lucide-circle-check', 'text-primary')

    expect(waiting).toHaveAttribute('data-state', 'active')
    expect(waiting).toHaveAttribute('aria-current', 'step')
    expect(waiting).toHaveTextContent('Aguardando confirmação: em andamento')
    expect(icon(waiting)).toHaveClass('lucide-loader-circle', 'animate-spin', 'text-primary')

    expect(result).toHaveAttribute('data-state', 'todo')
    expect(result).not.toHaveAttribute('aria-current')
    expect(result).toHaveTextContent('Resultado da rede: ainda não')
    expect(icon(result)).toHaveClass('lucide-circle', 'text-text-muted')

    expect(screen.queryByText('Confirmada')).toBeNull()
    expect(screen.queryByText('Falhou')).toBeNull()
    expect(document.querySelector('[data-drawn]')).toBeNull()
  })

  it('CONFIRMED: verde, ícone de check que se desenha, sem indicador animado', () => {
    render(<StatusTimeline status="CONFIRMED" />)
    const [accepted, waiting, result] = steps()

    expect(accepted).toHaveAttribute('data-state', 'done')
    expect(waiting).toHaveAttribute('data-state', 'done')
    expect(waiting).toHaveTextContent('Aguardando confirmação: concluída')
    expect(waiting).not.toHaveAttribute('aria-current')

    expect(result).toHaveAttribute('data-state', 'success')
    expect(result).toHaveAttribute('aria-current', 'step')
    expect(result).toHaveTextContent('Confirmada: concluída com sucesso')
    expect(within(result).getByText('Confirmada')).toHaveClass('text-success')
    const svg = icon(result)
    expect(svg).toHaveClass('lucide-circle-check', 'text-success', '[&>*]:animate-draw')
    expect(svg).toHaveAttribute('data-drawn')

    expect(document.querySelector('.animate-spin')).toBeNull()
  })

  it('FAILED: vermelho, ícone de X que se desenha e a explicação da falha', () => {
    render(
      <StatusTimeline status="FAILED" failureMessage="A transação foi executada e revertida." />,
    )
    const [, waiting, result] = steps()

    expect(waiting).toHaveAttribute('data-state', 'done')
    expect(result).toHaveAttribute('data-state', 'error')
    expect(result).toHaveAttribute('aria-current', 'step')
    expect(result).toHaveTextContent('Falhou: com falha')
    expect(within(result).getByText('Falhou')).toHaveClass('text-error')
    expect(result).toHaveTextContent('A transação foi executada e revertida.')
    const svg = icon(result)
    expect(svg).toHaveClass('lucide-circle-x', 'text-error', '[&>*]:animate-draw')
    expect(svg).toHaveAttribute('data-drawn')
    expect(document.querySelector('.animate-spin')).toBeNull()
  })

  it('não mostra explicação de falha fora de FAILED', () => {
    render(<StatusTimeline status="CONFIRMED" failureMessage="Não deveria aparecer." />)

    expect(screen.queryByText('Não deveria aparecer.')).toBeNull()
  })

  it.each(['PENDING', 'CONFIRMED', 'FAILED'] as const)(
    '%s: nenhum passo informa só por cor (ícone, rótulo e situação em texto)',
    (status) => {
      render(<StatusTimeline status={status} />)

      const all = steps()
      expect(all).toHaveLength(3)
      for (const step of all) {
        expect(icon(step)).toHaveAttribute('aria-hidden', 'true')
        const sr = step.querySelector('.sr-only')?.textContent ?? ''
        expect(sr).toMatch(/^: \S/)
        // O rótulo visível existe sem o texto do leitor de tela.
        expect((step.textContent ?? '').replace(sr, '').trim()).not.toBe('')
      }
    },
  )
})

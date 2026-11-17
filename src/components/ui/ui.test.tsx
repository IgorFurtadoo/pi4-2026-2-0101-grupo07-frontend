import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Alert } from './Alert'
import { Button } from './Button'
import { COPY_FEEDBACK_MS, CopyButton } from './CopyButton'
import { TextField } from './TextField'

afterEach(() => {
  vi.useRealTimers()
})

describe('Button', () => {
  it('em carregamento fica desabilitado e mostra o texto de carregamento', () => {
    render(
      <Button loading loadingText="Entrando…">
        Entrar
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Entrando…' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('desabilitado não dispara o clique', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Entrar
      </Button>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('TextField', () => {
  it('liga o rótulo, a dica e o erro ao campo', () => {
    render(<TextField label="E-mail" type="email" hint="Use o seu e-mail." error="Informe o e-mail." />)

    const input = screen.getByLabelText('E-mail')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Use o seu e-mail. Informe o e-mail.')
  })

  it('sem erro não marca aria-invalid', () => {
    render(<TextField label="E-mail" type="email" />)
    expect(screen.getByLabelText('E-mail')).not.toHaveAttribute('aria-invalid')
  })

  it('alterna entre mostrar e ocultar a senha', () => {
    render(<TextField label="Senha" type="password" />)
    const input = screen.getByLabelText('Senha')
    expect(input).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(input).toHaveAttribute('type', 'password')
  })
})

describe('Alert', () => {
  it('erro usa role="alert" e sucesso role="status", sempre com texto', () => {
    render(
      <>
        <Alert variant="error">Falhou.</Alert>
        <Alert variant="success">Deu certo.</Alert>
      </>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou.')
    expect(screen.getByRole('status')).toHaveTextContent('Deu certo.')
  })
})

describe('CopyButton', () => {
  it('copia o valor, avisa "Copiado" e anuncia ao leitor de tela', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    render(<CopyButton value="0xabc" label="Copiar endereço" copiedMessage="Endereço copiado" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar endereço' }))
    })

    expect(writeText).toHaveBeenCalledWith('0xabc')
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument()
    expect(screen.getByText('Endereço copiado')).toHaveAttribute('aria-live', 'polite')

    act(() => {
      vi.advanceTimersByTime(COPY_FEEDBACK_MS)
    })
    expect(screen.getByRole('button', { name: 'Copiar endereço' })).toBeInTheDocument()
  })

  it('sem área de transferência avisa que não foi possível copiar', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })

    render(<CopyButton value="0xabc" label="Copiar endereço" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar endereço' }))
    })

    expect(screen.getByRole('button', { name: 'Não foi possível copiar' })).toBeInTheDocument()
  })
})

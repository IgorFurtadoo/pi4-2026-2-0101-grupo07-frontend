import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Balance } from '../../api/wallet'
import { BalanceCard } from './BalanceCard'
import { ReceivePanel } from './ReceivePanel'

const ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'

function balance(balanceEth: string, exact = true): Balance {
  return { ethereumAddress: ADDRESS, balanceEth, network: 'SEPOLIA', exact }
}

function renderCard(value: Balance, receiveOpen = false, onToggleReceive = () => {}) {
  return render(
    <MemoryRouter>
      <BalanceCard
        balance={value}
        receiveOpen={receiveOpen}
        onToggleReceive={onToggleReceive}
        receivePanelId="painel-receber"
      />
    </MemoryRouter>,
  )
}

function card() {
  return screen.getByRole('region', { name: 'Saldo' })
}

describe('BalanceCard', () => {
  it('mostra o saldo com 6 casas, o selo da rede e a linha do valor exato', () => {
    renderCard(balance('0.002499999999601'))

    expect(card()).toHaveTextContent('0,002499 ETH')
    expect(card()).toHaveTextContent('Sepolia · testnet')
    expect(card()).toHaveTextContent('Valor exato: 0,002499999999601 ETH')
  })

  it('sem dígitos escondidos, não mostra a linha do valor exato', () => {
    renderCard(balance('0.25'))

    expect(card()).toHaveTextContent('0,25 ETH')
    expect(card()).not.toHaveTextContent('Valor exato')
  })

  it('valor grande sai com milhares e o exato completo', () => {
    renderCard(balance('123456789.123456789012345678'))

    expect(card()).toHaveTextContent('123.456.789,123456 ETH')
    expect(card()).toHaveTextContent('Valor exato: 123.456.789,123456789012345678 ETH')
  })

  it('valor positivo muito pequeno aparece como "< 0,000001", nunca "0"', () => {
    renderCard(balance('0.000000000000000001'))

    expect(card()).toHaveTextContent('< 0,000001 ETH')
    expect(card()).toHaveTextContent('Valor exato: 0,000000000000000001 ETH')
    expect(card()).not.toHaveTextContent('receber ETH de teste')
  })

  it('sem o texto exato (navegador antigo) não mostra a linha do valor exato', () => {
    renderCard(balance('0.002499999999601', false))

    expect(card()).toHaveTextContent('0,002499 ETH')
    expect(card()).not.toHaveTextContent('Valor exato')
  })

  it('saldo zero mostra "0" e a frase sobre receber ETH de teste', () => {
    renderCard(balance('0.000000000000000000'))

    expect(card()).toHaveTextContent('0 ETH')
    expect(card()).toHaveTextContent('Use o endereço desta carteira para receber ETH de teste.')
    expect(card()).not.toHaveTextContent('Valor exato')
  })

  it('mostra o endereço abreviado e deixa o completo para o leitor de tela', () => {
    renderCard(balance('1'))

    expect(screen.getByText('0x71C7…976F')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText(`Endereço da carteira: ${ADDRESS}`)).toHaveClass('sr-only')
  })

  it('copiar copia o endereço COMPLETO', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    renderCard(balance('1'))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar endereço' }))
    })

    expect(writeText).toHaveBeenCalledWith(ADDRESS)
  })

  it('"Enviar" leva a /enviar e "Receber" controla o painel', () => {
    const onToggle = vi.fn()
    renderCard(balance('1'), true, onToggle)

    expect(screen.getByRole('link', { name: 'Enviar' })).toHaveAttribute('href', '/enviar')
    const receive = screen.getByRole('button', { name: 'Receber' })
    expect(receive).toHaveAttribute('aria-expanded', 'true')
    expect(receive).toHaveAttribute('aria-controls', 'painel-receber')
    fireEvent.click(receive)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('o fio coral é decorativo', () => {
    const { container } = renderCard(balance('1'))
    expect(container.querySelector('.bg-brand-coral')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('ReceivePanel', () => {
  it('aberto mostra o endereço completo, o botão de copiar e o aviso da rede', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<ReceivePanel id="painel-receber" address={ADDRESS} open />)

    const panel = screen.getByRole('region', { name: 'Receber ETH' })
    expect(panel).toBeVisible()
    expect(panel).toHaveTextContent(ADDRESS)
    expect(panel).toHaveTextContent('Esta é a rede de teste Sepolia: receba apenas ETH de teste.')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar endereço de recebimento' }))
    })
    expect(writeText).toHaveBeenCalledWith(ADDRESS)
  })

  it('fechado fica no DOM, escondido', () => {
    const { container } = render(<ReceivePanel id="painel-receber" address={ADDRESS} open={false} />)

    const panel = container.querySelector('#painel-receber')
    expect(panel).toHaveAttribute('hidden')
    expect(screen.queryByRole('region', { name: 'Receber ETH' })).toBeNull()
  })
})

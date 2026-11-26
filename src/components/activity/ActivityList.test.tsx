import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGES } from '../../api/errors'
import { COUNTERPARTY, activityBody, activityItem, txHash } from '../../test/activity'
import { fakeResponse, pendingResponse } from '../../test/fetch'
import { ActivityList } from './ActivityList'

type FetchArgs = [url: string, init: RequestInit]
type Reply = Response | Error | 'pendente'

const NOTE =
  'Mostra só transações já confirmadas na rede; envios em andamento aparecem em “Em andamento” e no acompanhamento.'

const ok = (items: string[]) => fakeResponse(200, activityBody(items))

function apiError(status: number, code: string) {
  return fakeResponse(status, JSON.stringify({ code, message: 'Mensagem do servidor.' }))
}

/** fetch simulado: responde na ordem dada e respeita o signal. Fila vazia fica pendente. */
function stubFetch(...replies: Reply[]) {
  const queue = [...replies]
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((_url, init) => {
    const next = queue.shift() ?? 'pendente'
    const pending = pendingResponse(init.signal)
    if (next === 'pendente') return pending
    if (next instanceof Error) return Promise.reject(next)
    return Promise.race([pending, Promise.resolve(next)])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderList() {
  return render(<ActivityList token="token-de-teste" />)
}

function panel() {
  return screen.getByRole('region', { name: 'Atividade' })
}

async function items() {
  const list = await screen.findByRole('list')
  return within(list).getAllByRole('listitem')
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled()
})

describe('ActivityList', () => {
  it('mostra o esqueleto com aria-busy, sem mascote, e a nota sobre o que aparece', async () => {
    stubFetch('pendente')
    const { container } = renderList()

    const region = panel()
    expect(region).toHaveTextContent(NOTE)
    expect(within(region).getByText('Carregando atividade…')).toBeInTheDocument()
    expect(region.querySelector('[aria-busy="true"] [data-skeleton]')).not.toBeNull()
    expect(within(region).queryByRole('button')).toBeNull()
    expect(container.querySelector('img[src*="mascote"]')).toBeNull()
  })

  it('mostra cada item com o valor exato em texto, sem zeros à direita', async () => {
    stubFetch(
      ok([
        activityItem({ hash: txHash(1), direction: 'SENT', amountEth: '0.000000000000000001' }),
        activityItem({ hash: txHash(2), direction: 'RECEIVED', amountEth: '0.000500000000000000' }),
        activityItem({ hash: txHash(3), direction: 'RECEIVED', amountEth: '123456789.123456789012345678' }),
      ]),
    )
    renderList()

    const [sent, received, big] = await items()
    expect(sent).toHaveTextContent('−0,000000000000000001 ETH')
    expect(received).toHaveTextContent('+0,0005 ETH')
    expect(received).not.toHaveTextContent('0,000500')
    expect(big).toHaveTextContent('+123.456.789,123456789012345678 ETH')
  })

  it('conta um item por transação, na ordem do Core API', async () => {
    stubFetch(ok(Array.from({ length: 20 }, (_, i) => activityItem({ hash: txHash(i + 1) }))))
    renderList()

    const rows = await items()
    expect(rows).toHaveLength(20)
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', `https://sepolia.etherscan.io/tx/${txHash(1)}`)
    expect(within(rows[19]).getByRole('link')).toHaveAttribute('href', `https://sepolia.etherscan.io/tx/${txHash(20)}`)
  })

  it('direção e estado aparecem como texto, com sinal só no que se moveu', async () => {
    stubFetch(
      ok([
        activityItem({ hash: txHash(1), direction: 'SENT', amountEth: '0.01' }),
        activityItem({ hash: txHash(2), direction: 'RECEIVED', amountEth: '0.02' }),
        activityItem({ hash: txHash(3), direction: 'SELF', amountEth: '0.03' }),
        activityItem({ hash: txHash(4), direction: 'SENT', amountEth: '0.04', status: 'FAILED' }),
        activityItem({ hash: txHash(5), direction: 'RECEIVED', amountEth: '0.05', status: 'FAILED' }),
      ]),
    )
    renderList()

    const [sent, received, self, sentFailed, receivedFailed] = await items()
    expect(sent).toHaveTextContent('Enviada')
    expect(sent).toHaveTextContent('Para 0x6bdB…58E6')
    expect(sent).toHaveTextContent('Confirmada')
    expect(sent).toHaveTextContent('−0,01 ETH')

    expect(received).toHaveTextContent('Recebida')
    expect(received).toHaveTextContent('De 0x6bdB…58E6')
    expect(received).toHaveTextContent('+0,02 ETH')

    expect(self).toHaveTextContent('Para você mesmo')
    expect(self).toHaveTextContent(/(^|[^+−])0,03 ETH/)
    expect(within(self).queryByRole('button')).toBeNull()

    expect(sentFailed).toHaveTextContent('Falhou na rede')
    expect(sentFailed).not.toHaveTextContent('Confirmada')
    expect(sentFailed).toHaveTextContent(/(^|[^+−])0,04 ETH/)
    expect(receivedFailed).toHaveTextContent(/(^|[^+−])0,05 ETH/)
  })

  it('data em pt-BR num <time> com o instante ISO', async () => {
    stubFetch(ok([activityItem({ timestamp: '2026-11-16T04:12:00Z' })]))
    renderList()

    const [row] = await items()
    const time = row.querySelector('time')
    expect(time).toHaveAttribute('dateTime', '2026-11-16T04:12:00Z')
    expect(time?.textContent).toMatch(/^\d{2}\/\d{2}\/2026, \d{2}:\d{2}:\d{2}$/)
  })

  it('link do Etherscan em nova aba, com rel e aviso ao leitor de tela', async () => {
    const hash = '0x336be534b01ce174e559209ffdde79b15ffeb5f47a66b16f77737d45fcef7598'
    stubFetch(ok([activityItem({ hash })]))
    renderList()

    const [row] = await items()
    const link = within(row).getByRole('link', { name: 'Ver no Etherscan (abre em nova aba)' })
    expect(link).toHaveAttribute('href', `https://sepolia.etherscan.io/tx/${hash}`)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('outra ponta nula mostra "Criação de contrato", sem copiar', async () => {
    stubFetch(ok([activityItem({ direction: 'SENT', status: 'FAILED', counterpartyAddress: 'null' })]))
    renderList()

    const [row] = await items()
    expect(row).toHaveTextContent('Criação de contrato')
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('copiar copia o endereço COMPLETO da outra ponta', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    stubFetch(ok([activityItem()]))
    renderList()

    const [row] = await items()
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Copiar endereço 0x6bdB…58E6' }))
    })

    expect(writeText).toHaveBeenCalledWith(COUNTERPARTY)
  })

  it('lista vazia mostra o texto com o mascote pequeno, sem alerta', async () => {
    stubFetch(ok([]))
    const { container } = renderList()

    expect(await screen.findByText(/Nenhuma transação ainda/)).toBeInTheDocument()
    const mascot = container.querySelector('img[src*="mascote"]')
    expect(mascot).not.toBeNull()
    expect(mascot?.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('502 HISTORY_UNAVAILABLE mostra "Histórico indisponível", sem mascote; "Tentar de novo" refaz', async () => {
    const fetchMock = stubFetch(apiError(502, 'HISTORY_UNAVAILABLE'), ok([activityItem()]))
    const { container } = renderList()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Histórico indisponível')
    expect(alert).toHaveTextContent(ERROR_MESSAGES.HISTORY_UNAVAILABLE)
    expect(alert).not.toHaveTextContent('Mensagem do servidor.')
    expect(container.querySelector('img[src*="mascote"]')).toBeNull()

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))

    expect(await items()).toHaveLength(1)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['500 INTERNAL_ERROR', apiError(500, 'INTERNAL_ERROR'), ERROR_MESSAGES.INTERNAL_ERROR],
    ['corpo fora da ficha', ok([activityItem({ hash: '0x123' })]), ERROR_MESSAGES.INTERNAL_ERROR],
    ['falha de rede', new TypeError('Failed to fetch'), ERROR_MESSAGES.NETWORK_ERROR],
  ])('%s mostra a mensagem genérica com "Tentar de novo", sem lista parcial', async (_name, reply, message) => {
    stubFetch(reply)
    renderList()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(alert).not.toHaveTextContent('Histórico indisponível')
    expect(within(alert).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('"Atualizar" relê, anuncia e, numa falha, mantém a lista com o alerta', async () => {
    const fetchMock = stubFetch(
      ok([activityItem({ hash: txHash(1) })]),
      ok([activityItem({ hash: txHash(1) }), activityItem({ hash: txHash(2) })]),
      apiError(502, 'HISTORY_UNAVAILABLE'),
    )
    renderList()
    expect(await items()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar atividade' }))
    await waitFor(async () => expect(await items()).toHaveLength(2))
    expect(screen.getByText('Atividade atualizada')).toHaveAttribute('aria-live', 'polite')

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar atividade' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Histórico indisponível')
    expect(await items()).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('dois cliques em "Atualizar" fazem UMA chamada; o botão fica desabilitado', async () => {
    const fetchMock = stubFetch(ok([activityItem()]), 'pendente')
    renderList()
    await items()

    const button = screen.getByRole('button', { name: 'Atualizar atividade' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleName('Atualizando…')
  })

  it('no StrictMode faz uma chamada só', async () => {
    const fetchMock = stubFetch(ok([activityItem()]))
    render(
      <StrictMode>
        <ActivityList token="token-de-teste" />
      </StrictMode>,
    )

    expect(await items()).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

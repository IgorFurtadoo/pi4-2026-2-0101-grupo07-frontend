import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAILURE_REASON_MESSAGES, FAILED_GENERIC_MESSAGE } from '../../api/transactions'
import type { PendingRecord } from '../../lib/pendingTransactions'
import { txHash } from '../../test/activity'
import { pendingResponse } from '../../test/fetch'
import { apiErrorResponse, pendingRecord, taskResponse, taskUrl } from '../../test/pending'
import { PENDING_POLL_MS, PendingList } from './PendingList'

type FetchArgs = [url: string, init: RequestInit]
type Reply = Response | Error | 'pendente'

const TOKEN = 'token-de-teste'
const NETWORK = () => new TypeError('Failed to fetch')

/** fetch simulado por task: cada uma responde na ordem da sua fila; fila vazia fica pendente. */
function stubTasks(replies: Record<string, Reply[]>) {
  const queues = new Map(Object.entries(replies).map(([taskId, list]) => [taskUrl(taskId), [...list]]))
  const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>((url, init) => {
    const next = queues.get(url)?.shift() ?? 'pendente'
    const pending = pendingResponse(init.signal)
    if (next === 'pendente') return pending
    if (next instanceof Error) return Promise.reject(next)
    return Promise.race([pending, Promise.resolve(next)])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function callsFor(fetchMock: ReturnType<typeof stubTasks>, taskId: string) {
  return fetchMock.mock.calls.filter(([url]) => url === taskUrl(taskId)).length
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

const flush = () => advance(0)

function renderList(records: PendingRecord[], historyHashes: string[] = []) {
  const onRemove = vi.fn<(taskId: string) => void>()
  const onConfirmed = vi.fn<() => void>()
  const view = render(
    <MemoryRouter>
      <PendingList
        token={TOKEN}
        records={records}
        historyHashes={new Set(historyHashes)}
        onRemove={onRemove}
        onConfirmed={onConfirmed}
      />
    </MemoryRouter>,
  )
  return { ...view, onRemove, onConfirmed }
}

const section = () => screen.getByRole('region', { name: 'Em andamento' })

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  vi.useRealTimers()
  expect(consoleError).not.toHaveBeenCalled()
})

describe('PendingList', () => {
  it('sem itens, a seção não aparece e nada é consultado', () => {
    const fetchMock = stubTasks({})
    const { container } = renderList([])
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('region', { name: 'Em andamento' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mostra o esqueleto e depois destino, valor e estado, com link para o acompanhamento', async () => {
    stubTasks({ t1: [taskResponse('t1', 'PENDING')] })
    renderList([pendingRecord('t1', { amountEth: '0.000000000000000001' })])

    expect(within(section()).getByRole('heading', { level: 2, name: 'Em andamento' })).toBeInTheDocument()
    expect(within(section()).getByText('Consultando estado…')).toBeInTheDocument()
    expect(section().querySelector('[data-skeleton]')).not.toBeNull()

    await flush()
    const link = within(section()).getByRole('link')
    expect(link).toHaveAttribute('href', '/transacoes/t1')
    expect(link).toHaveTextContent('Para 0x5B38…ddC4')
    expect(link).toHaveTextContent('0,000000000000000001 ETH')
    expect(link).toHaveTextContent('Pendente')
    expect(section().querySelector('[data-skeleton]')).toBeNull()
    expect(screen.queryByRole('button', { name: /Dispensar/ })).toBeNull()
  })

  it(`PENDING vira CONFIRMED pelo polling de ${PENDING_POLL_MS / 1000} s e avisa a carteira uma vez`, async () => {
    const fetchMock = stubTasks({
      t1: [taskResponse('t1', 'PENDING'), taskResponse('t1', 'CONFIRMED', { transactionHash: txHash(9) })],
    })
    const { onConfirmed, onRemove } = renderList([pendingRecord('t1')])
    await flush()
    expect(within(section()).getByRole('link')).toHaveTextContent('Pendente')

    await advance(PENDING_POLL_MS - 1)
    expect(callsFor(fetchMock, 't1')).toBe(1)
    await advance(1)
    expect(callsFor(fetchMock, 't1')).toBe(2)
    expect(within(section()).getByRole('link')).toHaveTextContent('Confirmada')
    expect(onConfirmed).toHaveBeenCalledTimes(1)
    // Sem o hash no histórico, o item fica como "Confirmada".
    expect(onRemove).not.toHaveBeenCalled()

    // Estado final: não consulta mais.
    await advance(PENDING_POLL_MS * 3)
    expect(callsFor(fetchMock, 't1')).toBe(2)
    expect(onConfirmed).toHaveBeenCalledTimes(1)
  })

  it('CONFIRMED já na primeira leitura não relê a carteira (ela acabou de ler)', async () => {
    stubTasks({ t1: [taskResponse('t1', 'CONFIRMED', { transactionHash: txHash(9) })] })
    const { onConfirmed } = renderList([pendingRecord('t1')])
    await flush()
    expect(within(section()).getByRole('link')).toHaveTextContent('Confirmada')
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('FAILED mostra o motivo do mapa local e "Dispensar" tira o item', async () => {
    stubTasks({
      t1: [taskResponse('t1', 'FAILED', { failureReason: 'REJECTED_BY_NETWORK' })],
      t2: [taskResponse('t2', 'FAILED', { failureReason: 'MOTIVO_NOVO' })],
    })
    const { onRemove } = renderList([pendingRecord('t1'), pendingRecord('t2')])
    await flush()

    const [first, second] = within(section()).getAllByRole('listitem')
    expect(first).toHaveTextContent('Falhou')
    expect(first).toHaveTextContent(FAILURE_REASON_MESSAGES.REJECTED_BY_NETWORK)
    // Motivo desconhecido: texto genérico, nunca o do servidor.
    expect(second).toHaveTextContent(FAILED_GENERIC_MESSAGE)
    expect(second).not.toHaveTextContent('MOTIVO_NOVO')

    const dismiss = within(first).getByRole('button', { name: 'Dispensar envio para 0x5B38…ddC4' })
    // O botão fica fora do link (sem botão dentro de link).
    expect(within(first).getByRole('link').contains(dismiss)).toBe(false)
    fireEvent.click(dismiss)
    expect(onRemove).toHaveBeenCalledWith('t1')
  })

  it('item cujo hash já está no histórico sai da lista (não duplica)', async () => {
    stubTasks({ t1: [taskResponse('t1', 'CONFIRMED', { transactionHash: txHash(9).toUpperCase().replace('0X', '0x') })] })
    const { onRemove, container } = renderList([pendingRecord('t1')], [txHash(9)])
    await flush()
    expect(onRemove).toHaveBeenCalledWith('t1')
    expect(container.querySelectorAll('li')).toHaveLength(0)
  })

  it('PENDING com hash provisório igual a um do histórico fica (só sai confirmado)', async () => {
    stubTasks({ t1: [taskResponse('t1', 'PENDING', { transactionHash: txHash(9) })] })
    const { onRemove } = renderList([pendingRecord('t1')], [txHash(9)])
    await flush()
    expect(within(section()).getByRole('link')).toHaveTextContent('Pendente')
    expect(onRemove).not.toHaveBeenCalled()
  })

  it.each([
    ['404 TRANSACTION_NOT_FOUND', () => apiErrorResponse(404, 'TRANSACTION_NOT_FOUND')],
    ['401 TOKEN_INVALID', () => apiErrorResponse(401, 'TOKEN_INVALID')],
  ])('%s tira o item da lista', async (_name, reply) => {
    stubTasks({ t1: [reply()], t2: [taskResponse('t2', 'PENDING')] })
    const { onRemove } = renderList([pendingRecord('t1'), pendingRecord('t2')])
    await flush()
    expect(onRemove).toHaveBeenCalledWith('t1')
    expect(onRemove).not.toHaveBeenCalledWith('t2')
    expect(within(section()).getAllByRole('listitem')).toHaveLength(1)
  })

  it('erro de rede mantém o último estado conhecido, sem alerta, e volta a consultar', async () => {
    const fetchMock = stubTasks({
      t1: [taskResponse('t1', 'PENDING'), NETWORK(), taskResponse('t1', 'CONFIRMED', { transactionHash: txHash(9) })],
    })
    const { onRemove } = renderList([pendingRecord('t1')])
    await flush()
    await advance(PENDING_POLL_MS)
    expect(callsFor(fetchMock, 't1')).toBe(2)
    expect(within(section()).getByRole('link')).toHaveTextContent('Pendente')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onRemove).not.toHaveBeenCalled()

    // Recuo do acompanhamento (3 s depois da primeira falha).
    await advance(3_000)
    expect(within(section()).getByRole('link')).toHaveTextContent('Confirmada')
  })

  it('erro de rede antes de qualquer leitura mostra um texto neutro, sem alerta', async () => {
    stubTasks({ t1: [NETWORK()] })
    renderList([pendingRecord('t1')])
    await flush()
    expect(within(section()).getByRole('link')).toHaveTextContent('Estado indisponível no momento')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('só os PENDING continuam sendo consultados', async () => {
    const fetchMock = stubTasks({
      t1: [taskResponse('t1', 'PENDING'), taskResponse('t1', 'PENDING')],
      t2: [taskResponse('t2', 'FAILED', { failureReason: 'TRANSACTION_REVERTED' })],
    })
    renderList([pendingRecord('t1'), pendingRecord('t2')])
    await flush()
    await advance(PENDING_POLL_MS)
    expect(callsFor(fetchMock, 't1')).toBe(2)
    expect(callsFor(fetchMock, 't2')).toBe(1)
  })
})

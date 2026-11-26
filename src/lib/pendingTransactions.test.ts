import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_PENDING,
  PENDING_MAX_AGE_MS,
  addPending,
  pendingKey,
  readPending,
  removePending,
  type PendingRecord,
} from './pendingTransactions'

const NOW = Date.parse('2026-11-26T12:00:00Z')
const ADDRESS = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4'

function record(taskId: string, minutesAgo = 0): PendingRecord {
  return {
    taskId,
    amountEth: '0.01',
    destinationAddress: ADDRESS,
    createdAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
  }
}

function failingStorage() {
  const fail = () => {
    throw new DOMException('Bloqueado', 'SecurityError')
  }
  return [
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(fail),
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(fail),
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(fail),
  ]
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pendingTransactions', () => {
  it('grava e lê, mais novos primeiro', () => {
    addPending('42', record('a', 10), NOW)
    addPending('42', record('b', 5), NOW)
    expect(readPending('42', NOW).map((item) => item.taskId)).toEqual(['b', 'a'])
    expect(readPending('42', NOW)[0]).toEqual(record('b', 5))
  })

  it('a chave é por usuário: um não vê a lista do outro', () => {
    addPending('42', record('a'), NOW)
    addPending('7', record('b'), NOW)
    expect(readPending('42', NOW).map((item) => item.taskId)).toEqual(['a'])
    expect(readPending('7', NOW).map((item) => item.taskId)).toEqual(['b'])
    expect(window.localStorage.getItem(pendingKey('42'))).toContain('"a"')
    expect(window.localStorage.getItem(pendingKey('7'))).not.toContain('"a"')
  })

  it('sem usuário não lê nem grava', () => {
    addPending(null, record('a'), NOW)
    removePending(null, 'a', NOW)
    expect(readPending(null, NOW)).toEqual([])
    expect(window.localStorage.length).toBe(0)
  })

  it(`guarda no máximo ${MAX_PENDING}; o mais antigo sai`, () => {
    for (let i = 0; i <= MAX_PENDING; i++) addPending('42', record(`t${i}`, MAX_PENDING - i), NOW)
    const ids = readPending('42', NOW).map((item) => item.taskId)
    expect(ids).toHaveLength(MAX_PENDING)
    expect(ids[0]).toBe(`t${MAX_PENDING}`)
    expect(ids).not.toContain('t0')
  })

  it('não repete o mesmo taskId (sem diferença de caixa)', () => {
    addPending('42', record('ABC', 5), NOW)
    addPending('42', record('abc', 1), NOW)
    expect(readPending('42', NOW).map((item) => item.taskId)).toEqual(['abc'])
  })

  it('item com mais de 24 h sai da lista e do armazenamento', () => {
    // "novo" foi criado 1 h depois de "velho".
    window.localStorage.setItem(
      pendingKey('42'),
      JSON.stringify([record('novo', -60), record('velho', 0)]),
    )
    const later = NOW + PENDING_MAX_AGE_MS
    expect(readPending('42', later).map((item) => item.taskId)).toEqual(['novo'])
    expect(window.localStorage.getItem(pendingKey('42'))).not.toContain('velho')
  })

  it('removePending tira só o item dado; a lista vazia apaga a chave', () => {
    addPending('42', record('a', 2), NOW)
    addPending('42', record('b', 1), NOW)
    removePending('42', 'A', NOW)
    expect(readPending('42', NOW).map((item) => item.taskId)).toEqual(['b'])
    removePending('42', 'b', NOW)
    expect(window.localStorage.getItem(pendingKey('42'))).toBeNull()
  })

  it('JSON ilegível ou que não é lista vira lista vazia', () => {
    window.localStorage.setItem(pendingKey('42'), '{quebrado')
    expect(readPending('42', NOW)).toEqual([])
    window.localStorage.setItem(pendingKey('42'), '{"taskId":"a"}')
    expect(readPending('42', NOW)).toEqual([])
    addPending('42', record('a'), NOW)
    expect(readPending('42', NOW).map((item) => item.taskId)).toEqual(['a'])
  })

  it('descarta itens fora do formato e mantém os bons', () => {
    const good = record('bom')
    window.localStorage.setItem(
      pendingKey('42'),
      JSON.stringify([
        good,
        null,
        { ...good, taskId: '' },
        { ...good, taskId: 'x', amountEth: 0.01 },
        { ...good, taskId: 'y', amountEth: '1e-2' },
        { ...good, taskId: 'z', destinationAddress: 1 },
        { ...good, taskId: 'w', createdAt: 'ontem' },
      ]),
    )
    expect(readPending('42', NOW)).toEqual([good])
    expect(JSON.parse(window.localStorage.getItem(pendingKey('42'))!)).toEqual([good])
  })

  it('armazenamento que lança não lança para fora', () => {
    const spies = failingStorage()
    expect(() => addPending('42', record('a'), NOW)).not.toThrow()
    expect(readPending('42', NOW)).toEqual([])
    expect(() => removePending('42', 'a', NOW)).not.toThrow()
    expect(spies[0]).toHaveBeenCalled()
  })

  it('window.localStorage inacessível (o próprio acesso lança) vira lista vazia', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Bloqueado', 'SecurityError')
    })
    expect(() => addPending('42', record('a'), NOW)).not.toThrow()
    expect(readPending('42', NOW)).toEqual([])
  })
})

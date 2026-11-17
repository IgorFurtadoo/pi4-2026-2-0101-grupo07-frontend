import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_KEY, clearSession, readSession, writeSession } from './sessionStorage'

const NOW = Date.parse('2026-11-17T12:00:00Z')
const VALID = { token: 'abc.def.ghi', expiresAt: '2026-11-17T16:00:00Z' }

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  window.sessionStorage.clear()
})

describe('sessionStorage da sessão', () => {
  it('grava e lê token e expiresAt na chave lemma.session', () => {
    writeSession(VALID)

    expect(JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? '')).toEqual(VALID)
    expect(readSession(NOW)).toEqual(VALID)
  })

  it('não grava campos além de token e expiresAt', () => {
    writeSession({ ...VALID, email: 'ana@example.com' } as typeof VALID)
    expect(Object.keys(JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? ''))).toEqual([
      'token',
      'expiresAt',
    ])
  })

  it('sem nada guardado devolve null', () => {
    expect(readSession(NOW)).toBeNull()
  })

  it('descarta e apaga o token vencido', () => {
    writeSession({ token: 'abc', expiresAt: '2026-11-17T12:00:00Z' })

    expect(readSession(NOW)).toBeNull()
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('descarta e apaga JSON ilegível', () => {
    window.sessionStorage.setItem(SESSION_KEY, '{nao é json')

    expect(readSession(NOW)).toBeNull()
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it.each([
    ['null', null],
    ['sem token', { expiresAt: VALID.expiresAt }],
    ['token vazio', { token: '', expiresAt: VALID.expiresAt }],
    ['token numérico', { token: 123, expiresAt: VALID.expiresAt }],
    ['expiresAt numérico', { token: 'abc', expiresAt: 1763380800 }],
    ['expiresAt fora do ISO UTC', { token: 'abc', expiresAt: '17/11/2026 16:00' }],
    ['expiresAt com fuso local', { token: 'abc', expiresAt: '2026-11-17T16:00:00-03:00' }],
  ])('descarta e apaga formato errado (%s)', (_name, value) => {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(value))

    expect(readSession(NOW)).toBeNull()
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('clearSession apaga a chave', () => {
    writeSession(VALID)
    clearSession()
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  describe('com o armazenamento lançando', () => {
    it('leitura devolve null', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('bloqueado', 'SecurityError')
      })
      expect(readSession(NOW)).toBeNull()
    })

    it('gravação e remoção não lançam', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('cheio', 'QuotaExceededError')
      })
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('bloqueado', 'SecurityError')
      })
      expect(() => writeSession(VALID)).not.toThrow()
      expect(() => clearSession()).not.toThrow()
    })

    it('JSON ilegível com remoção lançando ainda devolve null', () => {
      window.sessionStorage.setItem(SESSION_KEY, '{')
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('bloqueado', 'SecurityError')
      })
      expect(readSession(NOW)).toBeNull()
    })

    it('o próprio window.sessionStorage lançando não quebra', () => {
      const spy = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
        throw new DOMException('bloqueado', 'SecurityError')
      })
      expect(readSession(NOW)).toBeNull()
      expect(() => writeSession(VALID)).not.toThrow()
      expect(() => clearSession()).not.toThrow()
      // Restaura antes do afterEach, que usa o sessionStorage.
      spy.mockRestore()
    })
  })
})

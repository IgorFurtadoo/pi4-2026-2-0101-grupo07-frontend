import { describe, expect, it } from 'vitest'
import { formatInstant, parseIsoInstant } from './instant'

describe('parseIsoInstant', () => {
  it('lê o instante ISO UTC e recusa outro formato', () => {
    expect(parseIsoInstant('2026-10-20T14:36:10Z')).toBe(Date.UTC(2026, 9, 20, 14, 36, 10))
    expect(parseIsoInstant('2026-10-20 14:36:10')).toBeNull()
    expect(parseIsoInstant(42)).toBeNull()
  })
})

describe('formatInstant', () => {
  it('formata em pt-BR no fuso dado', () => {
    expect(formatInstant('2026-10-20T14:36:10Z', 'UTC')).toBe('20/10/2026, 14:36:10')
    expect(formatInstant('2026-10-20T14:36:10Z', 'America/Sao_Paulo')).toBe('20/10/2026, 11:36:10')
  })

  it('aceita fração de segundo', () => {
    expect(formatInstant('2026-01-02T03:04:05.123Z', 'UTC')).toBe('02/01/2026, 03:04:05')
  })

  it('sem fuso, usa o do navegador (o mesmo do toLocaleString)', () => {
    const text = '2026-10-20T14:36:10Z'
    expect(formatInstant(text)).toBe(
      new Date(text).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }),
    )
  })

  it.each([
    ['vazio', ''],
    ['sem fuso', '2026-10-20T14:36:10'],
    ['data impossível', '2026-13-45T99:99:99Z'],
    ['texto qualquer', 'ontem'],
  ])('texto inválido (%s) volta cru', (_name, text) => {
    expect(formatInstant(text, 'UTC')).toBe(text)
  })
})

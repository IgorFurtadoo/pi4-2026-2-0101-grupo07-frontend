import { describe, expect, it } from 'vitest'
import { formatEth, normalizeAmountInput } from './format'

describe('normalizeAmountInput', () => {
  it('aceita vírgula ou ponto e devolve o texto com ponto', () => {
    expect(normalizeAmountInput('0,01')).toBe('0.01')
    expect(normalizeAmountInput('0.01')).toBe('0.01')
    expect(normalizeAmountInput('  1,5 ')).toBe('1.5')
  })

  it('completa o separador solto nas pontas', () => {
    expect(normalizeAmountInput(',5')).toBe('0.5')
    expect(normalizeAmountInput('5,')).toBe('5')
  })

  it('preserva todos os dígitos', () => {
    expect(normalizeAmountInput('123456789,123456789012345678')).toBe(
      '123456789.123456789012345678',
    )
  })
})

describe('formatEth', () => {
  it('formata em pt-BR com milhares e vírgula', () => {
    expect(formatEth('0.25')).toBe('0,25')
    expect(formatEth('1234567.5')).toBe('1.234.567,5')
    expect(formatEth('1000')).toBe('1.000')
  })

  it('corta as casas sem arredondar', () => {
    expect(formatEth('0.123456789')).toBe('0,123456')
    expect(formatEth('0.9999999')).toBe('0,999999')
    expect(formatEth('0.001999999999202')).toBe('0,001999')
    expect(formatEth('0.123', 2)).toBe('0,12')
  })

  it('tira os zeros à direita e à esquerda', () => {
    expect(formatEth('10.50')).toBe('10,5')
    expect(formatEth('2.000000')).toBe('2')
    expect(formatEth('007.5')).toBe('7,5')
  })

  it('mostra zero só para zero', () => {
    expect(formatEth('0')).toBe('0')
    expect(formatEth('0.000')).toBe('0')
  })

  it('mostra "< 0,000001" para valor positivo abaixo da precisão exibida, nunca "0"', () => {
    expect(formatEth('0.000001')).toBe('0,000001')
    expect(formatEth('0.0000009')).toBe('< 0,000001')
    expect(formatEth('0.000000000000000001')).toBe('< 0,000001')
    expect(formatEth('0.001', 2)).toBe('< 0,01')
  })

  it('não perde dígitos onde o Number perderia', () => {
    expect(formatEth('123456789.123456789012345678')).toBe('123.456.789,123456')
    expect(formatEth('99999999999999999999.999999999999999999')).toBe(
      '99.999.999.999.999.999.999,999999',
    )
  })

  it('devolve como veio o texto fora do formato', () => {
    expect(formatEth('abc')).toBe('abc')
    expect(formatEth('1e-7')).toBe('1e-7')
  })
})

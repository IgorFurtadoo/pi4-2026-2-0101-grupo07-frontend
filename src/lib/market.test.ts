import { describe, expect, it } from 'vitest'
import {
  changeDirection,
  formatClock,
  formatPercent,
  formatPointTime,
  formatUsd,
  priceToNumber,
  sevenDayChange,
} from './market'

/** O Intl separa "US$" do valor com espaço não separável; o teste compara com espaço comum. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ')

const series = (...prices: string[]) => prices.map((price) => ({ price }))

describe('formatUsd', () => {
  it.each([
    [3200.45, 'US$ 3.200,45'],
    [1768.12, 'US$ 1.768,12'],
    [2055.7338345700337, 'US$ 2.055,73'],
    [0.5, 'US$ 0,50'],
    [1234567.891, 'US$ 1.234.567,89'],
  ])('%d vira %s', (value, expected) => {
    expect(plain(formatUsd(value))).toBe(expected)
  })

  it('usa espaço não separável entre o símbolo e o valor', () => {
    expect(formatUsd(1)).toBe('US$\u00a01,00')
  })
})

describe('priceToNumber', () => {
  it('lê o texto plano da API', () => {
    expect(priceToNumber('3200.4500')).toBe(3200.45)
    expect(priceToNumber('0')).toBe(0)
  })
})

describe('sevenDayChange', () => {
  it('compara o último ponto com o primeiro', () => {
    expect(sevenDayChange(series('2000', '1900', '2100'))).toBeCloseTo(0.05)
    expect(sevenDayChange(series('2055.7338345700337', '1768.3035797965015'))).toBeCloseTo(-0.13982, 5)
  })

  it('ignora os pontos do meio', () => {
    expect(sevenDayChange(series('100', '999', '1', '100'))).toBe(0)
  })

  it('um ponto só dá 0', () => {
    expect(sevenDayChange(series('3200.45'))).toBe(0)
  })

  it('série plana dá 0', () => {
    expect(sevenDayChange(series('5', '5', '5'))).toBe(0)
  })

  it('primeiro preço zero (sem base) dá null, sem dividir por zero', () => {
    expect(sevenDayChange(series('0', '10'))).toBeNull()
    expect(sevenDayChange(series('0.000', '0'))).toBeNull()
  })

  it('série vazia dá null', () => {
    expect(sevenDayChange([])).toBeNull()
  })
})

describe('formatPercent', () => {
  it.each([
    [0.0123, '+1,23%'],
    [-0.13982, '-13,98%'],
    [0, '0,00%'],
    [-0.000001, '0,00%'],
    [1.5, '+150,00%'],
  ])('%d vira %s', (ratio, expected) => {
    expect(formatPercent(ratio)).toBe(expected)
  })
})

describe('changeDirection', () => {
  it('segue o percentual exibido', () => {
    expect(changeDirection(0.0123)).toBe('up')
    expect(changeDirection(-0.0123)).toBe('down')
    expect(changeDirection(0)).toBe('flat')
    expect(changeDirection(0.00004)).toBe('flat')
    expect(changeDirection(-0.00004)).toBe('flat')
  })
})

describe('formatPointTime e formatClock', () => {
  it('formatam em pt-BR no fuso dado', () => {
    const time = Date.UTC(2026, 10, 18, 14, 5)
    expect(formatPointTime(time, 'UTC')).toBe('18/11, 14:05')
    expect(formatPointTime(time, 'America/Sao_Paulo')).toBe('18/11, 11:05')
    expect(formatClock(time, 'UTC')).toBe('14:05')
  })
})

import { describe, expect, it } from 'vitest'
import { decimalReviver, decimalToText, parseJson } from './client'

describe('decimalReviver com context.source', () => {
  it('mantém 0.001999999999202 intacto', () => {
    const body = parseJson('{"balanceEth":0.001999999999202,"network":"SEPOLIA"}')
    expect(body).toEqual({ balanceEth: '0.001999999999202', network: 'SEPOLIA' })
  })

  it('mantém 123456789.123456789012345678 intacto, que o JSON.parse comum arredonda', () => {
    const text = '{"amountEth":123456789.123456789012345678}'

    expect(parseJson(text)).toEqual({ amountEth: '123456789.123456789012345678' })
    expect(String((JSON.parse(text) as { amountEth: number }).amountEth)).not.toBe(
      '123456789.123456789012345678',
    )
  })

  it('cobre balanceEth, amountEth, currentPrice e price (dentro da série)', () => {
    const body = parseJson(
      '{"assetId":"ethereum","currency":"USD","currentPrice":3200.4500,' +
        '"series":[{"timestamp":"2026-10-19T12:00:00Z","price":3187.9}],' +
        '"balanceEth":0.000000000000000001,"amountEth":100}',
    )
    expect(body).toEqual({
      assetId: 'ethereum',
      currency: 'USD',
      currentPrice: '3200.4500',
      series: [{ timestamp: '2026-10-19T12:00:00Z', price: '3187.9' }],
      balanceEth: '0.000000000000000001',
      amountEth: '100',
    })
  })

  it('não mexe em outros campos numéricos nem em decimais que já vieram como texto', () => {
    expect(parseJson('{"userId":1,"amountEth":"0.01"}')).toEqual({ userId: 1, amountEth: '0.01' })
  })
})

describe('decimalReviver sem context (navegador sem suporte)', () => {
  it('devolve o número comum', () => {
    expect(decimalReviver('balanceEth', 0.25)).toBe(0.25)
    expect(decimalReviver('balanceEth', 0.25, {})).toBe(0.25)
    expect(decimalReviver('price', 3187.9, undefined)).toBe(3187.9)
  })
})

describe('decimalToText', () => {
  it('devolve o texto como veio', () => {
    expect(decimalToText('123456789.123456789012345678')).toBe('123456789.123456789012345678')
  })

  it('converte o número de reserva sem notação exponencial', () => {
    expect(decimalToText(0.25)).toBe('0.25')
    expect(decimalToText(1e-7)).toBe('0.0000001')
    expect(decimalToText(100)).toBe('100')
  })
})

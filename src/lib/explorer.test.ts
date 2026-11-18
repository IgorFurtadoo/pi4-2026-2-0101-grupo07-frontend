import { describe, expect, it } from 'vitest'
import { etherscanTxUrl } from './explorer'

const HASH = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060'

describe('etherscanTxUrl', () => {
  it('monta o link da Sepolia para um hash válido', () => {
    expect(etherscanTxUrl(HASH)).toBe(`https://sepolia.etherscan.io/tx/${HASH}`)
    expect(etherscanTxUrl(HASH.toUpperCase().replace('0X', '0x'))).toBe(
      `https://sepolia.etherscan.io/tx/${HASH.toUpperCase().replace('0X', '0x')}`,
    )
  })

  it.each([
    ['vazio', ''],
    ['sem 0x', HASH.slice(2)],
    ['curto', HASH.slice(0, -1)],
    ['longo', `${HASH}0`],
    ['não hexadecimal', `${HASH.slice(0, -1)}g`],
    ['com espaço', ` ${HASH}`],
    ['com quebra de linha', `${HASH}\n`],
    ['com caminho', `${HASH}/../x`],
    ['javascript:', 'javascript:alert(1)'],
    ['0X maiúsculo', `0X${HASH.slice(2)}`],
  ])('hash fora do padrão (%s) não tem link', (_name, hash) => {
    expect(etherscanTxUrl(hash)).toBeNull()
  })
})

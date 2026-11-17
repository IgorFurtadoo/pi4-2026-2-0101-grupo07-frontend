import { describe, expect, it } from 'vitest'

/**
 * ETH (saldo e valor) é texto do começo ao fim (CLAUDE.md e desenho, seção 8).
 * Esta varredura falha se o código que trata o saldo ou o valor do envio
 * converter o valor em número. O decimalToText do client.ts fica de fora de
 * propósito: ele só escreve como texto o número que o navegador sem
 * context.source já entregou.
 */
const SOURCES = import.meta.glob<string>(
  [
    '../api/wallet.ts',
    '../api/transactions.ts',
    './format.ts',
    './validate.ts',
    '../hooks/useBalance.ts',
    '../components/wallet/*.tsx',
    '!../components/wallet/*.test.tsx',
    '../pages/WalletPage.tsx',
  ],
  { query: '?raw', import: 'default', eager: true },
)

const FORBIDDEN = /\bNumber\s*\(|\bNumber\.parse|\bparseFloat\b|\bparseInt\b|\.toFixed\b|\bMath\./

describe('ETH sem Number', () => {
  it('varre os arquivos esperados', () => {
    expect(Object.keys(SOURCES).sort()).toEqual([
      '../api/transactions.ts',
      '../api/wallet.ts',
      '../components/wallet/BalanceCard.tsx',
      '../components/wallet/ReceivePanel.tsx',
      '../hooks/useBalance.ts',
      '../pages/WalletPage.tsx',
      './format.ts',
      './validate.ts',
    ])
  })

  it.each(Object.entries(SOURCES))(
    '%s não usa Number, parseFloat, parseInt, toFixed nem Math',
    (_path, source) => {
      expect(source).not.toMatch(FORBIDDEN)
    },
  )

  it('a expressão pega as conversões proibidas', () => {
    for (const sample of ['Number(x)', 'Number.parseFloat(x)', 'parseFloat(x)', 'x.toFixed(2)', 'Math.round(x)']) {
      expect(sample).toMatch(FORBIDDEN)
    }
    expect('formatEth(balanceEth)').not.toMatch(FORBIDDEN)
  })
})

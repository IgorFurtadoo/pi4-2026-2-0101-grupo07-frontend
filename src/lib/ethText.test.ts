import { describe, expect, it } from 'vitest'

/**
 * ETH (saldo e valor) é texto do começo ao fim (CLAUDE.md e desenho, seção 8).
 * Esta varredura falha se o código que trata o saldo, o valor do envio, o
 * valor da transação acompanhada ou o da atividade converter o valor em
 * número. O decimalToText do client.ts fica de fora de propósito: ele só
 * escreve como texto o número que o navegador sem context.source já entregou.
 */
const SOURCES = import.meta.glob<string>(
  [
    '../api/wallet.ts',
    '../api/transactions.ts',
    './format.ts',
    './validate.ts',
    './pendingTransactions.ts',
    '../hooks/useBalance.ts',
    '../hooks/useTransactionPolling.ts',
    '../hooks/useActivity.ts',
    '../components/wallet/*.tsx',
    '!../components/wallet/*.test.tsx',
    '../components/activity/*.tsx',
    '!../components/activity/*.test.tsx',
    '../components/tx/*.tsx',
    '!../components/tx/*.test.tsx',
    '../pages/WalletPage.tsx',
    '../pages/SendPage.tsx',
    '../pages/TransactionPage.tsx',
  ],
  { query: '?raw', import: 'default', eager: true },
)

const FORBIDDEN = /\bNumber\s*\(|\bNumber\.parse|\bparseFloat\b|\bparseInt\b|\.toFixed\b|\bMath\./

describe('ETH sem Number', () => {
  it('varre os arquivos esperados', () => {
    expect(Object.keys(SOURCES).sort()).toEqual([
      '../api/transactions.ts',
      '../api/wallet.ts',
      '../components/activity/ActivityList.tsx',
      '../components/activity/PendingList.tsx',
      '../components/tx/StatusTimeline.tsx',
      '../components/wallet/BalanceCard.tsx',
      '../components/wallet/ReceivePanel.tsx',
      '../hooks/useActivity.ts',
      '../hooks/useBalance.ts',
      '../hooks/useTransactionPolling.ts',
      '../pages/SendPage.tsx',
      '../pages/TransactionPage.tsx',
      '../pages/WalletPage.tsx',
      './format.ts',
      './pendingTransactions.ts',
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

import { Minus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { messageFor } from '../../api/errors'
import { useMarket } from '../../hooks/useMarket'
import {
  changeDirection,
  formatClock,
  formatPercent,
  formatUsd,
  priceToNumber,
  sevenDayChange,
} from '../../lib/market'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { PriceChart } from './PriceChart'

const DIRECTION = {
  up: { Icon: TrendingUp, className: 'text-success' },
  down: { Icon: TrendingDown, className: 'text-error' },
  flat: { Icon: Minus, className: 'text-text-muted' },
} as const

/** Variação dos 7 dias com ícone e texto com sinal (nunca só cor). */
function Change({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <p className="text-text-muted">Variação em 7 dias indisponível</p>
  const { Icon, className } = DIRECTION[changeDirection(ratio)]
  return (
    <p className={`flex items-center gap-1.5 font-medium tabular-nums ${className}`}>
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      {formatPercent(ratio)} em 7 dias
    </p>
  )
}

function MarketSkeleton() {
  return (
    <div>
      <p className="sr-only">Carregando mercado…</p>
      <Skeleton tone="light" className="h-10 w-48 max-w-full rounded-md" />
      <Skeleton tone="light" className="mt-3 h-6 w-32 rounded-md" />
      <Skeleton tone="light" className="mt-6 h-36 w-full rounded-md" />
    </div>
  )
}

/**
 * Painel de mercado (CT17, desenho, seções 5.3 e 6.2): preço do ETH em USD,
 * variação dos 7 dias e gráfico. Independe do saldo: qualquer falha aqui fica
 * dentro do painel. 429 mostra a contagem pelo Retry-After com "Atualizar"
 * desabilitado; 502 mostra "Mercado indisponível" com "Tentar de novo". Com
 * leitura anterior, uma falha mantém o preço com a hora em que foi lido.
 * `className` posiciona o bloco na grade da carteira.
 */
export function MarketPanel({ token, className }: { token: string; className?: string }) {
  const { status, data, fetchedAt, error, retryIn, canRefresh, refresh } = useMarket(token)
  const [userRefreshed, setUserRefreshed] = useState(false)
  const loading = status === 'loading'
  const rateLimited = error?.code === 'RATE_LIMIT_EXCEEDED'

  function handleRefresh() {
    setUserRefreshed(true)
    refresh()
  }

  return (
    <section
      aria-labelledby="titulo-mercado"
      className={`min-w-0 rounded-2xl border border-divider bg-surface p-6 sm:p-8 ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-mercado" className="text-lg">
          Mercado · ETH
        </h2>
        {(data || rateLimited) && (
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={!canRefresh}
            loading={loading}
            loadingText="Atualizando…"
          >
            <RefreshCw aria-hidden="true" className="size-5 shrink-0" />
            Atualizar
          </Button>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {userRefreshed && status === 'ok' ? 'Mercado atualizado' : ''}
      </p>

      <div aria-busy={loading} className="mt-4">
        {error && (
          <div className="mb-4">
            <Alert variant="error">
              {error.code === 'MARKET_DATA_UNAVAILABLE' && <p className="font-medium">Mercado indisponível</p>}
              <p>{messageFor(error.code, error.serverMessage)}</p>
              {!data && !rateLimited && (
                <Button variant="secondary" onClick={handleRefresh} disabled={!canRefresh} className="mt-3">
                  Tentar de novo
                </Button>
              )}
            </Alert>
            {/* Fora do alerta, para o leitor de tela não repetir a cada segundo. */}
            {rateLimited && (
              <p className="mt-2 text-sm text-text-muted tabular-nums">
                {retryIn > 0 ? `Tente de novo em ${retryIn} s.` : 'Você já pode atualizar.'}
              </p>
            )}
          </div>
        )}

        {data ? (
          <>
            <p className="text-sm text-text-muted">Preço atual</p>
            <p className="text-4xl leading-tight font-medium tabular-nums">
              {formatUsd(priceToNumber(data.currentPrice))}
            </p>
            <div className="mt-1">
              <Change ratio={sevenDayChange(data.series)} />
            </div>
            <div className="mt-4">
              <PriceChart series={data.series} />
            </div>
            {fetchedAt !== null && (
              <p className="mt-3 text-sm text-text-muted">Atualizado às {formatClock(fetchedAt)}</p>
            )}
          </>
        ) : (
          loading && <MarketSkeleton />
        )}
      </div>
    </section>
  )
}

import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { PricePoint } from '../../api/market'
import { formatPointTime, formatUsd, priceToNumber } from '../../lib/market'

/** Sistema de coordenadas do SVG; o desenho escala por largura sem deformar. */
const W = 600
const H = 180
const PAD_X = 6
const PAD_Y = 12

/** Um dia de pontos (a série da CoinGecko é de hora em hora): PageUp e PageDown. */
const PAGE = 24

type PriceChartProps = { series: PricePoint[] }

/**
 * Gráfico dos 7 dias em SVG próprio (desenho, seções 3 e 5): área suave sob
 * uma linha azul, sem grade. Mouse e teclado (setas, Home, End, PageUp,
 * PageDown) escolhem um ponto, mostrado com valor e data acima do gráfico.
 * Um ponto só fica no centro e a série plana no meio: nenhuma divisão por
 * zero. A linha se desenha (animate-draw); prefers-reduced-motion corta.
 */
export function PriceChart({ series }: PriceChartProps) {
  const gradientId = `area-${useId().replace(/[^\w-]/g, '')}`
  const summaryId = useId()
  const [active, setActive] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const values = series.map((point) => priceToNumber(point.price))
  const n = values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = (i: number) => (n === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (n - 1))
  const y = (v: number) => (max === min ? H / 2 : PAD_Y + ((max - v) * (H - 2 * PAD_Y)) / (max - min))

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`

  const describe = (i: number) => `${formatUsd(values[i])} em ${formatPointTime(series[i].time)}`
  const first = formatUsd(values[0])
  const last = formatUsd(values[n - 1])

  function select(i: number, announce: boolean) {
    const index = Math.min(n - 1, Math.max(0, i))
    setActive(index)
    if (announce) setAnnouncement(describe(index))
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const current = active ?? n - 1
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      PageUp: current - PAGE,
      PageDown: current + PAGE,
      Home: 0,
      End: n - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    select(moves[event.key], true)
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || n === 1) return select(0, false)
    const viewX = ((event.clientX - rect.left) / rect.width) * W
    select(Math.round(((viewX - PAD_X) / (W - 2 * PAD_X)) * (n - 1)), false)
  }

  return (
    <figure className="m-0">
      <p className="min-h-6 text-sm text-text-muted tabular-nums" data-testid="chart-readout">
        {active === null ? 'Passe o mouse ou use as setas para ver cada ponto.' : describe(active)}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Preço do ETH nos últimos 7 dias, de ${first} a ${last}`}
        aria-describedby={summaryId}
        tabIndex={0}
        className="mt-2 block h-auto w-full touch-pan-y rounded-md"
        onKeyDown={handleKeyDown}
        onFocus={() => active === null && select(n - 1, true)}
        onBlur={() => setActive(null)}
        onPointerMove={handlePointerMove}
        onPointerLeave={(event) => event.currentTarget !== document.activeElement && setActive(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--color-divider)" vectorEffect="non-scaling-stroke" />
        {n > 1 && <path d={area} fill={`url(#${gradientId})`} />}
        {n > 1 && (
          <path
            d={line}
            pathLength={100}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="animate-draw"
          />
        )}
        {active !== null && n > 1 && (
          <line x1={x(active)} x2={x(active)} y1="0" y2={H} stroke="var(--color-field-border)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        )}
        {(active !== null || n === 1) && (
          <circle
            data-testid="chart-dot"
            cx={x(active ?? 0)}
            cy={y(values[active ?? 0])}
            r={5}
            fill="var(--color-primary)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
        )}
      </svg>
      <figcaption id={summaryId} className="sr-only">
        {`Início: ${describe(0)}. Fim: ${describe(n - 1)}. Mínimo: ${formatUsd(min)}. Máximo: ${formatUsd(max)}. Use as setas para percorrer os ${n} pontos.`}
      </figcaption>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </figure>
  )
}

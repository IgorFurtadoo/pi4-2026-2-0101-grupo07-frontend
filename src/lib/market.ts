/**
 * Números do painel de mercado (desenho, seção 6.2). Diferente do ETH, o
 * preço em USD e a série do gráfico só são exibidos (desenho, seção 8): aqui
 * o texto exato da API vira Number de propósito. Por isso este arquivo fica
 * fora de format.ts, que a varredura "ETH sem Number" confere.
 */

const USD = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' })

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  signDisplay: 'exceptZero',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Decimal em texto (já validado pela api/market.ts) como número, só para exibir e desenhar. */
export function priceToNumber(text: string): number {
  return Number(text)
}

/** Dólar em pt-BR: "US$ 3.200,45" (o espaço é o não separável do Intl). */
export function formatUsd(value: number): string {
  return USD.format(value)
}

/**
 * Variação dos 7 dias: último ponto contra o primeiro, como fração (0,0123 é
 * +1,23%). Um ponto só dá 0. Primeiro preço zero (sem base) dá null.
 */
export function sevenDayChange(series: ReadonlyArray<{ price: string }>): number | null {
  if (series.length === 0) return null
  const first = priceToNumber(series[0].price)
  const last = priceToNumber(series[series.length - 1].price)
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null
  return (last - first) / first
}

/** Fração em percentual pt-BR com sinal: "+1,23%", "-13,98%", "0,00%". */
export function formatPercent(ratio: number): string {
  return PERCENT.format(ratio)
}

export type ChangeDirection = 'up' | 'down' | 'flat'

/** Sentido da variação como é exibida (duas casas do percentual): -0,001% conta como estável. */
export function changeDirection(ratio: number): ChangeDirection {
  const basisPoints = Math.round(ratio * 10_000)
  if (basisPoints > 0) return 'up'
  if (basisPoints < 0) return 'down'
  return 'flat'
}

/** Dia, mês e hora de um ponto da série em pt-BR ("18/11, 14:00"), no fuso do navegador ou no dado. */
export function formatPointTime(time: number, timeZone?: string): string {
  return new Date(time).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
}

/** Hora e minuto em pt-BR ("14:05"), para "Atualizado às". */
export function formatClock(time: number, timeZone?: string): string {
  return new Date(time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone })
}

/** Fundo onde o esqueleto aparece: o cartão azul do saldo ou uma superfície clara. */
export type SkeletonTone = 'blue' | 'light'

const TONE_CLASS: Record<SkeletonTone, string> = {
  blue: 'from-primary-hover via-primary to-primary-hover',
  light: 'from-divider via-bg to-divider',
}

type SkeletonProps = {
  /** Tamanho e forma (por exemplo "h-10 w-48 rounded-md"). */
  className?: string
  /** "blue" (padrão) dentro do cartão azul; "light" sobre fundo claro. */
  tone?: SkeletonTone
}

/**
 * Bloco de esqueleto com brilho em CSS (desenho, seção 5, momento 5). É
 * decoração: aria-hidden, e quem informa o carregamento é o contêiner
 * (aria-busy) e o texto para leitor de tela. O prefers-reduced-motion global
 * para a animação.
 */
export function Skeleton({ className, tone = 'blue' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-skeleton=""
      className={`animate-shimmer bg-linear-to-r ${TONE_CLASS[tone]} bg-size-[200%_100%] ${className ?? ''}`}
    />
  )
}

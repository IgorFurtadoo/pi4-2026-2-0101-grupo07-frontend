type SkeletonProps = {
  /** Tamanho e forma (por exemplo "h-10 w-48 rounded-md"). */
  className?: string
}

/**
 * Bloco de esqueleto com brilho em CSS (desenho, seção 5, momento 5), para o
 * conteúdo dentro do cartão azul. É decoração: aria-hidden, e quem informa o
 * carregamento é o contêiner (aria-busy) e o texto para leitor de tela. O
 * prefers-reduced-motion global para a animação. A variante clara entra no F6.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-skeleton=""
      className={`animate-shimmer bg-linear-to-r from-primary-hover via-primary to-primary-hover bg-size-[200%_100%] ${className ?? ''}`}
    />
  )
}

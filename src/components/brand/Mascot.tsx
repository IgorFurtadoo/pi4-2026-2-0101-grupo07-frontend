import mascot from '../../assets/brand/lemma-mascote.svg'

/**
 * Fundo onde o mascote aparece. Sobre branco suave ou azul-noite ele perde o
 * contorno de partes do corpo, então entra sempre sobre um disco de apoio
 * (guia, seção 5.4). Sobre o azul da marca o guia manda evitar: não há opção.
 */
export type MascotBackground = 'light' | 'night'

const DISC_CLASS: Record<MascotBackground, string> = {
  light: 'bg-mascot-disc-light',
  night: 'bg-mascot-disc-night',
}

type MascotProps = {
  background: MascotBackground
  /** Diâmetro do disco em px. */
  size: number
  className?: string
}

/**
 * Ilustração de apoio. É decorativa: removê-la não apaga informação, por isso
 * fica fora da árvore de acessibilidade. Nunca indica sucesso, erro, alerta ou
 * progresso, e sempre aparece com texto ao lado.
 */
export function Mascot({ background, size, className }: MascotProps) {
  return (
    <div
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${DISC_CLASS[background]} ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <img src={mascot} alt="" width={size} height={size} />
    </div>
  )
}

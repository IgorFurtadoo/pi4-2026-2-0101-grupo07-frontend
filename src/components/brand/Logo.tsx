import logoLight from '../../assets/brand/lemma-logo-claro.svg'
import logoNight from '../../assets/brand/lemma-logo-escuro.svg'
import logoBlue from '../../assets/brand/lemma-logo-fundo-azul.svg'

/**
 * Fundo onde o logo aparece (guia de identidade, seção 3.2):
 * - light: branco suave #F5F7FA ou branco → versão clara
 * - night: azul-noite #151D35 → versão escura
 * - blue: azul #2447C6 → versão "fundo azul" (com halo)
 */
export type LogoBackground = 'light' | 'night' | 'blue'

const SOURCES: Record<LogoBackground, string> = {
  light: logoLight,
  night: logoNight,
  blue: logoBlue,
}

/** Prancheta do arquivo: 1320 × 480 (2,75 : 1). */
const ASPECT_RATIO = 1320 / 480

/** Altura mínima da assinatura completa (guia, seção 3.4). */
export const LOGO_MIN_HEIGHT = 32
/** Altura recomendada no cabeçalho (LEIA-ME v2). */
export const LOGO_DEFAULT_HEIGHT = 40

type LogoProps = {
  background: LogoBackground
  /** Altura total em px, incluindo a prancheta. Abaixo de 32 fica em 32. */
  height?: number
  className?: string
}

/** Assinatura do Lemma pelos arquivos do pacote, sem redesenhar nem recolorir. */
export function Logo({ background, height = LOGO_DEFAULT_HEIGHT, className }: LogoProps) {
  const h = Math.max(height, LOGO_MIN_HEIGHT)
  return (
    <img
      src={SOURCES[background]}
      alt="Lemma"
      height={h}
      width={Math.round(h * ASPECT_RATIO)}
      className={className}
      style={{ height: h, width: 'auto' }}
    />
  )
}

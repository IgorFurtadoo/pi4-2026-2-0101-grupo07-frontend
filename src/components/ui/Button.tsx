import { LoaderCircle } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-primary bg-surface text-primary hover:bg-primary-soft',
}

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: ButtonVariant
  /** Requisição em andamento: desabilita o botão e troca o texto por `loadingText`. */
  loading?: boolean
  loadingText?: string
}

/**
 * Botão do produto. Em carregamento fica desabilitado e mostra um indicador
 * (decorativo) ao lado do texto; o texto é o que informa o estado.
 */
export function Button({
  variant = 'primary',
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASS[variant]} ${className ?? ''}`}
      {...rest}
    >
      {loading && <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}

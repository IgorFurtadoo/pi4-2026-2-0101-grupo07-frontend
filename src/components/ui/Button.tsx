import { LoaderCircle } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'
import { BUTTON_CLASS, type ButtonVariant } from './buttonClass'

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
      className={`${BUTTON_CLASS[variant]} ${className ?? ''}`}
      {...rest}
    >
      {loading && <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}

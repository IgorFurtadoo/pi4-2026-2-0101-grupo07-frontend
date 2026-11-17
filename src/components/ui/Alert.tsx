import { CircleCheck, CircleExclamationPoint } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'

export type AlertVariant = 'error' | 'success'

const STYLE: Record<AlertVariant, string> = {
  error: 'border-error bg-error-soft text-error',
  success: 'border-success bg-success-soft text-success',
}

type AlertProps = Omit<ComponentPropsWithRef<'div'>, 'role'> & {
  variant: AlertVariant
  children: ReactNode
}

/**
 * Mensagem de erro ou de sucesso, sempre com ícone e texto (nunca só cor).
 * Erro usa role="alert"; sucesso, role="status". Aceita foco programático
 * (tabIndex -1) para a tela levar o foco até ela.
 */
export function Alert({ variant, children, className, ...rest }: AlertProps) {
  const Icon = variant === 'error' ? CircleExclamationPoint : CircleCheck
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      tabIndex={-1}
      className={`flex items-start gap-3 rounded-md border-l-4 px-4 py-3 ${STYLE[variant]} ${className ?? ''}`}
      {...rest}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

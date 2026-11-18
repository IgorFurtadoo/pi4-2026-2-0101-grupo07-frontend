import { Circle, CircleCheck, CircleX, LoaderCircle, type LucideIcon } from 'lucide-react'
import type { TransactionStatus } from '../../api/transactions'

/** Situação de um passo. Cada uma tem cor, ícone e texto (nunca só cor). */
export type StepState = 'done' | 'active' | 'todo' | 'success' | 'error'

type StepStyle = {
  Icon: LucideIcon
  /** Situação dita ao leitor de tela, depois do rótulo. */
  srText: string
  icon: string
  disc: string
  label: string
}

const STEP_STYLE: Record<StepState, StepStyle> = {
  done: {
    Icon: CircleCheck,
    srText: 'concluída',
    icon: 'text-primary',
    disc: 'bg-primary-soft',
    label: 'text-text',
  },
  active: {
    Icon: LoaderCircle,
    srText: 'em andamento',
    icon: 'text-primary animate-spin',
    disc: 'bg-primary-soft',
    label: 'text-text font-medium',
  },
  todo: {
    Icon: Circle,
    srText: 'ainda não',
    icon: 'text-text-muted',
    disc: 'bg-bg',
    label: 'text-text-muted',
  },
  success: {
    Icon: CircleCheck,
    srText: 'concluída com sucesso',
    icon: 'text-success [&>*]:animate-draw',
    disc: 'bg-success-soft',
    label: 'text-success font-medium',
  },
  error: {
    Icon: CircleX,
    srText: 'com falha',
    icon: 'text-error [&>*]:animate-draw',
    disc: 'bg-error-soft',
    label: 'text-error font-medium',
  },
}

type Step = { label: string; state: StepState }

function stepsFor(status: TransactionStatus): Step[] {
  const final = status !== 'PENDING'
  return [
    { label: 'Solicitação aceita', state: 'done' },
    { label: 'Aguardando confirmação', state: final ? 'done' : 'active' },
    status === 'CONFIRMED'
      ? { label: 'Confirmada', state: 'success' }
      : status === 'FAILED'
        ? { label: 'Falhou', state: 'error' }
        : { label: 'Resultado da rede', state: 'todo' },
  ]
}

type StatusTimelineProps = {
  status: TransactionStatus
  /** Explicação da falha (já em português, de failureReasonMessage). Só em FAILED. */
  failureMessage?: string
}

/**
 * Linha do tempo vertical do acompanhamento (desenho, seção 5, momento 4):
 * "Solicitação aceita" → "Aguardando confirmação" (indicador animado) →
 * "Confirmada" ou "Falhou". O ícone do estado final se desenha (traço de SVG,
 * animação --animate-draw do index.css); com prefers-reduced-motion a regra
 * global faz o ícone aparecer pronto e o indicador parar. Não anuncia nada:
 * o anúncio da mudança de estado é da página.
 */
export function StatusTimeline({ status, failureMessage }: StatusTimelineProps) {
  const steps = stepsFor(status)
  return (
    <ol aria-label="Andamento da transação">
      {steps.map((step, index) => {
        const style = STEP_STYLE[step.state]
        const current = step.state === 'active' || step.state === 'success' || step.state === 'error'
        const drawn = step.state === 'success' || step.state === 'error'
        const last = index === steps.length - 1
        return (
          <li
            key={index}
            data-state={step.state}
            aria-current={current ? 'step' : undefined}
            className={`relative flex gap-3 ${last ? '' : 'pb-6'}`}
          >
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-10 bottom-1 left-[1.125rem] w-px bg-divider"
              />
            )}
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${style.disc}`}
            >
              <style.Icon
                aria-hidden="true"
                data-drawn={drawn ? '' : undefined}
                className={`size-5 ${style.icon}`}
              />
            </span>
            <div className="min-w-0 pt-1.5">
              <p className={style.label}>
                {step.label}
                <span className="sr-only">: {style.srText}</span>
              </p>
              {step.state === 'error' && failureMessage && (
                <p className="mt-1 text-text">{failureMessage}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Quanto tempo o aviso "Copiado" fica na tela. */
export const COPY_FEEDBACK_MS = 2000

type CopyState = 'idle' | 'copied' | 'failed'

type CopyButtonProps = {
  /** Texto copiado para a área de transferência. */
  value: string
  /** Rótulo do botão, por exemplo "Copiar endereço". */
  label: string
  /** O que o leitor de tela anuncia ao copiar, por exemplo "Endereço copiado". */
  copiedMessage?: string
  /**
   * Complemento do rótulo só para leitor de tela, quando há vários botões
   * iguais na tela (por exemplo "endereço 0x6bdB…58E6" depois de "Copiar").
   */
  srLabel?: string
  className?: string
}

/**
 * Copia um texto com navigator.clipboard. O resultado aparece no próprio botão
 * (ícone e texto) e é anunciado numa região aria-live que fica sempre montada.
 */
export function CopyButton({
  value,
  label,
  copiedMessage = 'Copiado',
  srLabel,
  className,
}: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    clearTimeout(timer.current)
    let next: CopyState = 'failed'
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(value)
        next = 'copied'
      }
    } catch {
      // Sem permissão ou contexto inseguro: fica "failed".
    }
    setState(next)
    timer.current = setTimeout(() => setState('idle'), COPY_FEEDBACK_MS)
  }

  const announcement =
    state === 'copied' ? copiedMessage : state === 'failed' ? 'Não foi possível copiar' : ''

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-field-border bg-surface px-4 py-2 font-medium text-primary hover:bg-primary-soft ${className ?? ''}`}
      >
        {state === 'copied' ? (
          <Check aria-hidden="true" className="size-5 shrink-0" />
        ) : (
          <Copy aria-hidden="true" className="size-5 shrink-0" />
        )}
        <span>
          {state === 'copied' ? 'Copiado' : state === 'failed' ? 'Não foi possível copiar' : label}
          {state === 'idle' && srLabel && (
            <>
              {' '}
              <span className="sr-only">{srLabel}</span>
            </>
          )}
        </span>
      </button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  )
}

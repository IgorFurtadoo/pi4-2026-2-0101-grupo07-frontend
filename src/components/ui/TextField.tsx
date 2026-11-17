import { CircleExclamationPoint, Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentPropsWithRef } from 'react'

type TextFieldProps = Omit<ComponentPropsWithRef<'input'>, 'id' | 'type'> & {
  label: string
  type?: 'text' | 'email' | 'password'
  /** Texto de ajuda sempre visível, abaixo do campo. */
  hint?: string
  /** Mensagem de erro do campo; com ela, o campo fica aria-invalid. */
  error?: string
}

/**
 * Campo com rótulo sempre visível. Dica e erro ficam ligados ao campo por
 * aria-describedby. Em senha, um botão alterna entre mostrar e ocultar.
 */
export function TextField({ label, type = 'text', hint, error, className, ...rest }: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-dica`
  const errorId = `${id}-erro`
  const [revealed, setRevealed] = useState(false)

  const isPassword = type === 'password'
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={className}>
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`block min-h-11 w-full rounded-md border bg-surface px-3 py-2 text-text ${
            error ? 'border-2 border-error' : 'border-field-border'
          } ${isPassword ? 'pr-12' : ''}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-text-muted hover:text-text"
          >
            {revealed ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm text-error">
          <CircleExclamationPoint aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

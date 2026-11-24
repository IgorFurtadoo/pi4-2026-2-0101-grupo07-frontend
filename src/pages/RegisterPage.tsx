import { CircleCheck } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { registerUser, type RegisterResult } from '../api/auth'
import { ApiError } from '../api/client'
import { messageFor } from '../api/errors'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { BUTTON_CLASS } from '../components/ui/buttonClass'
import { CopyButton } from '../components/ui/CopyButton'
import { TextField } from '../components/ui/TextField'
import {
  emailProblem,
  passwordProblem,
  trimEmail,
  type EmailProblem,
  type PasswordProblem,
} from '../lib/validate'

const EMAIL_MESSAGES: Record<EmailProblem, string> = {
  empty: 'Informe o e-mail.',
  invalid: 'Informe um e-mail válido, como nome@exemplo.com.',
}

const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  empty: 'Informe a senha.',
  too_short: 'A senha precisa ter no mínimo 8 caracteres.',
  too_long:
    'A senha passou do limite de caracteres: use uma senha mais curta ou com menos acentos.',
}

const PASSWORD_HINT =
  'Mínimo de 8 caracteres.'

type FieldErrors = { email?: string; password?: string }
type FormError = { code: string; text: string }

function emailError(value: string): string | undefined {
  const problem = emailProblem(value)
  return problem ? EMAIL_MESSAGES[problem] : undefined
}

function passwordError(value: string): string | undefined {
  const problem = passwordProblem(value)
  return problem ? PASSWORD_MESSAGES[problem] : undefined
}

/**
 * Cadastro (CT1, E1 e E2). Valida no cliente como o Core API, mas quem decide
 * é o servidor, pelo code do erro. Em 201, mostra o endereço da carteira e leva
 * ao login com o e-mail preenchido. Não faz login automático.
 */
export function RegisterPage() {
  const { dismissSessionExpired } = useAuth()
  const [result, setResult] = useState<RegisterResult | null>(null)

  // O aviso de sessão expirada é do login anterior; depois de um cadastro, não volta.
  useEffect(() => {
    dismissSessionExpired()
  }, [dismissSessionExpired])

  if (result) return <RegisterSuccess result={result} />
  return <RegisterForm onRegistered={setResult} />
}

function RegisterForm({ onRegistered }: { onRegistered: (result: RegisterResult) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<FormError | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  // Trava síncrona: o disabled do botão só vale depois do próximo render.
  const submittingRef = useRef(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (formError) alertRef.current?.focus()
  }, [formError])

  function handleEmailChange(value: string) {
    setEmail(value)
    if (submitted) setFieldErrors((errors) => ({ ...errors, email: emailError(value) }))
  }

  function handlePasswordChange(value: string) {
    setPassword(value)
    if (submitted) setFieldErrors((errors) => ({ ...errors, password: passwordError(value) }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    setSubmitted(true)
    setFormError(null)
    const errors: FieldErrors = { email: emailError(email), password: passwordError(password) }
    setFieldErrors(errors)
    if (errors.email) {
      emailRef.current?.focus()
      return
    }
    if (errors.password) {
      passwordRef.current?.focus()
      return
    }

    submittingRef.current = true
    setLoading(true)
    try {
      // Só o e-mail é aparado; a senha vai exatamente como digitada.
      const registered = await registerUser({ email: trimEmail(email), password })
      setPassword('')
      onRegistered(registered)
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR'
      const serverMessage = error instanceof ApiError ? error.message : undefined
      if (code === 'EMAIL_INVALID') {
        setFieldErrors({ email: messageFor(code) })
        emailRef.current?.focus()
      } else if (code === 'PASSWORD_INVALID') {
        setFieldErrors({ password: messageFor(code) })
        passwordRef.current?.focus()
      } else {
        setFormError({ code, text: messageFor(code, serverMessage) })
      }
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-labelledby="titulo-cadastro">
      <h1 id="titulo-cadastro" className="text-3xl">
        Criar conta
      </h1>
      <p className="mt-2 text-text-muted">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-medium text-primary underline hover:text-primary-hover">
          Entrar
        </Link>
      </p>

      {formError && (
        <Alert ref={alertRef} variant="error" className="mt-6">
          <p>{formError.text}</p>
          {formError.code === 'EMAIL_ALREADY_REGISTERED' && (
            <Link
              to="/entrar"
              state={{ email: trimEmail(email) }}
              className="mt-1 inline-block font-medium underline"
            >
              Entrar com este e-mail
            </Link>
          )}
        </Alert>
      )}

      <div className="mt-6 space-y-5">
        <TextField
          ref={emailRef}
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => handleEmailChange(event.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          ref={passwordRef}
          label="Senha"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => handlePasswordChange(event.target.value)}
          hint={PASSWORD_HINT}
          error={fieldErrors.password}
        />
      </div>

      <Button type="submit" loading={loading} loadingText="Criando conta…" className="mt-8 w-full">
        Criar conta
      </Button>
    </form>
  )
}

function RegisterSuccess({ result }: { result: RegisterResult }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section aria-labelledby="titulo-carteira-criada">
      <h1
        ref={headingRef}
        id="titulo-carteira-criada"
        tabIndex={-1}
        className="flex items-center gap-3 text-3xl"
      >
        <CircleCheck aria-hidden="true" className="size-8 shrink-0 text-success" />
        Sua carteira foi criada
      </h1>
      <p className="mt-3 text-text-muted">
        Este é o endereço da sua carteira na rede de teste Sepolia. Ele serve para receber ETH de
        teste.
      </p>

      <dl className="mt-6">
        <dt className="font-medium">Endereço da carteira</dt>
        <dd className="mt-1.5 rounded-md bg-primary-soft px-3 py-2 font-mono text-sm break-all">
          {result.ethereumAddress}
        </dd>
      </dl>
      <CopyButton
        value={result.ethereumAddress}
        label="Copiar endereço"
        copiedMessage="Endereço copiado"
        className="mt-3"
      />

      <p className="mt-8 text-text-muted">Para ver o saldo e enviar, entre com o seu e-mail e senha.</p>
      <Link to="/entrar" state={{ email: result.email }} className={`${BUTTON_CLASS.primary} mt-4 w-full`}>
        Entrar
      </Link>
    </section>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { authenticateUser } from '../api/auth'
import { ApiError } from '../api/client'
import { messageFor } from '../api/errors'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'
import { trimEmail } from '../lib/validate'

type FieldErrors = { email?: string; password?: string }

/** E-mail vindo da confirmação do cadastro (router state), se for texto. */
function initialEmail(state: unknown): string {
  if (state && typeof state === 'object' && 'email' in state) {
    const { email } = state as { email: unknown }
    if (typeof email === 'string') return email
  }
  return ''
}

/**
 * Login (CT3). Em 200, guarda a sessão; o RequireGuest leva a /carteira pelo
 * estado. Em erro, não guarda nada, mantém o e-mail e limpa a senha. Só confere
 * se os campos foram preenchidos: o login não revela regra de formato.
 */
export function LoginPage() {
  const location = useLocation()
  const { login, sessionExpired, dismissSessionExpired } = useAuth()

  const [email, setEmail] = useState(() => initialEmail(location.state))
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Trava síncrona: o disabled do botão só vale depois do próximo render.
  const submittingRef = useRef(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (formError) alertRef.current?.focus()
  }, [formError])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    dismissSessionExpired()
    setFormError(null)
    const errors: FieldErrors = {
      email: trimEmail(email) === '' ? 'Informe o e-mail.' : undefined,
      password: password === '' ? 'Informe a senha.' : undefined,
    }
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
      const session = await authenticateUser({ email: trimEmail(email), password })
      login(session)
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR'
      const serverMessage = error instanceof ApiError ? error.message : undefined
      setPassword('')
      setFormError(messageFor(code, serverMessage))
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-labelledby="titulo-entrar">
      <h1 id="titulo-entrar" className="text-3xl">
        Entrar
      </h1>
      <p className="mt-2 text-text-muted">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="font-medium text-primary underline hover:text-primary-hover">
          Criar conta
        </Link>
      </p>

      {sessionExpired && !formError && (
        <Alert variant="error" className="mt-6">
          <p>{messageFor('TOKEN_INVALID')}</p>
        </Alert>
      )}
      {formError && (
        <Alert ref={alertRef} variant="error" className="mt-6">
          <p>{formError}</p>
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
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          ref={passwordRef}
          label="Senha"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
      </div>

      <Button type="submit" loading={loading} loadingText="Entrando…" className="mt-8 w-full">
        Entrar
      </Button>
    </form>
  )
}

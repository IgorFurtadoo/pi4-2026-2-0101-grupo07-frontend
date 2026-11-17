import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setTokenInvalidHandler } from '../api/client'
import { AuthContext, type AuthContextValue } from './useAuth'
import { parseIsoInstant } from '../lib/instant'
import { clearSession, readSession, writeSession, type Session } from './sessionStorage'

/** Maior atraso que o setTimeout aceita (2^31 - 1 ms, cerca de 24,8 dias). */
export const MAX_TIMEOUT_MS = 2 ** 31 - 1

/**
 * Estado da sessão (desenho, seção 9). Não navega: quem leva ao /entrar é o
 * RequireAuth, pelo estado. Encerra a sessão no expiresAt e ao receber
 * 401 TOKEN_INVALID numa chamada com token (registrado no cliente da API).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Sessão vencida ao carregar é descartada sem aviso: só a leitura do storage.
  const [session, setSession] = useState<Session | null>(() => readSession())
  const [sessionExpired, setSessionExpired] = useState(false)

  const expire = useCallback(() => {
    clearSession()
    setSession(null)
    setSessionExpired(true)
  }, [])

  const login = useCallback((next: Session) => {
    writeSession(next)
    setSession({ token: next.token, expiresAt: next.expiresAt })
    setSessionExpired(false)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
    setSessionExpired(false)
  }, [])

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), [])

  // Encerra a sessão no expiresAt. Prazos acima do limite do setTimeout são
  // divididos: o temporizador reagenda até chegar a hora.
  const expiresAt = session?.expiresAt
  useEffect(() => {
    if (expiresAt === undefined) return
    const deadline = parseIsoInstant(expiresAt) ?? 0
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        expire()
        return
      }
      timer = setTimeout(schedule, Math.min(remaining, MAX_TIMEOUT_MS))
    }
    // Sempre por setTimeout, nunca setState direto no efeito (mesmo já vencida).
    timer = setTimeout(schedule, 0)
    return () => clearTimeout(timer)
  }, [expiresAt, expire])

  useEffect(() => {
    setTokenInvalidHandler(expire)
    return () => setTokenInvalidHandler(null)
  }, [expire])

  const value = useMemo<AuthContextValue>(
    () => ({ session, sessionExpired, login, logout, dismissSessionExpired }),
    [session, sessionExpired, login, logout, dismissSessionExpired],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

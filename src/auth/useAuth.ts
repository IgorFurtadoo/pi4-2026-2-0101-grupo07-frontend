import { createContext, useContext } from 'react'
import type { Session } from './sessionStorage'

export type AuthContextValue = {
  /** Sessão válida, ou null sem login. */
  session: Session | null
  /** A sessão acabou por TOKEN_INVALID ou por vencer: o /entrar mostra o aviso. */
  sessionExpired: boolean
  /** Guarda a sessão devolvida pelo login. */
  login: (session: Session) => void
  /** Apaga a sessão (não há logout no servidor). */
  logout: () => void
  /** Some com o aviso de sessão expirada. */
  dismissSessionExpired: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro do AuthProvider')
  return value
}

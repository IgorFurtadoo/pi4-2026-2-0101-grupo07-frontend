import { Navigate, Outlet } from 'react-router'
import { useAuth } from './useAuth'

/**
 * Proteção das rotas pela sessão (desenho, seção 6). Decide só pelo estado do
 * AuthContext: quando a sessão acaba (logout, vencimento ou TOKEN_INVALID), o
 * novo render leva a /entrar. Sem "voltar para a rota original" por enquanto.
 */

/** Rotas que exigem sessão: sem ela, vai a /entrar. */
export function RequireAuth() {
  const { session } = useAuth()
  if (!session) return <Navigate to="/entrar" replace />
  return <Outlet />
}

/** Cadastro e login: com sessão válida, vai a /carteira. */
export function RequireGuest() {
  const { session } = useAuth()
  if (session) return <Navigate to="/carteira" replace />
  return <Outlet />
}

/** "/": carteira com sessão, login sem. */
export function HomeRedirect() {
  const { session } = useAuth()
  return <Navigate to={session ? '/carteira' : '/entrar'} replace />
}

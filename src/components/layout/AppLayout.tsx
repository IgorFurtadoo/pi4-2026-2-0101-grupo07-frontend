import { Link, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { Logo } from '../brand/Logo'

const NAV_LINK =
  'inline-flex min-h-11 items-center rounded-md px-3 font-medium text-primary hover:bg-primary-soft hover:text-primary-hover'

/**
 * Cabeçalho com o logo (40 px, versão clara sobre branco) e o conteúdo da rota.
 * Com sessão, "Sair"; sem sessão, "Entrar" e "Criar conta".
 */
export function AppLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    // Também fora das rotas protegidas (por exemplo, no 404).
    navigate('/entrar', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-divider bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="rounded-sm">
            <Logo background="light" />
          </Link>
          <nav aria-label="Conta">
            {session ? (
              <button type="button" onClick={handleLogout} className={NAV_LINK}>
                Sair
              </button>
            ) : (
              <ul className="flex items-center gap-1">
                <li>
                  <Link to="/entrar" className={NAV_LINK}>
                    Entrar
                  </Link>
                </li>
                <li>
                  <Link to="/cadastro" className={NAV_LINK}>
                    Criar conta
                  </Link>
                </li>
              </ul>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

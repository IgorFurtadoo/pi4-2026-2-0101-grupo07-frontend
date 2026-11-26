import { Link, Outlet, useMatch, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { Logo } from '../brand/Logo'

/** Margem lateral do cabeçalho e da carteira: 12 px no celular, 16 no tablet, 24 no desktop. */
const GUTTER = 'px-3 sm:px-4 lg:px-6'
/** Teto da carteira e do cabeçalho, para não esticar em tela ultrawide. */
const WIDE = 'mx-auto w-full max-w-[1600px]'

const NAV_LINK =
  'inline-flex min-h-11 items-center rounded-md px-3 font-medium text-primary hover:bg-primary-soft hover:text-primary-hover'

/**
 * Cabeçalho com o logo (40 px, versão clara sobre branco) e o conteúdo da rota.
 * Com sessão, "Sair"; sem sessão, "Entrar" e "Criar conta". O cabeçalho ocupa
 * a largura da janela (até 1600 px). Só a carteira usa a mesma largura, com a
 * grade de blocos (desenho, seção 6.2); as demais telas seguem na coluna de
 * sempre.
 */
export function AppLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const wide = useMatch('/carteira') !== null

  function handleLogout() {
    logout()
    // Também fora das rotas protegidas (por exemplo, no 404).
    navigate('/entrar', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-divider bg-surface">
        <div className={`${WIDE} ${GUTTER} flex flex-wrap items-center justify-between gap-2 py-3`}>
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
      <main
        className={
          wide ? `${WIDE} ${GUTTER} flex-1 py-4 sm:py-6` : 'mx-auto w-full max-w-5xl flex-1 px-4 py-8'
        }
      >
        <Outlet />
      </main>
    </div>
  )
}

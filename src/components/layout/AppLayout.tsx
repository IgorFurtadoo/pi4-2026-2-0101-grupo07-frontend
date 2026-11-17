import { Link, Outlet } from 'react-router'
import { Logo } from '../brand/Logo'

/** Cabeçalho com o logo (40 px, versão clara sobre branco) e o conteúdo da rota. */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-divider bg-surface">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3">
          <Link to="/" className="rounded-sm">
            <Logo background="light" />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

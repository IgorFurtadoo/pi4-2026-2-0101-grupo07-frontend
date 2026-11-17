import type { RouteObject } from 'react-router'
import { HomeRedirect, RequireAuth, RequireGuest } from './auth/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RegisterPage } from './pages/RegisterPage'
import { SendPage } from './pages/SendPage'
import { TransactionPage } from './pages/TransactionPage'
import { WalletPage } from './pages/WalletPage'

/**
 * Rotas da seção 6 do desenho. Rotas com token passam pelo RequireAuth; cadastro
 * e login, pelo RequireGuest. "/" decide pela sessão.
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      {
        element: <RequireGuest />,
        children: [
          { path: '/cadastro', element: <RegisterPage /> },
          { path: '/entrar', element: <LoginPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/carteira', element: <WalletPage /> },
          { path: '/enviar', element: <SendPage /> },
          { path: '/transacoes/:taskId', element: <TransactionPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

import { Navigate, type RouteObject } from 'react-router'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RegisterPage } from './pages/RegisterPage'
import { SendPage } from './pages/SendPage'
import { TransactionPage } from './pages/TransactionPage'
import { WalletPage } from './pages/WalletPage'

/**
 * Rotas da seção 6 do desenho. A proteção por sessão (RequireAuth) e o desvio
 * de "/" para /entrar sem sessão entram no passo F2.
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/carteira" replace /> },
      { path: '/cadastro', element: <RegisterPage /> },
      { path: '/entrar', element: <LoginPage /> },
      { path: '/carteira', element: <WalletPage /> },
      { path: '/enviar', element: <SendPage /> },
      { path: '/transacoes/:taskId', element: <TransactionPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

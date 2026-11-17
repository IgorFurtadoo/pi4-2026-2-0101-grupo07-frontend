import type { RouteObject } from 'react-router'
import { HomeRedirect, RequireAuth, RequireGuest } from './auth/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import { AuthLayout } from './components/layout/AuthLayout'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RegisterPage } from './pages/RegisterPage'
import { SendPage } from './pages/SendPage'
import { TransactionPage } from './pages/TransactionPage'
import { WalletPage } from './pages/WalletPage'

/**
 * Rotas da seção 6 do desenho. Cadastro e login passam pelo RequireGuest e
 * ocupam a tela inteira (AuthLayout, sem o cabeçalho); as demais ficam no
 * AppLayout, e as que exigem token passam pelo RequireAuth. "/" decide pela sessão.
 */
export const routes: RouteObject[] = [
  {
    element: <RequireGuest />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/cadastro', element: <RegisterPage /> },
          { path: '/entrar', element: <LoginPage /> },
        ],
      },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomeRedirect /> },
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

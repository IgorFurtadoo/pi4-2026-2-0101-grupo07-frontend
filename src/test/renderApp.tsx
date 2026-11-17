import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, type InitialEntry } from 'react-router'
import { AuthProvider } from '../auth/AuthContext'
import { writeSession } from '../auth/sessionStorage'
import { routes } from '../routes'

/** Token de teste; nenhum teste o imprime. */
export const TEST_TOKEN = 'eyJ0ZXN0IjoidG9rZW4ifQ.e30.assinatura'

/** Grava no sessionStorage uma sessão que vence daqui a 4 h. */
export function storeValidSession(now: number = Date.now()): void {
  writeSession({ token: TEST_TOKEN, expiresAt: new Date(now + 4 * 60 * 60 * 1000).toISOString() })
}

/**
 * Renderiza o app inteiro (AuthProvider e rotas) num roteador em memória.
 * Com uma lista, o histórico começa com ela e a tela é a última.
 */
export function renderApp(entry: InitialEntry | InitialEntry[]) {
  const initialEntries = Array.isArray(entry) ? entry : [entry]
  const router = createMemoryRouter(routes, {
    initialEntries,
    initialIndex: initialEntries.length - 1,
  })
  const view = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return { router, ...view }
}

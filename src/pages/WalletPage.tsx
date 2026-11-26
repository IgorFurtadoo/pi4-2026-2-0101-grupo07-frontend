import { RefreshCw } from 'lucide-react'
import { useCallback, useId, useMemo, useState } from 'react'
import { messageFor } from '../api/errors'
import { tokenSubject } from '../auth/tokenSubject'
import { useAuth } from '../auth/useAuth'
import { ActivityPanel } from '../components/activity/ActivityList'
import { PendingList } from '../components/activity/PendingList'
import { MarketPanel } from '../components/market/MarketPanel'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { BalanceCard } from '../components/wallet/BalanceCard'
import { ReceivePanel } from '../components/wallet/ReceivePanel'
import { useActivity } from '../hooks/useActivity'
import { useBalance } from '../hooks/useBalance'
import { readPending, removePending } from '../lib/pendingTransactions'

/**
 * Posição de cada bloco na grade (desenho, seção 6.2). A ordem no DOM é a do
 * celular (Saldo, Em andamento, Mercado, Atividade), e é também a de leitura e
 * de foco nos outros tamanhos: no desktop, a coluna da esquerda (Saldo, Em
 * andamento) vem antes da da direita (Mercado, Atividade).
 * - Celular (< 640 px): uma coluna, na ordem do DOM.
 * - Tablet (>= 640 px): Saldo e Mercado lado a lado; Em andamento e Atividade
 *   em largura total, cada um numa linha.
 * - Desktop (>= 1024 px): 12 colunas em 2 linhas. Saldo (5) e Mercado (7) em
 *   cima; Em andamento (5) e Atividade (7) embaixo. Sem Em andamento, a
 *   Atividade ocupa as 12 colunas, para não sobrar buraco sob o Saldo.
 * As classes ficam escritas por extenso para o Tailwind gerá-las.
 */
const WALLET_GRID = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:gap-4'
const BLOCK = {
  balance: 'min-w-0 sm:col-start-1 sm:row-start-1 lg:col-span-5 lg:col-start-1 lg:row-start-1',
  pending: 'sm:col-span-2 sm:row-start-2 lg:col-span-5 lg:col-start-1 lg:row-start-2',
  market: 'sm:col-start-2 sm:row-start-1 lg:col-span-7 lg:col-start-6 lg:row-start-1',
  activityBesidePending: 'sm:col-span-2 lg:col-span-7 lg:col-start-6 lg:row-start-2',
  activityAlone: 'sm:col-span-2 lg:col-span-12 lg:col-start-1 lg:row-start-2',
} as const

/** Casca azul do cartão enquanto a primeira leitura não chega. */
function BalanceCardSkeleton() {
  return (
    <div className="rounded-2xl bg-primary p-6 text-on-primary sm:p-8">
      <p className="sr-only">Carregando saldo…</p>
      <Skeleton className="h-6 w-24 rounded-md" />
      <Skeleton className="mt-6 h-11 w-52 max-w-full rounded-md" />
      <Skeleton className="mt-6 h-15 w-full rounded-lg" />
      <div className="mt-6 flex gap-3">
        <Skeleton className="h-11 flex-1 rounded-md" />
        <Skeleton className="h-11 flex-1 rounded-md" />
      </div>
    </div>
  )
}

/**
 * Carteira (CT6, CT13, CT17 e CT26, desenho, seções 5, 6.2 e 7): saldo ao
 * abrir e pelo botão "Atualizar saldo", sem polling; abaixo, o painel de
 * mercado, os envios "Em andamento" (só com itens guardados neste navegador)
 * e a lista de atividade, independentes do saldo e entre si (uma falha num
 * não afeta os outros). Um envio que confirma relê o saldo e a atividade.
 * Erros pelo code, com ícone e texto, sem mascote (o mascote só aparece no
 * vazio da atividade). O TOKEN_INVALID é tratado no cliente e no AuthContext
 * (o RequireAuth leva a /entrar).
 */
export function WalletPage() {
  const { session } = useAuth()
  const token = session?.token ?? ''
  const { status, balance, error, reload } = useBalance(token)
  const activity = useActivity(token)
  const refreshActivity = activity.refresh

  // Envios guardados neste navegador, na chave do usuário do token (seção 7.2).
  const subject = useMemo(() => tokenSubject(token), [token])
  const [pending, setPending] = useState(() => readPending(subject))
  const removeFromPending = useCallback(
    (taskId: string) => {
      removePending(subject, taskId)
      setPending((records) =>
        records.filter((record) => record.taskId.toLowerCase() !== taskId.toLowerCase()),
      )
    },
    [subject],
  )
  const historyHashes = useMemo(
    () => new Set((activity.data?.transactions ?? []).map((item) => item.hash.toLowerCase())),
    [activity.data],
  )
  const handleConfirmed = useCallback(() => {
    reload()
    refreshActivity()
  }, [reload, refreshActivity])
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [userReloaded, setUserReloaded] = useState(false)
  const receivePanelId = useId()

  const loading = status === 'loading'
  const errorMessage = error ? messageFor(error.code, error.serverMessage) : null

  function handleReload() {
    setUserReloaded(true)
    reload()
  }

  return (
    <section aria-labelledby="titulo-carteira">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="titulo-carteira" className="text-3xl">
          Carteira
        </h1>
        {balance && (
          <Button
            variant="secondary"
            onClick={handleReload}
            loading={loading}
            loadingText="Atualizando…"
          >
            <RefreshCw aria-hidden="true" className="size-5 shrink-0" />
            Atualizar saldo
          </Button>
        )}
      </div>

      {/* Sempre montada, para o leitor de tela anunciar cada nova atualização. */}
      <p aria-live="polite" className="sr-only">
        {userReloaded && status === 'ok' ? 'Saldo atualizado' : ''}
      </p>

      <div className={`mt-4 ${WALLET_GRID}`}>
        <div aria-busy={loading} data-block="saldo" className={BLOCK.balance}>
          {errorMessage && (
            <Alert variant="error" className="mb-4">
              <p>{errorMessage}</p>
              {!balance && (
                <Button variant="secondary" onClick={reload} className="mt-3">
                  Tentar novamente
                </Button>
              )}
            </Alert>
          )}

          {balance ? (
            <>
              <BalanceCard
                balance={balance}
                receiveOpen={receiveOpen}
                onToggleReceive={() => setReceiveOpen((open) => !open)}
                receivePanelId={receivePanelId}
              />
              <ReceivePanel id={receivePanelId} address={balance.ethereumAddress} open={receiveOpen} />
            </>
          ) : (
            loading && <BalanceCardSkeleton />
          )}
        </div>

        <PendingList
          token={token}
          records={pending}
          historyHashes={historyHashes}
          onRemove={removeFromPending}
          onConfirmed={handleConfirmed}
          className={BLOCK.pending}
        />
        <MarketPanel token={token} className={BLOCK.market} />
        <ActivityPanel
          activity={activity}
          className={pending.length > 0 ? BLOCK.activityBesidePending : BLOCK.activityAlone}
        />
      </div>
    </section>
  )
}

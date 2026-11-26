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
    <section aria-labelledby="titulo-carteira" className="mx-auto max-w-xl">
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

      <div aria-busy={loading} className="mt-6">
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

      <MarketPanel token={token} />
      <PendingList
        token={token}
        records={pending}
        historyHashes={historyHashes}
        onRemove={removeFromPending}
        onConfirmed={handleConfirmed}
      />
      <ActivityPanel activity={activity} />
    </section>
  )
}

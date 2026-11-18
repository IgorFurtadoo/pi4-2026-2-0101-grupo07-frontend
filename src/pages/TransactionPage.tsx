import { Clock, ExternalLink, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { messageFor } from '../api/errors'
import { failureReasonMessage, isFinalStatus, type Transaction } from '../api/transactions'
import { useAuth } from '../auth/useAuth'
import { StatusTimeline } from '../components/tx/StatusTimeline'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { BUTTON_CLASS } from '../components/ui/buttonClass'
import { CopyButton } from '../components/ui/CopyButton'
import { Skeleton } from '../components/ui/Skeleton'
import { useTransactionPolling } from '../hooks/useTransactionPolling'
import { etherscanTxUrl } from '../lib/explorer'
import { ETH_DECIMALS, formatEth } from '../lib/format'
import { formatInstant } from '../lib/instant'

const CARD = 'rounded-2xl border border-divider bg-surface p-6'
const TERM = 'text-sm text-text-muted'
const MONO_VALUE = 'font-mono break-all text-text'

/** Anúncio da mudança de estado: muda só quando o estado muda, nunca a cada leitura. */
function announcementFor(status: Transaction['status'] | undefined): string {
  if (status === 'CONFIRMED') return 'Transação confirmada.'
  if (status === 'FAILED') return 'A transação falhou.'
  return ''
}

/** Casca clara enquanto a primeira leitura não chega. */
function TrackerSkeleton() {
  return (
    <div className={CARD}>
      <p className="sr-only">Carregando transação…</p>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 pb-6 last:pb-0">
          <Skeleton tone="light" className="size-9 rounded-full" />
          <Skeleton tone="light" className="h-5 w-48 max-w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}

function HashBlock({ transaction }: { transaction: Transaction }) {
  const { status, transactionHash } = transaction
  if (!transactionHash) return null
  const provisional = status === 'PENDING'
  // Link só em estado final e com o hash no formato (desenho, seções 6.2 e 6.5).
  const link = isFinalStatus(status) ? etherscanTxUrl(transactionHash) : null
  return (
    <div>
      <dt className={TERM}>{provisional ? 'Hash provisório' : 'Hash da transação'}</dt>
      <dd className={MONO_VALUE}>{transactionHash}</dd>
      {provisional && (
        <dd className="mt-1 text-sm text-text-muted">
          Pode mudar ou sumir se a rede recusar a transação.
        </dd>
      )}
      {link && (
        <dd className="mt-2">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-primary underline hover:text-primary-hover"
          >
            Ver no Etherscan
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        </dd>
      )}
    </div>
  )
}

type DetailsProps = {
  transaction: Transaction
  reconnecting: boolean
  slow: boolean
}

function TransactionDetails({ transaction, reconnecting, slow }: DetailsProps) {
  const { status } = transaction
  return (
    <>
      {reconnecting && (
        <p role="status" className="flex items-center gap-2 text-text-muted">
          <RefreshCw aria-hidden="true" className="size-5 shrink-0" />
          Reconectando…
        </p>
      )}
      {slow && status === 'PENDING' && (
        <p className="flex items-start gap-2 rounded-md bg-primary-soft px-4 py-3 text-text">
          <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          Está demorando mais que o normal. Você pode sair e voltar a esta página.
        </p>
      )}

      <div className={CARD}>
        <StatusTimeline
          status={status}
          failureMessage={
            status === 'FAILED' ? failureReasonMessage(transaction.failureReason) : undefined
          }
        />
        {status === 'CONFIRMED' && (
          <p className="mt-6 text-text-muted">O saldo é atualizado quando você abre a carteira.</p>
        )}
      </div>

      <dl className={`${CARD} space-y-5`}>
        <div>
          <dt className={TERM}>Destino</dt>
          <dd className={MONO_VALUE}>{transaction.destinationAddress}</dd>
          <dd className="mt-2">
            <CopyButton
              value={transaction.destinationAddress}
              label="Copiar endereço"
              copiedMessage="Endereço copiado"
            />
          </dd>
        </div>
        <div>
          <dt className={TERM}>Valor</dt>
          <dd className="break-all text-lg font-medium tabular-nums">
            {formatEth(transaction.amountEth, ETH_DECIMALS)} ETH
          </dd>
        </div>
        <div>
          <dt className={TERM}>Rede</dt>
          <dd>Sepolia · testnet</dd>
        </div>
        <HashBlock transaction={transaction} />
        <div>
          <dt className={TERM}>Identificador</dt>
          <dd className={MONO_VALUE}>{transaction.taskId}</dd>
          <dd className="mt-2">
            <CopyButton
              value={transaction.taskId}
              label="Copiar identificador"
              copiedMessage="Identificador copiado"
            />
          </dd>
        </div>
        <div>
          <dt className={TERM}>Última atualização</dt>
          <dd>{formatInstant(transaction.updatedAt)}</dd>
        </div>
      </dl>
    </>
  )
}

function Tracker({ token, taskId }: { token: string; taskId: string }) {
  const { transaction, error, notFound, reconnecting, slow, retry } = useTransactionPolling(
    token,
    taskId,
  )
  const loading = !transaction && !error && !notFound
  const final = transaction !== null && isFinalStatus(transaction.status)

  return (
    <>
      {/* Sempre montada, para o leitor de tela anunciar só a mudança de estado. */}
      <p aria-live="polite" className="sr-only">
        {announcementFor(transaction?.status)}
      </p>

      <div aria-busy={loading} className="mt-6 space-y-4">
        {notFound ? (
          <Alert variant="error">
            <p>{messageFor('TRANSACTION_NOT_FOUND')}</p>
          </Alert>
        ) : transaction ? (
          <TransactionDetails transaction={transaction} reconnecting={reconnecting} slow={slow} />
        ) : error ? (
          <Alert variant="error">
            <p>{messageFor(error.code, error.serverMessage)}</p>
            {error.code !== 'TOKEN_INVALID' && (
              <Button variant="secondary" onClick={retry} className="mt-3">
                Tentar novamente
              </Button>
            )}
          </Alert>
        ) : (
          <TrackerSkeleton />
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          {final && (
            <Link to="/enviar" className={BUTTON_CLASS.primary}>
              Fazer outro envio
            </Link>
          )}
          <Link to="/carteira" className={BUTTON_CLASS.secondary}>
            Voltar à carteira
          </Link>
        </div>
      </div>
    </>
  )
}

/**
 * Acompanhamento da transação (CT13, desenho, seções 5 momento 4 e 6.5):
 * polling até CONFIRMED ou FAILED, linha do tempo, hash (provisório enquanto
 * PENDING, com link do Etherscan só em estado final), motivo de falha em
 * português, "Reconectando…" e aviso de demora. Sem mascote. O
 * TOKEN_INVALID é tratado no cliente e no AuthContext (o RequireAuth leva a
 * /entrar). O conteúdo é remontado por taskId, para outra task começar do zero.
 */
export function TransactionPage() {
  const { taskId = '' } = useParams()
  const { session } = useAuth()
  return (
    <section aria-labelledby="titulo-transacao" className="mx-auto max-w-xl">
      <h1 id="titulo-transacao" className="text-3xl">
        Acompanhamento da transação
      </h1>
      <Tracker key={taskId} token={session?.token ?? ''} taskId={taskId} />
    </section>
  )
}

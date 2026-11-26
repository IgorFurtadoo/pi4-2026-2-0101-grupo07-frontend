import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleCheck,
  CircleX,
  ExternalLink,
  RefreshCw,
  Repeat,
} from 'lucide-react'
import { useState } from 'react'
import { messageFor } from '../../api/errors'
import type { ActivityDirection, ActivityStatus, WalletTransaction } from '../../api/wallet'
import { useActivity, type ActivityHandle } from '../../hooks/useActivity'
import { etherscanTxUrl } from '../../lib/explorer'
import { ETH_DECIMALS, formatEth, shortenAddress } from '../../lib/format'
import { formatInstant } from '../../lib/instant'
import { Mascot } from '../brand/Mascot'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { CopyButton } from '../ui/CopyButton'
import { Skeleton } from '../ui/Skeleton'

/** Direção com ícone e texto (nunca só cor nem só ícone). */
const DIRECTION: Record<ActivityDirection, { Icon: typeof ArrowUpRight; label: string; party: string }> = {
  SENT: { Icon: ArrowUpRight, label: 'Enviada', party: 'Para' },
  RECEIVED: { Icon: ArrowDownLeft, label: 'Recebida', party: 'De' },
  SELF: { Icon: Repeat, label: 'Para você mesmo', party: '' },
}

/** Estado com ícone e texto. */
const STATUS: Record<ActivityStatus, { Icon: typeof CircleCheck; label: string; className: string }> = {
  CONFIRMED: { Icon: CircleCheck, label: 'Confirmada', className: 'text-success' },
  FAILED: { Icon: CircleX, label: 'Falhou na rede', className: 'text-error' },
}

const ACTIVITY_NOTE =
  'Mostra só transações já confirmadas na rede; envios em andamento aparecem em “Em andamento” e no acompanhamento.'

/**
 * Sinal do valor: − no que saiu, + no que entrou. Sem sinal em FAILED (o
 * valor não se moveu; a taxa paga não vem na ficha) e em SELF.
 */
function amountSign({ direction, status }: WalletTransaction): string {
  if (status !== 'CONFIRMED') return ''
  if (direction === 'SENT') return '−'
  if (direction === 'RECEIVED') return '+'
  return ''
}

/** A outra ponta: endereço encurtado com copiar; nula é criação de contrato; SELF omite. */
function Counterparty({ transaction }: { transaction: WalletTransaction }) {
  const { direction, counterpartyAddress } = transaction
  if (direction === 'SELF') return null
  if (counterpartyAddress === null) {
    return <p className="mt-1 text-sm text-text-muted">Criação de contrato</p>
  }
  const short = shortenAddress(counterpartyAddress)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-sm text-text-muted">
        {DIRECTION[direction].party}{' '}
        <span title={counterpartyAddress} className="font-mono text-text">
          {short}
        </span>
      </p>
      <CopyButton
        value={counterpartyAddress}
        label="Copiar"
        srLabel={`endereço ${short}`}
        copiedMessage="Endereço copiado"
      />
    </div>
  )
}

function ActivityItem({ transaction }: { transaction: WalletTransaction }) {
  const direction = DIRECTION[transaction.direction]
  const status = STATUS[transaction.status]
  const link = etherscanTxUrl(transaction.hash)
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2 font-medium">
          <direction.Icon aria-hidden="true" className="size-5 shrink-0 self-center text-primary" />
          {direction.label}
        </p>
        <p className="font-medium break-all tabular-nums">
          {amountSign(transaction)}
          {formatEth(transaction.amountEth, ETH_DECIMALS)} ETH
        </p>
      </div>
      <Counterparty transaction={transaction} />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <time dateTime={transaction.timestamp} className="text-text-muted tabular-nums">
          {formatInstant(transaction.timestamp)}
        </time>
        <span className={`flex items-center gap-1.5 font-medium ${status.className}`}>
          <status.Icon aria-hidden="true" className="size-4 shrink-0" />
          {status.label}
        </span>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-primary underline hover:text-primary-hover"
          >
            Ver no Etherscan
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />{' '}
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        )}
      </div>
    </li>
  )
}

function ActivitySkeleton() {
  return (
    <div>
      <p className="sr-only">Carregando atividade…</p>
      {[0, 1, 2].map((row) => (
        <div key={row} className="py-4 first:pt-0">
          <div className="flex justify-between gap-4">
            <Skeleton tone="light" className="h-6 w-28 rounded-md" />
            <Skeleton tone="light" className="h-6 w-24 rounded-md" />
          </div>
          <Skeleton tone="light" className="mt-2 h-5 w-48 max-w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}

/** Carteira sem transações: boas-vindas com o mascote pequeno ao lado do texto (seção 5, momento 5). */
function EmptyActivity() {
  return (
    <div className="flex items-center gap-4">
      <Mascot background="light" size={72} />
      <p>Nenhuma transação ainda. Quando a carteira receber ou enviar ETH, ela aparece aqui.</p>
    </div>
  )
}

/**
 * Atividade da carteira (CT26, desenho, seção 7): as últimas transações já
 * mineradas, lidas da blockchain. Independe do saldo e do mercado: qualquer
 * falha aqui fica dentro do painel. 502 mostra "Histórico indisponível" com
 * "Tentar de novo"; com lista anterior, uma falha mantém a lista. Sem polling.
 */
export function ActivityList({ token }: { token: string }) {
  return <ActivityPanel activity={useActivity(token)} />
}

/**
 * O painel com o estado já lido. A carteira chama useActivity ela mesma para
 * comparar os hashes com a lista "Em andamento" e reler a atividade quando um
 * envio confirma (desenho, seção 7.2).
 */
export function ActivityPanel({ activity }: { activity: ActivityHandle }) {
  const { status, data, error, refresh } = activity
  const [userRefreshed, setUserRefreshed] = useState(false)
  const loading = status === 'loading'

  function handleRefresh() {
    setUserRefreshed(true)
    refresh()
  }

  return (
    <section
      aria-labelledby="titulo-atividade"
      className="mt-6 rounded-2xl border border-divider bg-surface p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-atividade" className="text-lg">
          Atividade
        </h2>
        {data && (
          <Button variant="secondary" onClick={handleRefresh} loading={loading} loadingText="Atualizando…">
            <RefreshCw aria-hidden="true" className="size-5 shrink-0" />
            Atualizar <span className="sr-only">atividade</span>
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-text-muted">{ACTIVITY_NOTE}</p>

      <p aria-live="polite" className="sr-only">
        {userRefreshed && status === 'ok' ? 'Atividade atualizada' : ''}
      </p>

      <div aria-busy={loading} className="mt-4">
        {error && (
          <Alert variant="error" className="mb-4">
            {error.code === 'HISTORY_UNAVAILABLE' && <p className="font-medium">Histórico indisponível</p>}
            <p>{messageFor(error.code, error.serverMessage)}</p>
            {!data && (
              <Button variant="secondary" onClick={handleRefresh} className="mt-3">
                Tentar de novo
              </Button>
            )}
          </Alert>
        )}

        {data ? (
          data.transactions.length === 0 ? (
            <EmptyActivity />
          ) : (
            <ol className="divide-y divide-divider">
              {data.transactions.map((transaction, index) => (
                // O índice entra na chave: um hash repetido não pode quebrar a lista.
                <ActivityItem key={`${index}-${transaction.hash}`} transaction={transaction} />
              ))}
            </ol>
          )
        ) : (
          loading && <ActivitySkeleton />
        )}
      </div>
    </section>
  )
}

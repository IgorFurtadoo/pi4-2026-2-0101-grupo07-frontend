import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { Component, useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { failureReasonMessage, type TransactionStatus } from '../../api/transactions'
import { useTransactionPolling } from '../../hooks/useTransactionPolling'
import { ETH_DECIMALS, formatEth, shortenAddress } from '../../lib/format'
import type { PendingRecord } from '../../lib/pendingTransactions'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'

/** Intervalo da consulta enquanto algum envio está PENDING (desenho, seção 7.2). */
export const PENDING_POLL_MS = 5_000

const PENDING_NOTE =
  'Envios feitos neste navegador. O estado se atualiza sozinho enquanto estiver pendente.'

/** Estado com ícone e texto (nunca só cor). */
const STATUS: Record<TransactionStatus, { Icon: typeof CircleCheck; label: string; className: string; icon: string }> = {
  PENDING: { Icon: LoaderCircle, label: 'Pendente', className: 'text-primary', icon: 'animate-spin' },
  CONFIRMED: { Icon: CircleCheck, label: 'Confirmada', className: 'text-success', icon: '' },
  FAILED: { Icon: CircleX, label: 'Falhou', className: 'text-error', icon: '' },
}

type ItemProps = {
  token: string
  record: PendingRecord
  /** Hashes do histórico (CT26), em minúsculas. */
  historyHashes: ReadonlySet<string>
  onRemove: (taskId: string) => void
  onConfirmed: () => void
}

/**
 * Um envio, com o estado lido do CT13 (o mesmo polling do acompanhamento, a
 * cada 5 s enquanto PENDING). Sai da lista no 404, no 401 e quando o hash
 * confirmado aparece no histórico. Erro de rede ou do servidor mantém o
 * último estado, sem alerta.
 */
function PendingItem({ token, record, historyHashes, onRemove, onConfirmed }: ItemProps) {
  const { transaction, notFound, error } = useTransactionPolling(token, record.taskId, {
    intervalMs: PENDING_POLL_MS,
  })
  const status = transaction?.status
  const hash = transaction?.transactionHash?.toLowerCase()
  const gone =
    notFound ||
    error?.code === 'TOKEN_INVALID' ||
    (status === 'CONFIRMED' && hash !== undefined && historyHashes.has(hash))

  useEffect(() => {
    if (gone) onRemove(record.taskId)
  }, [gone, onRemove, record.taskId])

  // Só a passagem de PENDING para CONFIRMED vista nesta tela relê saldo e atividade.
  const lastStatus = useRef<TransactionStatus | undefined>(undefined)
  useEffect(() => {
    if (lastStatus.current === 'PENDING' && status === 'CONFIRMED') onConfirmed()
    if (status !== undefined) lastStatus.current = status
  }, [status, onConfirmed])

  if (gone) return null

  const short = shortenAddress(record.destinationAddress)
  const loading = !transaction && !error

  let statusContent: ReactNode
  if (transaction) {
    const shown = STATUS[transaction.status]
    statusContent = (
      <span className={`flex items-center gap-1.5 font-medium ${shown.className}`}>
        <shown.Icon aria-hidden="true" className={`size-4 shrink-0 ${shown.icon}`} />
        {shown.label}
      </span>
    )
  } else if (loading) {
    statusContent = (
      <>
        <span className="sr-only">Consultando estado…</span>
        <Skeleton tone="light" className="h-5 w-24 rounded-md" />
      </>
    )
  } else {
    statusContent = <span className="text-text-muted">Estado indisponível no momento</span>
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
      <Link
        to={`/transacoes/${encodeURIComponent(record.taskId)}`}
        className="-mx-2 flex min-h-11 min-w-0 flex-1 basis-60 flex-col justify-center rounded-md px-2 py-1 hover:bg-primary-soft"
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="font-medium">
            Para{' '}
            <span title={record.destinationAddress} className="font-mono">
              {short}
            </span>
          </span>
          <span className="font-medium break-all tabular-nums">
            {formatEth(record.amountEth, ETH_DECIMALS)} ETH
          </span>
        </span>
        <span aria-live="polite" aria-busy={loading} className="mt-1 block text-sm">
          {statusContent}
          {status === 'FAILED' && (
            <span className="mt-1 block text-text-muted">
              {failureReasonMessage(transaction?.failureReason)}
            </span>
          )}
        </span>
      </Link>
      {status === 'FAILED' && (
        <Button variant="secondary" onClick={() => onRemove(record.taskId)}>
          Dispensar <span className="sr-only">envio para {short}</span>
        </Button>
      )}
    </li>
  )
}

/** Se a seção quebrar, ela some e o resto da carteira segue. */
class PendingBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

type PendingListProps = Omit<ItemProps, 'record'> & {
  /** Envios guardados neste navegador (lib/pendingTransactions.ts), mais novos primeiro. */
  records: PendingRecord[]
  /** Posição do bloco na grade da carteira. */
  className?: string
}

/**
 * "Em andamento" (desenho, seção 7.2, opção B): os envios aceitos neste
 * navegador que ainda não aparecem no histórico, cada um com o estado do
 * CT13 e o link para o acompanhamento. Sem itens, a seção não aparece. FAILED
 * fica até "Dispensar" (ou 24 h); CONFIRMED fica até o hash aparecer no
 * histórico (ou 24 h).
 */
export function PendingList({ records, className, ...itemProps }: PendingListProps) {
  if (records.length === 0) return null
  return (
    <PendingBoundary>
      <section
        aria-labelledby="titulo-em-andamento"
        className={`min-w-0 rounded-2xl border border-divider bg-surface p-6 sm:p-8 ${className ?? ''}`}
      >
        <h2 id="titulo-em-andamento" className="text-lg">
          Em andamento
        </h2>
        <p className="mt-1 text-sm text-text-muted">{PENDING_NOTE}</p>
        <ol className="mt-4 divide-y divide-divider">
          {records.map((record) => (
            <PendingItem key={record.taskId} record={record} {...itemProps} />
          ))}
        </ol>
      </section>
    </PendingBoundary>
  )
}

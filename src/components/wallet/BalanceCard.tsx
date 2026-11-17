import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import type { Balance } from '../../api/wallet'
import { ETH_DECIMALS, formatEth, isZeroEth, shortenAddress } from '../../lib/format'
import { CopyButton } from '../ui/CopyButton'

/** Ação clara sobre o azul. O anel de foco é branco: o azul padrão some no cartão. */
const ACTION_ON_BLUE =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-surface px-5 py-2.5 font-medium text-primary transition-colors hover:bg-primary-soft focus-visible:outline-on-primary'

type BalanceCardProps = {
  balance: Balance
  /** Estado do painel "Receber", que fica fora do cartão. */
  receiveOpen: boolean
  onToggleReceive: () => void
  /** id do painel "Receber", para o aria-controls. */
  receivePanelId: string
}

/**
 * Cartão de saldo (desenho, seção 5, momento 2): azul sólido com texto branco
 * (7,5 : 1), sem token novo; a hierarquia vem de tamanho e peso. O saldo é
 * exibido com 6 casas (truncado pelo formatEth, nunca arredondado para cima);
 * quando isso esconde dígitos e o texto é o exato do JSON, uma linha mostra o
 * valor exato. O coral é só um fio decorativo: nenhuma informação depende dele.
 */
export function BalanceCard({
  balance,
  receiveOpen,
  onToggleReceive,
  receivePanelId,
}: BalanceCardProps) {
  const { balanceEth, ethereumAddress, exact } = balance
  const shown = formatEth(balanceEth)
  const full = formatEth(balanceEth, ETH_DECIMALS)

  return (
    <section
      aria-labelledby="titulo-saldo"
      className="rounded-2xl bg-primary p-6 text-on-primary sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-saldo" className="text-lg">
          Saldo
        </h2>
        <span className="rounded-full border border-on-primary px-3 py-0.5 text-sm font-medium">
          Sepolia · testnet
        </span>
      </div>

      <span aria-hidden="true" className="mt-5 block h-1 w-10 rounded-full bg-brand-coral" />

      <p className="mt-3 leading-tight font-medium tabular-nums [overflow-wrap:anywhere]">
        <span className="text-4xl sm:text-5xl">{shown}</span>{' '}
        <span className="text-xl sm:text-2xl">ETH</span>
      </p>
      {exact && full !== shown && (
        <p className="mt-2 text-sm tabular-nums [overflow-wrap:anywhere]">Valor exato: {full} ETH</p>
      )}
      {isZeroEth(balanceEth) && (
        <p className="mt-2">Use o endereço desta carteira para receber ETH de teste.</p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-hover p-2 pl-4">
        <p className="font-mono text-sm">
          <span aria-hidden="true">{shortenAddress(ethereumAddress)}</span>
          <span className="sr-only">Endereço da carteira: {ethereumAddress}</span>
        </p>
        <CopyButton
          value={ethereumAddress}
          label="Copiar endereço"
          copiedMessage="Endereço copiado"
          className="focus-visible:outline-on-primary"
        />
      </div>

      <div className="mt-6 flex gap-3">
        <Link to="/enviar" className={ACTION_ON_BLUE}>
          <ArrowUpRight aria-hidden="true" className="size-5 shrink-0" />
          Enviar
        </Link>
        <button
          type="button"
          aria-expanded={receiveOpen}
          aria-controls={receivePanelId}
          onClick={onToggleReceive}
          className={ACTION_ON_BLUE}
        >
          <ArrowDownLeft aria-hidden="true" className="size-5 shrink-0" />
          Receber
        </button>
      </div>
    </section>
  )
}

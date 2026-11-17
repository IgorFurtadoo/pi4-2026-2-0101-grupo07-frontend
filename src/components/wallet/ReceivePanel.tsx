import { Info } from 'lucide-react'
import { CopyButton } from '../ui/CopyButton'

type ReceivePanelProps = {
  /** id usado pelo aria-controls do botão "Receber". */
  id: string
  address: string
  open: boolean
}

/**
 * "Receber" (desenho, seção 6.3): seção recolhível na própria carteira, sem
 * rota nova e sem QR code. Mostra o endereço completo, o botão de copiar e o
 * aviso da rede de teste. Fechada, fica no DOM com hidden, para o aria-controls
 * apontar sempre para um elemento.
 */
export function ReceivePanel({ id, address, open }: ReceivePanelProps) {
  const titleId = `${id}-titulo`
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      hidden={!open}
      className="mt-4 rounded-2xl border border-divider bg-surface p-6"
    >
      <h2 id={titleId} className="text-xl">
        Receber ETH
      </h2>
      <p className="mt-2 text-text-muted">Endereço desta carteira:</p>
      <p className="mt-1.5 rounded-md bg-primary-soft px-3 py-2 font-mono text-sm break-all">{address}</p>
      <CopyButton
        value={address}
        label="Copiar endereço de recebimento"
        copiedMessage="Endereço copiado"
        className="mt-3"
      />
      <p className="mt-4 flex items-start gap-2">
        <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        Esta é a rede de teste Sepolia: receba apenas ETH de teste.
      </p>
    </section>
  )
}

import { useParams } from 'react-router'

export function TransactionPage() {
  const { taskId } = useParams()
  return (
    <section aria-labelledby="titulo-transacao">
      <h1 id="titulo-transacao" className="text-3xl">
        Acompanhamento da transação
      </h1>
      <p className="mt-2 text-text-muted">
        Identificador: <span className="font-mono break-all text-text">{taskId}</span>
      </p>
    </section>
  )
}

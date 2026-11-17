import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section aria-labelledby="titulo-nao-encontrada">
      <h1 id="titulo-nao-encontrada" className="text-3xl">
        Página não encontrada
      </h1>
      <p className="mt-2 text-text-muted">O endereço digitado não existe.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline hover:text-primary-hover">
        Ir para o início
      </Link>
    </section>
  )
}

/** `sub` aceito: texto curto e seguro para compor uma chave de armazenamento. */
const SUBJECT = /^[A-Za-z0-9_-]{1,64}$/

/**
 * `sub` do JWT da sessão (o Core API grava ali o id do usuário). Lido SEM
 * conferir a assinatura: serve só para separar, por usuário, o que o navegador
 * guarda (envios em andamento, desenho, seção 7.2), nunca para autorizar nada.
 * Quem decide o acesso continua sendo o Core API. Token fora do formato, sem
 * `sub` ou com `sub` estranho devolve null, e quem chama segue sem a lista.
 */
export function tokenSubject(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const claims: unknown = JSON.parse(atob(padded))
    if (typeof claims !== 'object' || claims === null) return null
    const sub = (claims as Record<string, unknown>).sub
    return typeof sub === 'string' && SUBJECT.test(sub) ? sub : null
  } catch {
    return null
  }
}

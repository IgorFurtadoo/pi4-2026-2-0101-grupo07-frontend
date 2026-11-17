import { parseIsoInstant } from '../lib/instant'

/**
 * Sessão guardada no sessionStorage (desenho, seção 9): sobrevive a recarregar
 * a página e some ao fechar a aba. O token nunca vai a log, URL ou mensagem.
 */
export type Session = {
  token: string
  /** Instante em que o token vence, em ISO 8601 UTC (CT3). */
  expiresAt: string
}

export const SESSION_KEY = 'lemma.session'

/** O próprio acesso a window.sessionStorage pode lançar (armazenamento bloqueado). */
function storage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Milissegundos do expiresAt, ou null se estiver fora do formato. */
export function expiresAtMs(session: Session): number | null {
  return parseIsoInstant(session.expiresAt)
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.token === 'string' &&
    record.token !== '' &&
    typeof record.expiresAt === 'string' &&
    parseIsoInstant(record.expiresAt) !== null
  )
}

/**
 * Lê a sessão. JSON ilegível, formato errado e token vencido são descartados
 * (e apagados) sem chamar a API.
 */
export function readSession(now: number = Date.now()): Session | null {
  let raw: string | null
  try {
    raw = storage()?.getItem(SESSION_KEY) ?? null
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearSession()
    return null
  }

  if (!isSession(parsed) || (expiresAtMs(parsed) ?? 0) <= now) {
    clearSession()
    return null
  }
  return { token: parsed.token, expiresAt: parsed.expiresAt }
}

/** Grava a sessão. Se o armazenamento falhar, a sessão vale só enquanto a página viver. */
export function writeSession(session: Session): void {
  try {
    storage()?.setItem(
      SESSION_KEY,
      JSON.stringify({ token: session.token, expiresAt: session.expiresAt }),
    )
  } catch {
    // Armazenamento cheio ou bloqueado: segue só com o estado em memória.
  }
}

export function clearSession(): void {
  try {
    storage()?.removeItem(SESSION_KEY)
  } catch {
    // Nada a fazer: sem armazenamento, não há o que apagar.
  }
}

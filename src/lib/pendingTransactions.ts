import { parseIsoInstant } from './instant'

/**
 * Envios aceitos pelo Core API (202 do CT9) guardados no localStorage do
 * navegador, por usuário (desenho, seção 7.2, opção B). É só uma lista de
 * referências: o estado de cada um vem sempre do CT13. Todo acesso ao
 * armazenamento é protegido: sem ele, a lista fica vazia e o app segue como
 * antes. Não conhece React.
 */

export type PendingRecord = {
  taskId: string
  /** Valor em ETH como texto com ponto, como foi enviado. Nunca passa por Number. */
  amountEth: string
  destinationAddress: string
  /** Instante do 202, em ISO 8601 UTC. */
  createdAt: string
}

/** Teto da lista; ao passar dele, os mais antigos saem. */
export const MAX_PENDING = 20
/** Depois disso, o item sai da lista, qualquer que seja o estado. */
export const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000

const PLAIN_DECIMAL = /^\d+(\.\d+)?$/

/** Chave do usuário (o `sub` do token, ver auth/tokenSubject.ts). */
export function pendingKey(subject: string): string {
  return `lemma.pending.${subject}`
}

/** O próprio acesso a window.localStorage pode lançar (armazenamento bloqueado). */
function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isRecordValue(value: unknown): value is PendingRecord {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.taskId === 'string' &&
    item.taskId.trim() !== '' &&
    typeof item.amountEth === 'string' &&
    PLAIN_DECIMAL.test(item.amountEth) &&
    typeof item.destinationAddress === 'string' &&
    parseIsoInstant(item.createdAt) !== null
  )
}

function isFresh(record: PendingRecord, now: number): boolean {
  const created = parseIsoInstant(record.createdAt) ?? 0
  return now - created < PENDING_MAX_AGE_MS
}

/** Mais novos primeiro, sem repetir taskId, no máximo MAX_PENDING. */
function normalize(records: PendingRecord[], now: number): PendingRecord[] {
  const seen = new Set<string>()
  return records
    .filter((record) => isFresh(record, now))
    .sort((a, b) => (parseIsoInstant(b.createdAt) ?? 0) - (parseIsoInstant(a.createdAt) ?? 0))
    .filter((record) => {
      const key = record.taskId.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_PENDING)
}

function write(subject: string, records: PendingRecord[]): void {
  try {
    const store = storage()
    if (!store) return
    if (records.length === 0) store.removeItem(pendingKey(subject))
    else store.setItem(pendingKey(subject), JSON.stringify(records))
  } catch {
    // Armazenamento cheio ou bloqueado: a lista só não fica guardada.
  }
}

function readRaw(subject: string): unknown[] | null {
  let raw: string | null
  try {
    raw = storage()?.getItem(pendingKey(subject)) ?? null
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Lista do usuário, mais novos primeiro. Item fora do formato ou com mais de
 * 24 h é descartado, e a lista limpa é gravada de volta. Sem usuário ou sem
 * armazenamento, lista vazia.
 */
export function readPending(subject: string | null, now: number = Date.now()): PendingRecord[] {
  if (!subject) return []
  const raw = readRaw(subject)
  if (raw === null) return []
  const records = normalize(raw.filter(isRecordValue), now)
  if (records.length !== raw.length) write(subject, records)
  return records
}

/** Guarda um envio aceito no topo da lista. Sem usuário, não faz nada. */
export function addPending(subject: string | null, record: PendingRecord, now: number = Date.now()): void {
  if (!subject) return
  write(subject, normalize([record, ...readPending(subject, now)], now))
}

/** Tira um envio da lista (comparando o taskId sem caixa). */
export function removePending(subject: string | null, taskId: string, now: number = Date.now()): void {
  if (!subject) return
  const records = readPending(subject, now)
  const next = records.filter((record) => record.taskId.toLowerCase() !== taskId.toLowerCase())
  if (next.length !== records.length) write(subject, next)
}

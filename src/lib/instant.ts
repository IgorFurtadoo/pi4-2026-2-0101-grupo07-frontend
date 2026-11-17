/**
 * Instante em ISO 8601 UTC, como o Core API devolve o expiresAt do login
 * (CT3: "2026-10-20T18:30:00Z", sem fração; a fração é aceita por folga).
 */
const ISO_UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/

/** Milissegundos desde a época, ou null se o texto não for um instante ISO UTC válido. */
export function parseIsoInstant(text: unknown): number | null {
  if (typeof text !== 'string' || !ISO_UTC_INSTANT.test(text)) return null
  const ms = Date.parse(text)
  return Number.isFinite(ms) ? ms : null
}

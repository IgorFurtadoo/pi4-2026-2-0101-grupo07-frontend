import { messageFor } from './errors'

/**
 * Cliente HTTP do Core API (desenho, seção 8). Toda chamada do Frontend passa
 * por aqui. Este módulo não conhece React.
 */

/** URL base do Core API. Lida no build e visível no bundle: nunca é segredo. */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(
  /\/+$/,
  '',
)

/** O Core API espera até 15 s o Blockchain Service; 20 s evita desistir antes dele. */
export const REQUEST_TIMEOUT_MS = 20_000

type ApiErrorInit = {
  status?: number
  code: string
  message: string
  retryAfter?: number
}

/**
 * Erro tipado de qualquer chamada. `status` fica ausente em NETWORK_ERROR.
 * `message` é o texto do servidor (só reserva); o texto da tela vem de
 * messageFor(code) em errors.ts.
 */
export class ApiError extends Error {
  readonly status?: number
  readonly code: string
  readonly retryAfter?: number

  constructor({ status, code, message, retryAfter }: ApiErrorInit) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

// ---------------------------------------------------------------------------
// Precisão decimal
// ---------------------------------------------------------------------------

/** Campos que o Core API devolve como número JSON exato. */
const DECIMAL_FIELDS = new Set(['balanceEth', 'amountEth', 'currentPrice', 'price'])

/**
 * Valor decimal vindo da API: o texto original quando o navegador expõe
 * `context.source` no reviver do JSON.parse; senão, o número comum (que pode
 * ter perdido dígitos e só serve para exibir arredondado).
 */
export type ApiDecimal = string | number

type ReviverContext = { source?: string }

/**
 * Reviver do JSON.parse. Para os campos decimais, devolve o texto exato do
 * número no JSON (`context.source`). Sem `context` (navegador sem suporte),
 * devolve o número já convertido.
 */
export function decimalReviver(key: string, value: unknown, context?: ReviverContext): unknown {
  if (DECIMAL_FIELDS.has(key) && typeof value === 'number' && typeof context?.source === 'string') {
    return context.source
  }
  return value
}

/** JSON.parse com o reviver decimal. */
export function parseJson(text: string): unknown {
  return JSON.parse(text, decimalReviver)
}

/**
 * Texto de um ApiDecimal, para as funções de formatação por texto. O número
 * de reserva sai sem notação exponencial (1e-7 vira "0.0000001").
 */
export function decimalToText(value: ApiDecimal): string {
  if (typeof value === 'string') return value
  return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })
}

// ---------------------------------------------------------------------------
// Sessão expirada
// ---------------------------------------------------------------------------

type TokenInvalidHandler = () => void

let tokenInvalidHandler: TokenInvalidHandler | null = null

/**
 * Registra quem trata o 401 TOKEN_INVALID de uma rota protegida (limpar a
 * sessão e ir a /entrar). O AuthContext do passo F2 registra aqui. O erro é
 * lançado ao chamador mesmo assim.
 */
export function setTokenInvalidHandler(handler: TokenInvalidHandler | null): void {
  tokenInvalidHandler = handler
}

// ---------------------------------------------------------------------------
// Requisição
// ---------------------------------------------------------------------------

export type RequestOptions = {
  method?: 'GET' | 'POST'
  /** Corpo, enviado como JSON. */
  body?: unknown
  /** Token da sessão. Sem ele, não vai Authorization (cadastro e login). */
  token?: string
  /** Cancelamento pelo chamador (por exemplo, ao sair da tela). */
  signal?: AbortSignal
}

/**
 * Chama o Core API. Resolve com o corpo da resposta 2xx (já com o reviver
 * decimal) e rejeita com ApiError. Cancelamento pelo `signal` do chamador
 * rejeita com o AbortError original, para quem cancelou poder ignorá-lo.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const abortFromCaller = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', abortFromCaller, { once: true })

  let response: Response
  let text: string
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    text = await response.text()
  } catch (cause) {
    if (signal?.aborted && !timedOut) throw cause
    throw new ApiError({ code: 'NETWORK_ERROR', message: messageFor('NETWORK_ERROR') })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abortFromCaller)
  }

  if (!response.ok) {
    const error = errorFromResponse(response, text)
    if (error.code === 'TOKEN_INVALID' && token) tokenInvalidHandler?.()
    throw error
  }

  if (text === '') return undefined as T
  try {
    return parseJson(text) as T
  } catch {
    throw new ApiError({
      status: response.status,
      code: 'INTERNAL_ERROR',
      message: messageFor('INTERNAL_ERROR'),
    })
  }
}

/** Corpo de erro do Core API: { "code": "...", "message": "..." }. */
function errorFromResponse(response: Response, text: string): ApiError {
  let code = 'INTERNAL_ERROR'
  let message: string | undefined
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      if (typeof record.code === 'string' && /^[A-Z_]{1,64}$/.test(record.code)) code = record.code
      if (typeof record.message === 'string') message = record.message
    }
  } catch {
    // Corpo vazio ou fora do formato: fica INTERNAL_ERROR com o status real.
  }
  return new ApiError({
    status: response.status,
    code,
    message: message ?? messageFor(code),
    retryAfter: parseRetryAfter(response.headers.get('Retry-After')),
  })
}

/** Retry-After do Core API: inteiro em segundos (CT17). Outro formato é ignorado. */
function parseRetryAfter(header: string | null): number | undefined {
  const value = header?.trim()
  if (!value || !/^\d+$/.test(value)) return undefined
  return Number.parseInt(value, 10)
}

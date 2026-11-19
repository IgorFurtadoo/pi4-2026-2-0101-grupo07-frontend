/**
 * Códigos de erro que o Frontend conhece (desenho, seção 8): os do Core API
 * (fichas CT1, CT3, CT6, CT9, CT13, CT17 e CT26) mais o NETWORK_ERROR do próprio
 * cliente, para falha de rede ou tempo esgotado.
 */
export const ERROR_CODES = [
  'EMAIL_INVALID',
  'PASSWORD_INVALID',
  'EMAIL_ALREADY_REGISTERED',
  'WALLET_UNAVAILABLE',
  'INVALID_CREDENTIALS',
  'REQUEST_INVALID',
  'TOKEN_INVALID',
  'ADDRESS_INVALID',
  'AMOUNT_INVALID',
  'BLOCKCHAIN_UNAVAILABLE',
  'TRANSACTION_NOT_FOUND',
  'ASSET_NOT_FOUND',
  'RATE_LIMIT_EXCEEDED',
  'MARKET_DATA_UNAVAILABLE',
  'HISTORY_UNAVAILABLE',
  'INTERNAL_ERROR',
  'NETWORK_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

/** Texto mostrado ao usuário para cada código. O Frontend decide pelo code, não pelo status. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  EMAIL_INVALID: 'Informe um e-mail válido.',
  PASSWORD_INVALID:
    'A senha precisa ter no mínimo 8 caracteres e no máximo 72 bytes (acentos e emojis ocupam mais de um byte).',
  EMAIL_ALREADY_REGISTERED: 'Já existe uma conta com este e-mail.',
  WALLET_UNAVAILABLE: 'Não foi possível criar a sua carteira agora. Tente novamente em instantes.',
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  REQUEST_INVALID: 'Os dados enviados estão incompletos ou em formato inválido.',
  TOKEN_INVALID: 'Sua sessão expirou. Entre novamente.',
  ADDRESS_INVALID: 'Endereço de destino inválido.',
  AMOUNT_INVALID: 'Valor inválido. Use um número maior que zero, com até 18 casas decimais.',
  BLOCKCHAIN_UNAVAILABLE: 'A rede Sepolia não está acessível agora. Tente novamente em instantes.',
  TRANSACTION_NOT_FOUND: 'Transação não encontrada.',
  ASSET_NOT_FOUND: 'Criptoativo não encontrado.',
  RATE_LIMIT_EXCEEDED: 'Muitas requisições. Tente novamente em instantes.',
  MARKET_DATA_UNAVAILABLE: 'Dados de mercado indisponíveis no momento.',
  HISTORY_UNAVAILABLE: 'Histórico indisponível no momento.',
  INTERNAL_ERROR: 'Ocorreu um erro inesperado. Tente novamente.',
  NETWORK_ERROR: 'Não foi possível falar com o servidor. Verifique a conexão e tente novamente.',
}

export function isKnownErrorCode(code: string): code is ErrorCode {
  return Object.hasOwn(ERROR_MESSAGES, code)
}

/**
 * Mensagem em português para um código. Para um código desconhecido, usa a
 * mensagem do servidor como reserva (sempre renderizada como texto, nunca como
 * HTML) e, sem ela, a mensagem genérica.
 */
export function messageFor(code: string, serverMessage?: string): string {
  if (isKnownErrorCode(code)) return ERROR_MESSAGES[code]
  return serverMessage?.trim() || ERROR_MESSAGES.INTERNAL_ERROR
}

/**
 * Envio (CT9) com resultado incerto: o Core API pode ter aceito o pedido.
 * Sem idempotência, a tela não reenvia sozinha; o usuário decide.
 */
export const UNCERTAIN_SEND_MESSAGE =
  'Não foi possível confirmar se o envio foi aceito. Se foi, o saldo diminui quando a rede confirmar. Espere um pouco e confira a carteira antes de enviar de novo.'

/**
 * true quando a falha de um envio não prova que nada foi gravado: falha de
 * rede ou tempo esgotado (NETWORK_ERROR), 500 ou 202 fora da ficha
 * (INTERNAL_ERROR; o 500 pode vir depois de o Blockchain Service já ter
 * recebido o pedido) e qualquer code que o Frontend não conhece.
 */
export function isUncertainSendError(code: string): boolean {
  return code === 'NETWORK_ERROR' || code === 'INTERNAL_ERROR' || !isKnownErrorCode(code)
}

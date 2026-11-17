/**
 * Validação no cliente, igual à do Core API (UserService e TransactionService),
 * só para dar resposta rápida: quem decide é o servidor, e o código de erro
 * dele é o que vale.
 */

import { normalizeAmountInput } from './format'

export const EMAIL_MAX_CHARS = 254
export const PASSWORD_MIN_CHARS = 8
export const PASSWORD_MAX_BYTES = 72
export const AMOUNT_MAX_DECIMALS = 18
export const AMOUNT_MAX_INTEGER_DIGITS = 20

/** Quantidade de caracteres em code points (como codePointCount do Java): um emoji conta 1. */
function codePointCount(text: string): number {
  return [...text].length
}

/** trim() do Java: remove das pontas os caracteres até U+0020. */
function javaTrim(text: string): string {
  let start = 0
  let end = text.length
  while (start < end && text.charCodeAt(start) <= 0x20) start++
  while (end > start && text.charCodeAt(end - 1) <= 0x20) end--
  return text.slice(start, end)
}

/** algo@algo.algo, sem espaço; "\s" do Java sem Unicode é só [ \t\n\x0B\f\r]. */
const EMAIL_FORMAT = /^[^@ \t\n\v\f\r]+@[^@ \t\n\v\f\r]+\.[^@ \t\n\v\f\r]+$/

/**
 * E-mail sem os espaços das pontas, como o Core API o recebe antes de
 * normalizar. É o que o Frontend valida e envia. Nunca se aplica à senha.
 */
export function trimEmail(raw: string): string {
  return javaTrim(raw)
}

/** E-mail como o Core API o trata: espaços das pontas removidos e letras minúsculas. */
export function normalizeEmail(raw: string): string {
  return javaTrim(raw).toLowerCase()
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw)
  return codePointCount(email) <= EMAIL_MAX_CHARS && EMAIL_FORMAT.test(email)
}

/**
 * Senha: no mínimo 8 caracteres (code points) e no máximo 72 bytes em UTF-8,
 * o limite do bcrypt. Acentos ocupam 2 bytes e emojis 4.
 */
export function isValidPassword(password: string): boolean {
  return (
    codePointCount(password) >= PASSWORD_MIN_CHARS &&
    new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES
  )
}

const ADDRESS_FORMAT = /^0x[0-9a-fA-F]{40}$/

/** 0x e 40 hexadecimais. O checksum EIP-55 é conferido no servidor. */
export function isValidAddress(address: string): boolean {
  return ADDRESS_FORMAT.test(address.trim())
}

/**
 * Valor em ETH (aceita vírgula ou ponto): maior que zero, até 18 casas
 * decimais e até 20 dígitos inteiros. Zeros à esquerda e à direita não contam,
 * como no CT9 ("0.0100000000000000000000" vale como "0.01").
 */
export function isValidAmount(raw: string): boolean {
  return amountProblem(raw) === null
}

export type AddressProblem = 'empty' | 'format'

/** Motivo de o endereço não passar, ou null. Vazio conta depois de tirar os espaços das pontas. */
export function addressProblem(raw: string): AddressProblem | null {
  if (raw.trim() === '') return 'empty'
  return isValidAddress(raw) ? null : 'format'
}

export type AmountProblem =
  | 'empty'
  | 'format'
  | 'zero'
  | 'too_many_decimals'
  | 'too_many_integer_digits'

/**
 * Motivo de o valor não passar, ou null. Vírgula ou ponto só como separador
 * decimal (um só), sem sinal, expoente nem separador de milhar: "1.000" é 1
 * ETH. Zeros à esquerda e à direita não contam para os limites.
 */
export function amountProblem(raw: string): AmountProblem | null {
  const text = normalizeAmountInput(raw)
  if (text === '') return 'empty'
  // Sem nenhum dígito ("." ou ","), não é número, embora normalize para "0".
  if (!/^\d+(\.\d+)?$/.test(text) || !/\d/.test(raw)) return 'format'

  const [integerPart, fractionPart = ''] = text.split('.')
  const integer = integerPart.replace(/^0+/, '')
  const fraction = fractionPart.replace(/0+$/, '')

  if (integer === '' && fraction === '') return 'zero'
  if (fraction.length > AMOUNT_MAX_DECIMALS) return 'too_many_decimals'
  if (integer.length > AMOUNT_MAX_INTEGER_DIGITS) return 'too_many_integer_digits'
  return null
}

export type EmailProblem = 'empty' | 'invalid'

/** Motivo de o e-mail não passar, ou null. Vazio conta depois de tirar os espaços das pontas. */
export function emailProblem(raw: string): EmailProblem | null {
  if (trimEmail(raw) === '') return 'empty'
  return isValidEmail(raw) ? null : 'invalid'
}

export type PasswordProblem = 'empty' | 'too_short' | 'too_long'

/** Motivo de a senha não passar, ou null. A senha nunca é aparada. */
export function passwordProblem(password: string): PasswordProblem | null {
  if (password === '') return 'empty'
  if (codePointCount(password) < PASSWORD_MIN_CHARS) return 'too_short'
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'too_long'
  return null
}

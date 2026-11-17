import { ApiError, apiRequest } from './client'
import { messageFor } from './errors'

/**
 * Cadastro e login (fichas CT1 e CT3). Rotas públicas: não levam token.
 * Só chamam apiRequest; não conhecem React.
 */

export type Credentials = {
  email: string
  password: string
}

/** CT1: 201 { userId, email, ethereumAddress }. O e-mail volta normalizado. */
export type RegisterResult = {
  userId: number
  email: string
  ethereumAddress: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Resposta 2xx fora do formato da ficha: tratada como falha do servidor. */
function unexpectedResponse(): ApiError {
  return new ApiError({ code: 'INTERNAL_ERROR', message: messageFor('INTERNAL_ERROR') })
}

/** CT1 registerUser: POST /users. Cria o usuário e a carteira custodial. */
export async function registerUser(
  { email, password }: Credentials,
  signal?: AbortSignal,
): Promise<RegisterResult> {
  const body = await apiRequest<unknown>('/users', {
    method: 'POST',
    body: { email, password },
    signal,
  })
  if (
    !isRecord(body) ||
    typeof body.userId !== 'number' ||
    typeof body.email !== 'string' ||
    typeof body.ethereumAddress !== 'string' ||
    body.ethereumAddress === ''
  ) {
    throw unexpectedResponse()
  }
  return { userId: body.userId, email: body.email, ethereumAddress: body.ethereumAddress }
}

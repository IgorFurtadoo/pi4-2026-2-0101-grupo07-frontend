import type { PendingRecord } from '../lib/pendingTransactions'
import { fakeResponse } from './fetch'

/**
 * Apoio dos testes da lista "Em andamento": registros guardados no navegador
 * e respostas do CT13 escritas como o Core API manda (amountEth como número
 * JSON cru).
 */

export const PENDING_DESTINATION = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4'

export function taskUrl(taskId: string): string {
  return `http://localhost:8080/transactions/${taskId}`
}

export function pendingRecord(taskId: string, init: Partial<PendingRecord> = {}): PendingRecord {
  return {
    taskId,
    amountEth: '0.01',
    destinationAddress: PENDING_DESTINATION,
    createdAt: new Date().toISOString(),
    ...init,
  }
}

/** 200 do CT13 para a task dada. */
export function taskResponse(
  taskId: string,
  status: string,
  extra: { transactionHash?: string; failureReason?: string } = {},
): Response {
  const fields = {
    taskId,
    status,
    destinationAddress: PENDING_DESTINATION,
    updatedAt: '2026-11-26T12:00:00Z',
    ...extra,
  }
  const parts = Object.entries(fields).map(([key, value]) => `"${key}":${JSON.stringify(value)}`)
  return fakeResponse(200, `{${parts.join(',')},"amountEth":0.01}`)
}

export function apiErrorResponse(status: number, code: string): Response {
  return fakeResponse(status, JSON.stringify({ code, message: 'Mensagem do servidor.' }))
}

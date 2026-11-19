import { describe, expect, it } from 'vitest'
import { ERROR_CODES, ERROR_MESSAGES, UNCERTAIN_SEND_MESSAGE, isUncertainSendError, messageFor } from './errors'

describe('mapa de erros', () => {
  it('cobre os códigos da seção 8 do desenho mais o NETWORK_ERROR', () => {
    expect([...ERROR_CODES].sort()).toEqual(
      [
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
      ].sort(),
    )
    for (const code of ERROR_CODES) {
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0)
    }
  })

  it('HISTORY_UNAVAILABLE (CT26) tem texto próprio', () => {
    expect(messageFor('HISTORY_UNAVAILABLE', 'Não foi possível obter o histórico agora.')).toBe(
      'Histórico indisponível no momento.',
    )
  })

  it('usa o texto do Frontend para código conhecido, mesmo com mensagem do servidor', () => {
    expect(messageFor('INVALID_CREDENTIALS', 'outra coisa')).toBe('E-mail ou senha incorretos.')
  })

  it('usa a mensagem do servidor como reserva para código desconhecido', () => {
    expect(messageFor('ALGO_NOVO', 'Mensagem do servidor')).toBe('Mensagem do servidor')
    expect(messageFor('ALGO_NOVO')).toBe(ERROR_MESSAGES.INTERNAL_ERROR)
    expect(messageFor('ALGO_NOVO', '   ')).toBe(ERROR_MESSAGES.INTERNAL_ERROR)
  })
})

describe('resultado incerto do envio', () => {
  it.each(['NETWORK_ERROR', 'INTERNAL_ERROR'])('%s é incerto', (code) => {
    expect(isUncertainSendError(code)).toBe(true)
  })

  it('code desconhecido é incerto: não prova que nada foi gravado', () => {
    expect(isUncertainSendError('SERVICE_OVERLOADED')).toBe(true)
  })

  it.each(['ADDRESS_INVALID', 'AMOUNT_INVALID', 'REQUEST_INVALID', 'BLOCKCHAIN_UNAVAILABLE', 'TOKEN_INVALID'])(
    '%s não é incerto',
    (code) => {
      expect(isUncertainSendError(code)).toBe(false)
    },
  )

  it('diz para conferir a carteira antes de enviar de novo', () => {
    expect(UNCERTAIN_SEND_MESSAGE).toBe(
      'Não foi possível confirmar se o envio foi aceito. Se foi, o saldo diminui quando a rede confirmar. Espere um pouco e confira a carteira antes de enviar de novo.',
    )
  })
})

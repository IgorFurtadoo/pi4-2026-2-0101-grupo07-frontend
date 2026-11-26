import { describe, expect, it } from 'vitest'
import { TEST_TOKEN, tokenWithSubject } from '../test/renderApp'
import { tokenSubject } from './tokenSubject'

/** Token com o payload dado, em base64url sem preenchimento. */
function tokenWith(payload: string): string {
  const encoded = btoa(payload).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `eyJhbGciOiJIUzI1NiJ9.${encoded}.assinatura`
}

describe('tokenSubject', () => {
  it('lê o sub do payload (id do usuário, como o Core API emite)', () => {
    expect(tokenSubject(tokenWithSubject('42'))).toBe('42')
    expect(tokenSubject(tokenWith('{"sub":"1","exp":1790000000}'))).toBe('1')
  })

  it('decodifica base64url (com - e _) e payload sem preenchimento', () => {
    // "??>" vira "Pz8-" em base64url: o payload tem caracteres que só o base64url usa.
    const token = tokenWith('{"x":"??>","sub":"abc_DEF-9"}')
    expect(token.split('.')[1]).toMatch(/[-_]/)
    expect(tokenSubject(token)).toBe('abc_DEF-9')
  })

  it.each([
    ['token sem sub (o dos testes)', TEST_TOKEN],
    ['texto sem pontos', 'nao-e-um-jwt'],
    ['payload vazio', 'a..b'],
    ['payload que não é base64', 'a.@@@.b'],
    ['payload que não é JSON', tokenWith('nao json')],
    ['payload que não é objeto', tokenWith('"42"')],
    ['payload null', tokenWith('null')],
    ['sub numérico', tokenWith('{"sub":42}')],
    ['sub vazio', tokenWith('{"sub":""}')],
    ['sub com caracteres estranhos', tokenWith('{"sub":"../x"}')],
    ['sub longo demais', tokenWith(`{"sub":"${'a'.repeat(65)}"}`)],
  ])('%s devolve null', (_name, token) => {
    expect(tokenSubject(token)).toBeNull()
  })
})

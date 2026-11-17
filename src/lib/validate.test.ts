import { describe, expect, it } from 'vitest'
import {
  emailProblem,
  isValidAddress,
  isValidAmount,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  passwordProblem,
  trimEmail,
} from './validate'

const bytes = (text: string) => new TextEncoder().encode(text).length

describe('isValidEmail', () => {
  it('aceita o formato simples, com espaços nas pontas e maiúsculas', () => {
    expect(isValidEmail('ana@example.com')).toBe(true)
    expect(isValidEmail(' Ana@Example.com ')).toBe(true)
    expect(normalizeEmail(' Ana@Example.com ')).toBe('ana@example.com')
  })

  it('recusa formato inválido', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('ana@example')).toBe(false)
    expect(isValidEmail('ana @example.com')).toBe(false)
    expect(isValidEmail('a@b@c.com')).toBe(false)
  })

  it('aceita até 254 caracteres', () => {
    const local = 'a'.repeat(64)
    const domain254 = `${'b'.repeat(254 - 64 - 1 - 4)}.com`
    expect(isValidEmail(`${local}@${domain254}`)).toBe(true)
    expect(isValidEmail(`${local}@b${domain254}`)).toBe(false)
  })
})

describe('isValidPassword: no mínimo 8 caracteres (code points) e no máximo 72 bytes', () => {
  it('aceita 8 caracteres ASCII e recusa 7', () => {
    expect(isValidPassword('12345678')).toBe(true)
    expect(isValidPassword('1234567')).toBe(false)
  })

  it('conta o mínimo em caracteres, não em bytes: 4 letras acentuadas (8 bytes) não bastam', () => {
    expect(bytes('çãõé')).toBe(8)
    expect(isValidPassword('çãõé')).toBe(false)
    expect(isValidPassword('çãõéçãõé')).toBe(true)
  })

  it('conta emoji como um caractere no mínimo, como o codePointCount do Core API', () => {
    const fourEmojis = '😀😀😀😀'
    expect(fourEmojis.length).toBe(8) // unidades UTF-16: passaria com length
    expect(isValidPassword(fourEmojis)).toBe(false)
    expect(isValidPassword('😀'.repeat(8))).toBe(true)
    expect(isValidPassword('abcdefg😀')).toBe(true)
  })

  it('aceita 72 bytes e recusa 73 em ASCII', () => {
    expect(isValidPassword('a'.repeat(72))).toBe(true)
    expect(isValidPassword('a'.repeat(73))).toBe(false)
  })

  it('recusa senha com acento que passa de 72 bytes com menos de 72 caracteres', () => {
    const accented = 'é'.repeat(37)
    expect(accented.length).toBe(37)
    expect(bytes(accented)).toBe(74)
    expect(isValidPassword(accented)).toBe(false)
    expect(isValidPassword('é'.repeat(36))).toBe(true)
  })

  it('recusa senha com acento e emoji que passa de 72 bytes', () => {
    const mixed = `${'ação'.repeat(10)}${'😀'.repeat(5)}`
    expect([...mixed].length).toBe(45)
    expect(bytes(mixed)).toBe(80)
    expect(isValidPassword(mixed)).toBe(false)
  })
})

describe('isValidAddress', () => {
  it('aceita 0x e 40 hexadecimais em qualquer caixa', () => {
    expect(isValidAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe(true)
    expect(isValidAddress('0x' + 'a'.repeat(40))).toBe(true)
  })

  it('recusa tamanho, prefixo ou caractere errado', () => {
    expect(isValidAddress('0x' + 'a'.repeat(39))).toBe(false)
    expect(isValidAddress('0x' + 'a'.repeat(41))).toBe(false)
    expect(isValidAddress('71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe(false)
    expect(isValidAddress('0x' + 'g'.repeat(40))).toBe(false)
  })
})

describe('isValidAmount', () => {
  it('aceita valor positivo com vírgula ou ponto', () => {
    expect(isValidAmount('0.01')).toBe(true)
    expect(isValidAmount('0,01')).toBe(true)
    expect(isValidAmount('1')).toBe(true)
  })

  it('recusa zero, negativo e texto que não é número', () => {
    expect(isValidAmount('0')).toBe(false)
    expect(isValidAmount('0,000')).toBe(false)
    expect(isValidAmount('-1')).toBe(false)
    expect(isValidAmount('')).toBe(false)
    expect(isValidAmount('abc')).toBe(false)
    expect(isValidAmount('1e2')).toBe(false)
    expect(isValidAmount('1.2.3')).toBe(false)
  })

  it('aceita até 18 casas, sem contar os zeros à direita', () => {
    expect(isValidAmount('0.000000000000000001')).toBe(true)
    expect(isValidAmount('0.0000000000000000001')).toBe(false)
    expect(isValidAmount('0.0100000000000000000000')).toBe(true)
  })

  it('aceita até 20 dígitos inteiros, sem contar os zeros à esquerda', () => {
    expect(isValidAmount('9'.repeat(20))).toBe(true)
    expect(isValidAmount('1' + '0'.repeat(20))).toBe(false)
    expect(isValidAmount('0'.repeat(5) + '9'.repeat(20))).toBe(true)
  })
})

describe('trimEmail', () => {
  it('tira os espaços das pontas e mantém a caixa', () => {
    expect(trimEmail('  Ana@Example.com \t')).toBe('Ana@Example.com')
  })
})

describe('emailProblem', () => {
  it('vazio ou só espaços é "empty"', () => {
    expect(emailProblem('')).toBe('empty')
    expect(emailProblem('   ')).toBe('empty')
  })

  it('formato errado é "invalid"', () => {
    expect(emailProblem('ana@')).toBe('invalid')
    expect(emailProblem(`${'a'.repeat(250)}@b.co`)).toBe('invalid')
  })

  it('e-mail válido com espaço no fim passa', () => {
    expect(emailProblem('ana@example.com ')).toBeNull()
  })
})

describe('passwordProblem', () => {
  it('vazia é "empty"; só espaços não é vazia', () => {
    expect(passwordProblem('')).toBe('empty')
    expect(passwordProblem('        ')).toBeNull()
  })

  it('menos de 8 caracteres é "too_short", mesmo com 8 bytes', () => {
    expect(passwordProblem('1234567')).toBe('too_short')
    expect(passwordProblem('çãõé')).toBe('too_short')
  })

  it('mais de 72 bytes é "too_long"', () => {
    expect(passwordProblem('a'.repeat(73))).toBe('too_long')
    expect(passwordProblem('ç'.repeat(37))).toBe('too_long')
  })

  it('aceita de 8 caracteres a 72 bytes', () => {
    expect(passwordProblem('a'.repeat(8))).toBeNull()
    expect(passwordProblem('ç'.repeat(36))).toBeNull()
  })
})

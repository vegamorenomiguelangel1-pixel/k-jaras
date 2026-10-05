import { describe, expect, it } from 'vitest'
import { identityFrom, localCandidates, memberEmail, pinError, slugFromName } from './authIdentity'

describe('nombre y código', () => {
  it('convierte el nombre en un identificador sin tildes', () => {
    expect(slugFromName('Miguel Ángel')).toBe('miguel-angel')
    expect(slugFromName('  Ána   Quispe ')).toBe('ana-quispe')
    expect(slugFromName('José-Luis')).toBe('jose-luis')
    expect(slugFromName('Ñandú')).toBe('nandu')
    expect(slugFromName('---')).toBe('')
    expect(slugFromName('a'.repeat(80)).length).toBeLessThanOrEqual(40)
  })

  it('exige un código numérico de 6 a 12 dígitos', () => {
    expect(pinError('12345')).toMatch(/6/)
    expect(pinError('12a456')).toMatch(/números/)
    expect(pinError('123456')).toBeNull()
    expect(pinError('123456789012')).toBeNull()
    expect(pinError('1234567890123')).toMatch(/12/)
  })

  it('arma el correo interno y no lo muestra en el nombre', () => {
    const identity = identityFrom('Miguel Ángel', '123456')
    expect(identity.nombre).toBe('Miguel Ángel')
    expect(memberEmail(identity.slug)).toBe('miguel-angel@kjaras.app')
    expect(identity.nombre.includes('@')).toBe(false)
  })

  it('ofrece sufijos cuando el nombre ya se usó', () => {
    expect(localCandidates('ana')).toEqual(['ana', 'ana-2', 'ana-3', 'ana-4', 'ana-5', 'ana-6', 'ana-7', 'ana-8', 'ana-9', 'ana-10', 'ana-11', 'ana-12', 'ana-13', 'ana-14', 'ana-15', 'ana-16', 'ana-17', 'ana-18', 'ana-19', 'ana-20'])
  })

  it('rechaza un nombre vacío', () => {
    expect(() => identityFrom('   ', '123456')).toThrow(/nombre/)
  })
})

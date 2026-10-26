import { thrownBy } from '../../../test/support/errors'
import { Email } from './email'

const invalidEmail = {
  code: 'VALIDATION_ERROR',
  field: 'borrowerEmail',
  message: 'El correo no es válido',
}

describe('Email', () => {
  it('[LOAN-R7] normaliza a minúsculas y sin espacios alrededor', () => {
    expect(Email.create('  Ana.Perez@UC.CL ').value).toBe('ana.perez@uc.cl')
  })

  it('[LOAN-R7] rechaza un correo sin arroba, con dos arrobas, sin usuario o con un dominio mal formado', () => {
    for (const raw of ['ana.uc.cl', 'ana@uc.cl@uc.cl', '@uc.cl', 'ana@uc', 'ana@uc..cl']) {
      expect(thrownBy(() => Email.create(raw))).toMatchObject(invalidEmail)
    }
  })

  it('[LOAN-R7] rechaza espacios dentro del correo', () => {
    expect(thrownBy(() => Email.create('ana perez@uc.cl'))).toMatchObject(invalidEmail)
  })

  it('[LOAN-R7] acepta hasta 254 caracteres y rechaza 255', () => {
    const domain = '@uc.cl'
    const atLimit = 'a'.repeat(254 - domain.length) + domain
    const overLimit = 'a'.repeat(255 - domain.length) + domain

    expect(Email.create(atLimit).value).toHaveLength(254)
    expect(thrownBy(() => Email.create(overLimit))).toMatchObject(invalidEmail)
  })
})

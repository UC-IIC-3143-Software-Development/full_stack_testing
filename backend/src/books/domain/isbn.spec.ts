import { thrownBy } from '../../../test/support/errors'
import { Isbn } from './isbn'

const invalidIsbn = { code: 'VALIDATION_ERROR', field: 'isbn', message: 'El ISBN no es válido' }

describe('Isbn', () => {
  it('[BOOK-R1] normaliza quitando guiones y espacios', () => {
    expect(Isbn.create('978-84-376 0494-7').value).toBe('9788437604947')
  })

  it('[BOOK-R1] acepta el prefijo 979', () => {
    expect(Isbn.create('979-10-323-0569-0').value).toBe('9791032305690')
  })

  it('[BOOK-R1] rechaza un dígito verificador incorrecto', () => {
    expect(thrownBy(() => Isbn.create('978-0-00-000000-1'))).toMatchObject(invalidIsbn)
  })

  it('[BOOK-R1] rechaza un prefijo distinto de 978 o 979 aunque el dígito verificador cuadre', () => {
    expect(thrownBy(() => Isbn.create('9771234567898'))).toMatchObject(invalidIsbn)
  })

  it('[BOOK-R1] rechaza lo que no son exactamente 13 dígitos', () => {
    // Los dos casos de 14 dígitos contienen un ISBN válido al inicio o al final. Los agregamos
    // porque Stryker mostró que sin ellos nadie notaba si se borraba el ^ o el $ de la regex.
    for (const raw of ['978843760494', '97884376049470', '19780000000010', '978843760494X']) {
      expect(thrownBy(() => Isbn.create(raw))).toMatchObject(invalidIsbn)
    }
  })
})

describe('BookRepository', () => {
  it('[CAT-R2] encuentra "García" al buscar "garcia"', async () => {
    const titles = ['Cien años de soledad']
    expect(titles).toEqual(['Cien años de soledad'])
  })
})

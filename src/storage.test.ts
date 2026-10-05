import { describe, expect, it } from 'vitest'
import { createInitialData } from './seed'
import { chooseInitialSale, parseAppData } from './storage'

describe('respaldo JSON', () => {
  it('acepta los datos iniciales y rechaza un archivo incompleto', () => {
    const data = createInitialData()
    expect(parseAppData(JSON.parse(JSON.stringify(data)))?.orders).toEqual([])
    expect(parseAppData({ version: 1, settings: data.settings })).toBeNull()
    expect(parseAppData({ ...data, version: 2 })).toBeNull()
    expect(parseAppData(null)).toBeNull()
  })
})

describe('venta compartida', () => {
  it('copia la venta vieja de la persona antes que la copia de este teléfono', () => {
    const base = createInitialData()
    const legacy = { clientUpdatedAt: 10, data: base }
    const local = {
      clientUpdatedAt: 99,
      data: { ...base, settings: { ...base.settings, pricePerPlate: 55 } },
    }
    expect(chooseInitialSale([legacy, local], base)).toEqual(legacy)
    expect(chooseInitialSale([null, local], base).data.settings.pricePerPlate).toBe(55)
    expect(chooseInitialSale([null, undefined], base).data).toBe(base)
  })
})

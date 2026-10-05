import { describe, expect, it } from 'vitest'
import { createInitialData } from './seed'
import { parseAppData } from './storage'

describe('respaldo JSON', () => {
  it('acepta los datos iniciales y rechaza un archivo incompleto', () => {
    const data = createInitialData()
    expect(parseAppData(JSON.parse(JSON.stringify(data)))?.orders).toEqual([])
    expect(parseAppData({ version: 1, settings: data.settings })).toBeNull()
    expect(parseAppData({ ...data, version: 2 })).toBeNull()
    expect(parseAppData(null)).toBeNull()
  })
})

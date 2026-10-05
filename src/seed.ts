import type { AppData, Settings, ShoppingItem } from './types'

export const DEFAULT_SETTINGS: Settings = {
  pricePerPlate: 40,
  plannedPlates: 100,
  saleDate: '2026-10-09',
}

const RECIPE: Array<Pick<ShoppingItem, 'id' | 'name' | 'quantityPer100' | 'unit' | 'unitPrice'>> = [
  { id: 'receta-chuleta', name: 'Chuleta de cerdo', quantityPer100: 15, unit: 'kg', unitPrice: 36 },
  { id: 'receta-chorizo', name: 'Chorizo', quantityPer100: 9, unit: 'kg', unitPrice: 30 },
  { id: 'receta-cuerillo', name: 'Cuerillo', quantityPer100: 5, unit: 'kg', unitPrice: 40 },
  { id: 'receta-papa', name: 'Papa', quantityPer100: 1.74, unit: 'arroba', unitPrice: 87.5 },
  { id: 'receta-mote', name: 'Mote (maíz)', quantityPer100: 5, unit: 'kg', unitPrice: 15 },
  { id: 'receta-queso', name: 'Queso criollo', quantityPer100: 3, unit: 'kg', unitPrice: 48 },
  { id: 'receta-limon', name: 'Limón', quantityPer100: 60, unit: 'unid', unitPrice: 1.16 },
  { id: 'receta-platos', name: 'Platos desechables', quantityPer100: 110, unit: 'unid', unitPrice: 0.75 },
  { id: 'receta-bolsas', name: 'Bolsas', quantityPer100: 110, unit: 'unid', unitPrice: 0.2 },
  { id: 'receta-gas', name: 'Gas (garrafa)', quantityPer100: 1, unit: 'unid', unitPrice: 22.5 },
]

export function createInitialData(): AppData {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    shoppingItems: RECIPE.map((item) => ({
      ...item,
      purchased: false,
      actualPricePaid: null,
    })),
    expenses: [],
    orders: [],
  }
}

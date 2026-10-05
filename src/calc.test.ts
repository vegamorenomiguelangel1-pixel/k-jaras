import { describe, expect, it } from 'vitest'
import { actualSubtotal, estimatedSubtotal, itemQuantity, orderTotal, summarize } from './calc'
import { createInitialData } from './seed'
import type { Order } from './types'

function order(partial: Partial<Order> & Pick<Order, 'id' | 'plates' | 'paymentStatus' | 'deliveryStatus'>): Order {
  return {
    customerName: 'Ana',
    phone: '70123456',
    address: 'Calle 1',
    pricePerPlate: 40,
    deliveryTime: '12:00',
    paymentMethod: 'efectivo',
    notes: '',
    createdAt: '2026-10-05T12:00:00.000Z',
    ...partial,
  }
}

describe('costos y ganancia de las k\'jaras', () => {
  it('carga la receta de 100 platos en Bs 1.577,85', () => {
    const summary = summarize(createInitialData())
    expect(summary.purchaseCostEstimated).toBe(1577.85)
    expect(summary.purchaseCostActual).toBe(1577.85)
    expect(summary.expectedIncome).toBe(4000)
    expect(summary.otherExpenses).toBe(0)
    expect(summary.estimatedProfit).toBe(2422.15)
    expect(summary.actualProfit).toBe(-1577.85)
    expect(summary.costPerPlate).toBe(15.78)
    expect(summary.plannedPlates).toBe(100)
    expect(summary.orderedPlates).toBe(0)
    expect(summary.remainingPlates).toBe(100)
    expect(summary.exceedsPlan).toBe(false)
    expect(summary.shoppingCount).toBe(10)
  })

  it('calcula el subtotal de cada compra', () => {
    const data = createInitialData()
    const byName = Object.fromEntries(data.shoppingItems.map((item) => [item.name, item]))
    expect(estimatedSubtotal(byName['Chuleta de cerdo'], 100)).toBe(540)
    expect(estimatedSubtotal(byName['Chorizo'], 100)).toBe(270)
    expect(estimatedSubtotal(byName['Cuerillo'], 100)).toBe(200)
    expect(estimatedSubtotal(byName['Papa'], 100)).toBe(152.25)
    expect(estimatedSubtotal(byName['Mote (maíz)'], 100)).toBe(75)
    expect(estimatedSubtotal(byName['Queso criollo'], 100)).toBe(144)
    expect(estimatedSubtotal(byName['Limón'], 100)).toBe(69.6)
    expect(estimatedSubtotal(byName['Platos desechables'], 100)).toBe(82.5)
    expect(estimatedSubtotal(byName['Bolsas'], 100)).toBe(22)
    expect(estimatedSubtotal(byName['Gas (garrafa)'], 100)).toBe(22.5)
    expect(orderTotal({ plates: 2, pricePerPlate: 40 })).toBe(80)
  })

  it('escala las cantidades según los platos planificados', () => {
    const data = createInitialData()
    data.settings.plannedPlates = 50
    const chuleta = data.shoppingItems[0]
    const papa = data.shoppingItems.find((item) => item.name === 'Papa')
    expect(papa).toBeDefined()
    expect(itemQuantity(chuleta, 50)).toBe(7.5)
    expect(estimatedSubtotal(chuleta, 50)).toBe(270)
    expect(itemQuantity(papa!, 50)).toBeCloseTo(0.87, 8)
    expect(estimatedSubtotal(papa!, 50)).toBe(76.13)
    const summary = summarize(data)
    expect(summary.expectedIncome).toBe(2000)
    expect(summary.purchaseCostEstimated).toBe(788.93)
    expect(summary.estimatedProfit).toBe(1211.07)
  })

  it('usa el precio real pagado sin cambiar el costo estimado', () => {
    const data = createInitialData()
    data.shoppingItems[0].actualPricePaid = 500
    data.shoppingItems[0].purchased = true
    const summary = summarize(data)
    expect(actualSubtotal(data.shoppingItems[0], 100)).toBe(500)
    expect(summary.purchaseCostEstimated).toBe(1577.85)
    expect(summary.purchaseCostActual).toBe(1537.85)
    expect(summary.estimatedProfit).toBe(2422.15)
    expect(summary.actualProfit).toBe(-1537.85)
    expect(summary.purchasedItems).toBe(1)
  })

  it('resta los otros gastos de la ganancia y del costo por plato', () => {
    const data = createInitialData()
    data.expenses.push({
      id: 'gasto-1',
      concept: 'Taxi al mercado',
      amount: 20,
      date: '2026-10-05',
      category: 'transporte',
    })
    const summary = summarize(data)
    expect(summary.otherExpenses).toBe(20)
    expect(summary.estimatedProfit).toBe(2402.15)
    expect(summary.actualProfit).toBe(-1597.85)
    expect(summary.costPerPlate).toBe(15.98)
  })

  it('cuenta platos, ingresos, entregas y pagos pendientes', () => {
    const data = createInitialData()
    data.orders.push(
      order({ id: 'a', plates: 10, paymentStatus: 'pagado', deliveryStatus: 'pendiente' }),
      order({
        id: 'b',
        plates: 3,
        paymentStatus: 'pendiente',
        deliveryStatus: 'entregado',
        paymentMethod: 'qr',
      }),
    )
    const summary = summarize(data)
    expect(summary.orderedPlates).toBe(13)
    expect(summary.remainingPlates).toBe(87)
    expect(summary.exceedsPlan).toBe(false)
    expect(summary.orderedIncome).toBe(520)
    expect(summary.collectedIncome).toBe(400)
    expect(summary.pendingPaymentAmount).toBe(120)
    expect(summary.pendingPayments).toBe(1)
    expect(summary.pendingDeliveries).toBe(1)
    expect(summary.pendingDeliveryPlates).toBe(10)
    expect(summary.actualProfit).toBe(-1057.85)
  })

  it('avisa cuando los pedidos superan los platos planificados', () => {
    const data = createInitialData()
    data.orders.push(order({ id: 'c', plates: 101, paymentStatus: 'pendiente', deliveryStatus: 'pendiente' }))
    const summary = summarize(data)
    expect(summary.exceedsPlan).toBe(true)
    expect(summary.remainingPlates).toBe(-1)
    expect(summary.orderedIncome).toBe(4040)
  })

  it('no divide por cero si no hay platos planificados', () => {
    const data = createInitialData()
    data.settings.plannedPlates = 0
    const summary = summarize(data)
    expect(summary.costPerPlate).toBe(0)
    expect(summary.expectedIncome).toBe(0)
    expect(summary.purchaseCostEstimated).toBe(0)
    expect(summary.estimatedProfit).toBe(0)
  })
})

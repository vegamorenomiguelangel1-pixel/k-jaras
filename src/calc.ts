import { roundMoney } from './format'
import type { AppData, Order, ShoppingItem } from './types'

export interface Summary {
  plannedPlates: number
  orderedPlates: number
  remainingPlates: number
  exceedsPlan: boolean
  expectedIncome: number
  orderedIncome: number
  collectedIncome: number
  pendingPaymentAmount: number
  purchaseCostEstimated: number
  purchaseCostActual: number
  otherExpenses: number
  costPerPlate: number
  estimatedProfit: number
  actualProfit: number
  pendingDeliveries: number
  pendingDeliveryPlates: number
  pendingPayments: number
  purchasedItems: number
  shoppingCount: number
}

export function itemQuantity(item: Pick<ShoppingItem, 'quantityPer100'>, plannedPlates: number): number {
  return (item.quantityPer100 * plannedPlates) / 100
}

export function quantityPer100FromScaled(quantity: number, plannedPlates: number): number {
  if (plannedPlates <= 0) return quantity
  return (quantity * 100) / plannedPlates
}

export function estimatedSubtotal(item: ShoppingItem, plannedPlates: number): number {
  return roundMoney(itemQuantity(item, plannedPlates) * item.unitPrice)
}

/** Precio real pagado es el total de la línea. Si está vacío, se usa el estimado. */
export function actualSubtotal(item: ShoppingItem, plannedPlates: number): number {
  if (item.actualPricePaid != null) return roundMoney(item.actualPricePaid)
  return estimatedSubtotal(item, plannedPlates)
}

export function orderTotal(order: Pick<Order, 'plates' | 'pricePerPlate'>): number {
  return roundMoney(order.plates * order.pricePerPlate)
}

function sum(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0))
}

export function summarize(data: AppData): Summary {
  const plannedPlates = data.settings.plannedPlates
  const pricePerPlate = data.settings.pricePerPlate
  const purchaseCostEstimated = sum(data.shoppingItems.map((item) => estimatedSubtotal(item, plannedPlates)))
  const purchaseCostActual = sum(data.shoppingItems.map((item) => actualSubtotal(item, plannedPlates)))
  const otherExpenses = sum(data.expenses.map((expense) => roundMoney(expense.amount)))
  const orderedPlates = data.orders.reduce((total, order) => total + order.plates, 0)
  const orderedIncome = sum(data.orders.map((order) => orderTotal(order)))
  const collectedIncome = sum(
    data.orders.filter((order) => order.paymentStatus === 'pagado').map((order) => orderTotal(order)),
  )
  const pendingOrders = data.orders.filter((order) => order.paymentStatus === 'pendiente')
  const pendingDeliveries = data.orders.filter((order) => order.deliveryStatus === 'pendiente')
  const expectedIncome = roundMoney(plannedPlates * pricePerPlate)
  const costBase = purchaseCostActual + otherExpenses

  return {
    plannedPlates,
    orderedPlates,
    remainingPlates: plannedPlates - orderedPlates,
    exceedsPlan: orderedPlates > plannedPlates,
    expectedIncome,
    orderedIncome,
    collectedIncome,
    pendingPaymentAmount: sum(pendingOrders.map((order) => orderTotal(order))),
    purchaseCostEstimated,
    purchaseCostActual,
    otherExpenses,
    costPerPlate: plannedPlates > 0 ? roundMoney(costBase / plannedPlates) : 0,
    estimatedProfit: roundMoney(expectedIncome - purchaseCostEstimated - otherExpenses),
    actualProfit: roundMoney(orderedIncome - purchaseCostActual - otherExpenses),
    pendingDeliveries: pendingDeliveries.length,
    pendingDeliveryPlates: pendingDeliveries.reduce((total, order) => total + order.plates, 0),
    pendingPayments: pendingOrders.length,
    purchasedItems: data.shoppingItems.filter((item) => item.purchased).length,
    shoppingCount: data.shoppingItems.length,
  }
}

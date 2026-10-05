import type {
  AppData,
  DeliveryStatus,
  Expense,
  ExpenseCategory,
  Order,
  PaymentMethod,
  PaymentStatus,
  Settings,
  ShoppingItem,
} from './types'
import { CATEGORIES } from './types'

const PREFIX = 'kjaras.v1'

export interface CacheEnvelope {
  clientUpdatedAt: number
  data: AppData
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function category(value: unknown): ExpenseCategory {
  return CATEGORIES.includes(value as ExpenseCategory) ? (value as ExpenseCategory) : 'otro'
}

function delivery(value: unknown): DeliveryStatus {
  return value === 'entregado' ? 'entregado' : 'pendiente'
}

function payment(value: unknown): PaymentStatus {
  return value === 'pagado' ? 'pagado' : 'pendiente'
}

function method(value: unknown): PaymentMethod {
  return value === 'qr' ? 'qr' : 'efectivo'
}

function parseSettings(value: unknown): Settings | null {
  if (!isRecord(value)) return null
  const pricePerPlate = number(value.pricePerPlate)
  const plannedPlates = number(value.plannedPlates)
  const saleDate = text(value.saleDate)
  if (pricePerPlate == null || plannedPlates == null || pricePerPlate < 0 || plannedPlates < 0 || !saleDate) return null
  return { pricePerPlate, plannedPlates, saleDate }
}

function parseShoppingItem(value: unknown): ShoppingItem | null {
  if (!isRecord(value)) return null
  const id = text(value.id)
  const name = text(value.name)
  const quantityPer100 = number(value.quantityPer100)
  const unitPrice = number(value.unitPrice)
  if (!id || !name || quantityPer100 == null || unitPrice == null || quantityPer100 < 0 || unitPrice < 0) return null
  const actual = value.actualPricePaid
  const actualPricePaid = actual == null ? null : number(actual)
  if (actual != null && (actualPricePaid == null || actualPricePaid < 0)) return null
  return {
    id,
    name,
    quantityPer100,
    unit: text(value.unit) || 'unid',
    unitPrice,
    purchased: value.purchased === true,
    actualPricePaid,
  }
}

function parseExpense(value: unknown): Expense | null {
  if (!isRecord(value)) return null
  const id = text(value.id)
  const concept = text(value.concept)
  const amount = number(value.amount)
  if (!id || !concept || amount == null || amount < 0) return null
  return {
    id,
    concept,
    amount,
    date: text(value.date),
    category: category(value.category),
  }
}

function parseOrder(value: unknown): Order | null {
  if (!isRecord(value)) return null
  const id = text(value.id)
  const customerName = text(value.customerName)
  const plates = number(value.plates)
  const pricePerPlate = number(value.pricePerPlate)
  if (!id || !customerName || plates == null || pricePerPlate == null || plates < 0 || pricePerPlate < 0) return null
  return {
    id,
    customerName,
    phone: text(value.phone),
    address: text(value.address),
    plates,
    pricePerPlate,
    deliveryTime: text(value.deliveryTime),
    deliveryStatus: delivery(value.deliveryStatus),
    paymentStatus: payment(value.paymentStatus),
    paymentMethod: method(value.paymentMethod),
    notes: text(value.notes),
    createdAt: text(value.createdAt) || new Date(0).toISOString(),
  }
}

export function parseAppData(value: unknown): AppData | null {
  if (!isRecord(value)) return null
  if (value.version !== 1) return null
  const settings = parseSettings(value.settings)
  if (!settings || !Array.isArray(value.shoppingItems) || !Array.isArray(value.expenses) || !Array.isArray(value.orders)) {
    return null
  }
  const shoppingItems: ShoppingItem[] = []
  for (const item of value.shoppingItems) {
    const parsed = parseShoppingItem(item)
    if (!parsed) return null
    shoppingItems.push(parsed)
  }
  const expenses: Expense[] = []
  for (const expense of value.expenses) {
    const parsed = parseExpense(expense)
    if (!parsed) return null
    expenses.push(parsed)
  }
  const orders: Order[] = []
  for (const order of value.orders) {
    const parsed = parseOrder(order)
    if (!parsed) return null
    orders.push(parsed)
  }
  return { version: 1, settings, shoppingItems, expenses, orders }
}

function storageKey(scope: string): string {
  return `${PREFIX}.${scope}`
}

export function loadEnvelope(scope: string): CacheEnvelope | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null
    const data = parseAppData(parsed.data ?? parsed)
    if (!data) return null
    const clientUpdatedAt = number(parsed.clientUpdatedAt) ?? 0
    return { clientUpdatedAt, data }
  } catch {
    return null
  }
}

export function saveEnvelope(scope: string, envelope: CacheEnvelope): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(envelope))
  } catch {
    // El navegador puede rechazar la escritura si el almacenamiento está lleno.
  }
}

export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

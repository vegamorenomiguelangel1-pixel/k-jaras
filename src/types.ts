export type ExpenseCategory = 'transporte' | 'condimentos' | 'aceite' | 'mano_de_obra' | 'otro'

export type DeliveryStatus = 'pendiente' | 'entregado'

export type PaymentStatus = 'pendiente' | 'pagado'

export type PaymentMethod = 'efectivo' | 'qr'

export interface Settings {
  pricePerPlate: number
  plannedPlates: number
  saleDate: string
}

export interface ShoppingItem {
  id: string
  name: string
  quantityPer100: number
  unit: string
  unitPrice: number
  purchased: boolean
  actualPricePaid: number | null
}

export interface Expense {
  id: string
  concept: string
  amount: number
  date: string
  category: ExpenseCategory
}

export interface Order {
  id: string
  customerName: string
  phone: string
  address: string
  plates: number
  pricePerPlate: number
  deliveryTime: string
  deliveryStatus: DeliveryStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  notes: string
  createdAt: string
}

export interface AppData {
  version: 1
  settings: Settings
  shoppingItems: ShoppingItem[]
  expenses: Expense[]
  orders: Order[]
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  transporte: 'Transporte',
  condimentos: 'Condimentos',
  aceite: 'Aceite',
  mano_de_obra: 'Mano de obra',
  otro: 'Otro',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[]

import { orderTotal } from './calc'
import { roundMoney } from './format'
import type { Order } from './types'

function cell(value: string | number): string {
  let text = String(value ?? '')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  if (/[;"\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function num(value: number): string {
  return roundMoney(value).toFixed(2).replace('.', ',')
}

export function ordersToCsv(orders: Order[]): string {
  const header = [
    'Nombre',
    'Teléfono',
    'Dirección',
    'Platos',
    'Precio por plato',
    'Total',
    'Hora de entrega',
    'Estado de entrega',
    'Estado de pago',
    'Método de pago',
    'Notas',
  ]
  const rows = orders.map((order) => [
    order.customerName,
    order.phone,
    order.address,
    num(order.plates),
    num(order.pricePerPlate),
    num(orderTotal(order)),
    order.deliveryTime,
    order.deliveryStatus,
    order.paymentStatus,
    order.paymentMethod === 'qr' ? 'QR' : 'Efectivo',
    order.notes,
  ])
  const plates = orders.reduce((total, order) => total + order.plates, 0)
  const money = orders.reduce((total, order) => total + orderTotal(order), 0)
  rows.push(['TOTAL', '', '', num(plates), '', num(money), '', '', '', '', ''])
  const body = [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')
  return `\uFEFF${body}`
}

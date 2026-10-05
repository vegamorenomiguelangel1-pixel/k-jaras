const moneyFormat = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const quantityFormat = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const dateFormat = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const shortDateFormat = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
})

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function formatMoney(value: number): string {
  return moneyFormat.format(roundMoney(value))
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return quantityFormat.format(value)
}

export function parseLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function formatLongDate(iso: string): string {
  const date = parseLocalDate(iso)
  if (!date) return iso
  return dateFormat.format(date)
}

export function formatShortDate(iso: string): string {
  const date = parseLocalDate(iso)
  if (!date) return iso
  return shortDateFormat.format(date)
}

export function todayISO(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function parseDecimal(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

export function decimalToInput(value: number): string {
  if (!Number.isFinite(value)) return ''
  return String(value).replace('.', ',')
}

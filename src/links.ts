export function whatsappHref(phone: string, customerName: string): string | null {
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits.startsWith('591')) {
    if (digits.startsWith('0')) digits = digits.slice(1)
    digits = `591${digits}`
  }
  if (digits.length < 11) return null
  const name = customerName.trim() || 'hola'
  const text = encodeURIComponent(`Hola ${name}, te escribo por tu pedido de k'jaras.`)
  return `https://wa.me/${digits}?text=${text}`
}

export function mapsHref(address: string): string | null {
  const query = address.trim()
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

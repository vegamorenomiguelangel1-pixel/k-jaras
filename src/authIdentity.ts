const EMAIL_DOMAIN = 'kjaras.app'
const MAX_SLUG = 40
const MAX_NAME = 80

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME)
}

export function slugFromName(name: string): string {
  return cleanName(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '')
}

export function pinError(pin: string): string | null {
  if (!pin) return 'Escribe el código.'
  if (!/^\d+$/.test(pin)) return 'El código solo puede tener números.'
  if (pin.length < 6) return 'El código debe tener al menos 6 números.'
  if (pin.length > 12) return 'El código puede tener hasta 12 números.'
  return null
}

export function memberEmail(local: string): string {
  return `${local}@${EMAIL_DOMAIN}`
}

/** El nombre base y, si ese correo ya existe en Auth, base-2 … base-20. */
export function localCandidates(base: string): string[] {
  const extras = Array.from({ length: 19 }, (_, index) => `${base}-${index + 2}`)
  return [base, ...extras]
}

export interface Identity {
  nombre: string
  slug: string
  pin: string
}

export function identityFrom(nombre: string, pin: string): Identity {
  const clean = cleanName(nombre)
  const slug = slugFromName(clean)
  if (!slug) throw new Error('Escribe un nombre con letras o números.')
  const message = pinError(pin)
  if (message) throw new Error(message)
  return { nombre: clean, slug, pin }
}

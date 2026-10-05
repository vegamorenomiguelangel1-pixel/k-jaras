import { useState, type FormEvent } from 'react'
import { friendlyError } from '../firebase'
import { createAdmin, signInWithName } from '../team'
import { BowlIcon } from './ui'

export function AuthScreen({
  notice,
  setup,
  blocked,
}: {
  notice: string | null
  setup: boolean
  blocked: boolean
}) {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (blocked) {
      setError(notice ?? 'No se pudo revisar el equipo. Vuelve a cargar la página.')
      return
    }
    setBusy(true)
    try {
      if (setup) await createAdmin(nombre, codigo)
      else await signInWithName(nombre, codigo)
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setBusy(false)
    }
  }

  const message = error ?? notice

  return (
    <main className="auth">
      <div className="auth-card">
        <BowlIcon />
        <p className="eyebrow">Venta de Miguel Ángel</p>
        <h1>K'jaras</h1>
        <p className="lede">
          {setup
            ? 'Primera vez: crea al administrador del equipo. Elige un nombre y un código de al menos 6 números.'
            : 'Entra con tu nombre y tu código.'}
        </p>
        {message ? <p className="banner bad">{message}</p> : null}
        <form onSubmit={(event) => void onSubmit(event)}>
          <label className="field">
            <span>Nombre</span>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="words"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Código</span>
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete={setup ? 'new-password' : 'current-password'}
              pattern="[0-9]*"
              minLength={6}
              maxLength={12}
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.replace(/\D/g, '').slice(0, 12))}
              required
            />
            <small className="hint">Mínimo 6 números.</small>
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Espera…' : setup ? 'Crear administrador' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}

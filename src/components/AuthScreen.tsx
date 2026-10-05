import { useState, type FormEvent } from 'react'
import {
  authErrorMessage,
  sendReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../firebase'
import { BowlIcon } from './ui'

type Mode = 'login' | 'signup' | 'reset'

export function AuthScreen({ notice }: { notice: string | null }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onGoogle() {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await signInWithGoogle()
    } catch (reason) {
      setError(authErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.includes('@')) {
      setError('Escribe un correo válido.')
      return
    }
    if (mode !== 'reset' && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') await signInWithEmail(email, password)
      else if (mode === 'signup') await signUpWithEmail(email, password)
      else {
        await sendReset(email)
        setInfo('Te enviamos un correo para restablecer la contraseña.')
        setMode('login')
      }
    } catch (reason) {
      setError(authErrorMessage(reason))
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
        <p className="lede">Entra con tu cuenta para ver compras, gastos y pedidos en el celular y en la computadora.</p>
        {message ? <p className="banner bad">{message}</p> : null}
        {info ? <p className="banner good">{info}</p> : null}
        <button type="button" className="btn google" onClick={() => void onGoogle()} disabled={busy}>
          <GoogleMark />
          Continuar con Google
        </button>
        <p className="divider">o con correo</p>
        <form onSubmit={(event) => void onSubmit(event)}>
          <label className="field">
            <span>Correo</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {mode !== 'reset' ? (
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
              />
            </label>
          ) : null}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Espera…' : mode === 'signup' ? 'Crear cuenta' : mode === 'reset' ? 'Enviar correo' : 'Entrar'}
          </button>
        </form>
        <div className="auth-links">
          {mode === 'login' ? (
            <>
              <button type="button" className="text-btn" onClick={() => setMode('reset')}>
                Olvidé mi contraseña
              </button>
              <button type="button" className="text-btn" onClick={() => setMode('signup')}>
                Crear cuenta
              </button>
            </>
          ) : (
            <button type="button" className="text-btn" onClick={() => setMode('login')}>
              Ya tengo cuenta
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8A6.4 6.4 0 1 1 12 5.6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.7 3.1 14.6 2 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.2-.2-1.7H12Z" />
    </svg>
  )
}

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { formatQuantity } from '../format'
import type { Summary } from '../calc'

export function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="loading">
      <div className="brand-mark" aria-hidden="true">
        <BowlIcon />
      </div>
      <p>{label}</p>
    </div>
  )
}

export function BowlIcon() {
  return (
    <svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#8c3416" />
      <ellipse cx="32" cy="40" rx="20" ry="11" fill="#f6e2c4" />
      <ellipse cx="32" cy="36" rx="15" ry="8" fill="#e0a04a" />
      <path
        d="M16 38c1.5 10 8 16 16 16s14.5-6 16-16"
        fill="none"
        stroke="#f8efe4"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const titleId = useId()
  closeRef.current = onClose

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const field = ref.current?.querySelector('input, select, textarea')
    if (field instanceof HTMLElement) field.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small className="hint">{hint}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  )
}

export function PlanAlert({ summary }: { summary: Summary }) {
  if (!summary.exceedsPlan) return null
  const extra = summary.orderedPlates - summary.plannedPlates
  return (
    <p className="banner warn" role="alert">
      Los pedidos suman {formatQuantity(summary.orderedPlates)} platos y el plan es{' '}
      {formatQuantity(summary.plannedPlates)}. Hay {formatQuantity(extra)} de más.
    </p>
  )
}

interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  tone: 'danger' | 'primary'
  action: () => void
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)

  function ask(options: Omit<ConfirmState, 'tone'> & { tone?: 'danger' | 'primary' }) {
    setState({ tone: 'danger', ...options })
  }

  const dialog = state ? (
    <Modal title={state.title} onClose={() => setState(null)}>
      <p className="confirm-copy">{state.message}</p>
      <div className="row-actions">
        <button type="button" className="btn ghost" onClick={() => setState(null)}>
          Cancelar
        </button>
        <button
          type="button"
          className={state.tone === 'primary' ? 'btn primary' : 'btn danger'}
          onClick={() => {
            state.action()
            setState(null)
          }}
        >
          {state.confirmLabel}
        </button>
      </div>
    </Modal>
  ) : null

  return { ask, dialog }
}

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 10.5V20h11v-9.5" />
    </svg>
  )
}

export function IconBag() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
    </svg>
  )
}

export function IconCoin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
      <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </svg>
  )
}

export function IconList() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7h11M8 12h11M8 17h11" />
      <circle cx="4.5" cy="7" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="17" r="1" />
    </svg>
  )
}

export function IconGear() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.8l1.6 1.6M17.6 15.6l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.2l1.6-1.6M17.6 8.4l1.6-1.6" />
    </svg>
  )
}

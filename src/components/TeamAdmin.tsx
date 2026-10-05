import { useEffect, useState, type FormEvent } from 'react'
import { friendlyError, getServices } from '../firebase'
import { addMember, removeMember, watchMembers, type TeamMember } from '../team'
import { useConfirm } from './ui'

function roleLabel(member: TeamMember, userId: string): string {
  if (member.uid === userId && member.role === 'admin') return 'Administrador'
  if (member.role === 'admin') return 'Sin acceso'
  return 'Equipo'
}

export function TeamAdmin({ userId }: { userId: string }) {
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { ask, dialog } = useConfirm()

  useEffect(() => {
    const { db } = getServices()
    return watchMembers(
      db,
      setMembers,
      (reason) => setError(friendlyError(reason)),
    )
  }, [])

  async function onAdd(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      await addMember(nombre, codigo)
      setNombre('')
      setCodigo('')
      setMessage('Persona agregada. Ya puede entrar con ese nombre y código.')
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setBusy(false)
    }
  }

  function onRemove(member: TeamMember) {
    ask({
      title: `Quitar a ${member.nombre}`,
      message: 'Dejará de entrar con su código. Para darle otro código, vuelve a agregar a esa persona con el mismo nombre.',
      confirmLabel: 'Quitar',
      action: () => {
        void (async () => {
          setError(null)
          setMessage(null)
          setBusy(true)
          try {
            await removeMember(member)
            setMessage(`${member.nombre} ya no entra. Si vuelves a agregar a esa persona, elige el código nuevo.`)
          } catch (reason) {
            setError(friendlyError(reason))
          } finally {
            setBusy(false)
          }
        })()
      },
    })
  }

  return (
    <section className="stack">
      <h2>Equipo</h2>
      <p className="note">
        Agrega a cada persona con un nombre y un código. Para cambiar el código, quita a la persona y vuelve a
        agregarla. Tú sigues dentro mientras das de alta a alguien.
      </p>
      {message ? <p className="banner good">{message}</p> : null}
      {error ? <p className="banner bad">{error}</p> : null}
      {members == null ? <p className="note">Cargando el equipo…</p> : null}
      {members != null && members.length === 0 ? <p className="note">Todavía no hay nadie en la lista.</p> : null}
      {members != null && members.length > 0 ? (
        <ul className="list">
          {members.map((member) => (
            <li key={member.uid} className="card member-row">
              <div>
                <strong>{member.nombre}</strong>
                <p>{roleLabel(member, userId)}</p>
              </div>
              {member.uid === userId ? null : (
                <button type="button" className="btn small danger" disabled={busy} onClick={() => onRemove(member)}>
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <form className="card plain block" onSubmit={(event) => void onAdd(event)}>
        <label className="field">
          <span>Nombre</span>
          <input
            value={nombre}
            autoComplete="off"
            onChange={(event) => setNombre(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Código</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
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
          {busy ? 'Espera…' : 'Agregar al equipo'}
        </button>
      </form>
      {dialog}
    </section>
  )
}

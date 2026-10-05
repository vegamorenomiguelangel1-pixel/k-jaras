import { useEffect, useRef, useState } from 'react'
import { ordersToCsv } from '../csv'
import { downloadText } from '../download'
import { decimalToInput, formatQuantity, parseDecimal, todayISO } from '../format'
import { parseAppData } from '../storage'
import { useStore } from '../store'
import type { Settings as SettingsData } from '../types'
import { TeamAdmin } from './TeamAdmin'
import { Field, useConfirm } from './ui'

export function Settings() {
  const { data, mode, memberName, esAdmin, userId, setSettings, importData, resetData, signOutUser } = useStore()
  const [price, setPrice] = useState(decimalToInput(data.settings.pricePerPlate))
  const [plates, setPlates] = useState(String(data.settings.plannedPlates))
  const [date, setDate] = useState(data.settings.saleDate)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { ask, dialog } = useConfirm()

  useEffect(() => {
    if (dirty) return
    setPrice(decimalToInput(data.settings.pricePerPlate))
    setPlates(String(data.settings.plannedPlates))
    setDate(data.settings.saleDate)
  }, [data.settings, dirty])

  function readForm(): SettingsData | null {
    const pricePerPlate = parseDecimal(price)
    const plannedPlates = parseDecimal(plates)
    if (pricePerPlate == null || pricePerPlate < 0) {
      setError('El precio no puede ser negativo.')
      return null
    }
    if (plannedPlates == null || plannedPlates < 1 || !Number.isInteger(plannedPlates)) {
      setError('Los platos planificados deben ser un entero, al menos 1.')
      return null
    }
    if (!date) {
      setError('Elige la fecha de la venta.')
      return null
    }
    setError(null)
    return { pricePerPlate, plannedPlates, saleDate: date }
  }

  function save() {
    const next = readForm()
    if (!next) return
    const apply = () => {
      setSettings(next)
      setDirty(false)
      setMessage('Configuración guardada.')
    }
    if (next.plannedPlates !== data.settings.plannedPlates) {
      ask({
        title: 'Cambiar platos planificados',
        message: `Las cantidades de la lista se calcularán para ${formatQuantity(next.plannedPlates)} platos. Cada ítem sigue guardando la medida por cada 100.`,
        confirmLabel: 'Guardar',
        tone: 'primary',
        action: apply,
      })
      return
    }
    apply()
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setMessage(null)
    try {
      const parsed = parseAppData(JSON.parse(await file.text()) as unknown)
      if (!parsed) {
        setError('Ese archivo no es un respaldo de K\'jaras.')
        return
      }
      ask({
        title: 'Reemplazar datos',
        message: 'Esto sustituye la lista, los gastos, los pedidos y la configuración por el archivo.',
        confirmLabel: 'Reemplazar',
        action: () => {
          importData(parsed)
          setDirty(false)
          setError(null)
          setMessage('Respaldo importado.')
        },
      })
    } catch {
      setError('No se pudo leer el archivo. Tiene que ser un JSON.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <h1>Configuración</h1>
      <p className="lede">Precio, cantidad y fecha de esta venta. También el respaldo de tus datos.</p>
      {message ? <p className="banner good">{message}</p> : null}
      {error ? <p className="banner bad">{error}</p> : null}
      <form
        className="card plain block"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <Field label="Precio por plato (Bs)">
          <input
            inputMode="decimal"
            value={price}
            onChange={(event) => {
              setDirty(true)
              setPrice(event.target.value)
            }}
          />
        </Field>
        <Field
          label="Platos planificados"
          hint="La lista de compras se recalcula con este número. La base de cada ítem es la cantidad para 100 platos."
        >
          <input
            inputMode="numeric"
            value={plates}
            onChange={(event) => {
              setDirty(true)
              setPlates(event.target.value)
            }}
          />
        </Field>
        <Field label="Fecha de la venta">
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDirty(true)
              setDate(event.target.value)
            }}
          />
        </Field>
        <button type="submit" className="btn primary">
          Guardar configuración
        </button>
      </form>
      <section className="stack">
        <h2>Respaldo</h2>
        <button
          type="button"
          className="btn ghost"
          onClick={() =>
            downloadText(
              `kjaras-respaldo-${todayISO()}.json`,
              JSON.stringify(data, null, 2),
              'application/json',
            )
          }
        >
          Exportar JSON
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          Importar JSON
        </button>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <button
          type="button"
          className="btn ghost"
          onClick={() =>
            downloadText(`kjaras-pedidos-${todayISO()}.csv`, ordersToCsv(data.orders), 'text/csv;charset=utf-8')
          }
        >
          Exportar pedidos a CSV
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={() =>
            ask({
              title: 'Volver a empezar',
              message:
                'Esto borra pedidos, gastos y cambios de la lista, y deja de nuevo 100 platos para el viernes 9 de octubre de 2026 a Bs 40.',
              confirmLabel: 'Restablecer',
              action: () => {
                resetData()
                setDirty(false)
                setMessage('Datos restablecidos.')
              },
            })
          }
        >
          Restablecer datos
        </button>
      </section>
      {mode === 'cloud' && esAdmin && userId ? <TeamAdmin userId={userId} /> : null}
      <section className="stack">
        <h2>Dónde están los datos</h2>
        {mode === 'cloud' ? (
          <>
            <p>
              Entraste como <strong>{memberName}</strong>
              {esAdmin ? ' (administrador)' : ''}. La venta está en la nube, compartida con el equipo, y también queda
              una copia en este teléfono por si no hay señal.
            </p>
            {esAdmin ? null : (
              <p className="note">Si necesitas otro código, pídeselo al administrador.</p>
            )}
            <button type="button" className="btn ghost" onClick={() => void signOutUser()}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <p>
            Solo en este teléfono, porque no hay configuración de Firebase. Si borras los datos del navegador, se
            pierden. Exporta un JSON de vez en cuando. Cuando completes el archivo <code>.env.local</code>, la app
            pedirá el nombre y el código, y subirá este respaldo la primera vez.
          </p>
        )}
      </section>
      {dialog}
    </>
  )
}

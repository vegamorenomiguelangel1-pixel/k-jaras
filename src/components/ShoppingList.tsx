import { useState } from 'react'
import { actualSubtotal, estimatedSubtotal, itemQuantity, quantityPer100FromScaled } from '../calc'
import { decimalToInput, formatMoney, formatQuantity, parseDecimal } from '../format'
import { newId } from '../storage'
import { useStore } from '../store'
import type { ShoppingItem } from '../types'
import { Field, Modal, useConfirm } from './ui'

interface Draft {
  id: string
  name: string
  quantity: string
  unit: string
  unitPrice: string
  actualPrice: string
  purchased: boolean
}

const emptyDraft = (): Draft => ({
  id: newId(),
  name: '',
  quantity: '',
  unit: 'kg',
  unitPrice: '',
  actualPrice: '',
  purchased: false,
})

export function ShoppingList() {
  const { data, summary, saveShoppingItem, deleteShoppingItem } = useStore()
  const planned = data.settings.plannedPlates
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { ask, dialog } = useConfirm()

  function openEdit(item: ShoppingItem) {
    setErrors({})
    setDraft({
      id: item.id,
      name: item.name,
      quantity: decimalToInput(itemQuantity(item, planned)),
      unit: item.unit,
      unitPrice: decimalToInput(item.unitPrice),
      actualPrice: item.actualPricePaid == null ? '' : decimalToInput(item.actualPricePaid),
      purchased: item.purchased,
    })
  }

  function save() {
    if (!draft) return
    const quantity = parseDecimal(draft.quantity)
    const unitPrice = parseDecimal(draft.unitPrice)
    const actualText = draft.actualPrice.trim()
    const actualPrice = actualText ? parseDecimal(actualText) : null
    const nextErrors: Record<string, string> = {}
    if (!draft.name.trim()) nextErrors.name = 'Escribe el nombre.'
    if (!draft.unit.trim()) nextErrors.unit = 'Escribe la unidad.'
    if (quantity == null || quantity <= 0) nextErrors.quantity = 'La cantidad debe ser mayor a cero.'
    if (unitPrice == null || unitPrice < 0) nextErrors.unitPrice = 'El precio no puede ser negativo.'
    if (actualText && (actualPrice == null || actualPrice < 0)) nextErrors.actualPrice = 'El monto pagado no es válido.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || quantity == null || unitPrice == null) return
    saveShoppingItem({
      id: draft.id,
      name: draft.name.trim(),
      quantityPer100: quantityPer100FromScaled(quantity, planned),
      unit: draft.unit.trim(),
      unitPrice,
      purchased: draft.purchased,
      actualPricePaid: actualPrice,
    })
    setDraft(null)
  }

  const liveQty = draft ? parseDecimal(draft.quantity) : null
  const per100 = liveQty != null && planned > 0 ? quantityPer100FromScaled(liveQty, planned) : null

  return (
    <>
      <h1>Lista de compras</h1>
      <p className="lede">
        Cantidades para {formatQuantity(planned)} platos. Cada ítem guarda la medida por cada 100 y se ajusta si
        cambias el plan.
      </p>
      <div className="totals">
        <div>
          <strong>{formatMoney(summary.purchaseCostEstimated)}</strong>
          <span>estimado</span>
        </div>
        <div>
          <strong>{formatMoney(summary.purchaseCostActual)}</strong>
          <span>real</span>
        </div>
        <div>
          <strong>
            {summary.purchasedItems}/{summary.shoppingCount}
          </strong>
          <span>comprados</span>
        </div>
      </div>
      <div className="progress" aria-hidden="true">
        <span
          style={{
            width: `${summary.shoppingCount ? (summary.purchasedItems / summary.shoppingCount) * 100 : 0}%`,
          }}
        />
      </div>
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          setErrors({})
          setDraft(emptyDraft())
        }}
      >
        Agregar ítem
      </button>
      <ul className="list">
        {data.shoppingItems.map((item) => {
          const quantity = itemQuantity(item, planned)
          const estimated = estimatedSubtotal(item, planned)
          const actual = actualSubtotal(item, planned)
          return (
            <li key={item.id} className={item.purchased ? 'card done' : 'card'}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={item.purchased}
                  onChange={() => saveShoppingItem({ ...item, purchased: !item.purchased })}
                />
                <span className="sr-only">{item.purchased ? 'Marcar como pendiente' : 'Marcar como comprado'}</span>
              </label>
              <div className="card-body">
                <div className="card-top">
                  <h3>{item.name}</h3>
                  <strong>{formatMoney(actual)}</strong>
                </div>
                <p>
                  {formatQuantity(quantity)} {item.unit} × {formatMoney(item.unitPrice)}
                  {item.actualPricePaid != null && item.actualPricePaid !== estimated
                    ? ` · estimado ${formatMoney(estimated)}`
                    : ''}
                </p>
                <div className="row-actions">
                  <button type="button" className="btn small ghost" onClick={() => openEdit(item)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() =>
                      ask({
                        title: 'Quitar de la lista',
                        message: `¿Eliminar ${item.name}?`,
                        confirmLabel: 'Eliminar',
                        action: () => deleteShoppingItem(item.id),
                      })
                    }
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {data.shoppingItems.length === 0 ? <p className="empty">La lista está vacía. Agrega el primer ítem.</p> : null}
      {draft ? (
        <Modal title={data.shoppingItems.some((item) => item.id === draft.id) ? 'Editar ítem' : 'Nuevo ítem'} onClose={() => setDraft(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <Field label="Nombre" error={errors.name}>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={80} />
            </Field>
            <div className="split">
              <Field
                label={`Cantidad para ${formatQuantity(planned)} platos`}
                error={errors.quantity}
                hint={per100 != null ? `Equivale a ${formatQuantity(per100)} ${draft.unit || ''} por cada 100 platos.` : undefined}
              >
                <input
                  inputMode="decimal"
                  value={draft.quantity}
                  onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
                />
              </Field>
              <Field label="Unidad" error={errors.unit}>
                <input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} maxLength={20} />
              </Field>
            </div>
            <Field label="Precio unitario (Bs)" error={errors.unitPrice}>
              <input
                inputMode="decimal"
                value={draft.unitPrice}
                onChange={(event) => setDraft({ ...draft, unitPrice: event.target.value })}
              />
            </Field>
            <Field
              label="Precio real pagado (Bs, opcional)"
              error={errors.actualPrice}
              hint="Total de la línea, no el precio por unidad. Si lo dejas vacío, se usa el estimado. Este monto no cambia al mover los platos."
            >
              <input
                inputMode="decimal"
                value={draft.actualPrice}
                onChange={(event) => setDraft({ ...draft, actualPrice: event.target.value })}
              />
            </Field>
            <label className="check-line">
              <input
                type="checkbox"
                checked={draft.purchased}
                onChange={(event) => setDraft({ ...draft, purchased: event.target.checked })}
              />
              Comprado
            </label>
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => setDraft(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {dialog}
    </>
  )
}

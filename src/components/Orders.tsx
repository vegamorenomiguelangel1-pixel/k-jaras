import { useMemo, useState } from 'react'
import { orderTotal } from '../calc'
import { decimalToInput, formatMoney, formatQuantity, parseDecimal } from '../format'
import { mapsHref, whatsappHref } from '../links'
import { foldText, newId } from '../storage'
import { useStore } from '../store'
import type { DeliveryStatus, Order, PaymentMethod, PaymentStatus } from '../types'
import { Field, Modal, PlanAlert, useConfirm } from './ui'

type DeliveryFilter = 'todas' | DeliveryStatus
type PaymentFilter = 'todos' | PaymentStatus

interface Draft {
  id: string
  customerName: string
  phone: string
  address: string
  plates: string
  pricePerPlate: string
  deliveryTime: string
  deliveryStatus: DeliveryStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  notes: string
  createdAt: string
}

export function Orders() {
  const { data, summary, saveOrder, deleteOrder } = useStore()
  const [query, setQuery] = useState('')
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('todas')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('todos')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { ask, dialog } = useConfirm()

  const visible = useMemo(() => {
    const needle = foldText(query.trim())
    return data.orders.filter((order) => {
      if (deliveryFilter !== 'todas' && order.deliveryStatus !== deliveryFilter) return false
      if (paymentFilter !== 'todos' && order.paymentStatus !== paymentFilter) return false
      if (!needle) return true
      return foldText([order.customerName, order.phone, order.address, order.notes].join(' ')).includes(needle)
    })
  }, [data.orders, deliveryFilter, paymentFilter, query])

  const visiblePlates = visible.reduce((total, order) => total + order.plates, 0)
  const visibleMoney = visible.reduce((total, order) => total + orderTotal(order), 0)
  const visiblePaid = visible
    .filter((order) => order.paymentStatus === 'pagado')
    .reduce((total, order) => total + orderTotal(order), 0)

  function open(order?: Order) {
    setError(null)
    setDraft(
      order
        ? {
            id: order.id,
            customerName: order.customerName,
            phone: order.phone,
            address: order.address,
            plates: String(order.plates),
            pricePerPlate: decimalToInput(order.pricePerPlate),
            deliveryTime: order.deliveryTime,
            deliveryStatus: order.deliveryStatus,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            notes: order.notes,
            createdAt: order.createdAt,
          }
        : {
            id: newId(),
            customerName: '',
            phone: '',
            address: '',
            plates: '1',
            pricePerPlate: decimalToInput(data.settings.pricePerPlate),
            deliveryTime: '12:00',
            deliveryStatus: 'pendiente',
            paymentStatus: 'pendiente',
            paymentMethod: 'efectivo',
            notes: '',
            createdAt: new Date().toISOString(),
          },
    )
  }

  function save() {
    if (!draft) return
    const plates = parseDecimal(draft.plates)
    const price = parseDecimal(draft.pricePerPlate)
    if (!draft.customerName.trim()) {
      setError('Escribe el nombre.')
      return
    }
    if (plates == null || plates < 1 || !Number.isInteger(plates)) {
      setError('Los platos deben ser un número entero, al menos 1.')
      return
    }
    if (price == null || price < 0) {
      setError('El precio no puede ser negativo.')
      return
    }
    saveOrder({
      id: draft.id,
      customerName: draft.customerName.trim(),
      phone: draft.phone.trim(),
      address: draft.address.trim(),
      plates,
      pricePerPlate: price,
      deliveryTime: draft.deliveryTime,
      deliveryStatus: draft.deliveryStatus,
      paymentStatus: draft.paymentStatus,
      paymentMethod: draft.paymentMethod,
      notes: draft.notes.trim(),
      createdAt: draft.createdAt,
    })
    setDraft(null)
  }

  const draftPlates = draft ? parseDecimal(draft.plates) : null
  const draftPrice = draft ? parseDecimal(draft.pricePerPlate) : null
  const draftTotal = draftPlates != null && draftPrice != null ? draftPlates * draftPrice : null
  const others = data.orders.reduce((total, order) => total + (draft && order.id === draft.id ? 0 : order.plates), 0)
  const projected = others + (draftPlates != null && draftPlates > 0 ? draftPlates : 0)

  return (
    <>
      <h1>Pedidos</h1>
      <p className="lede">Anota quién encargó, a qué hora lo llevas y si ya pagó.</p>
      <PlanAlert summary={summary} />
      <label className="field">
        <span className="sr-only">Buscar</span>
        <input
          className="search"
          type="search"
          placeholder="Buscar nombre, teléfono o dirección"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="filter-block">
        <span>Entrega</span>
        <div className="chips" role="group" aria-label="Filtrar por entrega">
          <FilterChip current={deliveryFilter} value="todas" onSelect={setDeliveryFilter} label="Todas" />
          <FilterChip current={deliveryFilter} value="pendiente" onSelect={setDeliveryFilter} label="Pendientes" />
          <FilterChip current={deliveryFilter} value="entregado" onSelect={setDeliveryFilter} label="Entregadas" />
        </div>
      </div>
      <div className="filter-block">
        <span>Pago</span>
        <div className="chips" role="group" aria-label="Filtrar por pago">
          <FilterChip current={paymentFilter} value="todos" onSelect={setPaymentFilter} label="Todos" />
          <FilterChip current={paymentFilter} value="pendiente" onSelect={setPaymentFilter} label="Por cobrar" />
          <FilterChip current={paymentFilter} value="pagado" onSelect={setPaymentFilter} label="Pagados" />
        </div>
      </div>
      <div className="totals">
        <div>
          <strong>{formatQuantity(visiblePlates)}</strong>
          <span>platos</span>
        </div>
        <div>
          <strong>{formatMoney(visibleMoney)}</strong>
          <span>total</span>
        </div>
        <div>
          <strong>{formatMoney(visiblePaid)}</strong>
          <span>cobrado</span>
        </div>
        <div>
          <strong>{formatMoney(visibleMoney - visiblePaid)}</strong>
          <span>por cobrar</span>
        </div>
      </div>
      <button type="button" className="btn primary" onClick={() => open()}>
        Nuevo pedido
      </button>
      {data.orders.length === 0 ? (
        <p className="empty">Todavía no hay pedidos. Cuando alguien encargue, anótalo aquí.</p>
      ) : visible.length === 0 ? (
        <p className="empty">Ningún pedido coincide con la búsqueda.</p>
      ) : (
        <ul className="list">
          {visible.map((order) => {
            const whatsapp = whatsappHref(order.phone, order.customerName)
            const maps = mapsHref(order.address)
            return (
              <li key={order.id} className="card plain">
                <div className="card-body">
                  <div className="card-top">
                    <h3>{order.customerName}</h3>
                    <strong>{formatMoney(orderTotal(order))}</strong>
                  </div>
                  <p>
                    {formatQuantity(order.plates)} {order.plates === 1 ? 'plato' : 'platos'}
                    {order.deliveryTime ? ` · ${order.deliveryTime}` : ''}
                    {order.pricePerPlate !== data.settings.pricePerPlate ? ` · ${formatMoney(order.pricePerPlate)} c/u` : ''}
                  </p>
                  {order.address ? <p>{order.address}</p> : null}
                  {order.phone ? <p>{order.phone}</p> : null}
                  {order.notes ? <p className="note-inline">{order.notes}</p> : null}
                  <p className="pills">
                    <span className={order.deliveryStatus === 'entregado' ? 'pill good' : 'pill warn'}>
                      {order.deliveryStatus === 'entregado' ? 'Entregado' : 'Entrega pendiente'}
                    </span>
                    <span className={order.paymentStatus === 'pagado' ? 'pill good' : 'pill warn'}>
                      {order.paymentStatus === 'pagado' ? 'Pagado' : 'Pago pendiente'} ·{' '}
                      {order.paymentMethod === 'qr' ? 'QR' : 'Efectivo'}
                    </span>
                  </p>
                  <div className="row-actions">
                    {whatsapp ? (
                      <a className="btn small whatsapp" href={whatsapp} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    ) : null}
                    {maps ? (
                      <a className="btn small ghost" href={maps} target="_blank" rel="noreferrer">
                        Mapa
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() =>
                        saveOrder({
                          ...order,
                          deliveryStatus: order.deliveryStatus === 'entregado' ? 'pendiente' : 'entregado',
                        })
                      }
                    >
                      {order.deliveryStatus === 'entregado' ? 'Marcar pendiente' : 'Marcar entregado'}
                    </button>
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() =>
                        saveOrder({
                          ...order,
                          paymentStatus: order.paymentStatus === 'pagado' ? 'pendiente' : 'pagado',
                        })
                      }
                    >
                      {order.paymentStatus === 'pagado' ? 'Marcar por cobrar' : 'Marcar pagado'}
                    </button>
                    <button type="button" className="btn small ghost" onClick={() => open(order)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() =>
                        ask({
                          title: 'Eliminar pedido',
                          message: `¿Eliminar el pedido de ${order.customerName}?`,
                          confirmLabel: 'Eliminar',
                          action: () => deleteOrder(order.id),
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
      )}
      {draft ? (
        <Modal title={data.orders.some((order) => order.id === draft.id) ? 'Editar pedido' : 'Nuevo pedido'} onClose={() => setDraft(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <Field label="Nombre">
              <input
                autoComplete="name"
                value={draft.customerName}
                onChange={(event) => setDraft({ ...draft, customerName: event.target.value })}
                maxLength={80}
              />
            </Field>
            <Field label="Teléfono" hint="Celular de Bolivia, 8 dígitos. El enlace de WhatsApp agrega +591.">
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                maxLength={20}
              />
            </Field>
            <Field label="Dirección">
              <input
                autoComplete="street-address"
                value={draft.address}
                onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                maxLength={200}
              />
            </Field>
            <div className="split">
              <Field label="Platos">
                <input inputMode="numeric" value={draft.plates} onChange={(event) => setDraft({ ...draft, plates: event.target.value })} />
              </Field>
              <Field label="Precio por plato (Bs)">
                <input
                  inputMode="decimal"
                  value={draft.pricePerPlate}
                  onChange={(event) => setDraft({ ...draft, pricePerPlate: event.target.value })}
                />
              </Field>
            </div>
            <p className="note">Total: {draftTotal == null ? '—' : formatMoney(draftTotal)}</p>
            {projected > data.settings.plannedPlates ? (
              <p className="banner warn">
                Con este pedido llegarías a {formatQuantity(projected)} platos, por encima de los{' '}
                {formatQuantity(data.settings.plannedPlates)} planificados.
              </p>
            ) : null}
            <Field label="Hora de entrega">
              <input type="time" value={draft.deliveryTime} onChange={(event) => setDraft({ ...draft, deliveryTime: event.target.value })} />
            </Field>
            <div className="split">
              <Field label="Entrega">
                <select
                  value={draft.deliveryStatus}
                  onChange={(event) => setDraft({ ...draft, deliveryStatus: event.target.value as DeliveryStatus })}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="entregado">Entregado</option>
                </select>
              </Field>
              <Field label="Pago">
                <select
                  value={draft.paymentStatus}
                  onChange={(event) => setDraft({ ...draft, paymentStatus: event.target.value as PaymentStatus })}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                </select>
              </Field>
            </div>
            <Field label="Método de pago">
              <select
                value={draft.paymentMethod}
                onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value as PaymentMethod })}
              >
                <option value="efectivo">Efectivo</option>
                <option value="qr">QR</option>
              </select>
            </Field>
            <Field label="Notas">
              <textarea
                rows={3}
                value={draft.notes}
                maxLength={500}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </Field>
            {error ? <p className="field-error">{error}</p> : null}
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

function FilterChip<T extends string>({
  current,
  value,
  label,
  onSelect,
}: {
  current: T
  value: T
  label: string
  onSelect: (value: T) => void
}) {
  const active = current === value
  return (
    <button type="button" className={active ? 'chip active' : 'chip'} aria-pressed={active} onClick={() => onSelect(value)}>
      {label}
    </button>
  )
}

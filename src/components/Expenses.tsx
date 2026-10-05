import { useState } from 'react'
import { formatMoney, formatShortDate, parseDecimal, todayISO } from '../format'
import { newId } from '../storage'
import { useStore } from '../store'
import { CATEGORIES, CATEGORY_LABELS, type Expense, type ExpenseCategory } from '../types'
import { Field, Modal, useConfirm } from './ui'

interface Draft {
  id: string
  concept: string
  amount: string
  date: string
  category: ExpenseCategory
}

function blank(): Draft {
  return { id: newId(), concept: '', amount: '', date: todayISO(), category: 'transporte' }
}

export function Expenses() {
  const { data, summary, saveExpense, deleteExpense } = useStore()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { ask, dialog } = useConfirm()

  function open(expense?: Expense) {
    setError(null)
    setDraft(
      expense
        ? {
            id: expense.id,
            concept: expense.concept,
            amount: String(expense.amount).replace('.', ','),
            date: expense.date,
            category: expense.category,
          }
        : blank(),
    )
  }

  function save() {
    if (!draft) return
    const amount = parseDecimal(draft.amount)
    if (!draft.concept.trim()) {
      setError('Escribe el concepto.')
      return
    }
    if (amount == null || amount <= 0) {
      setError('El monto debe ser mayor a cero.')
      return
    }
    if (!draft.date) {
      setError('Elige la fecha.')
      return
    }
    saveExpense({
      id: draft.id,
      concept: draft.concept.trim(),
      amount,
      date: draft.date,
      category: draft.category,
    })
    setDraft(null)
  }

  const byCategory = CATEGORIES.map((category) => ({
    category,
    total: data.expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0),
  })).filter((row) => row.total > 0)

  return (
    <>
      <h1>Gastos</h1>
      <p className="lede">Transporte, condimentos, aceite, mano de obra y lo que no va en la lista de compras.</p>
      <div className="totals">
        <div>
          <strong>{formatMoney(summary.otherExpenses)}</strong>
          <span>total</span>
        </div>
        <div>
          <strong>{data.expenses.length}</strong>
          <span>anotados</span>
        </div>
      </div>
      {byCategory.length > 0 ? (
        <ul className="chips static">
          {byCategory.map((row) => (
            <li key={row.category}>
              {CATEGORY_LABELS[row.category]} · {formatMoney(row.total)}
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="btn primary" onClick={() => open()}>
        Agregar gasto
      </button>
      {data.expenses.length === 0 ? (
        <p className="empty">Todavía no hay gastos extra. Si pagas un taxi o aceite, anótalo aquí.</p>
      ) : (
        <ul className="list">
          {data.expenses.map((expense) => (
            <li key={expense.id} className="card plain">
              <div className="card-body">
                <div className="card-top">
                  <h3>{expense.concept}</h3>
                  <strong>{formatMoney(expense.amount)}</strong>
                </div>
                <p>
                  <span className="pill">{CATEGORY_LABELS[expense.category]}</span>
                  {expense.date ? ` · ${formatShortDate(expense.date)}` : ''}
                </p>
                <div className="row-actions">
                  <button type="button" className="btn small ghost" onClick={() => open(expense)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() =>
                      ask({
                        title: 'Eliminar gasto',
                        message: `¿Eliminar «${expense.concept}»?`,
                        confirmLabel: 'Eliminar',
                        action: () => deleteExpense(expense.id),
                      })
                    }
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {draft ? (
        <Modal title={data.expenses.some((expense) => expense.id === draft.id) ? 'Editar gasto' : 'Nuevo gasto'} onClose={() => setDraft(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <Field label="Concepto" error={error && !draft.concept.trim() ? error : undefined}>
              <input value={draft.concept} onChange={(event) => setDraft({ ...draft, concept: event.target.value })} maxLength={80} />
            </Field>
            <div className="split">
              <Field label="Monto (Bs)">
                <input inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
              </Field>
              <Field label="Fecha">
                <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
              </Field>
            </div>
            <Field label="Categoría">
              <select
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value as ExpenseCategory })}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
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

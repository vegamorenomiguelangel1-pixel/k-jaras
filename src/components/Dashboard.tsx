import { formatLongDate, formatMoney, formatQuantity, roundMoney } from '../format'
import { useStore } from '../store'
import { PlanAlert } from './ui'

export function Dashboard() {
  const { data, summary } = useStore()
  const differentCost = summary.purchaseCostActual !== summary.purchaseCostEstimated
  const margin = summary.plannedPlates > 0 ? roundMoney(summary.estimatedProfit / summary.plannedPlates) : 0

  return (
    <>
      <p className="eyebrow">{formatLongDate(data.settings.saleDate)}</p>
      <h1>Resumen</h1>
      <p className="lede">
        {formatQuantity(summary.plannedPlates)} platos a {formatMoney(data.settings.pricePerPlate)} cada uno.
      </p>
      <PlanAlert summary={summary} />
      <section className={summary.estimatedProfit >= 0 ? 'hero' : 'hero bad'}>
        <p>Ganancia estimada</p>
        <strong>{formatMoney(summary.estimatedProfit)}</strong>
        <p>
          Si vendes los {formatQuantity(summary.plannedPlates)} platos, quedan {formatMoney(margin)} por plato
          después de los costos estimados.
        </p>
      </section>
      <div className="meter-block">
        <div className="meter-label">
          <span>Pedidos</span>
          <strong>
            {formatQuantity(summary.orderedPlates)} de {formatQuantity(summary.plannedPlates)}
          </strong>
        </div>
        <div
          className={summary.exceedsPlan ? 'meter over' : 'meter'}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={summary.plannedPlates}
          aria-valuenow={Math.min(summary.orderedPlates, summary.plannedPlates)}
          aria-label="Platos pedidos"
        >
          <span
            style={{
              width: `${summary.plannedPlates > 0 ? Math.min(100, (summary.orderedPlates / summary.plannedPlates) * 100) : 0}%`,
            }}
          />
        </div>
      </div>
      <h2>Venta</h2>
      <div className="grid">
        <Stat label="Platos planificados" value={formatQuantity(summary.plannedPlates)} />
        <Stat label="Platos pedidos" value={formatQuantity(summary.orderedPlates)} />
        <Stat
          label="Platos restantes"
          value={formatQuantity(summary.remainingPlates)}
          tone={summary.remainingPlates < 0 ? 'bad' : undefined}
        />
        <Stat label="Ingreso esperado" value={formatMoney(summary.expectedIncome)} hint="Plan × precio" />
      </div>
      <h2>Costos</h2>
      <div className="grid">
        <Stat
          label="Costo de compras"
          value={formatMoney(summary.purchaseCostActual)}
          hint={
            differentCost
              ? `Estimado ${formatMoney(summary.purchaseCostEstimated)} · ${summary.purchasedItems} de ${summary.shoppingCount} comprados`
              : `${summary.purchasedItems} de ${summary.shoppingCount} comprados`
          }
        />
        <Stat label="Otros gastos" value={formatMoney(summary.otherExpenses)} />
        <Stat
          label="Costo por plato"
          value={formatMoney(summary.costPerPlate)}
          hint="Compras reales + gastos"
        />
        <Stat
          label="Ganancia real"
          value={formatMoney(summary.actualProfit)}
          tone={summary.actualProfit >= 0 ? 'good' : 'bad'}
          hint="Pedidos − costos reales"
        />
      </div>
      {summary.orderedPlates === 0 ? (
        <p className="note">
          Todavía no hay pedidos: la ganancia real solo resta los costos de la preparación.
        </p>
      ) : null}
      <h2>Pendientes</h2>
      <div className="grid">
        <Stat
          label="Entregas pendientes"
          value={String(summary.pendingDeliveries)}
          hint={`${formatQuantity(summary.pendingDeliveryPlates)} platos`}
          tone={summary.pendingDeliveries > 0 ? 'warn' : 'good'}
        />
        <Stat
          label="Pagos pendientes"
          value={formatMoney(summary.pendingPaymentAmount)}
          hint={`${summary.pendingPayments} pedidos · cobrado ${formatMoney(summary.collectedIncome)}`}
          tone={summary.pendingPayments > 0 ? 'warn' : 'good'}
        />
      </div>
      <details className="notes">
        <summary>Cómo se calculan estos números</summary>
        <p>
          La ganancia estimada supone que vendes todos los platos planificados al precio configurado, y resta la
          lista de compras a precio de lista más los otros gastos.
        </p>
        <p>
          La ganancia real usa el total de los pedidos anotados. Si en una compra escribiste lo que pagaste, ese
          monto reemplaza al estimado de esa línea.
        </p>
      </details>
    </>
  )
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad' | 'warn'
}) {
  return (
    <article className={tone ? `stat ${tone}` : 'stat'}>
      <p>{label}</p>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  )
}

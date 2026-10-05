import { useState, type ReactElement } from 'react'
import { useStore } from '../store'
import { Dashboard } from './Dashboard'
import { Expenses } from './Expenses'
import { Orders } from './Orders'
import { Settings } from './Settings'
import { ShoppingList } from './ShoppingList'
import { BowlIcon, IconBag, IconCoin, IconGear, IconHome, IconList } from './ui'

type TabId = 'resumen' | 'compras' | 'gastos' | 'pedidos' | 'config'

const TABS: Array<{ id: TabId; label: string; icon: () => ReactElement }> = [
  { id: 'resumen', label: 'Resumen', icon: IconHome },
  { id: 'compras', label: 'Compras', icon: IconBag },
  { id: 'gastos', label: 'Gastos', icon: IconCoin },
  { id: 'pedidos', label: 'Pedidos', icon: IconList },
  { id: 'config', label: 'Ajustes', icon: IconGear },
]

export function Shell() {
  const [tab, setTab] = useState<TabId>('resumen')
  const { mode, offline, saveStatus, saveError, retrySave } = useStore()

  const statusLabel =
    mode === 'local' ? 'En este teléfono' : saveStatus === 'saving' ? 'Guardando…' : saveStatus === 'error' ? 'Sin guardar' : 'Sincronizado'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <BowlIcon />
          <div>
            <strong>K'jaras</strong>
            <span>Miguel Ángel</span>
          </div>
        </div>
        {saveStatus === 'error' ? (
          <button type="button" className="status-pill bad" onClick={retrySave}>
            Reintentar
          </button>
        ) : (
          <span className={`status-pill${saveStatus === 'saving' ? ' wait' : ''}`} role="status">
            {statusLabel}
          </span>
        )}
      </header>
      {offline && mode === 'cloud' ? (
        <p className="banner warn slim">Sin conexión. Puedes seguir anotando; se envía cuando vuelva la señal.</p>
      ) : null}
      {saveError ? <p className="banner bad slim">{saveError}</p> : null}
      <main className="page" id="contenido">
        {tab === 'resumen' ? <Dashboard /> : null}
        {tab === 'compras' ? <ShoppingList /> : null}
        {tab === 'gastos' ? <Expenses /> : null}
        {tab === 'pedidos' ? <Orders /> : null}
        {tab === 'config' ? <Settings /> : null}
      </main>
      <nav className="tabbar" aria-label="Secciones">
        {TABS.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={active ? 'tab active' : 'tab'}
              aria-current={active ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { summarize, type Summary } from './calc'
import {
  emailPermitido,
  firestoreErrorMessage,
  getServices,
  isFirebaseConfigured,
  signOutCurrent,
} from './firebase'
import { createInitialData } from './seed'
import { loadEnvelope, parseAppData, saveEnvelope, type CacheEnvelope } from './storage'
import type { AppData, Expense, Order, Settings, ShoppingItem } from './types'
import { AuthScreen } from './components/AuthScreen'
import { LoadingScreen } from './components/ui'

export type SaveStatus = 'local' | 'saving' | 'saved' | 'error'

interface StoreValue {
  mode: 'local' | 'cloud'
  offline: boolean
  saveStatus: SaveStatus
  saveError: string | null
  userEmail: string | null
  userName: string | null
  data: AppData
  summary: Summary
  retrySave: () => void
  signOutUser: () => Promise<void>
  setSettings: (settings: Settings) => void
  saveShoppingItem: (item: ShoppingItem) => void
  deleteShoppingItem: (id: string) => void
  saveExpense: (expense: Expense) => void
  deleteExpense: (id: string) => void
  saveOrder: (order: Order) => void
  deleteOrder: (id: string) => void
  importData: (data: AppData) => void
  resetData: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore debe usarse dentro del proveedor')
  return context
}

function bindActions(update: (fn: (prev: AppData) => AppData) => void) {
  return {
    setSettings: (settings: Settings) => update((prev) => ({ ...prev, settings })),
    saveShoppingItem: (item: ShoppingItem) =>
      update((prev) => ({
        ...prev,
        shoppingItems: prev.shoppingItems.some((current) => current.id === item.id)
          ? prev.shoppingItems.map((current) => (current.id === item.id ? item : current))
          : [...prev.shoppingItems, item],
      })),
    deleteShoppingItem: (id: string) =>
      update((prev) => ({
        ...prev,
        shoppingItems: prev.shoppingItems.filter((item) => item.id !== id),
      })),
    saveExpense: (expense: Expense) =>
      update((prev) => ({
        ...prev,
        expenses: prev.expenses.some((current) => current.id === expense.id)
          ? prev.expenses.map((current) => (current.id === expense.id ? expense : current))
          : [expense, ...prev.expenses],
      })),
    deleteExpense: (id: string) =>
      update((prev) => ({ ...prev, expenses: prev.expenses.filter((expense) => expense.id !== id) })),
    saveOrder: (order: Order) =>
      update((prev) => ({
        ...prev,
        orders: prev.orders.some((current) => current.id === order.id)
          ? prev.orders.map((current) => (current.id === order.id ? order : current))
          : [order, ...prev.orders],
      })),
    deleteOrder: (id: string) =>
      update((prev) => ({ ...prev, orders: prev.orders.filter((order) => order.id !== id) })),
    importData: (next: AppData) => update(() => next),
    resetData: () => update(() => createInitialData()),
  }
}

function useOfflineFlag(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  return !online
}

function LocalStore({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadEnvelope('local')?.data ?? createInitialData())
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    saveEnvelope('local', { clientUpdatedAt: Date.now(), data })
  }, [data])

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    const next = fn(dataRef.current)
    dataRef.current = next
    setData(next)
  }, [])

  const actions = useMemo(() => bindActions(update), [update])
  const summary = useMemo(() => summarize(data), [data])
  const value = useMemo<StoreValue>(
    () => ({
      mode: 'local',
      offline: false,
      saveStatus: 'local',
      saveError: null,
      userEmail: null,
      userName: null,
      data,
      summary,
      retrySave: () => undefined,
      signOutUser: async () => undefined,
      ...actions,
    }),
    [actions, data, summary],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

function CloudData({ user, children }: { user: User; children: ReactNode }) {
  const cacheKey = `uid:${user.uid}`
  const [data, setData] = useState<AppData>(() => loadEnvelope(cacheKey)?.data ?? createInitialData())
  const [ready, setReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const offline = useOfflineFlag()
  const dataRef = useRef(data)
  const pendingAt = useRef(0)
  const timer = useRef<number | null>(null)
  const latestEnvelope = useRef<CacheEnvelope | null>(loadEnvelope(cacheKey))
  const persistRef = useRef<(envelope: CacheEnvelope) => Promise<void>>(async () => undefined)
  const created = useRef(false)

  const schedule = useCallback(
    (next: AppData) => {
      const envelope: CacheEnvelope = { clientUpdatedAt: Date.now(), data: next }
      pendingAt.current = envelope.clientUpdatedAt
      latestEnvelope.current = envelope
      saveEnvelope(cacheKey, envelope)
      setSaveStatus('saving')
      setSaveError(null)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        void persistRef.current(envelope)
      }, 350)
    },
    [cacheKey],
  )

  const update = useCallback(
    (fn: (prev: AppData) => AppData) => {
      const next = fn(dataRef.current)
      dataRef.current = next
      setData(next)
      schedule(next)
    },
    [schedule],
  )

  useEffect(() => {
    const { db } = getServices()
    const ref = doc(db, 'users', user.uid)
    let cancelled = false

    async function persist(envelope: CacheEnvelope) {
      setSaveStatus('saving')
      try {
        await setDoc(ref, {
          ...envelope.data,
          clientUpdatedAt: envelope.clientUpdatedAt,
          updatedAt: serverTimestamp(),
        })
        if (!cancelled && pendingAt.current === envelope.clientUpdatedAt) {
          setSaveStatus('saved')
          setSaveError(null)
        }
      } catch (error) {
        console.error(error)
        if (!cancelled && pendingAt.current === envelope.clientUpdatedAt) {
          setSaveStatus('error')
          setSaveError(firestoreErrorMessage(error))
        }
      }
    }

    persistRef.current = persist

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (cancelled) return
        if (!snap.exists()) {
          if (created.current) {
            setReady(true)
            return
          }
          created.current = true
          const migrated = loadEnvelope(cacheKey) ?? loadEnvelope('local')
          const initial = migrated?.data ?? createInitialData()
          const envelope: CacheEnvelope = { clientUpdatedAt: Date.now(), data: initial }
          pendingAt.current = envelope.clientUpdatedAt
          latestEnvelope.current = envelope
          saveEnvelope(cacheKey, envelope)
          dataRef.current = initial
          setData(initial)
          setReady(true)
          void persist(envelope)
          return
        }

        const parsed = parseAppData(snap.data())
        if (!parsed) {
          setSaveError('Los datos en la nube no tienen el formato de esta app.')
          setSaveStatus('error')
          setReady(true)
          return
        }

        const remoteAt = typeof snap.data().clientUpdatedAt === 'number' ? snap.data().clientUpdatedAt : 0
        const local = loadEnvelope(cacheKey)
        if (local && local.clientUpdatedAt > remoteAt) {
          dataRef.current = local.data
          latestEnvelope.current = local
          setData(local.data)
          setReady(true)
          void persist(local)
          return
        }

        if (remoteAt >= pendingAt.current) {
          pendingAt.current = remoteAt
          const envelope = { clientUpdatedAt: remoteAt, data: parsed }
          latestEnvelope.current = envelope
          saveEnvelope(cacheKey, envelope)
          dataRef.current = parsed
          setData(parsed)
          setSaveStatus((current) => (current === 'error' ? current : 'saved'))
        }
        setReady(true)
      },
      (error) => {
        console.error(error)
        if (cancelled) return
        setSaveError(firestoreErrorMessage(error))
        setSaveStatus('error')
        setReady(true)
      },
    )

    return () => {
      cancelled = true
      unsubscribe()
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [cacheKey, user.uid])

  const retrySave = useCallback(() => {
    const envelope = latestEnvelope.current ?? loadEnvelope(cacheKey)
    if (!envelope) return
    pendingAt.current = envelope.clientUpdatedAt
    void persistRef.current(envelope)
  }, [cacheKey])

  const wasOffline = useRef(offline)
  useEffect(() => {
    if (wasOffline.current && !offline && saveStatus === 'error') retrySave()
    wasOffline.current = offline
  }, [offline, retrySave, saveStatus])

  const actions = useMemo(() => bindActions(update), [update])
  const summary = useMemo(() => summarize(data), [data])
  const value = useMemo<StoreValue>(
    () => ({
      mode: 'cloud',
      offline,
      saveStatus,
      saveError,
      userEmail: user.email,
      userName: user.displayName,
      data,
      summary,
      retrySave,
      signOutUser: signOutCurrent,
      ...actions,
    }),
    [actions, data, offline, retrySave, saveError, saveStatus, summary, user.displayName, user.email],
  )

  if (!ready) return <LoadingScreen label="Cargando tus datos…" />
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

function CloudGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const { auth } = getServices()
    return onAuthStateChanged(auth, (next) => {
      if (next && !emailPermitido(next.email)) {
        setNotice('Esta cuenta no está autorizada. Solo puede entrar el correo indicado en la configuración.')
        void signOutCurrent()
        setUser(null)
        return
      }
      if (next) setNotice(null)
      setUser(next)
    })
  }, [])

  if (user === undefined) return <LoadingScreen label="Conectando…" />
  if (!user) return <AuthScreen notice={notice} />
  return <CloudData user={user}>{children}</CloudData>
}

export function AppStore({ children }: { children: ReactNode }) {
  if (!isFirebaseConfigured()) return <LocalStore>{children}</LocalStore>
  return <CloudGate>{children}</CloudGate>
}

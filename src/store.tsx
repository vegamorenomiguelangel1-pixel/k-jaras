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
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { summarize, type Summary } from './calc'
import {
  firestoreErrorMessage,
  friendlyError,
  getServices,
  isFirebaseConfigured,
  isPermissionDenied,
  signOutCurrent,
} from './firebase'
import { createInitialData } from './seed'
import { waitForSetup } from './setupLock'
import { chooseInitialSale, loadEnvelope, parseAppData, saveEnvelope, type CacheEnvelope } from './storage'
import { fetchSessionProfile, fetchSetupNeeded } from './team'
import type { AppData, Expense, Order, Settings, ShoppingItem } from './types'
import { AuthScreen } from './components/AuthScreen'
import { LoadingScreen } from './components/ui'

export type SaveStatus = 'local' | 'saving' | 'saved' | 'error'

interface StoreValue {
  mode: 'local' | 'cloud'
  offline: boolean
  saveStatus: SaveStatus
  saveError: string | null
  memberName: string | null
  esAdmin: boolean
  userId: string | null
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
      memberName: null,
      esAdmin: false,
      userId: null,
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

const SALE_CACHE = 'venta:principal'
const BLOCKED_NOTICE =
  'No se pudo revisar el equipo. Cuando se publiquen las reglas nuevas, aquí se entra con nombre y código.'

async function readLegacySale(db: Firestore, uid: string): Promise<CacheEnvelope | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) return null
    const data = parseAppData(snap.data())
    if (!data) return null
    const raw = snap.data().clientUpdatedAt
    return { clientUpdatedAt: typeof raw === 'number' ? raw : Date.now(), data }
  } catch (error) {
    console.error(error)
    return null
  }
}

function CloudData({
  uid,
  memberName,
  esAdmin,
  children,
}: {
  uid: string
  memberName: string
  esAdmin: boolean
  children: ReactNode
}) {
  const cacheKey = SALE_CACHE
  const [data, setData] = useState<AppData>(
    () =>
      loadEnvelope(cacheKey)?.data ??
      loadEnvelope(`uid:${uid}`)?.data ??
      loadEnvelope('local')?.data ??
      createInitialData(),
  )
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
  const loadGeneration = useRef(0)

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
    const ref = doc(db, 'ventas', 'principal')
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
        void (async () => {
        if (cancelled) return
        if (!snap.exists()) {
          if (snap.metadata.fromCache || created.current || pendingAt.current > 0) {
            setReady(true)
            return
          }
          created.current = true
          const generation = ++loadGeneration.current
          const fromLegacy = await readLegacySale(db, uid)
          if (cancelled || generation !== loadGeneration.current) return
          const chosen = chooseInitialSale(
            [fromLegacy, loadEnvelope(cacheKey), loadEnvelope(`uid:${uid}`), loadEnvelope('local')],
            createInitialData(),
          )
          const envelope: CacheEnvelope = {
            clientUpdatedAt: chosen.clientUpdatedAt || Date.now(),
            data: chosen.data,
          }
          pendingAt.current = envelope.clientUpdatedAt
          latestEnvelope.current = envelope
          saveEnvelope(cacheKey, envelope)
          dataRef.current = envelope.data
          setData(envelope.data)
          setReady(true)
          void persist(envelope)
          return
        }

        loadGeneration.current += 1
        created.current = true
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
        })()
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
  }, [cacheKey, uid])

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
      memberName,
      esAdmin,
      userId: uid,
      data,
      summary,
      retrySave,
      signOutUser: signOutCurrent,
      ...actions,
    }),
    [actions, data, esAdmin, memberName, offline, retrySave, saveError, saveStatus, summary, uid],
  )

  if (!ready) return <LoadingScreen label="Cargando la venta…" />
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

function CloudGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'setup' | 'auth' | 'app'>('loading')
  const [blocked, setBlocked] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [session, setSession] = useState<{ uid: string; nombre: string; esAdmin: boolean } | null>(null)

  useEffect(() => {
    const { auth, db } = getServices()
    let active = true
    let request = 0
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      const id = ++request
      void (async () => {
        await waitForSetup()
        if (!active || id !== request) return
        if (!next) {
          setSession(null)
          try {
            const needsSetup = await fetchSetupNeeded(db)
            if (!active || id !== request) return
            setBlocked(false)
            setPhase(needsSetup ? 'setup' : 'auth')
          } catch (error) {
            if (!active || id !== request) return
            console.error(error)
            setBlocked(true)
            setNotice(isPermissionDenied(error) ? BLOCKED_NOTICE : friendlyError(error))
            setPhase('auth')
          }
          return
        }

        try {
          const profile = await fetchSessionProfile(db, next.uid)
          if (!active || id !== request) return
          if (!profile) {
            setNotice('Esta cuenta no forma parte del equipo.')
            setSession(null)
            await signOutCurrent()
            return
          }
          setBlocked(false)
          setNotice(null)
          setSession({ uid: next.uid, nombre: profile.nombre, esAdmin: profile.esAdmin })
          setPhase('app')
        } catch (error) {
          if (!active || id !== request) return
          console.error(error)
          setSession(null)
          setBlocked(true)
          setNotice(isPermissionDenied(error) ? BLOCKED_NOTICE : friendlyError(error))
          if (isPermissionDenied(error)) await signOutCurrent()
          else setPhase('auth')
        }
      })()
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (phase === 'loading') return <LoadingScreen label="Conectando…" />
  if (phase !== 'app' || !session) return <AuthScreen notice={notice} setup={phase === 'setup'} blocked={blocked} />
  return (
    <CloudData uid={session.uid} memberName={session.nombre} esAdmin={session.esAdmin}>
      {children}
    </CloudData>
  )
}

export function AppStore({ children }: { children: ReactNode }) {
  if (!isFirebaseConfigured()) return <LocalStore>{children}</LocalStore>
  return <CloudGate>{children}</CloudGate>
}

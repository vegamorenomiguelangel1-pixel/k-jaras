import { deleteApp, FirebaseError, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type UserCredential,
} from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

import { resolveFirebaseConfig, type FirebasePublicConfig } from './firebaseConfig'

export type { FirebasePublicConfig }

const SECONDARY_APP = 'alta-miembro'

export function readFirebaseConfig(): FirebasePublicConfig {
  return resolveFirebaseConfig(import.meta.env)
}

export function isFirebaseConfigured(): boolean {
  const config = readFirebaseConfig()
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export function getServices(): { auth: Auth; db: Firestore } {
  const config = readFirebaseConfig()
  if (!config.apiKey || !config.projectId) throw new Error('Firebase no está configurado')
  if (!app || !auth || !db) {
    const existing = getApps().find((item) => item.name === '[DEFAULT]')
    app = existing ?? initializeApp(config)
    auth = getAuth(app)
    auth.languageCode = 'es'
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    } catch {
      try {
        db = getFirestore(app)
      } catch {
        db = initializeFirestore(app, { localCache: memoryLocalCache() })
      }
    }
  }
  return { auth, db }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { auth: firebaseAuth } = getServices()
  await signInWithEmailAndPassword(firebaseAuth, email, password)
}

/** Alta del administrador en la sesión principal. Si el correo ya existe, entra con el mismo código. */
export async function ensurePrimaryUser(email: string, password: string): Promise<string> {
  const { auth: firebaseAuth } = getServices()
  try {
    const created = await createUserWithEmailAndPassword(firebaseAuth, email, password)
    return created.user.uid
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/email-already-in-use') {
      const signed = await signInWithEmailAndPassword(firebaseAuth, email, password)
      return signed.user.uid
    }
    throw error
  }
}

/**
 * Crea la cuenta en una app aparte, con memoria volátil, para no cambiar
 * la sesión de quien está dando de alta al equipo.
 */
export async function createAccountWithoutSwitching(email: string, password: string): Promise<string> {
  const config = readFirebaseConfig()
  const stale = getApps().find((item) => item.name === SECONDARY_APP)
  if (stale) await deleteApp(stale)
  const secondary = initializeApp(config, SECONDARY_APP)
  try {
    const secondaryAuth = initializeAuth(secondary, { persistence: inMemoryPersistence })
    const credential: UserCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    return credential.user.uid
  } finally {
    await deleteApp(secondary).catch(() => undefined)
  }
}

export async function signOutCurrent(): Promise<void> {
  const { auth: firebaseAuth } = getServices()
  await signOut(firebaseAuth)
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Ese nombre no se puede usar.',
  'auth/missing-password': 'Escribe el código.',
  'auth/user-not-found': 'Nombre o código incorrectos.',
  'auth/wrong-password': 'Nombre o código incorrectos.',
  'auth/invalid-credential': 'Nombre o código incorrectos.',
  'auth/email-already-in-use': 'Ese nombre ya está en uso.',
  'auth/weak-password': 'El código debe tener al menos 6 números.',
  'auth/unauthorized-domain': 'Este sitio no está autorizado en Firebase Authentication.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet e intenta de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a probar.',
  'auth/operation-not-allowed': 'El ingreso con código no está activado en Firebase Authentication.',
}

export function isPermissionDenied(error: unknown): boolean {
  return error instanceof FirebaseError && error.code.includes('permission-denied')
}

export function authErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : ''
  return AUTH_MESSAGES[code] ?? 'No se pudo entrar. Intenta de nuevo.'
}

export function firestoreErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : ''
  if (code.includes('permission-denied')) {
    return 'Firestore rechazó la operación. Revisa que hayas entrado y que las reglas sean las del repositorio.'
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Sin conexión con Firestore. El cambio quedó en este teléfono y se reintentará.'
  }
  return 'No se pudo guardar en la nube. El cambio quedó en este teléfono.'
}

export function friendlyError(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code.startsWith('auth/')) return authErrorMessage(error)
    return firestoreErrorMessage(error)
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return 'No se pudo completar. Intenta de nuevo.'
}

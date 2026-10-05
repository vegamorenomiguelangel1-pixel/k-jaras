import { FirebaseError, getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

export interface FirebasePublicConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

function clean(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function readFirebaseConfig(): FirebasePublicConfig | null {
  const apiKey = clean(import.meta.env.VITE_FIREBASE_API_KEY)
  const authDomain = clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
  const projectId = clean(import.meta.env.VITE_FIREBASE_PROJECT_ID)
  const appId = clean(import.meta.env.VITE_FIREBASE_APP_ID)
  if (!apiKey || !authDomain || !projectId || !appId) return null
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId,
  }
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfig() !== null
}

export function allowedEmail(): string {
  return clean(import.meta.env.VITE_ALLOWED_EMAIL).toLowerCase()
}

export function emailPermitido(email: string | null | undefined): boolean {
  const allowed = allowedEmail()
  if (!allowed) return true
  return (email ?? '').trim().toLowerCase() === allowed
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export function getServices(): { auth: Auth; db: Firestore } {
  const config = readFirebaseConfig()
  if (!config) throw new Error('Firebase no está configurado')
  if (!app || !auth || !db) {
    app = getApps().length ? getApp() : initializeApp(config)
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

export async function signInWithGoogle(): Promise<void> {
  const { auth: firebaseAuth } = getServices()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithPopup(firebaseAuth, provider)
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { auth: firebaseAuth } = getServices()
  await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const { auth: firebaseAuth } = getServices()
  await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)
}

export async function sendReset(email: string): Promise<void> {
  const { auth: firebaseAuth } = getServices()
  await sendPasswordResetEmail(firebaseAuth, email.trim())
}

export async function signOutCurrent(): Promise<void> {
  const { auth: firebaseAuth } = getServices()
  await signOut(firebaseAuth)
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'El correo no es válido.',
  'auth/missing-password': 'Escribe la contraseña.',
  'auth/user-not-found': 'No hay una cuenta con ese correo.',
  'auth/wrong-password': 'La contraseña no coincide.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ese correo ya está registrado. Entra con tu contraseña.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Prueba con correo y contraseña.',
  'auth/unauthorized-domain':
    'Este sitio no está autorizado en Firebase. Agrégalo en Authentication → Settings → Authorized domains.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet e intenta de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a probar.',
  'auth/operation-not-allowed': 'Ese método de entrada no está activado en Firebase Authentication.',
}

export function authErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : ''
  return AUTH_MESSAGES[code] ?? 'No se pudo entrar. Intenta de nuevo.'
}

export function firestoreErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : ''
  if (code.includes('permission-denied')) {
    return 'Firestore rechazó el cambio. Revisa que hayas iniciado sesión y que las reglas sean las del repositorio.'
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Sin conexión con Firestore. El cambio quedó en este teléfono y se reintentará.'
  }
  return 'No se pudo guardar en la nube. El cambio quedó en este teléfono.'
}

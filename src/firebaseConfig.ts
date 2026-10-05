export interface FirebasePublicConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

/** Configuración pública de la app web. Las reglas de Firestore protegen los datos. */
export const DEFAULT_FIREBASE_CONFIG: FirebasePublicConfig = {
  apiKey: 'AIzaSyBmffPseocFJ9L1X1y-TQrbobLbf2mM5jo',
  authDomain: 'k-jaras.firebaseapp.com',
  projectId: 'k-jaras',
  storageBucket: 'k-jaras.firebasestorage.app',
  messagingSenderId: '412388277431',
  appId: '1:412388277431:web:7728e3eaf102b61071a132',
}

type EnvLike = Partial<Record<string, string | undefined>>

function pick(env: EnvLike, key: string, fallback: string): string {
  const value = env[key]
  const cleaned = typeof value === 'string' ? value.trim() : ''
  return cleaned || fallback
}

/** Cada variable VITE_FIREBASE_* reemplaza solo ese campo. Vacío usa el proyecto k-jaras. */
export function resolveFirebaseConfig(env: EnvLike = import.meta.env): FirebasePublicConfig {
  const defaults = DEFAULT_FIREBASE_CONFIG
  return {
    apiKey: pick(env, 'VITE_FIREBASE_API_KEY', defaults.apiKey),
    authDomain: pick(env, 'VITE_FIREBASE_AUTH_DOMAIN', defaults.authDomain),
    projectId: pick(env, 'VITE_FIREBASE_PROJECT_ID', defaults.projectId),
    storageBucket: pick(env, 'VITE_FIREBASE_STORAGE_BUCKET', defaults.storageBucket),
    messagingSenderId: pick(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID', defaults.messagingSenderId),
    appId: pick(env, 'VITE_FIREBASE_APP_ID', defaults.appId),
  }
}

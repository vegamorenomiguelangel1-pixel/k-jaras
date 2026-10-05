import { describe, expect, it } from 'vitest'
import { DEFAULT_FIREBASE_CONFIG, resolveFirebaseConfig } from './firebaseConfig'

describe('configuración de Firebase', () => {
  it('usa el proyecto k-jaras cuando no hay variables', () => {
    expect(resolveFirebaseConfig({})).toEqual(DEFAULT_FIREBASE_CONFIG)
    expect(DEFAULT_FIREBASE_CONFIG.projectId).toBe('k-jaras')
    expect(DEFAULT_FIREBASE_CONFIG.authDomain).toBe('k-jaras.firebaseapp.com')
  })

  it('deja que una variable de entorno reemplace solo ese campo', () => {
    const config = resolveFirebaseConfig({
      VITE_FIREBASE_PROJECT_ID: 'otro-proyecto',
      VITE_FIREBASE_API_KEY: '  clave-de-prueba  ',
      VITE_FIREBASE_STORAGE_BUCKET: '   ',
    })
    expect(config.projectId).toBe('otro-proyecto')
    expect(config.apiKey).toBe('clave-de-prueba')
    expect(config.storageBucket).toBe(DEFAULT_FIREBASE_CONFIG.storageBucket)
    expect(config.appId).toBe(DEFAULT_FIREBASE_CONFIG.appId)
  })
})

import { FirebaseError } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore'

import { identityFrom, localCandidates, memberEmail } from './authIdentity'
import {
  createAccountWithoutSwitching,
  ensurePrimaryUser,
  getServices,
  signInWithPassword,
  signOutCurrent,
} from './firebase'
import { duringSetup } from './setupLock'

export type MemberRole = 'admin' | 'miembro'

export interface TeamMember {
  uid: string
  nombre: string
  role: MemberRole
  slug: string
}

export interface SessionProfile {
  nombre: string
  esAdmin: boolean
}

function asRole(value: unknown): MemberRole | null {
  return value === 'admin' || value === 'miembro' ? value : null
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function fetchSetupNeeded(db: Firestore): Promise<boolean> {
  const snap = await getDoc(doc(db, 'sistema', 'admin'))
  return !snap.exists()
}

export async function fetchSessionProfile(db: Firestore, uid: string): Promise<SessionProfile | null> {
  const [adminSnap, memberSnap] = await Promise.all([
    getDoc(doc(db, 'sistema', 'admin')),
    getDoc(doc(db, 'miembros', uid)),
  ])
  if (!adminSnap.exists() || !memberSnap.exists()) return null
  const nombre = asText(memberSnap.data().nombre)
  const role = asRole(memberSnap.data().role)
  const adminUid = asText(adminSnap.data().uid)
  if (!nombre || !role || !adminUid) return null
  const esAdmin = role === 'admin' && adminUid === uid
  if (role === 'miembro' || esAdmin) return { nombre, esAdmin }
  return null
}

export async function createAdmin(nombre: string, pin: string): Promise<void> {
  const identity = identityFrom(nombre, pin)
  await duringSetup(async () => {
    const { db, auth } = getServices()
    const adminRef = doc(db, 'sistema', 'admin')
    const current = await getDoc(adminRef)
    if (current.exists() && asText(current.data().uid) && asText(current.data().uid) !== auth.currentUser?.uid) {
      throw new Error('Ya hay un administrador. Entra con tu nombre y código.')
    }

    const uid = await ensurePrimaryUser(memberEmail(identity.slug), identity.pin)
    const memberRef = doc(db, 'miembros', uid)
    try {
      const memberSnap = await getDoc(memberRef)
      if (!memberSnap.exists()) {
        await setDoc(memberRef, { nombre: identity.nombre, role: 'admin', slug: identity.slug })
      }
      const adminSnap = await getDoc(adminRef)
      if (!adminSnap.exists()) {
        await setDoc(adminRef, { uid, nombre: identity.nombre })
      } else if (asText(adminSnap.data().uid) !== uid) {
        await signOutCurrent()
        throw new Error('Ya hay un administrador. Entra con tu nombre y código.')
      }
      await setDoc(doc(db, 'acceso', identity.slug), { local: identity.slug })
    } catch (error) {
      if (auth.currentUser?.uid === uid) {
        const stillAdmin = await getDoc(adminRef).catch(() => null)
        const won = stillAdmin?.exists() && asText(stillAdmin.data().uid) === uid
        if (!won) await signOutCurrent()
      }
      throw error
    }
  })
}

export async function signInWithName(nombre: string, pin: string): Promise<void> {
  const identity = identityFrom(nombre, pin)
  const { db } = getServices()
  const acceso = await getDoc(doc(db, 'acceso', identity.slug))
  const stored = acceso.exists() ? asText(acceso.data().local) : ''
  const local = stored || identity.slug
  await signInWithPassword(memberEmail(local), identity.pin)
}

async function slugTaken(db: Firestore, slug: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, 'miembros'), where('slug', '==', slug)))
  return !snap.empty
}

export async function addMember(nombre: string, pin: string): Promise<void> {
  const identity = identityFrom(nombre, pin)
  const { db } = getServices()
  if (await slugTaken(db, identity.slug)) {
    throw new Error('Ya hay alguien con ese nombre.')
  }

  let uid = ''
  let local = ''
  for (const candidate of localCandidates(identity.slug)) {
    try {
      uid = await createAccountWithoutSwitching(memberEmail(candidate), identity.pin)
      local = candidate
      break
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'auth/email-already-in-use') continue
      throw error
    }
  }
  if (!uid || !local) {
    throw new Error('Ese nombre ya se usó demasiadas veces. Elige otro.')
  }

  await setDoc(doc(db, 'miembros', uid), { nombre: identity.nombre, role: 'miembro', slug: identity.slug })
  await setDoc(doc(db, 'acceso', identity.slug), { local })
}

export async function removeMember(member: TeamMember): Promise<void> {
  const { db } = getServices()
  await deleteDoc(doc(db, 'miembros', member.uid))
  if (member.slug) await deleteDoc(doc(db, 'acceso', member.slug))
}

export function watchMembers(
  db: Firestore,
  onChange: (members: TeamMember[]) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    collection(db, 'miembros'),
    (snap) => {
      const members: TeamMember[] = []
      for (const item of snap.docs) {
        const nombre = asText(item.data().nombre)
        const role = asRole(item.data().role)
        const slug = asText(item.data().slug)
        if (!nombre || !role) continue
        members.push({ uid: item.id, nombre, role, slug })
      }
      members.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      onChange(members)
    },
    onError,
  )
}

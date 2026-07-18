import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, deleteDoc, onSnapshot, setDoc, doc } from 'firebase/firestore'
import { db, firebaseEnabled, OPERATORS_COLLECTION } from '../firebase'

const STORAGE_KEY = 'noc-chat-operators'
const DEFAULT_OPERATORS = ['פרנסיס', 'דניאל', 'אבי', 'שלומי', 'רפאל', 'חן', 'דני']
const LEGACY_NAMES = ['Francis', 'Daniel']

/** Firestore doc ids can't contain '/' — normalize names on the way in */
function sanitizeName(name: string): string {
  return name.trim().replace(/\//g, '-')
}

export interface OperatorsApi {
  operators: string[]
  addOperator: (name: string) => void
  renameOperator: (oldName: string, newName: string) => void
  deleteOperator: (name: string) => void
}

// ---------------------------------------------------------------------------
// Firestore backend — one doc per operator, doc id = name (idempotent adds)
// ---------------------------------------------------------------------------

function useFirestoreOperators(): OperatorsApi {
  const [operators, setOperators] = useState<string[]>([])
  const seeded = useRef(false)
  // Keep creation times so a rename preserves the operator's position in the list
  const createdAtRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!db) return
    const unsub = onSnapshot(collection(db, OPERATORS_COLLECTION), (snapshot) => {
      if (snapshot.empty && !seeded.current) {
        // First run against an empty collection — seed the default roster.
        // Doc id = name keeps this idempotent even if two clients race.
        seeded.current = true
        DEFAULT_OPERATORS.forEach((name, i) => {
          setDoc(doc(db!, OPERATORS_COLLECTION, name), { name, created_at: Date.now() + i }).catch(() => {})
        })
        return
      }
      const entries = snapshot.docs.map((d) => ({
        name: (d.data().name as string) ?? d.id,
        createdAt: (d.data().created_at as number) ?? 0,
      }))
      createdAtRef.current = new Map(entries.map((e) => [e.name, e.createdAt]))
      const next = entries.sort((a, b) => a.createdAt - b.createdAt).map((o) => o.name)
      if (next.length > 0) setOperators(next)
    })
    return unsub
  }, [])

  const addOperator = useCallback((name: string) => {
    const clean = sanitizeName(name)
    if (!db || !clean) return
    setDoc(doc(db, OPERATORS_COLLECTION, clean), { name: clean, created_at: Date.now() }).catch(() => {})
  }, [])

  const renameOperator = useCallback((oldName: string, newName: string) => {
    const clean = sanitizeName(newName)
    if (!db || !clean || clean === oldName) return
    const createdAt = createdAtRef.current.get(oldName) ?? Date.now()
    setDoc(doc(db, OPERATORS_COLLECTION, clean), { name: clean, created_at: createdAt })
      .then(() => deleteDoc(doc(db!, OPERATORS_COLLECTION, oldName)))
      .catch(() => {})
  }, [])

  const deleteOperator = useCallback((name: string) => {
    if (!db) return
    deleteDoc(doc(db, OPERATORS_COLLECTION, name)).catch(() => {})
  }, [])

  return useMemo(
    () => ({ operators, addOperator, renameOperator, deleteOperator }),
    [operators, addOperator, renameOperator, deleteOperator],
  )
}

// ---------------------------------------------------------------------------
// localStorage backend (fallback)
// ---------------------------------------------------------------------------

function loadOperators(): string[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      const parsed = JSON.parse(stored) as string[]
      if (Array.isArray(parsed)) {
        // Migrate: drop the old English defaults, then merge in any missing Hebrew defaults
        const kept = parsed.filter((n) => !LEGACY_NAMES.includes(n))
        const merged = [...kept, ...DEFAULT_OPERATORS.filter((n) => !kept.includes(n))]
        if (merged.length > 0) return merged
      }
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_OPERATORS
}

function useLocalOperators(): OperatorsApi {
  const [operators, setOperators] = useState<string[]>(loadOperators)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(operators))
    } catch {
      // localStorage unavailable — fail silently
    }
  }, [operators])

  const addOperator = useCallback((name: string) => {
    const clean = sanitizeName(name)
    if (!clean) return
    setOperators((prev) => (prev.includes(clean) ? prev : [...prev, clean]))
  }, [])

  const renameOperator = useCallback((oldName: string, newName: string) => {
    const clean = sanitizeName(newName)
    if (!clean || clean === oldName) return
    setOperators((prev) =>
      prev.includes(clean) ? prev.filter((n) => n !== oldName) : prev.map((n) => (n === oldName ? clean : n)),
    )
  }, [])

  const deleteOperator = useCallback((name: string) => {
    setOperators((prev) => prev.filter((n) => n !== name))
  }, [])

  return useMemo(
    () => ({ operators, addOperator, renameOperator, deleteOperator }),
    [operators, addOperator, renameOperator, deleteOperator],
  )
}

export function useOperators(): OperatorsApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreOperators()
  const localApi = useLocalOperators()
  return firebaseEnabled ? firestoreApi : localApi
}

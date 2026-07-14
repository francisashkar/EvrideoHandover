import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore'
import { db, firebaseEnabled, OPERATORS_COLLECTION } from '../firebase'

const STORAGE_KEY = 'noc-chat-operators'
const DEFAULT_OPERATORS = ['פרנסיס', 'דניאל', 'אבי', 'שלומי', 'רפאל', 'חן', 'דני']
const LEGACY_NAMES = ['Francis', 'Daniel']

export interface OperatorsApi {
  operators: string[]
  addOperator: (name: string) => void
}

// ---------------------------------------------------------------------------
// Firestore backend — one doc per operator, doc id = name (idempotent adds)
// ---------------------------------------------------------------------------

function useFirestoreOperators(): OperatorsApi {
  const [operators, setOperators] = useState<string[]>([])
  const seeded = useRef(false)

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
      const next = snapshot.docs
        .map((d) => ({ name: (d.data().name as string) ?? d.id, createdAt: (d.data().created_at as number) ?? 0 }))
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((o) => o.name)
      if (next.length > 0) setOperators(next)
    })
    return unsub
  }, [])

  const addOperator = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!db || !trimmed) return
    setDoc(doc(db, OPERATORS_COLLECTION, trimmed), { name: trimmed, created_at: Date.now() }).catch(() => {})
  }, [])

  return useMemo(() => ({ operators, addOperator }), [operators, addOperator])
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
    const trimmed = name.trim()
    if (!trimmed) return
    setOperators((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
  }, [])

  return useMemo(() => ({ operators, addOperator }), [operators, addOperator])
}

export function useOperators(): OperatorsApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreOperators()
  const localApi = useLocalOperators()
  return firebaseEnabled ? firestoreApi : localApi
}

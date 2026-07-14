import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, setDoc, where, doc } from 'firebase/firestore'
import { db, firebaseEnabled, SHIFT_STATUS_COLLECTION } from '../firebase'
import type { ShiftId, ShiftStatus, ShiftStatusStore } from '../types'

const STORAGE_KEY = 'noc-shift-status'

const SHIFT_TO_NUMBER: Record<ShiftId, number> = { shift1: 1, shift2: 2, shift3: 3 }
const NUMBER_TO_SHIFT: Record<number, ShiftId> = { 1: 'shift1', 2: 'shift2', 3: 'shift3' }

export interface ShiftStatusApi {
  getStatus: (dateKey: string, shiftId: ShiftId) => ShiftStatus
  setStatus: (dateKey: string, shiftId: ShiftId, status: ShiftStatus) => void
}

// ---------------------------------------------------------------------------
// Firestore backend — one doc per date+shift, deterministic id `YYYY-MM-DD_N`
// ---------------------------------------------------------------------------

function useFirestoreShiftStatus(activeDateKey: string): ShiftStatusApi {
  const [statuses, setStatuses] = useState<Partial<Record<ShiftId, ShiftStatus>>>({})

  useEffect(() => {
    if (!db) return
    setStatuses({})
    const q = query(collection(db, SHIFT_STATUS_COLLECTION), where('date', '==', activeDateKey))
    const unsub = onSnapshot(q, (snapshot) => {
      const next: Partial<Record<ShiftId, ShiftStatus>> = {}
      snapshot.docs.forEach((d) => {
        const data = d.data()
        const shiftId = NUMBER_TO_SHIFT[data.shift as number]
        if (shiftId) next[shiftId] = (data.status as ShiftStatus) ?? 'ok'
      })
      setStatuses(next)
    })
    return unsub
  }, [activeDateKey])

  const getStatus = useCallback(
    (_dateKey: string, shiftId: ShiftId): ShiftStatus => statuses[shiftId] ?? 'ok',
    [statuses],
  )

  const setStatus = useCallback((dateKey: string, shiftId: ShiftId, status: ShiftStatus) => {
    if (!db) return
    setDoc(doc(db, SHIFT_STATUS_COLLECTION, `${dateKey}_${SHIFT_TO_NUMBER[shiftId]}`), {
      date: dateKey,
      shift: SHIFT_TO_NUMBER[shiftId],
      status,
    }).catch(() => {})
  }, [])

  return useMemo(() => ({ getStatus, setStatus }), [getStatus, setStatus])
}

// ---------------------------------------------------------------------------
// localStorage backend (fallback)
// ---------------------------------------------------------------------------

function loadStore(): ShiftStatusStore {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored !== null ? (JSON.parse(stored) as ShiftStatusStore) : {}
  } catch {
    return {}
  }
}

function useLocalShiftStatus(): ShiftStatusApi {
  const [store, setStore] = useState<ShiftStatusStore>(loadStore)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
      // localStorage unavailable — fail silently
    }
  }, [store])

  const getStatus = useCallback(
    (dateKey: string, shiftId: ShiftId): ShiftStatus => store[dateKey]?.[shiftId] ?? 'ok',
    [store],
  )

  const setStatus = useCallback((dateKey: string, shiftId: ShiftId, status: ShiftStatus) => {
    setStore((prev) => ({
      ...prev,
      [dateKey]: { ...prev[dateKey], [shiftId]: status },
    }))
  }, [])

  return useMemo(() => ({ getStatus, setStatus }), [getStatus, setStatus])
}

export function useShiftStatus(activeDateKey: string): ShiftStatusApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreShiftStatus(activeDateKey)
  const localApi = useLocalShiftStatus()
  return firebaseEnabled ? firestoreApi : localApi
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db, firebaseEnabled, HANDOVER_COLLECTION } from '../firebase'
import type { ShiftId } from '../types'

const STORAGE_KEY = 'noc-handover'
const SHIFT_TO_NUMBER: Record<ShiftId, number> = { shift1: 1, shift2: 2, shift3: 3 }

export interface HandoverAck {
  operator: string
  at: number
}

type HandoverMap = Record<string, HandoverAck>

export interface HandoverApi {
  getAck: (dateKey: string, shiftId: ShiftId) => HandoverAck | undefined
  acceptShift: (dateKey: string, shiftId: ShiftId, operator: string) => void
}

const keyOf = (dateKey: string, shiftId: ShiftId) => `${dateKey}_${SHIFT_TO_NUMBER[shiftId]}`

function useFirestoreHandover(): HandoverApi {
  const [map, setMap] = useState<HandoverMap>({})

  useEffect(() => {
    if (!db) return
    return onSnapshot(collection(db, HANDOVER_COLLECTION), (snap) => {
      const next: HandoverMap = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        if (data.operator) next[d.id] = { operator: data.operator as string, at: (data.at as number) ?? 0 }
      })
      setMap(next)
    })
  }, [])

  const getAck = useCallback((dateKey: string, shiftId: ShiftId) => map[keyOf(dateKey, shiftId)], [map])

  const acceptShift = useCallback((dateKey: string, shiftId: ShiftId, operator: string) => {
    if (!db || !operator) return
    setDoc(doc(db, HANDOVER_COLLECTION, keyOf(dateKey, shiftId)), {
      date: dateKey,
      shift: SHIFT_TO_NUMBER[shiftId],
      operator,
      at: Date.now(),
    }).catch(() => {})
  }, [])

  return useMemo(() => ({ getAck, acceptShift }), [getAck, acceptShift])
}

function useLocalHandover(): HandoverApi {
  const [map, setMap] = useState<HandoverMap>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored) as HandoverMap
    } catch {
      // fall through
    }
    return {}
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch {
      // ignore
    }
  }, [map])

  const getAck = useCallback((dateKey: string, shiftId: ShiftId) => map[keyOf(dateKey, shiftId)], [map])

  const acceptShift = useCallback((dateKey: string, shiftId: ShiftId, operator: string) => {
    if (!operator) return
    setMap((prev) => ({ ...prev, [keyOf(dateKey, shiftId)]: { operator, at: Date.now() } }))
  }, [])

  return useMemo(() => ({ getAck, acceptShift }), [getAck, acceptShift])
}

export function useHandover(): HandoverApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreHandover()
  const localApi = useLocalHandover()
  return firebaseEnabled ? firestoreApi : localApi
}

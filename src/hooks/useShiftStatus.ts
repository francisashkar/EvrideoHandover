import { useCallback, useEffect, useState } from 'react'
import type { ShiftId, ShiftStatus, ShiftStatusStore } from '../types'

const STORAGE_KEY = 'noc-shift-status'

function loadStore(): ShiftStatusStore {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored !== null ? (JSON.parse(stored) as ShiftStatusStore) : {}
  } catch {
    return {}
  }
}

export function useShiftStatus() {
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

  return { getStatus, setStatus }
}

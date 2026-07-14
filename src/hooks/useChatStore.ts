import { useCallback, useEffect, useState } from 'react'
import type { CarryOverItem, ChatMessage, ChatStore, DayMessages, ShiftId } from '../types'
import { SHIFT_ORDER, createEmptyDayMessages } from '../types'

const STORAGE_KEY = 'noc-chat-store'

function loadStore(): ChatStore {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored !== null ? (JSON.parse(stored) as ChatStore) : {}
  } catch {
    return {}
  }
}

export function useChatStore() {
  const [store, setStore] = useState<ChatStore>(loadStore)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
      setStorageError(false)
    } catch {
      // Quota exceeded (likely large attachments) — surface it so the UI can warn
      setStorageError(true)
    }
  }, [store])

  const getDayMessages = useCallback(
    (dateKey: string): DayMessages => store[dateKey] ?? createEmptyDayMessages(),
    [store],
  )

  const addMessage = useCallback(
    (dateKey: string, shiftId: ShiftId, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      const full: ChatMessage = {
        ...message,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
      }
      setStore((prev) => {
        const day = prev[dateKey] ?? createEmptyDayMessages()
        return {
          ...prev,
          [dateKey]: {
            ...day,
            [shiftId]: [...day[shiftId], full],
          },
        }
      })
    },
    [],
  )

  const updateMessage = useCallback(
    (dateKey: string, shiftId: ShiftId, messageId: string, patch: Partial<ChatMessage>) => {
      setStore((prev) => {
        const day = prev[dateKey] ?? createEmptyDayMessages()
        return {
          ...prev,
          [dateKey]: {
            ...day,
            [shiftId]: day[shiftId].map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
          },
        }
      })
    },
    [],
  )

  /** Merge a message into the one directly before it (same operator only). */
  const mergeWithPrevious = useCallback((dateKey: string, shiftId: ShiftId, messageId: string) => {
    setStore((prev) => {
      const day = prev[dateKey] ?? createEmptyDayMessages()
      const list = day[shiftId]
      const idx = list.findIndex((m) => m.id === messageId)
      if (idx < 1) return prev
      const target = list[idx - 1]
      const source = list[idx]
      if (target.operator !== source.operator) return prev

      const mergedAttachments = [...(target.attachments ?? []), ...(source.attachments ?? [])]
      const merged: ChatMessage = {
        ...target,
        text: [target.text, source.text].filter(Boolean).join('\n'),
        // The more severe tag wins: incident > followup > update
        tag:
          target.tag === 'incident' || source.tag === 'incident'
            ? 'incident'
            : target.tag === 'followup' || source.tag === 'followup'
              ? 'followup'
              : target.tag,
        pinned: target.pinned || source.pinned,
        unresolved: target.unresolved || source.unresolved,
        attachments: mergedAttachments.length > 0 ? mergedAttachments : undefined,
      }
      const next = [...list.slice(0, idx - 1), merged, ...list.slice(idx + 1)]
      return { ...prev, [dateKey]: { ...day, [shiftId]: next } }
    })
  }, [])

  const deleteMessage = useCallback((dateKey: string, shiftId: ShiftId, messageId: string) => {
    setStore((prev) => {
      const day = prev[dateKey] ?? createEmptyDayMessages()
      return {
        ...prev,
        [dateKey]: {
          ...day,
          [shiftId]: day[shiftId].filter((m) => m.id !== messageId),
        },
      }
    })
  }, [])

  /** All unresolved messages from shifts strictly earlier than the given date+shift. */
  const getCarryOver = useCallback(
    (dateKey: string, shiftId: ShiftId): CarryOverItem[] => {
      const currentShiftIdx = SHIFT_ORDER.indexOf(shiftId)
      const items: CarryOverItem[] = []
      for (const [dk, day] of Object.entries(store)) {
        if (dk > dateKey) continue
        for (const sid of SHIFT_ORDER) {
          if (dk === dateKey && SHIFT_ORDER.indexOf(sid) >= currentShiftIdx) continue
          for (const m of day[sid] ?? []) {
            if (m.unresolved) items.push({ dateKey: dk, shiftId: sid, message: m })
          }
        }
      }
      items.sort((a, b) => a.message.timestamp - b.message.timestamp)
      return items
    },
    [store],
  )

  return {
    getDayMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    mergeWithPrevious,
    getCarryOver,
    storageError,
  }
}

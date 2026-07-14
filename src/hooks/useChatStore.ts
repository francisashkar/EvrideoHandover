import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db, firebaseEnabled, MESSAGES_COLLECTION } from '../firebase'
import type { CarryOverItem, ChatMessage, ChatStore, DayMessages, ShiftId } from '../types'
import { SHIFT_ORDER, createEmptyDayMessages } from '../types'

const STORAGE_KEY = 'noc-chat-store'

export interface ChatStoreApi {
  getDayMessages: (dateKey: string) => DayMessages
  addMessage: (dateKey: string, shiftId: ShiftId, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateMessage: (dateKey: string, shiftId: ShiftId, messageId: string, patch: Partial<ChatMessage>) => void
  deleteMessage: (dateKey: string, shiftId: ShiftId, messageId: string) => void
  mergeWithPrevious: (dateKey: string, shiftId: ShiftId, messageId: string) => void
  getCarryOver: (dateKey: string, shiftId: ShiftId) => CarryOverItem[]
  storageError: boolean
}

/** True when strictly earlier than the given date+shift (used for carry-over). */
function isBefore(dk: string, sid: ShiftId, dateKey: string, shiftId: ShiftId): boolean {
  if (dk < dateKey) return true
  if (dk > dateKey) return false
  return SHIFT_ORDER.indexOf(sid) < SHIFT_ORDER.indexOf(shiftId)
}

/** Merged-message field computation shared by both backends. */
function computeMerged(target: ChatMessage, source: ChatMessage): ChatMessage {
  const mergedAttachments = [...(target.attachments ?? []), ...(source.attachments ?? [])]
  return {
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
}

// ---------------------------------------------------------------------------
// Firestore backend
// ---------------------------------------------------------------------------

const SHIFT_TO_NUMBER: Record<ShiftId, number> = { shift1: 1, shift2: 2, shift3: 3 }
const NUMBER_TO_SHIFT: Record<number, ShiftId> = { 1: 'shift1', 2: 'shift2', 3: 'shift3' }

function docToMessage(id: string, data: DocumentData): ChatMessage {
  const ts = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : (data.client_ts as number)
  return {
    id,
    operator: (data.operator_name as string) ?? '',
    text: (data.text as string) ?? '',
    timestamp: ts ?? Date.now(),
    tag: data.tag ?? 'update',
    pinned: Boolean(data.pinned),
    unresolved: Boolean(data.unresolved),
    attachments: Array.isArray(data.attachments) && data.attachments.length > 0 ? data.attachments : undefined,
  }
}

function messageToDocFields(dateKey: string, shiftId: ShiftId, m: Omit<ChatMessage, 'id' | 'timestamp'>) {
  return {
    date: dateKey,
    shift: SHIFT_TO_NUMBER[shiftId],
    operator_name: m.operator,
    text: m.text,
    timestamp: serverTimestamp(),
    client_ts: Date.now(),
    tag: m.tag ?? 'update',
    pinned: Boolean(m.pinned),
    unresolved: Boolean(m.unresolved),
    attachments: m.attachments ?? [],
  }
}

function patchToDocFields(patch: Partial<ChatMessage>) {
  const fields: DocumentData = {}
  if (patch.operator !== undefined) fields.operator_name = patch.operator
  if (patch.text !== undefined) fields.text = patch.text
  if (patch.tag !== undefined) fields.tag = patch.tag
  if (patch.pinned !== undefined) fields.pinned = patch.pinned
  if (patch.unresolved !== undefined) fields.unresolved = patch.unresolved
  if (patch.attachments !== undefined) fields.attachments = patch.attachments ?? []
  return fields
}

function useFirestoreChatStore(activeDateKey: string): ChatStoreApi {
  const [dayMessages, setDayMessages] = useState<DayMessages>(createEmptyDayMessages)
  const [unresolvedAll, setUnresolvedAll] = useState<CarryOverItem[]>([])
  const [storageError, setStorageError] = useState(false)

  // Real-time listener for the selected date
  useEffect(() => {
    if (!db) return
    setDayMessages(createEmptyDayMessages())
    const q = query(collection(db, MESSAGES_COLLECTION), where('date', '==', activeDateKey))
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const next = createEmptyDayMessages()
        snapshot.docs.forEach((d) => {
          const data = d.data({ serverTimestamps: 'estimate' })
          const shiftId = NUMBER_TO_SHIFT[data.shift as number]
          if (shiftId) next[shiftId].push(docToMessage(d.id, data))
        })
        for (const sid of SHIFT_ORDER) next[sid].sort((a, b) => a.timestamp - b.timestamp)
        setDayMessages(next)
        setStorageError(false)
      },
      () => setStorageError(true),
    )
    return unsub
  }, [activeDateKey])

  // Real-time listener for open (unresolved) items across all dates — feeds carry-over
  useEffect(() => {
    if (!db) return
    const q = query(collection(db, MESSAGES_COLLECTION), where('unresolved', '==', true))
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: CarryOverItem[] = []
        snapshot.docs.forEach((d) => {
          const data = d.data({ serverTimestamps: 'estimate' })
          const shiftId = NUMBER_TO_SHIFT[data.shift as number]
          if (shiftId) {
            items.push({ dateKey: data.date as string, shiftId, message: docToMessage(d.id, data) })
          }
        })
        items.sort((a, b) => a.message.timestamp - b.message.timestamp)
        setUnresolvedAll(items)
      },
      () => setStorageError(true),
    )
    return unsub
  }, [])

  const getDayMessages = useCallback(() => dayMessages, [dayMessages])

  const addMessage = useCallback(
    (dateKey: string, shiftId: ShiftId, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      if (!db) return
      addDoc(collection(db, MESSAGES_COLLECTION), messageToDocFields(dateKey, shiftId, message)).catch(() =>
        setStorageError(true),
      )
    },
    [],
  )

  const updateMessage = useCallback(
    (_dateKey: string, _shiftId: ShiftId, messageId: string, patch: Partial<ChatMessage>) => {
      if (!db) return
      updateDoc(doc(db, MESSAGES_COLLECTION, messageId), patchToDocFields(patch)).catch(() =>
        setStorageError(true),
      )
    },
    [],
  )

  const deleteMessage = useCallback((_dateKey: string, _shiftId: ShiftId, messageId: string) => {
    if (!db) return
    deleteDoc(doc(db, MESSAGES_COLLECTION, messageId)).catch(() => setStorageError(true))
  }, [])

  const mergeWithPrevious = useCallback(
    (_dateKey: string, shiftId: ShiftId, messageId: string) => {
      if (!db) return
      const list = dayMessages[shiftId]
      const idx = list.findIndex((m) => m.id === messageId)
      if (idx < 1) return
      const target = list[idx - 1]
      const source = list[idx]
      if (target.operator !== source.operator) return

      const merged = computeMerged(target, source)
      const batch = writeBatch(db)
      batch.update(doc(db, MESSAGES_COLLECTION, target.id), {
        text: merged.text,
        tag: merged.tag ?? 'update',
        pinned: Boolean(merged.pinned),
        unresolved: Boolean(merged.unresolved),
        attachments: merged.attachments ?? [],
      })
      batch.delete(doc(db, MESSAGES_COLLECTION, source.id))
      batch.commit().catch(() => setStorageError(true))
    },
    [dayMessages],
  )

  const getCarryOver = useCallback(
    (dateKey: string, shiftId: ShiftId): CarryOverItem[] =>
      unresolvedAll.filter((item) => isBefore(item.dateKey, item.shiftId, dateKey, shiftId)),
    [unresolvedAll],
  )

  return useMemo(
    () => ({
      getDayMessages,
      addMessage,
      updateMessage,
      deleteMessage,
      mergeWithPrevious,
      getCarryOver,
      storageError,
    }),
    [getDayMessages, addMessage, updateMessage, deleteMessage, mergeWithPrevious, getCarryOver, storageError],
  )
}

// ---------------------------------------------------------------------------
// localStorage backend (fallback when Firebase env vars are missing)
// ---------------------------------------------------------------------------

function loadStore(): ChatStore {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored !== null ? (JSON.parse(stored) as ChatStore) : {}
  } catch {
    return {}
  }
}

function useLocalChatStore(): ChatStoreApi {
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
          [dateKey]: { ...day, [shiftId]: [...day[shiftId], full] },
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

  const deleteMessage = useCallback((dateKey: string, shiftId: ShiftId, messageId: string) => {
    setStore((prev) => {
      const day = prev[dateKey] ?? createEmptyDayMessages()
      return {
        ...prev,
        [dateKey]: { ...day, [shiftId]: day[shiftId].filter((m) => m.id !== messageId) },
      }
    })
  }, [])

  const mergeWithPrevious = useCallback((dateKey: string, shiftId: ShiftId, messageId: string) => {
    setStore((prev) => {
      const day = prev[dateKey] ?? createEmptyDayMessages()
      const list = day[shiftId]
      const idx = list.findIndex((m) => m.id === messageId)
      if (idx < 1) return prev
      const target = list[idx - 1]
      const source = list[idx]
      if (target.operator !== source.operator) return prev
      const merged = computeMerged(target, source)
      const next = [...list.slice(0, idx - 1), merged, ...list.slice(idx + 1)]
      return { ...prev, [dateKey]: { ...day, [shiftId]: next } }
    })
  }, [])

  const getCarryOver = useCallback(
    (dateKey: string, shiftId: ShiftId): CarryOverItem[] => {
      const items: CarryOverItem[] = []
      for (const [dk, day] of Object.entries(store)) {
        for (const sid of SHIFT_ORDER) {
          if (!isBefore(dk, sid, dateKey, shiftId)) continue
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

  return useMemo(
    () => ({
      getDayMessages,
      addMessage,
      updateMessage,
      deleteMessage,
      mergeWithPrevious,
      getCarryOver,
      storageError,
    }),
    [getDayMessages, addMessage, updateMessage, deleteMessage, mergeWithPrevious, getCarryOver, storageError],
  )
}

// ---------------------------------------------------------------------------
// Public hook — picks the backend once at startup
// ---------------------------------------------------------------------------

export function useChatStore(activeDateKey: string): ChatStoreApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreChatStore(activeDateKey)
  const localApi = useLocalChatStore()
  return firebaseEnabled ? firestoreApi : localApi
}

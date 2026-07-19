import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db, firebaseEnabled, RUNBOOK_COLLECTION } from '../firebase'
import type { MessageAttachment } from '../types'

const STORAGE_KEY = 'noc-runbook'

export interface RunbookEntry {
  id: string
  title: string
  category: string
  content: string
  images: MessageAttachment[]
  createdAt: number
  updatedAt: number
}

export type RunbookInput = Pick<RunbookEntry, 'title' | 'category' | 'content' | 'images'>

export interface RunbookApi {
  entries: RunbookEntry[]
  addEntry: (input: RunbookInput) => void
  updateEntry: (id: string, input: RunbookInput) => void
  deleteEntry: (id: string) => void
}

function docToEntry(id: string, data: DocumentData): RunbookEntry {
  return {
    id,
    title: (data.title as string) ?? '',
    category: (data.category as string) ?? '',
    content: (data.content as string) ?? '',
    images: Array.isArray(data.images) ? (data.images as MessageAttachment[]) : [],
    createdAt: (data.created_at as number) ?? 0,
    updatedAt: (data.updated_at as number) ?? 0,
  }
}

function useFirestoreRunbook(): RunbookApi {
  const [entries, setEntries] = useState<RunbookEntry[]>([])

  useEffect(() => {
    if (!db) return
    return onSnapshot(collection(db, RUNBOOK_COLLECTION), (snap) => {
      const next = snap.docs.map((d) => docToEntry(d.id, d.data()))
      next.sort((a, b) => a.title.localeCompare(b.title, 'he'))
      setEntries(next)
    })
  }, [])

  const addEntry = useCallback((input: RunbookInput) => {
    if (!db || !input.title.trim()) return
    addDoc(collection(db, RUNBOOK_COLLECTION), {
      ...input,
      created_at: Date.now(),
      updated_at: Date.now(),
    }).catch(() => {})
  }, [])

  const updateEntry = useCallback((id: string, input: RunbookInput) => {
    if (!db) return
    updateDoc(doc(db, RUNBOOK_COLLECTION, id), { ...input, updated_at: Date.now() }).catch(() => {})
  }, [])

  const deleteEntry = useCallback((id: string) => {
    if (!db) return
    deleteDoc(doc(db, RUNBOOK_COLLECTION, id)).catch(() => {})
  }, [])

  return useMemo(
    () => ({ entries, addEntry, updateEntry, deleteEntry }),
    [entries, addEntry, updateEntry, deleteEntry],
  )
}

function useLocalRunbook(): RunbookApi {
  const [entries, setEntries] = useState<RunbookEntry[]>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as RunbookEntry[]
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // fall through
    }
    return []
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // ignore
    }
  }, [entries])

  const addEntry = useCallback((input: RunbookInput) => {
    if (!input.title.trim()) return
    setEntries((prev) =>
      [
        ...prev,
        {
          ...input,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ].sort((a, b) => a.title.localeCompare(b.title, 'he')),
    )
  }, [])

  const updateEntry = useCallback((id: string, input: RunbookInput) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...input, updatedAt: Date.now() } : e)))
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return useMemo(
    () => ({ entries, addEntry, updateEntry, deleteEntry }),
    [entries, addEntry, updateEntry, deleteEntry],
  )
}

export function useRunbook(): RunbookApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreRunbook()
  const localApi = useLocalRunbook()
  return firebaseEnabled ? firestoreApi : localApi
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db, firebaseEnabled, TAGS_COLLECTION } from '../firebase'
import type { TagDef } from '../types'
import { DEFAULT_TAGS } from '../types'

const STORAGE_KEY = 'noc-tags'

export interface TagInput {
  label: string
  chip: string
  ticketPrefix: string
}

export interface TagsApi {
  tags: TagDef[]
  addTag: (input: TagInput) => void
  updateTag: (id: string, input: TagInput) => void
  deleteTag: (id: string) => void
}

function slugify(label: string): string {
  return (
    label
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}-]/gu, '') || `tag-${Date.now()}`
  )
}

function useFirestoreTags(): TagsApi {
  // Default tags shown immediately so the chip row isn't empty while the
  // first snapshot loads (or if security rules block the read entirely)
  const [tags, setTags] = useState<TagDef[]>(DEFAULT_TAGS)
  const seeded = useRef(false)

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      collection(db, TAGS_COLLECTION),
      (snap) => {
        if (snap.empty && !seeded.current) {
          seeded.current = true
          DEFAULT_TAGS.forEach((t) => {
            setDoc(doc(db!, TAGS_COLLECTION, t.id), t).catch(() => {})
          })
          return
        }
        const next = snap.docs.map((d) => d.data() as TagDef)
        if (next.length > 0) setTags(next)
      },
      () => {
        // Read blocked (e.g. security rules not yet updated for this collection) —
        // keep showing the built-in defaults instead of an empty tag list
        setTags(DEFAULT_TAGS)
      },
    )
  }, [])

  const addTag = useCallback((input: TagInput) => {
    if (!db || !input.label.trim()) return
    const id = slugify(input.label)
    setDoc(doc(db, TAGS_COLLECTION, id), { id, ...input }).catch(() => {})
  }, [])

  const updateTag = useCallback((id: string, input: TagInput) => {
    if (!db) return
    setDoc(doc(db, TAGS_COLLECTION, id), { id, ...input }).catch(() => {})
  }, [])

  const deleteTag = useCallback(
    (id: string) => {
      if (!db) return
      const tag = tags.find((t) => t.id === id)
      if (tag?.builtin) return
      deleteDoc(doc(db, TAGS_COLLECTION, id)).catch(() => {})
    },
    [tags],
  )

  return useMemo(() => ({ tags, addTag, updateTag, deleteTag }), [tags, addTag, updateTag, deleteTag])
}

function useLocalTags(): TagsApi {
  const [tags, setTags] = useState<TagDef[]>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as TagDef[]
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // fall through
    }
    return DEFAULT_TAGS
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tags))
    } catch {
      // ignore
    }
  }, [tags])

  const addTag = useCallback((input: TagInput) => {
    if (!input.label.trim()) return
    const id = slugify(input.label)
    setTags((prev) => [...prev.filter((t) => t.id !== id), { id, ...input }])
  }, [])

  const updateTag = useCallback((id: string, input: TagInput) => {
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...input } : t)))
  }, [])

  const deleteTag = useCallback((id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id || t.builtin))
  }, [])

  return useMemo(() => ({ tags, addTag, updateTag, deleteTag }), [tags, addTag, updateTag, deleteTag])
}

export function useTags(): TagsApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreTags()
  const localApi = useLocalTags()
  return firebaseEnabled ? firestoreApi : localApi
}

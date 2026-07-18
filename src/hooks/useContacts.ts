import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db, firebaseEnabled, CONTACTS_COLLECTION } from '../firebase'

const STORAGE_KEY = 'noc-contacts'

export interface Contact {
  id: string
  name: string
  role: string
  phone: string
  email: string
  notes: string
  createdAt: number
}

export type ContactInput = Omit<Contact, 'id' | 'createdAt'>

export interface ContactsApi {
  contacts: Contact[]
  addContact: (input: ContactInput) => void
  updateContact: (id: string, input: ContactInput) => void
  deleteContact: (id: string) => void
}

function docToContact(id: string, data: DocumentData): Contact {
  return {
    id,
    name: (data.name as string) ?? '',
    role: (data.role as string) ?? '',
    phone: (data.phone as string) ?? '',
    email: (data.email as string) ?? '',
    notes: (data.notes as string) ?? '',
    createdAt: (data.created_at as number) ?? 0,
  }
}

function useFirestoreContacts(): ContactsApi {
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    if (!db) return
    return onSnapshot(collection(db, CONTACTS_COLLECTION), (snap) => {
      const next = snap.docs.map((d) => docToContact(d.id, d.data()))
      next.sort((a, b) => a.name.localeCompare(b.name, 'he'))
      setContacts(next)
    })
  }, [])

  const addContact = useCallback((input: ContactInput) => {
    if (!db || !input.name.trim()) return
    addDoc(collection(db, CONTACTS_COLLECTION), { ...input, created_at: Date.now() }).catch(() => {})
  }, [])

  const updateContact = useCallback((id: string, input: ContactInput) => {
    if (!db) return
    updateDoc(doc(db, CONTACTS_COLLECTION, id), { ...input }).catch(() => {})
  }, [])

  const deleteContact = useCallback((id: string) => {
    if (!db) return
    deleteDoc(doc(db, CONTACTS_COLLECTION, id)).catch(() => {})
  }, [])

  return useMemo(
    () => ({ contacts, addContact, updateContact, deleteContact }),
    [contacts, addContact, updateContact, deleteContact],
  )
}

function useLocalContacts(): ContactsApi {
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Contact[]
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // fall through
    }
    return []
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
    } catch {
      // ignore
    }
  }, [contacts])

  const addContact = useCallback((input: ContactInput) => {
    if (!input.name.trim()) return
    setContacts((prev) =>
      [...prev, { ...input, id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, createdAt: Date.now() }].sort(
        (a, b) => a.name.localeCompare(b.name, 'he'),
      ),
    )
  }, [])

  const updateContact = useCallback((id: string, input: ContactInput) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...input } : c)))
  }, [])

  const deleteContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return useMemo(
    () => ({ contacts, addContact, updateContact, deleteContact }),
    [contacts, addContact, updateContact, deleteContact],
  )
}

export function useContacts(): ContactsApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreContacts()
  const localApi = useLocalContacts()
  return firebaseEnabled ? firestoreApi : localApi
}

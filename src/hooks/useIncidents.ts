import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db, firebaseEnabled, INCIDENTS_COLLECTION } from '../firebase'
import type {
  IncidentItem,
  IncidentResolution,
  IncidentSource,
  IncidentTimelineEntry,
  IncidentUrgency,
  MessageAttachment,
  ShiftId,
} from '../types'

const STORAGE_KEY = 'noc-incidents'

export interface NewIncidentInput {
  title: string
  description?: string
  urgency: IncidentUrgency
  createdBy: string
  source: IncidentSource
  attachments?: MessageAttachment[]
}

export interface IncidentsApi {
  incidents: IncidentItem[]
  addIncident: (input: NewIncidentInput) => string
  updateIncident: (
    id: string,
    patch: Partial<Pick<IncidentItem, 'title' | 'description' | 'urgency' | 'attachments'>>,
  ) => void
  deleteIncident: (id: string) => void
  addTimelineEntry: (id: string, text: string, operator: string, sourceMessageId?: string) => void
  /** Remove the timeline entry that was created from a given chat message (used when that message is deleted) */
  removeTimelineEntryBySource: (id: string, sourceMessageId: string) => void
  resolveIncident: (id: string, resolution: IncidentResolution) => void
  reopenIncident: (id: string) => void
  /** Find the incident tied to a chat message, if one exists */
  findBySource: (dateKey: string, shiftId: ShiftId, messageId: string) => IncidentItem | undefined
}

function docToIncident(id: string, data: DocumentData): IncidentItem {
  return {
    id,
    title: (data.title as string) ?? '',
    description: (data.description as string) || undefined,
    urgency: (data.urgency as IncidentUrgency) ?? 'medium',
    open: data.open !== false,
    source: (data.source as IncidentSource) ?? { kind: 'manual' },
    timeline: Array.isArray(data.timeline) ? (data.timeline as IncidentTimelineEntry[]) : [],
    attachments: Array.isArray(data.attachments) ? (data.attachments as MessageAttachment[]) : [],
    resolution: (data.resolution as IncidentResolution | undefined) ?? undefined,
    createdBy: (data.created_by as string) ?? '',
    createdAt: (data.created_at as number) ?? 0,
  }
}

function makeTimelineEntry(text: string, operator: string, sourceMessageId?: string): IncidentTimelineEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text,
    operator,
    at: Date.now(),
    sourceMessageId,
  }
}

// ---------------------------------------------------------------------------
// Firestore backend
// ---------------------------------------------------------------------------

function useFirestoreIncidents(): IncidentsApi {
  const [incidents, setIncidents] = useState<IncidentItem[]>([])

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      collection(db, INCIDENTS_COLLECTION),
      (snap) => {
        const next = snap.docs.map((d) => docToIncident(d.id, d.data()))
        next.sort((a, b) => b.createdAt - a.createdAt)
        setIncidents(next)
      },
      () => setIncidents([]),
    )
  }, [])

  const addIncident = useCallback((input: NewIncidentInput): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    if (!db || !input.title.trim()) return id
    addDoc(collection(db, INCIDENTS_COLLECTION), {
      title: input.title.trim(),
      description: input.description?.trim() || '',
      urgency: input.urgency,
      open: true,
      source: input.source,
      timeline: [],
      attachments: input.attachments ?? [],
      created_by: input.createdBy,
      created_at: Date.now(),
    }).catch(() => {})
    return id
  }, [])

  const updateIncident = useCallback(
    (
      id: string,
      patch: Partial<Pick<IncidentItem, 'title' | 'description' | 'urgency' | 'attachments'>>,
    ) => {
      if (!db) return
      const fields: DocumentData = {}
      if (patch.title !== undefined) fields.title = patch.title
      if (patch.description !== undefined) fields.description = patch.description
      if (patch.urgency !== undefined) fields.urgency = patch.urgency
      if (patch.attachments !== undefined) fields.attachments = patch.attachments
      updateDoc(doc(db, INCIDENTS_COLLECTION, id), fields).catch(() => {})
    },
    [],
  )

  const deleteIncident = useCallback((id: string) => {
    if (!db) return
    deleteDoc(doc(db, INCIDENTS_COLLECTION, id)).catch(() => {})
  }, [])

  const addTimelineEntry = useCallback(
    (id: string, text: string, operator: string, sourceMessageId?: string) => {
      if (!db || !text.trim()) return
      const incident = incidents.find((i) => i.id === id)
      if (!incident) return
      updateDoc(doc(db, INCIDENTS_COLLECTION, id), {
        timeline: [...incident.timeline, makeTimelineEntry(text.trim(), operator, sourceMessageId)],
      }).catch(() => {})
    },
    [incidents],
  )

  const removeTimelineEntryBySource = useCallback(
    (id: string, sourceMessageId: string) => {
      if (!db) return
      const incident = incidents.find((i) => i.id === id)
      if (!incident) return
      updateDoc(doc(db, INCIDENTS_COLLECTION, id), {
        timeline: incident.timeline.filter((t) => t.sourceMessageId !== sourceMessageId),
      }).catch(() => {})
    },
    [incidents],
  )

  const resolveIncident = useCallback((id: string, resolution: IncidentResolution) => {
    if (!db) return
    updateDoc(doc(db, INCIDENTS_COLLECTION, id), { open: false, resolution }).catch(() => {})
  }, [])

  const reopenIncident = useCallback((id: string) => {
    if (!db) return
    updateDoc(doc(db, INCIDENTS_COLLECTION, id), { open: true, resolution: null }).catch(() => {})
  }, [])

  const findBySource = useCallback(
    (dateKey: string, shiftId: ShiftId, messageId: string) =>
      incidents.find(
        (i) =>
          i.source.kind === 'chat' &&
          i.source.dateKey === dateKey &&
          i.source.shiftId === shiftId &&
          i.source.messageId === messageId,
      ),
    [incidents],
  )

  return useMemo(
    () => ({
      incidents,
      addIncident,
      updateIncident,
      deleteIncident,
      addTimelineEntry,
      removeTimelineEntryBySource,
      resolveIncident,
      reopenIncident,
      findBySource,
    }),
    [
      incidents,
      addIncident,
      updateIncident,
      deleteIncident,
      addTimelineEntry,
      removeTimelineEntryBySource,
      resolveIncident,
      reopenIncident,
      findBySource,
    ],
  )
}

// ---------------------------------------------------------------------------
// localStorage backend (fallback)
// ---------------------------------------------------------------------------

function loadIncidents(): IncidentItem[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as IncidentItem[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // fall through
  }
  return []
}

function useLocalIncidents(): IncidentsApi {
  const [incidents, setIncidents] = useState<IncidentItem[]>(loadIncidents)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents))
    } catch {
      // ignore
    }
  }, [incidents])

  const addIncident = useCallback((input: NewIncidentInput): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    if (!input.title.trim()) return id
    setIncidents((prev) => [
      {
        id,
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        urgency: input.urgency,
        open: true,
        source: input.source,
        timeline: [],
        attachments: input.attachments ?? [],
        createdBy: input.createdBy,
        createdAt: Date.now(),
      },
      ...prev,
    ])
    return id
  }, [])

  const updateIncident = useCallback(
    (
      id: string,
      patch: Partial<Pick<IncidentItem, 'title' | 'description' | 'urgency' | 'attachments'>>,
    ) => {
      setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    },
    [],
  )

  const deleteIncident = useCallback((id: string) => {
    setIncidents((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const addTimelineEntry = useCallback((id: string, text: string, operator: string, sourceMessageId?: string) => {
    if (!text.trim()) return
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, timeline: [...i.timeline, makeTimelineEntry(text.trim(), operator, sourceMessageId)] }
          : i,
      ),
    )
  }, [])

  const removeTimelineEntryBySource = useCallback((id: string, sourceMessageId: string) => {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, timeline: i.timeline.filter((t) => t.sourceMessageId !== sourceMessageId) } : i,
      ),
    )
  }, [])

  const resolveIncident = useCallback((id: string, resolution: IncidentResolution) => {
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, open: false, resolution } : i)))
  }, [])

  const reopenIncident = useCallback((id: string) => {
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, open: true, resolution: undefined } : i)))
  }, [])

  const findBySource = useCallback(
    (dateKey: string, shiftId: ShiftId, messageId: string) =>
      incidents.find(
        (i) =>
          i.source.kind === 'chat' &&
          i.source.dateKey === dateKey &&
          i.source.shiftId === shiftId &&
          i.source.messageId === messageId,
      ),
    [incidents],
  )

  return useMemo(
    () => ({
      incidents,
      addIncident,
      updateIncident,
      deleteIncident,
      addTimelineEntry,
      removeTimelineEntryBySource,
      resolveIncident,
      reopenIncident,
      findBySource,
    }),
    [
      incidents,
      addIncident,
      updateIncident,
      deleteIncident,
      addTimelineEntry,
      removeTimelineEntryBySource,
      resolveIncident,
      reopenIncident,
      findBySource,
    ],
  )
}

export function useIncidents(): IncidentsApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreIncidents()
  const localApi = useLocalIncidents()
  return firebaseEnabled ? firestoreApi : localApi
}

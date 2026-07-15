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
import { db, firebaseEnabled, TASKS_COLLECTION } from '../firebase'
import type { ShiftId } from '../types'

const STORAGE_KEY = 'noc-tasks'

export type TaskAssignee =
  | { kind: 'operator'; name: string }
  | { kind: 'shift'; shiftId: ShiftId }

export interface Task {
  id: string
  text: string
  description?: string
  /** YYYY-MM-DD — when set, the task belongs to that date only; empty = every day */
  date?: string
  done: boolean
  createdAt: number
  assignee?: TaskAssignee
}

export interface NewTaskInput {
  text: string
  description?: string
  date?: string
  assignee?: TaskAssignee
}

export type TaskPatch = Partial<Pick<Task, 'text' | 'description' | 'date' | 'assignee'>>

export interface TasksApi {
  tasks: Task[]
  addTask: (input: NewTaskInput) => void
  updateTask: (id: string, patch: TaskPatch) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
}

// ---------------------------------------------------------------------------
// Firestore backend
// ---------------------------------------------------------------------------

function docToTask(id: string, data: DocumentData): Task {
  return {
    id,
    text: (data.text as string) ?? '',
    description: (data.description as string) || undefined,
    date: (data.date as string) || undefined,
    done: Boolean(data.done),
    createdAt: (data.created_at as number) ?? 0,
    assignee: (data.assignee as TaskAssignee | null) ?? undefined,
  }
}

function useFirestoreTasks(): TasksApi {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    if (!db) return
    const unsub = onSnapshot(collection(db, TASKS_COLLECTION), (snapshot) => {
      const next = snapshot.docs.map((d) => docToTask(d.id, d.data()))
      next.sort((a, b) => a.createdAt - b.createdAt)
      setTasks(next)
    })
    return unsub
  }, [])

  const addTask = useCallback((input: NewTaskInput) => {
    const trimmed = input.text.trim()
    if (!db || !trimmed) return
    addDoc(collection(db, TASKS_COLLECTION), {
      text: trimmed,
      description: input.description?.trim() || null,
      date: input.date || null,
      done: false,
      created_at: Date.now(),
      assignee: input.assignee ?? null,
    }).catch(() => {})
  }, [])

  const updateTask = useCallback((id: string, patch: TaskPatch) => {
    if (!db) return
    const fields: DocumentData = {}
    if ('text' in patch && patch.text !== undefined) fields.text = patch.text
    if ('description' in patch) fields.description = patch.description ?? null
    if ('date' in patch) fields.date = patch.date ?? null
    if ('assignee' in patch) fields.assignee = patch.assignee ?? null
    updateDoc(doc(db, TASKS_COLLECTION, id), fields).catch(() => {})
  }, [])

  const toggleTask = useCallback(
    (id: string) => {
      if (!db) return
      const task = tasks.find((t) => t.id === id)
      if (!task) return
      updateDoc(doc(db, TASKS_COLLECTION, id), { done: !task.done }).catch(() => {})
    },
    [tasks],
  )

  const deleteTask = useCallback((id: string) => {
    if (!db) return
    deleteDoc(doc(db, TASKS_COLLECTION, id)).catch(() => {})
  }, [])

  return useMemo(
    () => ({ tasks, addTask, updateTask, toggleTask, deleteTask }),
    [tasks, addTask, updateTask, toggleTask, deleteTask],
  )
}

// ---------------------------------------------------------------------------
// localStorage backend (fallback)
// ---------------------------------------------------------------------------

function loadTasks(): Task[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      const parsed = JSON.parse(stored) as Task[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // fall through
  }
  return []
}

function useLocalTasks(): TasksApi {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      // localStorage unavailable — fail silently
    }
  }, [tasks])

  const addTask = useCallback((input: NewTaskInput) => {
    const trimmed = input.text.trim()
    if (!trimmed) return
    setTasks((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text: trimmed,
        description: input.description?.trim() || undefined,
        date: input.date || undefined,
        done: false,
        createdAt: Date.now(),
        assignee: input.assignee,
      },
    ])
  }, [])

  const updateTask = useCallback((id: string, patch: TaskPatch) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return useMemo(
    () => ({ tasks, addTask, updateTask, toggleTask, deleteTask }),
    [tasks, addTask, updateTask, toggleTask, deleteTask],
  )
}

export function useTasks(): TasksApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreTasks()
  const localApi = useLocalTasks()
  return firebaseEnabled ? firestoreApi : localApi
}

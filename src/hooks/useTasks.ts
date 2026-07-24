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
  /** Recurring tasks reset daily — completion is tracked per date in doneDates */
  recurring?: boolean
  done: boolean
  doneDates?: string[]
  createdAt: number
  assignee?: TaskAssignee
  /** Manual sort position — falls back to createdAt when unset (see sortValue) */
  order?: number
}

/** Whether the task counts as done for the given date. */
export function isTaskDone(task: Task, dateKey: string): boolean {
  return task.recurring ? (task.doneDates ?? []).includes(dateKey) : task.done
}

/** Sort key for manual ordering — tasks without an explicit order sort by creation time. */
function sortValue(task: Task): number {
  return task.order ?? task.createdAt
}

/** New order value that sits between two neighboring tasks (either end may be open). */
function computeOrder(before?: Task, after?: Task): number {
  const beforeValue = before ? sortValue(before) : undefined
  const afterValue = after ? sortValue(after) : undefined
  if (beforeValue !== undefined && afterValue !== undefined) return (beforeValue + afterValue) / 2
  if (beforeValue !== undefined) return beforeValue + 1000
  if (afterValue !== undefined) return afterValue - 1000
  return Date.now()
}

export interface NewTaskInput {
  text: string
  description?: string
  date?: string
  recurring?: boolean
  assignee?: TaskAssignee
}

export type TaskPatch = Partial<Pick<Task, 'text' | 'description' | 'date' | 'recurring' | 'assignee'>>

export interface TasksApi {
  tasks: Task[]
  addTask: (input: NewTaskInput) => void
  updateTask: (id: string, patch: TaskPatch) => void
  /** Toggle done state; for recurring tasks the toggle applies to the given date only */
  toggleTask: (id: string, dateKey: string) => void
  deleteTask: (id: string) => void
  /** Move a task to sit between beforeId and afterId (either may be omitted for start/end of list) */
  reorderTask: (id: string, beforeId?: string, afterId?: string) => void
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
    recurring: Boolean(data.recurring),
    done: Boolean(data.done),
    doneDates: Array.isArray(data.done_dates) ? (data.done_dates as string[]) : undefined,
    createdAt: (data.created_at as number) ?? 0,
    assignee: (data.assignee as TaskAssignee | null) ?? undefined,
    order: typeof data.order === 'number' ? (data.order as number) : undefined,
  }
}

function useFirestoreTasks(): TasksApi {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    if (!db) return
    const unsub = onSnapshot(collection(db, TASKS_COLLECTION), (snapshot) => {
      const next = snapshot.docs.map((d) => docToTask(d.id, d.data()))
      next.sort((a, b) => sortValue(a) - sortValue(b))
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
      recurring: Boolean(input.recurring),
      done: false,
      done_dates: [],
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
    if ('recurring' in patch) fields.recurring = Boolean(patch.recurring)
    if ('assignee' in patch) fields.assignee = patch.assignee ?? null
    updateDoc(doc(db, TASKS_COLLECTION, id), fields).catch(() => {})
  }, [])

  const toggleTask = useCallback(
    (id: string, dateKey: string) => {
      if (!db) return
      const task = tasks.find((t) => t.id === id)
      if (!task) return
      if (task.recurring) {
        const set = new Set(task.doneDates ?? [])
        if (set.has(dateKey)) set.delete(dateKey)
        else set.add(dateKey)
        updateDoc(doc(db, TASKS_COLLECTION, id), { done_dates: [...set] }).catch(() => {})
      } else {
        updateDoc(doc(db, TASKS_COLLECTION, id), { done: !task.done }).catch(() => {})
      }
    },
    [tasks],
  )

  const deleteTask = useCallback((id: string) => {
    if (!db) return
    deleteDoc(doc(db, TASKS_COLLECTION, id)).catch(() => {})
  }, [])

  const reorderTask = useCallback(
    (id: string, beforeId?: string, afterId?: string) => {
      if (!db) return
      const before = beforeId ? tasks.find((t) => t.id === beforeId) : undefined
      const after = afterId ? tasks.find((t) => t.id === afterId) : undefined
      const newOrder = computeOrder(before, after)
      updateDoc(doc(db, TASKS_COLLECTION, id), { order: newOrder }).catch(() => {})
    },
    [tasks],
  )

  return useMemo(
    () => ({ tasks, addTask, updateTask, toggleTask, deleteTask, reorderTask }),
    [tasks, addTask, updateTask, toggleTask, deleteTask, reorderTask],
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
        recurring: Boolean(input.recurring),
        done: false,
        doneDates: [],
        createdAt: Date.now(),
        assignee: input.assignee,
      },
    ])
  }, [])

  const updateTask = useCallback((id: string, patch: TaskPatch) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const toggleTask = useCallback((id: string, dateKey: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        if (t.recurring) {
          const set = new Set(t.doneDates ?? [])
          if (set.has(dateKey)) set.delete(dateKey)
          else set.add(dateKey)
          return { ...t, doneDates: [...set] }
        }
        return { ...t, done: !t.done }
      }),
    )
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const reorderTask = useCallback((id: string, beforeId?: string, afterId?: string) => {
    setTasks((prev) => {
      const before = beforeId ? prev.find((t) => t.id === beforeId) : undefined
      const after = afterId ? prev.find((t) => t.id === afterId) : undefined
      const newOrder = computeOrder(before, after)
      return prev.map((t) => (t.id === id ? { ...t, order: newOrder } : t))
    })
  }, [])

  return useMemo(
    () => ({ tasks: [...tasks].sort((a, b) => sortValue(a) - sortValue(b)), addTask, updateTask, toggleTask, deleteTask, reorderTask }),
    [tasks, addTask, updateTask, toggleTask, deleteTask, reorderTask],
  )
}

export function useTasks(): TasksApi {
  // Both hooks are always called (rules of hooks); only one does real work
  const firestoreApi = useFirestoreTasks()
  const localApi = useLocalTasks()
  return firebaseEnabled ? firestoreApi : localApi
}

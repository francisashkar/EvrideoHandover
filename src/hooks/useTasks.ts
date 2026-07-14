import { useCallback, useEffect, useState } from 'react'
import type { ShiftId } from '../types'

const STORAGE_KEY = 'noc-tasks'

export type TaskAssignee =
  | { kind: 'operator'; name: string }
  | { kind: 'shift'; shiftId: ShiftId }

export interface Task {
  id: string
  text: string
  done: boolean
  createdAt: number
  assignee?: TaskAssignee
}

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

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      // localStorage unavailable — fail silently
    }
  }, [tasks])

  const addTask = useCallback((text: string, assignee?: TaskAssignee) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setTasks((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text: trimmed,
        done: false,
        createdAt: Date.now(),
        assignee,
      },
    ])
  }, [])

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { tasks, addTask, toggleTask, deleteTask }
}

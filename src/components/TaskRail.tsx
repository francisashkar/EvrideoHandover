import { useRef, useState } from 'react'
import { CalendarDays, Check, ListTodo, User, Users } from 'lucide-react'
import type { Task } from '../hooks/useTasks'
import type { ShiftId } from '../types'
import { SHIFT_SHORT_LABELS } from './TaskPanel'
import { formatDateShort } from '../dateUtils'

interface TaskRailProps {
  tasks: Task[]
  shiftId: ShiftId
  dateKey: string
  onToggle: (id: string) => void
}

const ROTATIONS = ['-rotate-1', 'rotate-1', '-rotate-2', 'rotate-2']

/**
 * Fixed rail on the right side of the page showing open tasks as sticky notes.
 * A task shows only when BOTH match:
 * - shift: shift-assigned tasks appear only on their shift's tab
 *   (general / operator tasks appear on every tab)
 * - date: dated tasks appear only on their scheduled date
 *   (undated tasks appear every day)
 */
export default function TaskRail({ tasks, shiftId, dateKey, onToggle }: TaskRailProps) {
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const handleDone = (id: string) => {
    if (leavingIds.has(id)) return
    setLeavingIds((prev) => new Set(prev).add(id))
    // let the crumple animation play before the task actually flips to done
    const t = setTimeout(() => {
      onToggle(id)
      timers.current.delete(id)
      setLeavingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 350)
    timers.current.set(id, t)
  }

  const notes = tasks.filter(
    (t) =>
      !t.done &&
      (t.assignee?.kind !== 'shift' || t.assignee.shiftId === shiftId) &&
      (!t.date || t.date === dateKey),
  )

  return (
    <aside className="hidden w-56 shrink-0 flex-col overflow-hidden border-e border-noc-border bg-noc-panel/50 lg:flex">
      <div className="flex items-center gap-2 border-b border-noc-border px-3 py-2.5">
        <ListTodo className="h-4 w-4 text-noc-accent" />
        <h2 className="text-sm font-bold text-noc-t1">משימות</h2>
        {notes.length > 0 && (
          <span className="rounded-full bg-noc-accent/20 px-2 py-0.5 text-[10px] font-bold text-noc-accent">
            {notes.length}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin">
        {notes.length === 0 ? (
          <p className="mt-6 text-center text-xs text-noc-t4">אין משימות פתוחות</p>
        ) : (
          notes.map((task, i) => (
            <div
              key={task.id}
              className={`${ROTATIONS[i % ROTATIONS.length]} rounded-sm bg-yellow-200 p-2.5 text-slate-900 shadow-lg shadow-black/30 transition-transform hover:rotate-0 ${
                leavingIds.has(task.id) ? 'note-leaving' : ''
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-1">
                <div className="flex flex-wrap items-center gap-1">
                  <TaskChip task={task} />
                  {task.date && (
                    <span className="flex items-center gap-1 rounded-full bg-yellow-300/80 px-1.5 py-0.5 text-[9px] font-bold text-yellow-900">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {formatDateShort(task.date)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDone(task.id)}
                  title="סימון כבוצע"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-yellow-600/40 text-yellow-800 transition-colors hover:border-emerald-600 hover:bg-emerald-500 hover:text-white"
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
              <p className="break-words text-[11px] font-bold leading-relaxed">{task.text}</p>
              {task.description && (
                <p className="mt-0.5 break-words text-[10px] leading-relaxed text-slate-700">
                  {task.description}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

function TaskChip({ task }: { task: Task }) {
  if (task.assignee?.kind === 'shift') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-yellow-300/80 px-1.5 py-0.5 text-[9px] font-bold text-yellow-900">
        <Users className="h-2.5 w-2.5" />
        {SHIFT_SHORT_LABELS[task.assignee.shiftId]}
      </span>
    )
  }
  if (task.assignee?.kind === 'operator') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-yellow-300/80 px-1.5 py-0.5 text-[9px] font-bold text-yellow-900">
        <User className="h-2.5 w-2.5" />
        {task.assignee.name}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-yellow-300/80 px-1.5 py-0.5 text-[9px] font-bold text-yellow-900">
      כללי
    </span>
  )
}

import { useRef, useState } from 'react'
import { CalendarDays, Check, ListTodo, User, Users, Infinity as InfinityIcon, Repeat } from 'lucide-react'
import type { Task } from '../hooks/useTasks'
import { isTaskDone } from '../hooks/useTasks'
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

/** Sticky-note color families — each task gets a deterministic pick based on its id, so the color stays stable across renders. */
const NOTE_COLORS = [
  { bg: 'bg-yellow-200', text: 'text-slate-900', textSoft: 'text-slate-700', chip: 'bg-yellow-300/80 text-yellow-900', check: 'border-yellow-600/40 text-yellow-800' },
  { bg: 'bg-pink-200', text: 'text-slate-900', textSoft: 'text-slate-700', chip: 'bg-pink-300/80 text-pink-900', check: 'border-pink-600/40 text-pink-800' },
  { bg: 'bg-sky-200', text: 'text-slate-900', textSoft: 'text-slate-700', chip: 'bg-sky-300/80 text-sky-900', check: 'border-sky-600/40 text-sky-800' },
  { bg: 'bg-emerald-200', text: 'text-slate-900', textSoft: 'text-slate-700', chip: 'bg-emerald-300/80 text-emerald-900', check: 'border-emerald-600/40 text-emerald-800' },
  { bg: 'bg-orange-200', text: 'text-slate-900', textSoft: 'text-slate-700', chip: 'bg-orange-300/80 text-orange-900', check: 'border-orange-600/40 text-orange-800' },
  { bg: 'bg-violet-200', text: 'text-slate-900', textSoft: 'text-slate-700', chip: 'bg-violet-300/80 text-violet-900', check: 'border-violet-600/40 text-violet-800' },
]

/** Deterministic color per task id — same task always renders the same color, different tasks vary. */
function colorForTask(id: string): (typeof NOTE_COLORS)[number] {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return NOTE_COLORS[hash % NOTE_COLORS.length]
}

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
      !isTaskDone(t, dateKey) &&
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
          notes.map((task, i) => {
            const color = colorForTask(task.id)
            return (
              <div
                key={task.id}
                className={`${ROTATIONS[i % ROTATIONS.length]} rounded-sm ${color.bg} p-2.5 ${color.text} shadow-lg shadow-black/30 transition-transform hover:rotate-0 ${
                  leavingIds.has(task.id) ? 'note-leaving' : ''
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <TaskChip task={task} chip={color.chip} />
                    {task.recurring ? (
                      <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${color.chip}`}>
                        <Repeat className="h-2.5 w-2.5" />
                        חוזר
                      </span>
                    ) : task.date ? (
                      <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${color.chip}`}>
                        <CalendarDays className="h-2.5 w-2.5" />
                        {formatDateShort(task.date)}
                      </span>
                    ) : (
                      <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${color.chip}`}>
                        <InfinityIcon className="h-2.5 w-2.5" />
                        קבוע
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDone(task.id)}
                    title="סימון כבוצע"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors hover:border-emerald-600 hover:bg-emerald-500 hover:text-white ${color.check}`}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </div>
                <p className={`whitespace-pre-wrap break-words text-sm font-bold leading-snug ${color.text}`}>
                  {task.text}
                </p>
                {task.description && (
                  <p className={`mt-1 whitespace-pre-wrap break-words text-xs font-medium leading-snug ${color.textSoft}`}>
                    {task.description}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

function TaskChip({ task, chip }: { task: Task; chip: string }) {
  if (task.assignee?.kind === 'shift') {
    return (
      <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${chip}`}>
        <Users className="h-2.5 w-2.5" />
        {SHIFT_SHORT_LABELS[task.assignee.shiftId]}
      </span>
    )
  }
  if (task.assignee?.kind === 'operator') {
    return (
      <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${chip}`}>
        <User className="h-2.5 w-2.5" />
        {task.assignee.name}
      </span>
    )
  }
  return <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${chip}`}>כללי</span>
}

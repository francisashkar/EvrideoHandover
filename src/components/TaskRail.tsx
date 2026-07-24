import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  CalendarDays,
  Check,
  ListTodo,
  User,
  Users,
  Infinity as InfinityIcon,
  Repeat,
  Pencil,
  X,
  AlignCenter,
  Move,
} from 'lucide-react'
import type { Task, TaskAssignee, TaskPatch } from '../hooks/useTasks'
import { isTaskDone } from '../hooks/useTasks'
import type { ShiftId } from '../types'
import { SHIFT_SHORT_LABELS, type TaskMode } from './TaskPanel'
import { formatDateShort } from '../dateUtils'

interface TaskRailProps {
  tasks: Task[]
  operators: string[]
  shiftId: ShiftId
  dateKey: string
  onToggle: (id: string) => void
  onUpdate: (id: string, patch: TaskPatch) => void
  onReorder: (id: string, beforeId?: string, afterId?: string) => void
}

const ROTATIONS = ['-rotate-1', 'rotate-1', '-rotate-2', 'rotate-2']
const STRAIGHT_KEY = 'noc-tasks-straight'
const MOVABLE_KEY = 'noc-tasks-movable'

function assigneeToValue(assignee?: TaskAssignee): string {
  if (!assignee) return ''
  return assignee.kind === 'operator' ? `op:${assignee.name}` : `shift:${assignee.shiftId}`
}

function parseAssignee(value: string): TaskAssignee | undefined {
  if (value.startsWith('op:')) return { kind: 'operator', name: value.slice(3) }
  if (value.startsWith('shift:')) return { kind: 'shift', shiftId: value.slice(6) as ShiftId }
  return undefined
}

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
export default function TaskRail({ tasks, operators, shiftId, dateKey, onToggle, onUpdate, onReorder }: TaskRailProps) {
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [straight, setStraight] = useState(() => {
    try {
      return window.localStorage.getItem(STRAIGHT_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [movable, setMovable] = useState(() => {
    try {
      return window.localStorage.getItem(MOVABLE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: 'before' | 'after' } | null>(null)
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const toggleStraight = () => {
    setStraight((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STRAIGHT_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const toggleMovable = () => {
    setMovable((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(MOVABLE_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const notes = tasks.filter(
    (t) =>
      !isTaskDone(t, dateKey) &&
      (t.assignee?.kind !== 'shift' || t.assignee.shiftId === shiftId) &&
      (!t.date || t.date === dateKey),
  )

  const resetDrag = () => {
    setDragId(null)
    setDropTarget(null)
  }

  const handleDragStart = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    if (!dragId || dragId === id) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
    setDropTarget((prev) => (prev?.id === id && prev.pos === pos ? prev : { id, pos }))
  }

  const handleDrop = (targetId: string) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const id = dragId
    const target = dropTarget
    resetDrag()
    if (!id || id === targetId || !target) return
    const visible = notes.filter((t) => t.id !== id)
    const idx = visible.findIndex((t) => t.id === target.id)
    if (idx === -1) return
    const insertIdx = target.pos === 'before' ? idx : idx + 1
    const beforeId = insertIdx > 0 ? visible[insertIdx - 1].id : undefined
    const afterId = insertIdx < visible.length ? visible[insertIdx].id : undefined
    onReorder(id, beforeId, afterId)
  }

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
        <button
          onClick={toggleMovable}
          title={movable ? 'כיבוי מצב הזזה' : 'הזזת פתקיות וסידור לפי רצון'}
          className={`ms-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
            movable ? 'bg-noc-accent/20 text-noc-accent' : 'text-noc-t4 hover:bg-noc-panel3 hover:text-noc-t2'
          }`}
        >
          <Move className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={toggleStraight}
          title={straight ? 'החזרת נטיית הפתקיות' : 'יישור הפתקיות'}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
            straight ? 'bg-noc-accent/20 text-noc-accent' : 'text-noc-t4 hover:bg-noc-panel3 hover:text-noc-t2'
          }`}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin">
        {notes.length === 0 ? (
          <p className="mt-6 text-center text-xs text-noc-t4">אין משימות פתוחות</p>
        ) : (
          notes.map((task, i) => {
            const color = colorForTask(task.id)
            const rotation = straight ? '' : ROTATIONS[i % ROTATIONS.length]

            if (editingId === task.id) {
              return (
                <TaskNoteEditor
                  key={task.id}
                  task={task}
                  operators={operators}
                  color={color}
                  onCancel={() => setEditingId(null)}
                  onSave={(patch) => {
                    onUpdate(task.id, patch)
                    setEditingId(null)
                  }}
                />
              )
            }

            return (
              <div
                key={task.id}
                draggable={movable}
                onDragStart={movable ? handleDragStart(task.id) : undefined}
                onDragOver={movable ? handleDragOver(task.id) : undefined}
                onDrop={movable ? handleDrop(task.id) : undefined}
                onDragEnd={movable ? resetDrag : undefined}
                className={`group/note relative ${rotation} rounded-sm ${color.bg} p-2.5 ${color.text} shadow-lg shadow-black/30 transition-transform ${
                  straight ? '' : 'hover:rotate-0'
                } ${leavingIds.has(task.id) ? 'note-leaving' : ''} ${movable ? 'cursor-grab active:cursor-grabbing' : ''} ${
                  dragId === task.id ? 'opacity-40' : ''
                } ${
                  dropTarget?.id === task.id && dropTarget.pos === 'before'
                    ? 'border-t-2 border-noc-accent'
                    : dropTarget?.id === task.id && dropTarget.pos === 'after'
                      ? 'border-b-2 border-noc-accent'
                      : ''
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
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => setEditingId(task.id)}
                      title="עריכת משימה"
                      className={`flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-black/10 group-hover/note:opacity-100 dark:hover:bg-white/10 ${color.text}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDone(task.id)}
                      title="סימון כבוצע"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors hover:border-emerald-600 hover:bg-emerald-500 hover:text-white ${color.check}`}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
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

function TaskNoteEditor({
  task,
  operators,
  color,
  onSave,
  onCancel,
}: {
  task: Task
  operators: string[]
  color: { bg: string; text: string }
  onSave: (patch: TaskPatch) => void
  onCancel: () => void
}) {
  const [eText, setEText] = useState(task.text)
  const [eDesc, setEDesc] = useState(task.description ?? '')
  const [eDate, setEDate] = useState(task.date ?? '')
  const [eMode, setEMode] = useState<TaskMode>(task.recurring ? 'recurring' : task.date ? 'date' : 'permanent')
  const [eAssignee, setEAssignee] = useState(assigneeToValue(task.assignee))

  const save = () => {
    if (!eText.trim()) return
    onSave({
      text: eText.trim(),
      description: eDesc.trim() || undefined,
      date: eMode === 'date' ? eDate || undefined : undefined,
      recurring: eMode === 'recurring',
      assignee: parseAssignee(eAssignee),
    })
  }

  return (
    <div className={`space-y-1.5 rounded-sm ${color.bg} p-2.5 shadow-lg shadow-black/30`}>
      <input
        autoFocus
        type="text"
        value={eText}
        onChange={(e) => setEText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') onCancel()
        }}
        className="h-7 w-full rounded-md border border-black/20 bg-white/50 px-2 text-xs font-bold text-slate-900 outline-none focus:border-black/40"
      />
      <textarea
        value={eDesc}
        onChange={(e) => setEDesc(e.target.value)}
        placeholder="תיאור..."
        rows={2}
        className="w-full rounded-md border border-black/20 bg-white/50 px-2 py-1 text-[11px] leading-relaxed text-slate-800 outline-none focus:border-black/40"
        style={{ resize: 'none' }}
      />
      <div className="flex items-stretch gap-1">
        <select
          value={eMode}
          onChange={(e) => setEMode(e.target.value as TaskMode)}
          className="h-6 shrink-0 rounded-md border border-black/20 bg-white/50 px-1 text-[9px] font-bold text-slate-800 outline-none"
        >
          <option value="date">לתאריך</option>
          <option value="permanent">קבוע</option>
          <option value="recurring">חוזר</option>
        </select>
        {eMode === 'date' && (
          <input
            type="date"
            value={eDate}
            onChange={(e) => setEDate(e.target.value)}
            className="h-6 min-w-0 flex-1 rounded-md border border-black/20 bg-white/50 px-1 text-[10px] text-slate-800 outline-none"
          />
        )}
      </div>
      <select
        value={eAssignee}
        onChange={(e) => setEAssignee(e.target.value)}
        className="h-6 w-full rounded-md border border-black/20 bg-white/50 px-1 text-[10px] text-slate-800 outline-none"
      >
        <option value="">כללי</option>
        <optgroup label="משמרת שלמה">
          {(Object.keys(SHIFT_SHORT_LABELS) as ShiftId[]).map((sid) => (
            <option key={sid} value={`shift:${sid}`}>
              {SHIFT_SHORT_LABELS[sid]}
            </option>
          ))}
        </optgroup>
        <optgroup label="נוקיסט">
          {operators.map((name) => (
            <option key={name} value={`op:${name}`}>
              {name}
            </option>
          ))}
        </optgroup>
      </select>
      <div className="flex items-center gap-1.5">
        <button
          onClick={save}
          disabled={!eText.trim()}
          className="flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40"
        >
          <Check className="h-3 w-3" /> שמירה
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 rounded-full border border-black/20 px-2.5 py-1 text-[10px] font-bold text-slate-800"
        >
          <X className="h-3 w-3" /> ביטול
        </button>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import {
  ListTodo,
  Plus,
  Trash2,
  X,
  User,
  Users,
  Lock,
  LockOpen,
  GripHorizontal,
  CalendarDays,
  Pencil,
  Check,
} from 'lucide-react'
import type { NewTaskInput, Task, TaskAssignee, TaskPatch } from '../hooks/useTasks'
import type { ShiftId } from '../types'
import { formatDateShort } from '../dateUtils'

export const SHIFT_SHORT_LABELS: Record<ShiftId, string> = {
  shift1: 'משמרת בוקר',
  shift2: 'משמרת ערב',
  shift3: 'משמרת לילה',
}

const PANEL_WIDTH = 320
const POS_KEY = 'noc-task-panel-pos'
const LOCK_KEY = 'noc-task-panel-locked'

interface TaskPanelProps {
  tasks: Task[]
  operators: string[]
  /** The date currently selected in the app — used as the default task date */
  currentDateKey: string
  onAdd: (input: NewTaskInput) => void
  onUpdate: (id: string, patch: TaskPatch) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function assigneeToValue(assignee?: TaskAssignee): string {
  if (!assignee) return ''
  return assignee.kind === 'operator' ? `op:${assignee.name}` : `shift:${assignee.shiftId}`
}

function parseAssignee(value: string): TaskAssignee | undefined {
  if (value.startsWith('op:')) return { kind: 'operator', name: value.slice(3) }
  if (value.startsWith('shift:')) return { kind: 'shift', shiftId: value.slice(6) as ShiftId }
  return undefined
}

function loadPos(): { x: number; y: number } {
  try {
    const stored = window.localStorage.getItem(POS_KEY)
    if (stored) {
      const p = JSON.parse(stored) as { x: number; y: number }
      if (typeof p.x === 'number' && typeof p.y === 'number') return p
    }
  } catch {
    // fall through
  }
  return { x: 24, y: 140 }
}

function clampPos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - PANEL_WIDTH)),
    y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - 120)),
  }
}

export default function TaskPanel({
  tasks,
  operators,
  currentDateKey,
  onAdd,
  onUpdate,
  onToggle,
  onDelete,
  onClose,
}: TaskPanelProps) {
  const [text, setText] = useState('')
  const [description, setDescription] = useState('')
  const [taskDate, setTaskDate] = useState(currentDateKey)
  const [assigneeValue, setAssigneeValue] = useState('')
  const [pos, setPos] = useState(loadPos)
  const [locked, setLocked] = useState(() => {
    try {
      return window.localStorage.getItem(LOCK_KEY) === 'true'
    } catch {
      return false
    }
  })
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Follow the app's selected date as the default for new tasks
  useEffect(() => {
    setTaskDate(currentDateKey)
  }, [currentDateKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(POS_KEY, JSON.stringify(pos))
    } catch {
      // ignore
    }
  }, [pos])

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCK_KEY, String(locked))
    } catch {
      // ignore
    }
  }, [locked])

  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (locked) return
    if ((e.target as HTMLElement).closest('button')) return
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragState.current
    if (!d) return
    setPos(clampPos(d.origX + (e.clientX - d.startX), d.origY + (e.clientY - d.startY)))
  }

  const handleDragEnd = () => {
    dragState.current = null
  }

  const handleAdd = () => {
    if (!text.trim()) return
    onAdd({
      text,
      description: description.trim() || undefined,
      date: taskDate || undefined,
      assignee: parseAssignee(assigneeValue),
    })
    setText('')
    setDescription('')
    setTaskDate(currentDateKey)
    setAssigneeValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAdd()
    }
  }

  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)

  return (
    <div
      className="fixed z-40 flex max-h-[75vh] w-80 flex-col overflow-hidden rounded-2xl border border-noc-border bg-noc-panel shadow-2xl shadow-black/40"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        className={`flex touch-none items-center justify-between border-b border-noc-border bg-noc-panel2 px-4 py-3 ${
          locked ? '' : 'cursor-move'
        }`}
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-noc-t1">
          <ListTodo className="h-4 w-4 text-noc-accent" />
          משימות
          {open.length > 0 && (
            <span className="rounded-full bg-noc-accent/20 px-2 py-0.5 text-[10px] font-bold text-noc-accent">
              {open.length}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1">
          {!locked && <GripHorizontal className="h-4 w-4 text-noc-t4" />}
          <button
            onClick={() => setLocked((v) => !v)}
            title={locked ? 'שחרור נעילה (אפשר גרירה)' : 'נעילת מיקום'}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              locked ? 'text-noc-accent' : 'text-noc-t3 hover:text-noc-t1'
            } hover:bg-noc-panel3`}
          >
            {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onClose}
            title="סגירה"
            className="flex h-7 w-7 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel3 hover:text-noc-t1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 border-b border-noc-border p-3">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="כותרת המשימה..."
            className="h-9 min-w-0 flex-1 rounded-lg border border-noc-border bg-noc-panel2 px-2.5 text-sm text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
          />
          <button
            onClick={handleAdd}
            disabled={!text.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-noc-gradient text-white disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="תיאור (אופציונלי)..."
          rows={2}
          className="w-full rounded-lg border border-noc-border bg-noc-panel2 px-2.5 py-1.5 text-xs leading-relaxed text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
          style={{ resize: 'none' }}
        />

        <div className="flex gap-1.5">
          <div className="flex h-8 flex-1 items-center gap-1.5 rounded-lg border border-noc-border bg-noc-panel2 px-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-noc-accent2" />
            <input
              type="date"
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
              title="תאריך המשימה (ריק = כל יום)"
              className="w-full bg-transparent text-xs text-noc-t2 outline-none"
            />
          </div>
          <select
            value={assigneeValue}
            onChange={(e) => setAssigneeValue(e.target.value)}
            className="h-8 flex-1 rounded-lg border border-noc-border bg-noc-panel2 px-2 text-xs text-noc-t2 outline-none focus:border-noc-accent"
          >
            <option value="">שיוך: כללי</option>
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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {tasks.length === 0 ? (
          <p className="mt-6 text-center text-xs text-noc-t4">אין משימות. הוסיפו משימה למעלה.</p>
        ) : (
          <div className="space-y-1.5">
            {open.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                operators={operators}
                onUpdate={onUpdate}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
            {done.length > 0 && (
              <>
                <p className="pt-2 text-[10px] font-bold uppercase text-noc-t4">הושלמו ({done.length})</p>
                {done.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    operators={operators}
                    onUpdate={onUpdate}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AssigneeChip({ assignee }: { assignee: TaskAssignee }) {
  if (assignee.kind === 'shift') {
    return (
      <span className="flex w-fit items-center gap-1 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 ring-1 ring-violet-500/30 dark:text-violet-300">
        <Users className="h-2.5 w-2.5" />
        {SHIFT_SHORT_LABELS[assignee.shiftId]}
      </span>
    )
  }
  return (
    <span className="flex w-fit items-center gap-1 rounded-full bg-noc-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-noc-accent ring-1 ring-noc-accent/30">
      <User className="h-2.5 w-2.5" />
      {assignee.name}
    </span>
  )
}

function TaskRow({
  task,
  operators,
  onUpdate,
  onToggle,
  onDelete,
}: {
  task: Task
  operators: string[]
  onUpdate: (id: string, patch: TaskPatch) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [eText, setEText] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eDate, setEDate] = useState('')
  const [eAssignee, setEAssignee] = useState('')

  const startEdit = () => {
    setEText(task.text)
    setEDesc(task.description ?? '')
    setEDate(task.date ?? '')
    setEAssignee(assigneeToValue(task.assignee))
    setEditing(true)
  }

  const saveEdit = () => {
    if (!eText.trim()) return
    onUpdate(task.id, {
      text: eText.trim(),
      description: eDesc.trim() || undefined,
      date: eDate || undefined,
      assignee: parseAssignee(eAssignee),
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-1.5 rounded-lg border border-noc-accent/50 bg-noc-panel2 px-2.5 py-2">
        <input
          type="text"
          value={eText}
          onChange={(e) => setEText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="כותרת המשימה..."
          className="h-8 w-full rounded-md border border-noc-border bg-noc-bg/40 px-2 text-xs font-semibold text-noc-t1 outline-none focus:border-noc-accent"
        />
        <textarea
          value={eDesc}
          onChange={(e) => setEDesc(e.target.value)}
          placeholder="תיאור (אופציונלי)..."
          rows={2}
          className="w-full rounded-md border border-noc-border bg-noc-bg/40 px-2 py-1 text-[11px] leading-relaxed text-noc-t1 outline-none focus:border-noc-accent"
          style={{ resize: 'none' }}
        />
        <div className="flex gap-1.5">
          <input
            type="date"
            value={eDate}
            onChange={(e) => setEDate(e.target.value)}
            className="h-7 flex-1 rounded-md border border-noc-border bg-noc-bg/40 px-1.5 text-[11px] text-noc-t2 outline-none"
          />
          <select
            value={eAssignee}
            onChange={(e) => setEAssignee(e.target.value)}
            className="h-7 flex-1 rounded-md border border-noc-border bg-noc-bg/40 px-1.5 text-[11px] text-noc-t2 outline-none"
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
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={saveEdit}
            disabled={!eText.trim()}
            className="flex items-center gap-1 rounded-full bg-noc-accent px-2.5 py-1 text-[10px] font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            <Check className="h-3 w-3" /> שמירה
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1 rounded-full border border-noc-border px-2.5 py-1 text-[10px] font-bold text-noc-t2 hover:bg-noc-panel3"
          >
            <X className="h-3 w-3" /> ביטול
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-2 rounded-lg border border-noc-border bg-noc-panel2 px-2.5 py-2">
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task.id)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#00a884]"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p
          className={`break-words text-xs font-semibold leading-relaxed ${
            task.done ? 'text-noc-t4 line-through' : 'text-noc-t1'
          }`}
        >
          {task.text}
        </p>
        {task.description && (
          <p className={`break-words text-[11px] leading-relaxed ${task.done ? 'text-noc-t4' : 'text-noc-t3'}`}>
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {task.date && (
            <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-600 ring-1 ring-sky-500/30 dark:text-sky-300">
              <CalendarDays className="h-2.5 w-2.5" />
              {formatDateShort(task.date)}
            </span>
          )}
          {task.assignee && <AssigneeChip assignee={task.assignee} />}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={startEdit}
          title="עריכת משימה"
          className="flex h-5 w-5 items-center justify-center rounded-full text-noc-t4 hover:bg-noc-accent/15 hover:text-noc-accent"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          title="מחיקת משימה"
          className="flex h-5 w-5 items-center justify-center rounded-full text-noc-t4 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

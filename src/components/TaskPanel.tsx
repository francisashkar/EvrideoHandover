import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ListTodo, Plus, Trash2, X, User, Users, Lock, LockOpen, GripHorizontal } from 'lucide-react'
import type { Task, TaskAssignee } from '../hooks/useTasks'
import type { ShiftId } from '../types'

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
  onAdd: (text: string, assignee?: TaskAssignee) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
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

export default function TaskPanel({ tasks, operators, onAdd, onToggle, onDelete, onClose }: TaskPanelProps) {
  const [text, setText] = useState('')
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
    // don't start a drag from the header buttons
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
    onAdd(text, parseAssignee(assigneeValue))
    setText('')
    setAssigneeValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)

  return (
    <div
      className="fixed z-40 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-2xl border border-noc-border bg-noc-panel shadow-2xl shadow-black/40"
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
            placeholder="משימה חדשה..."
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
        <select
          value={assigneeValue}
          onChange={(e) => setAssigneeValue(e.target.value)}
          className="h-8 w-full rounded-lg border border-noc-border bg-noc-panel2 px-2 text-xs text-noc-t2 outline-none focus:border-noc-accent"
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

      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {tasks.length === 0 ? (
          <p className="mt-6 text-center text-xs text-noc-t4">אין משימות. הוסיפו משימה למעלה.</p>
        ) : (
          <div className="space-y-1.5">
            {open.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
            ))}
            {done.length > 0 && (
              <>
                <p className="pt-2 text-[10px] font-bold uppercase text-noc-t4">הושלמו ({done.length})</p>
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
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
  onToggle,
  onDelete,
}: {
  task: Task
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
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
          className={`break-words text-xs leading-relaxed ${
            task.done ? 'text-noc-t4 line-through' : 'text-noc-t1'
          }`}
        >
          {task.text}
        </p>
        {task.assignee && <AssigneeChip assignee={task.assignee} />}
      </div>
      <button
        onClick={() => onDelete(task.id)}
        title="מחיקת משימה"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-noc-t4 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

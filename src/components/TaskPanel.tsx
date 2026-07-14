import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ListTodo, Plus, Trash2, X, User, Users } from 'lucide-react'
import type { Task, TaskAssignee } from '../hooks/useTasks'
import type { ShiftId } from '../types'

const SHIFT_SHORT_LABELS: Record<ShiftId, string> = {
  shift1: 'משמרת בוקר',
  shift2: 'משמרת ערב',
  shift3: 'משמרת לילה',
}

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

export default function TaskPanel({ tasks, operators, onAdd, onToggle, onDelete, onClose }: TaskPanelProps) {
  const [text, setText] = useState('')
  const [assigneeValue, setAssigneeValue] = useState('')

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
    <aside className="flex w-72 shrink-0 flex-col border-e border-noc-border bg-noc-panel max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:shadow-2xl">
      <div className="flex items-center justify-between border-b border-noc-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-noc-t1">
          <ListTodo className="h-4 w-4 text-noc-accent" />
          משימות
          {open.length > 0 && (
            <span className="rounded-full bg-noc-accent/20 px-2 py-0.5 text-[10px] font-bold text-noc-accent">
              {open.length}
            </span>
          )}
        </h2>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
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
    </aside>
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

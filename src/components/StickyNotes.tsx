import { Check, Users } from 'lucide-react'
import type { Task } from '../hooks/useTasks'
import type { ShiftId } from '../types'
import { SHIFT_SHORT_LABELS } from './TaskPanel'

interface StickyNotesProps {
  tasks: Task[]
  shiftId: ShiftId
  onToggle: (id: string) => void
}

const ROTATIONS = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2']

/** Open tasks assigned to the given shift, rendered as sticky notes over the chat. */
export default function StickyNotes({ tasks, shiftId, onToggle }: StickyNotesProps) {
  const notes = tasks.filter((t) => !t.done && t.assignee?.kind === 'shift' && t.assignee.shiftId === shiftId)
  if (notes.length === 0) return null

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex w-44 flex-col gap-2.5">
      {notes.map((task, i) => (
        <div
          key={task.id}
          className={`pointer-events-auto ${ROTATIONS[i % ROTATIONS.length]} rounded-sm bg-yellow-200 p-2.5 text-slate-900 shadow-lg shadow-black/30 transition-transform hover:rotate-0`}
        >
          <div className="mb-1.5 flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 rounded-full bg-yellow-300/80 px-1.5 py-0.5 text-[9px] font-bold text-yellow-900">
              <Users className="h-2.5 w-2.5" />
              {SHIFT_SHORT_LABELS[shiftId]}
            </span>
            <button
              onClick={() => onToggle(task.id)}
              title="סימון כבוצע"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-yellow-600/40 text-yellow-800 transition-colors hover:bg-emerald-500 hover:border-emerald-600 hover:text-white"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
          <p className="break-words text-[11px] font-medium leading-relaxed">{task.text}</p>
        </div>
      ))}
    </div>
  )
}

import { X, MessageSquare, Clock3 } from 'lucide-react'
import { SHIFT_DEFINITIONS } from '../types'
import type { DayMessages, ShiftId } from '../types'
import { formatTime } from '../dateUtils'

interface DailyOverviewProps {
  open: boolean
  onClose: () => void
  dayMessages: DayMessages
  activeTab: ShiftId
  liveShiftId: ShiftId | null
  onSelectShift: (shiftId: ShiftId) => void
}

export default function DailyOverview({
  open,
  onClose,
  dayMessages,
  activeTab,
  liveShiftId,
  onSelectShift,
}: DailyOverviewProps) {
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-50 mx-auto max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-b-2xl border border-t-0 border-noc-border bg-noc-panel shadow-2xl scrollbar-thin sm:top-4 sm:rounded-2xl sm:border-t">
        <div className="sticky top-0 flex items-center justify-between border-b border-noc-border bg-noc-panel/95 px-5 py-4 backdrop-blur-xl">
          <h2 className="text-base font-bold text-noc-t1">תצוגה כללית — כל המשמרות</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {SHIFT_DEFINITIONS.map((def) => {
            const messages = dayMessages[def.id]
            const isLive = def.id === liveShiftId
            const isActive = def.id === activeTab
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
            const uniqueOperators = Array.from(new Set(messages.map((m) => m.operator)))

            return (
              <button
                key={def.id}
                onClick={() => {
                  onSelectShift(def.id)
                  onClose()
                }}
                className={`flex flex-col gap-3 rounded-xl border p-4 text-start transition-colors ${
                  isActive
                    ? 'border-noc-accent/60 bg-noc-accent/10'
                    : 'border-noc-border bg-noc-panel2 hover:border-noc-borderLight'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-noc-t1">
                    <span>{def.emoji}</span>
                    {def.label}
                  </span>
                  {isLive && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      פעיל
                    </span>
                  )}
                </div>
                <span className="text-xs text-noc-t3">{def.timeRange}</span>

                <div className="flex items-center gap-1.5 text-xs text-noc-t3">
                  <MessageSquare className="h-3.5 w-3.5 text-noc-accent2" />
                  <span className="font-semibold text-noc-t2">{messages.length}</span> עדכונים
                  {uniqueOperators.length > 0 && (
                    <span className="text-noc-t4">· {uniqueOperators.join(', ')}</span>
                  )}
                </div>

                {lastMessage ? (
                  <div className="rounded-lg border border-noc-border bg-noc-bg/60 p-2.5">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] text-noc-t3">
                      <Clock3 className="h-3 w-3" />
                      {formatTime(lastMessage.timestamp)} · {lastMessage.operator}
                    </div>
                    <p className="line-clamp-3 text-xs leading-relaxed text-noc-t2">{lastMessage.text}</p>
                  </div>
                ) : (
                  <p className="text-xs text-noc-t4">אין עדכונים למשמרת זו.</p>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

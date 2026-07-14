import { SHIFT_DEFINITIONS, STATUS_META } from '../types'
import type { ShiftId, ShiftStatus } from '../types'

interface ShiftTabsProps {
  activeTab: ShiftId
  liveShiftId: ShiftId | null
  messageCounts: Record<ShiftId, number>
  statuses: Record<ShiftId, ShiftStatus>
  onSelect: (shiftId: ShiftId) => void
}

export default function ShiftTabs({ activeTab, liveShiftId, messageCounts, statuses, onSelect }: ShiftTabsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 pb-3 pt-3 sm:px-6">
      {SHIFT_DEFINITIONS.map((def) => {
        const isSelected = def.id === activeTab
        const isLive = def.id === liveShiftId
        const count = messageCounts[def.id]
        const status = statuses[def.id]
        return (
          <button
            key={def.id}
            onClick={() => onSelect(def.id)}
            className={`group flex flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-3 text-xs font-semibold transition-all sm:flex-row sm:gap-2 ${
              isSelected
                ? 'border-noc-accent/70 bg-gradient-to-br from-noc-accent/20 to-noc-accent3/10 text-noc-accent2 shadow-lg shadow-emerald-500/10'
                : 'border-noc-border bg-noc-panel2 text-noc-t3 hover:border-noc-borderLight hover:bg-noc-panel3'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[status].dot}`}
                title={STATUS_META[status].label}
              />
              <span>{def.emoji}</span>
              <span>{def.label}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-normal text-noc-t3">
              <span>{def.timeRange}</span>
              {count > 0 && (
                <span className="rounded-full bg-noc-border px-1.5 py-0.5 text-[9px] font-bold text-noc-t2">
                  {count}
                </span>
              )}
            </span>
            {isLive && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                פעיל עכשיו
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

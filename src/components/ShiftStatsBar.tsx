import { MessageSquare, User, Clock3 } from 'lucide-react'
import type { ChatMessage } from '../types'
import { formatTime } from '../dateUtils'

interface ShiftStatsBarProps {
  messages: ChatMessage[]
}

export default function ShiftStatsBar({ messages }: ShiftStatsBarProps) {
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
  const uniqueOperators = Array.from(new Set(messages.map((m) => m.operator)))

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
      <span className="flex items-center gap-1.5 rounded-full border border-noc-border bg-noc-panel2 px-3 py-1.5 text-xs text-noc-t2">
        <MessageSquare className="h-3.5 w-3.5 text-noc-accent2" />
        <span className="font-semibold text-noc-t1">{messages.length}</span> עדכונים
      </span>
      <span className="flex items-center gap-1.5 rounded-full border border-noc-border bg-noc-panel2 px-3 py-1.5 text-xs text-noc-t2">
        <User className="h-3.5 w-3.5 text-noc-accent2" />
        <span className="font-semibold text-noc-t1">{uniqueOperators.length}</span> נוקיסטים
      </span>
      {lastMessage && (
        <span className="flex items-center gap-1.5 rounded-full border border-noc-border bg-noc-panel2 px-3 py-1.5 text-xs text-noc-t2">
          <Clock3 className="h-3.5 w-3.5 text-noc-accent2" />
          <span className="font-semibold text-noc-t1">{formatTime(lastMessage.timestamp)}</span>
          <span className="text-noc-t3">·</span>
          {lastMessage.operator}
        </span>
      )}
    </div>
  )
}

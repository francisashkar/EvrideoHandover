import { useEffect, useRef } from 'react'
import { MessageSquareText, SearchX, Pin, CircleAlert, Check } from 'lucide-react'
import type { CarryOverItem, ChatMessage } from '../types'
import { SHIFT_DEFINITIONS } from '../types'
import MessageBubble from './MessageBubble'
import { formatDateShort, formatTime } from '../dateUtils'

interface ChatFeedProps {
  messages: ChatMessage[]
  hasUnfilteredMessages: boolean
  carryOver: CarryOverItem[]
  mergeableIds: Set<string>
  onDeleteMessage: (id: string) => void
  onTogglePin: (id: string) => void
  onToggleUnresolved: (id: string) => void
  onMergeMessage: (id: string) => void
  onResolveCarryOver: (item: CarryOverItem) => void
}

export default function ChatFeed({
  messages,
  hasUnfilteredMessages,
  carryOver,
  mergeableIds,
  onDeleteMessage,
  onTogglePin,
  onToggleUnresolved,
  onMergeMessage,
  onResolveCarryOver,
}: ChatFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const pinned = messages.filter((m) => m.pinned)

  const banners = (
    <>
      {carryOver.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-500">
            <CircleAlert className="h-4 w-4" />
            מעקב ממשמרות קודמות ({carryOver.length})
          </div>
          <div className="space-y-1.5">
            {carryOver.map((item) => {
              const shiftDef = SHIFT_DEFINITIONS.find((s) => s.id === item.shiftId)!
              return (
                <div
                  key={`${item.dateKey}-${item.message.id}`}
                  className="flex items-center gap-2 rounded-lg bg-noc-panel/60 px-2.5 py-2"
                >
                  <button
                    onClick={() => onResolveCarryOver(item)}
                    title="סימון כטופל"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/50 text-emerald-500 transition-colors hover:bg-emerald-500/20"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-noc-t1">{item.message.text || '(קובץ מצורף)'}</p>
                    <p className="text-[10px] text-noc-t3">
                      {item.message.operator} · {shiftDef.label} · {formatDateShort(item.dateKey)} ·{' '}
                      {formatTime(item.message.timestamp)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {pinned.length > 0 && (
        <div className="rounded-xl border border-noc-accent/40 bg-noc-accent/10 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-noc-accent">
            <Pin className="h-4 w-4 fill-current" />
            הודעות נעוצות
          </div>
          <div className="space-y-1">
            {pinned.map((m) => (
              <p key={m.id} className="truncate text-xs text-noc-t1">
                <span className="font-semibold">{m.operator}:</span> {m.text || '(קובץ מצורף)'}
              </p>
            ))}
          </div>
        </div>
      )}
    </>
  )

  if (messages.length === 0 && hasUnfilteredMessages) {
    return (
      <div className="wa-wallpaper flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-noc-t3">
        <SearchX className="h-10 w-10" />
        <p className="text-sm">לא נמצאו הודעות התואמות את החיפוש.</p>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="wa-wallpaper flex flex-1 flex-col overflow-y-auto scrollbar-thin">
        {carryOver.length > 0 && <div className="space-y-3 px-4 pt-4 sm:px-6">{banners}</div>}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-noc-t3">
          <MessageSquareText className="h-10 w-10" />
          <p className="text-sm">עדיין לא נרשמו הודעות במשמרת זו.</p>
          <p className="text-xs">הקלידו עדכון למטה כדי להתחיל את היומן.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="wa-wallpaper flex-1 space-y-1.5 overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6">
      <div className="space-y-3 pb-2 empty:hidden">{banners}</div>
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          canMerge={mergeableIds.has(message.id)}
          onDelete={() => onDeleteMessage(message.id)}
          onTogglePin={() => onTogglePin(message.id)}
          onToggleUnresolved={() => onToggleUnresolved(message.id)}
          onMerge={() => onMergeMessage(message.id)}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

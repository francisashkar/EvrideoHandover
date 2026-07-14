import { useState } from 'react'
import { Trash2, Check, X, Pin, CircleAlert, FileText, Download, Merge } from 'lucide-react'
import type { ChatMessage } from '../types'
import { TAG_META, colorForOperator } from '../types'
import { formatTime } from '../dateUtils'

/** Detects Hebrew (or other RTL) script so the bubble can auto-align. */
function isRtlText(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface MessageBubbleProps {
  message: ChatMessage
  canMerge: boolean
  onDelete: () => void
  onTogglePin: () => void
  onToggleUnresolved: () => void
  onMerge: () => void
}

export default function MessageBubble({
  message,
  canMerge,
  onDelete,
  onTogglePin,
  onToggleUnresolved,
  onMerge,
}: MessageBubbleProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const rtl = isRtlText(message.text) || message.text === ''
  const badgeColor = colorForOperator(message.operator)
  const tagMeta = message.tag && message.tag !== 'update' ? TAG_META[message.tag] : null
  // Unresolved marking is reserved for incident-tagged messages
  // (still shown when already unresolved so it can be cleared)
  const canToggleUnresolved = message.tag === 'incident' || !!message.unresolved

  const actions = confirmingDelete ? (
    <DeleteConfirm onConfirm={onDelete} onCancel={() => setConfirmingDelete(false)} />
  ) : (
    <HoverActions
      pinned={!!message.pinned}
      unresolved={!!message.unresolved}
      showUnresolvedToggle={canToggleUnresolved}
      canMerge={canMerge}
      onTogglePin={onTogglePin}
      onToggleUnresolved={onToggleUnresolved}
      onMerge={onMerge}
      onDeleteClick={() => setConfirmingDelete(true)}
    />
  )

  return (
    <div className={`group flex ${rtl ? 'justify-start' : 'justify-end'}`}>
      {!rtl && actions}

      <div
        className={`relative max-w-[85%] rounded-lg px-3 py-2 shadow-md shadow-black/20 sm:max-w-[70%] ${
          rtl ? 'rounded-tl-none bg-noc-bubbleOut' : 'rounded-tr-none bg-noc-bubbleIn'
        } ${message.unresolved ? 'ring-1 ring-amber-400/60' : ''}`}
      >
        <div className={`mb-0.5 flex items-center gap-2 ${rtl ? 'flex-row' : 'flex-row-reverse'}`}>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${badgeColor}`}>
            {message.operator}
          </span>
          {tagMeta && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${tagMeta.chip}`}>
              {tagMeta.label}
            </span>
          )}
          {message.pinned && <Pin className="h-3 w-3 fill-current text-noc-accent" />}
          {message.unresolved && <CircleAlert className="h-3 w-3 text-amber-400" />}
          <span className="text-[10px] text-noc-t3">{formatTime(message.timestamp)}</span>
        </div>

        {message.text && (
          <p
            dir={rtl ? 'rtl' : 'ltr'}
            className="whitespace-pre-wrap break-words text-sm leading-relaxed text-noc-t1"
          >
            {message.text}
          </p>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.attachments.map((a) =>
              a.mimeType.startsWith('image/') ? (
                <a
                  key={a.id}
                  href={a.dataUrl}
                  download={a.name}
                  title={`${a.name} (${formatSize(a.size)})`}
                  className="block overflow-hidden rounded-lg border border-black/10"
                >
                  <img src={a.dataUrl} alt={a.name} className="max-h-48 max-w-56 object-cover" />
                </a>
              ) : (
                <a
                  key={a.id}
                  href={a.dataUrl}
                  download={a.name}
                  className="flex items-center gap-2 rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 py-2 text-xs text-noc-t2 transition-colors hover:border-noc-accent/50"
                >
                  <FileText className="h-4 w-4 shrink-0 text-noc-accent2" />
                  <span className="max-w-40 truncate font-medium">{a.name}</span>
                  <span className="text-noc-t4">{formatSize(a.size)}</span>
                  <Download className="h-3.5 w-3.5 shrink-0 text-noc-t3" />
                </a>
              ),
            )}
          </div>
        )}
      </div>

      {rtl && actions}
    </div>
  )
}

function HoverActions({
  pinned,
  unresolved,
  showUnresolvedToggle,
  canMerge,
  onTogglePin,
  onToggleUnresolved,
  onMerge,
  onDeleteClick,
}: {
  pinned: boolean
  unresolved: boolean
  showUnresolvedToggle: boolean
  canMerge: boolean
  onTogglePin: () => void
  onToggleUnresolved: () => void
  onMerge: () => void
  onDeleteClick: () => void
}) {
  return (
    <div className="mx-1.5 flex shrink-0 items-center gap-0.5 self-center opacity-0 transition-opacity group-hover:opacity-100">
      {canMerge && (
        <button
          onClick={onMerge}
          title="חיבור להודעה הקודמת"
          className="flex h-7 w-7 items-center justify-center rounded-full text-noc-t4 transition-colors hover:bg-noc-accent2/15 hover:text-noc-accent2"
        >
          <Merge className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onTogglePin}
        title={pinned ? 'ביטול נעיצה' : 'נעיצת הודעה'}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-noc-accent/15 ${
          pinned ? 'text-noc-accent' : 'text-noc-t4 hover:text-noc-accent'
        }`}
      >
        <Pin className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`} />
      </button>
      {showUnresolvedToggle && (
        <button
          onClick={onToggleUnresolved}
          title={unresolved ? 'סימון כטופל' : 'סימון כלא פתור (יועבר למשמרת הבאה)'}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-amber-500/15 ${
            unresolved ? 'text-amber-400' : 'text-noc-t4 hover:text-amber-400'
          }`}
        >
          <CircleAlert className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onDeleteClick}
        title="מחיקת הודעה"
        className="flex h-7 w-7 items-center justify-center rounded-full text-noc-t4 transition-colors hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="mx-1.5 flex shrink-0 items-center gap-1 self-center">
      <button
        onClick={onConfirm}
        title="אישור מחיקה"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onCancel}
        title="ביטול"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-noc-border text-noc-t3 hover:bg-noc-borderLight"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

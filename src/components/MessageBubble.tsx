import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Trash2, Check, X, Pin, CircleAlert, FileText, Download, Merge, Copy, Pencil } from 'lucide-react'
import type { ChatMessage } from '../types'
import { TAG_META, attachmentSrc, colorForOperator } from '../types'
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
  onCopy: () => void
  onEdit: (newText: string) => void
}

export default function MessageBubble({
  message,
  canMerge,
  onDelete,
  onTogglePin,
  onToggleUnresolved,
  onMerge,
  onCopy,
  onEdit,
}: MessageBubbleProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const editRef = useRef<HTMLTextAreaElement>(null)
  const rtl = isRtlText(message.text) || message.text === ''
  const badgeColor = colorForOperator(message.operator)
  const tagMeta = message.tag && message.tag !== 'update' ? TAG_META[message.tag] : null
  // Unresolved marking is reserved for incident-tagged messages
  // (still shown when already unresolved so it can be cleared)
  const canToggleUnresolved = message.tag === 'incident' || !!message.unresolved

  useEffect(() => {
    if (editing) {
      editRef.current?.focus()
      editRef.current?.setSelectionRange(draft.length, draft.length)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const startEdit = () => {
    setDraft(message.text)
    setEditing(true)
  }

  const saveEdit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== message.text) onEdit(trimmed)
    setEditing(false)
  }

  const handleEditKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    }
    if (e.key === 'Escape') setEditing(false)
  }

  const actions = confirmingDelete ? (
    <DeleteConfirm onConfirm={onDelete} onCancel={() => setConfirmingDelete(false)} />
  ) : editing ? null : (
    <HoverActions
      pinned={!!message.pinned}
      unresolved={!!message.unresolved}
      showUnresolvedToggle={canToggleUnresolved}
      canMerge={canMerge}
      hasText={message.text.length > 0}
      onTogglePin={onTogglePin}
      onToggleUnresolved={onToggleUnresolved}
      onMerge={onMerge}
      onCopy={onCopy}
      onEditClick={startEdit}
      onDeleteClick={() => setConfirmingDelete(true)}
    />
  )

  return (
    <div className={`group flex ${rtl ? 'justify-start' : 'justify-end'}`}>
      {!rtl && actions}

      <div
        className={`relative max-w-[85%] rounded-lg px-3 py-2 shadow-md shadow-black/20 sm:max-w-[70%] ${
          rtl ? 'rounded-tl-none bg-noc-bubbleOut' : 'rounded-tr-none bg-noc-bubbleIn'
        } ${message.unresolved ? 'ring-1 ring-amber-400/60' : ''} ${editing ? 'w-full ring-1 ring-noc-accent/60' : ''}`}
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
          {message.edited && <span className="text-[9px] text-noc-t4">(נערך)</span>}
        </div>

        {editing ? (
          <div className="space-y-1.5">
            <textarea
              ref={editRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleEditKeyDown}
              dir={isRtlText(draft) ? 'rtl' : 'ltr'}
              rows={Math.min(6, Math.max(2, draft.split('\n').length))}
              className="chat-textarea w-full rounded-md border border-noc-border bg-noc-bg/40 px-2 py-1.5 text-sm leading-relaxed text-noc-t1 outline-none focus:border-noc-accent"
              style={{ resize: 'none' }}
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={saveEdit}
                className="flex items-center gap-1 rounded-full bg-noc-accent px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90"
              >
                <Check className="h-3 w-3" /> שמירה
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1 rounded-full border border-noc-border px-2.5 py-1 text-[11px] font-bold text-noc-t2 hover:bg-noc-panel3"
              >
                <X className="h-3 w-3" /> ביטול
              </button>
            </div>
          </div>
        ) : (
          message.text && (
            <p
              dir={rtl ? 'rtl' : 'ltr'}
              className="whitespace-pre-wrap break-words text-sm leading-relaxed text-noc-t1"
            >
              {message.text}
            </p>
          )
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.attachments.map((a) =>
              a.mimeType.startsWith('image/') ? (
                <a
                  key={a.id}
                  href={attachmentSrc(a)}
                  download={a.name}
                  target={a.url ? '_blank' : undefined}
                  rel={a.url ? 'noreferrer' : undefined}
                  title={`${a.name} (${formatSize(a.size)})`}
                  className="block overflow-hidden rounded-lg border border-black/10"
                >
                  <img src={attachmentSrc(a)} alt={a.name} className="max-h-48 max-w-56 object-cover" />
                </a>
              ) : (
                <a
                  key={a.id}
                  href={attachmentSrc(a)}
                  download={a.name}
                  target={a.url ? '_blank' : undefined}
                  rel={a.url ? 'noreferrer' : undefined}
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
  hasText,
  onTogglePin,
  onToggleUnresolved,
  onMerge,
  onCopy,
  onEditClick,
  onDeleteClick,
}: {
  pinned: boolean
  unresolved: boolean
  showUnresolvedToggle: boolean
  canMerge: boolean
  hasText: boolean
  onTogglePin: () => void
  onToggleUnresolved: () => void
  onMerge: () => void
  onCopy: () => void
  onEditClick: () => void
  onDeleteClick: () => void
}) {
  return (
    <div className="mx-1.5 flex shrink-0 items-center gap-0.5 self-center opacity-0 transition-opacity group-hover:opacity-100">
      {hasText && (
        <button
          onClick={onEditClick}
          title="עריכת ההודעה"
          className="flex h-7 w-7 items-center justify-center rounded-full text-noc-t4 transition-colors hover:bg-noc-accent/15 hover:text-noc-accent"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {hasText && (
        <button
          onClick={onCopy}
          title="העתקת ההודעה"
          className="flex h-7 w-7 items-center justify-center rounded-full text-noc-t4 transition-colors hover:bg-noc-accent/15 hover:text-noc-accent"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
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

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Plus, Send, Paperclip, X, FileText } from 'lucide-react'
import type { MessageAttachment, MessageTag } from '../types'
import { TAG_META } from '../types'

// Attachments are stored inline (data URLs). Firestore documents cap at 1MB,
// so keep files comfortably under it (also friendlier to localStorage quota).
const MAX_FILE_BYTES = 700 * 1024
const MAX_FILES = 5
const MAX_TEXTAREA_HEIGHT = 160

interface ChatInputBarProps {
  operators: string[]
  selectedOperator: string
  onSelectOperator: (name: string) => void
  onAddOperator: (name: string) => void
  onSend: (text: string, tag: MessageTag, attachments: MessageAttachment[]) => void
  onFileError: (message: string) => void
}

/** Detects Hebrew (or other RTL) script so the textarea can auto-align while typing. */
function isRtlText(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const TAG_ORDER: MessageTag[] = ['update', 'incident', 'followup']

export default function ChatInputBar({
  operators,
  selectedOperator,
  onSelectOperator,
  onAddOperator,
  onSend,
  onFileError,
}: ChatInputBarProps) {
  const [text, setText] = useState('')
  const [tag, setTag] = useState<MessageTag>('update')
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [addingOperator, setAddingOperator] = useState(false)
  const [newOperatorName, setNewOperatorName] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const newOperatorInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)
    el.style.height = `${next}px`
    // Only allow a scrollbar once the content truly exceeds the max height —
    // otherwise Windows renders scrollbar arrow buttons on a one-line box
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
  }, [text])

  useEffect(() => {
    if (addingOperator) newOperatorInputRef.current?.focus()
  }, [addingOperator])

  const canSend = text.trim().length > 0 || attachments.length > 0

  const handleSend = () => {
    if (!canSend) return
    onSend(text.trim(), tag, attachments)
    setText('')
    setTag('update')
    setAttachments([])
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-selecting the same file
    for (const file of files) {
      if (attachments.length >= MAX_FILES) {
        onFileError(`ניתן לצרף עד ${MAX_FILES} קבצים להודעה`)
        break
      }
      if (file.size > MAX_FILE_BYTES) {
        onFileError(`הקובץ "${file.name}" גדול מדי (מקסימום 700KB)`)
        continue
      }
      try {
        const dataUrl = await readFileAsDataUrl(file)
        setAttachments((prev) =>
          prev.length >= MAX_FILES
            ? prev
            : [
                ...prev,
                {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                  name: file.name,
                  mimeType: file.type || 'application/octet-stream',
                  dataUrl,
                  size: file.size,
                },
              ],
        )
      } catch {
        onFileError(`לא ניתן לקרוא את הקובץ "${file.name}"`)
      }
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const rtl = isRtlText(text)

  if (addingOperator) {
    return (
      <div className="border-t border-noc-border bg-noc-panel/95 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2">
          <input
            ref={newOperatorInputRef}
            type="text"
            value={newOperatorName}
            onChange={(e) => setNewOperatorName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const trimmed = newOperatorName.trim()
                if (trimmed) {
                  onAddOperator(trimmed)
                  onSelectOperator(trimmed)
                }
                setNewOperatorName('')
                setAddingOperator(false)
              }
              if (e.key === 'Escape') setAddingOperator(false)
            }}
            placeholder="שם הנוקיסט החדש..."
            className="h-11 flex-1 rounded-xl border border-noc-border bg-noc-panel2 px-3 text-sm text-noc-t1 outline-none focus:border-noc-accent"
          />
          <button
            onClick={() => {
              const trimmed = newOperatorName.trim()
              if (trimmed) {
                onAddOperator(trimmed)
                onSelectOperator(trimmed)
              }
              setNewOperatorName('')
              setAddingOperator(false)
            }}
            className="h-11 shrink-0 rounded-xl bg-noc-gradient px-4 text-sm font-semibold text-white"
          >
            הוסף
          </button>
          <button
            onClick={() => setAddingOperator(false)}
            className="h-11 shrink-0 rounded-xl border border-noc-border px-4 text-sm font-semibold text-noc-t2 hover:bg-noc-panel2"
          >
            ביטול
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-noc-border bg-noc-panel/95 px-4 py-3 backdrop-blur-xl sm:px-6">
      {/* Tag selector + attachment previews */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {TAG_ORDER.map((t) => {
            const meta = TAG_META[t]
            const selected = t === tag
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                  selected ? meta.chip : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-t2'
                }`}
              >
                {meta.label}
              </button>
            )
          })}
        </div>

        {attachments.map((a) => (
          <span
            key={a.id}
            className="flex items-center gap-1.5 rounded-full border border-noc-border bg-noc-panel2 py-1 pe-1 ps-2 text-[11px] text-noc-t2"
          >
            {a.mimeType.startsWith('image/') ? (
              <img src={a.dataUrl} alt={a.name} className="h-5 w-5 rounded object-cover" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-noc-accent2" />
            )}
            <span className="max-w-28 truncate">{a.name}</span>
            <button
              type="button"
              onClick={() => removeAttachment(a.id)}
              className="flex h-4 w-4 items-center justify-center rounded-full text-noc-t3 hover:bg-red-500/20 hover:text-red-400"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-end gap-2">
        {/* Operator selector — native select, left side */}
        <div className="order-1 flex h-11 shrink-0 items-center gap-1 rounded-xl border border-noc-border bg-noc-panel2 ps-1 pe-2">
          <select
            value={selectedOperator}
            onChange={(e) => onSelectOperator(e.target.value)}
            className="h-full max-w-[7rem] truncate bg-transparent px-2 text-sm font-medium text-noc-t2 outline-none"
          >
            {operators.map((name) => (
              <option key={name} value={name} className="bg-noc-panel2 text-noc-t1">
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAddingOperator(true)}
            title="הוספת נוקיסט"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-noc-t3 transition-colors hover:bg-noc-panel3 hover:text-noc-accent2"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Textarea — middle */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          dir={rtl ? 'rtl' : 'ltr'}
          rows={1}
          placeholder="הקלד עדכון... (Enter לשליחה, Shift+Enter לשורה חדשה)"
          className="chat-textarea order-2 max-h-40 min-h-11 flex-1 rounded-xl border border-noc-border bg-noc-panel2 px-3 py-2.5 text-sm leading-relaxed text-noc-t1 placeholder-noc-t4 outline-none transition-colors focus:border-noc-accent"
          style={{ resize: 'none' }}
        />

        {/* Attach button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.log"
          onChange={handleFiles}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="צירוף קבצים"
          className="order-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-noc-border bg-noc-panel2 text-noc-t3 transition-colors hover:border-noc-accent/50 hover:text-noc-accent"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        {/* Send button — right side */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="order-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-noc-gradient text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          <Send className="h-4 w-4 -scale-x-100" />
        </button>
      </div>
    </div>
  )
}

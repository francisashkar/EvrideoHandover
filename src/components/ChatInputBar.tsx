import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent as ClipboardPasteEvent, KeyboardEvent } from 'react'
import { Plus, Send, Paperclip, X, FileText, Loader2, Zap, ChevronDown, Check, Clock, Link2, Pencil, Trash2 } from 'lucide-react'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { firebaseEnabled, storage } from '../firebase'
import type { MessageAttachment, MessageTag, ShiftId } from '../types'
import { SHIFT_DEFINITIONS } from '../types'
import { TAG_META, attachmentSrc, colorForOperator } from '../types'

// With Firebase, files go to Cloud Storage (only a link is kept in the message) — 10MB cap.
// In localStorage fallback mode they're stored inline as data URLs, so keep them small.
const MAX_FILE_BYTES = firebaseEnabled ? 10 * 1024 * 1024 : 700 * 1024
const MAX_FILE_LABEL = firebaseEnabled ? '10MB' : '700KB'
// When Storage upload fails, files up to this size fall back to inline storage
const INLINE_FALLBACK_BYTES = 700 * 1024
const MAX_FILES = 5
const MAX_TEXTAREA_HEIGHT = 160

export interface SendExtras {
  incidentId?: string
  targetDateKey?: string
  targetShiftId?: ShiftId
}

interface ChatInputBarProps {
  operators: string[]
  selectedOperator: string
  /** Unique key of the current date+shift — unsent drafts are kept per key */
  draftKey: string
  /** Open incidents of the current shift, offered for linking follow-ups */
  openIncidents: { id: string; label: string }[]
  currentDateKey: string
  currentShiftId: ShiftId
  onSelectOperator: (name: string) => void
  onAddOperator: (name: string) => void
  onRenameOperator: (oldName: string, newName: string) => void
  onDeleteOperator: (name: string) => void
  onSend: (text: string, tag: MessageTag, attachments: MessageAttachment[], extras: SendExtras) => void
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

const TAG_ORDER: MessageTag[] = ['update', 'incident', 'followup', 'maintenance', 'provider', 'hardware']

const TEMPLATES_KEY = 'noc-templates'
const DEFAULT_TEMPLATES = [
  'ערוץ __ נפל',
  'ערוץ __ חזר לשידור',
  'נפתחה פנייה לספק בנושא __',
  'בוצע ריסטרט ל__',
  'בדיקת ערוצים בוצעה — הכל תקין',
  'המשמרת נמסרה ללא תקלות פתוחות',
]

function loadTemplates(): string[] {
  try {
    const stored = window.localStorage.getItem(TEMPLATES_KEY)
    if (stored !== null) {
      const parsed = JSON.parse(stored) as string[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // fall through
  }
  return DEFAULT_TEMPLATES
}

export default function ChatInputBar({
  operators,
  selectedOperator,
  draftKey,
  openIncidents,
  currentDateKey,
  currentShiftId,
  onSelectOperator,
  onAddOperator,
  onRenameOperator,
  onDeleteOperator,
  onSend,
  onFileError,
}: ChatInputBarProps) {
  const [text, setText] = useState('')
  const [tag, setTag] = useState<MessageTag>('update')
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [templates, setTemplates] = useState<string[]>(loadTemplates)
  const [newTemplate, setNewTemplate] = useState('')
  const [addingOperator, setAddingOperator] = useState(false)
  const [operatorMenuOpen, setOperatorMenuOpen] = useState(false)
  const [editingOperator, setEditingOperator] = useState<string | null>(null)
  const [editOperatorValue, setEditOperatorValue] = useState('')
  const [deletingOperator, setDeletingOperator] = useState<string | null>(null)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)
  const operatorListRef = useRef<HTMLDivElement>(null)
  const selectedOperatorRowRef = useRef<HTMLDivElement>(null)
  const [incidentLink, setIncidentLink] = useState('')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [schedDate, setSchedDate] = useState(currentDateKey)
  const [schedShift, setSchedShift] = useState<ShiftId>(currentShiftId)
  const [newOperatorName, setNewOperatorName] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const newOperatorInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Draft autosave — unsent text survives refresh/crash, kept per date+shift.
  // skipSaveRef prevents the save effect (which runs with the pre-load empty
  // text right after a load) from wiping the stored draft.
  const skipSaveRef = useRef(true)
  useEffect(() => {
    skipSaveRef.current = true
    try {
      setText(window.localStorage.getItem(`noc-draft-${draftKey}`) ?? '')
    } catch {
      setText('')
    }
    setIncidentLink('')
    setScheduleOpen(false)
    setSchedDate(currentDateKey)
    setSchedShift(currentShiftId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false
      return
    }
    try {
      if (text) window.localStorage.setItem(`noc-draft-${draftKey}`, text)
      else window.localStorage.removeItem(`noc-draft-${draftKey}`)
    } catch {
      // ignore
    }
  }, [text, draftKey])

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

  useEffect(() => {
    try {
      window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
    } catch {
      // ignore
    }
  }, [templates])

  const addTemplate = () => {
    const trimmed = newTemplate.trim()
    if (!trimmed) return
    setTemplates((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    setNewTemplate('')
  }

  const updateScrollHint = () => {
    const el = operatorListRef.current
    if (!el) return
    setHasMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 8)
  }

  // When the picker opens: reset edit state, scroll the selected operator into
  // view, and compute whether a scroll hint is needed
  useEffect(() => {
    if (!operatorMenuOpen) return
    setEditingOperator(null)
    setDeletingOperator(null)
    requestAnimationFrame(() => {
      selectedOperatorRowRef.current?.scrollIntoView({ block: 'nearest' })
      updateScrollHint()
    })
  }, [operatorMenuOpen])

  const confirmRenameOperator = (oldName: string) => {
    const clean = editOperatorValue.trim()
    if (clean && clean !== oldName) onRenameOperator(oldName, clean)
    setEditingOperator(null)
  }

  const canSend = (text.trim().length > 0 || attachments.length > 0) && uploadingCount === 0

  const handleSend = () => {
    if (!canSend) return
    onSend(text.trim(), tag, attachments, {
      incidentId: incidentLink || undefined,
      targetDateKey: scheduleOpen ? schedDate : undefined,
      targetShiftId: scheduleOpen ? schedShift : undefined,
    })
    setText('')
    setTag('update')
    setAttachments([])
    setIncidentLink('')
    setScheduleOpen(false)
    textareaRef.current?.focus()
  }


  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const addFiles = async (files: File[]) => {
    for (const file of files) {
      if (attachments.length >= MAX_FILES) {
        onFileError(`ניתן לצרף עד ${MAX_FILES} קבצים להודעה`)
        break
      }
      if (file.size > MAX_FILE_BYTES) {
        onFileError(`הקובץ "${file.name}" גדול מדי (מקסימום ${MAX_FILE_LABEL})`)
        continue
      }

      const base = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }

      if (storage) {
        // Firebase mode: upload to Cloud Storage, keep only the download URL
        setUploadingCount((c) => c + 1)
        try {
          const storageRef = ref(storage, `attachments/${base.id}-${file.name}`)
          await uploadBytes(storageRef, file)
          const url = await getDownloadURL(storageRef)
          setAttachments((prev) => (prev.length >= MAX_FILES ? prev : [...prev, { ...base, url }]))
        } catch {
          // Storage not provisioned / blocked — small files can still travel
          // inline inside the Firestore message document (1MB doc cap)
          if (file.size <= INLINE_FALLBACK_BYTES) {
            try {
              const dataUrl = await readFileAsDataUrl(file)
              setAttachments((prev) => (prev.length >= MAX_FILES ? prev : [...prev, { ...base, dataUrl }]))
            } catch {
              onFileError(`לא ניתן לקרוא את הקובץ "${file.name}"`)
            }
          } else {
            onFileError(
              `העלאת "${file.name}" נכשלה — קבצים מעל 700KB דורשים הפעלת Storage בקונסולת Firebase`,
            )
          }
        } finally {
          setUploadingCount((c) => c - 1)
        }
      } else {
        // Fallback mode: inline data URL in localStorage
        try {
          const dataUrl = await readFileAsDataUrl(file)
          setAttachments((prev) => (prev.length >= MAX_FILES ? prev : [...prev, { ...base, dataUrl }]))
        } catch {
          onFileError(`לא ניתן לקרוא את הקובץ "${file.name}"`)
        }
      }
    }
  }

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-selecting the same file
    void addFiles(files)
  }

  /** Paste a screenshot/image straight from the clipboard into the message */
  const handlePaste = (e: ClipboardPasteEvent) => {
    const files = Array.from(e.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)
      .map((f) => {
        // Clipboard screenshots arrive as generic "image.png" — give them a real name
        if (/^image\.\w+$/i.test(f.name)) {
          const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
          const ext = f.type.split('/')[1] || 'png'
          return new File([f], `screenshot-${stamp}.${ext}`, { type: f.type })
        }
        return f
      })
    if (files.length === 0) return
    e.preventDefault()
    void addFiles(files)
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
      {/* Tag selector + templates + attachment previews */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
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

        {/* Quick templates */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTemplatesOpen((v) => !v)}
            title="תבניות מהירות"
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
              templatesOpen
                ? 'bg-noc-accent/15 text-noc-accent ring-noc-accent/40'
                : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-accent'
            }`}
          >
            <Zap className="h-3 w-3" />
            תבניות
          </button>
          {templatesOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setTemplatesOpen(false)} />
              <div className="absolute bottom-full start-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border border-noc-border bg-noc-panel2 shadow-2xl">
                <div className="max-h-56 overflow-y-auto scrollbar-thin">
                  {templates.length === 0 && (
                    <p className="px-3 py-3 text-center text-[11px] text-noc-t4">אין תבניות — הוסיפו למטה</p>
                  )}
                  {templates.map((tpl) => (
                    <div
                      key={tpl}
                      className="group/tpl flex items-center gap-1 transition-colors hover:bg-noc-accent/10"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setText((prev) => (prev.trim() ? `${prev}\n${tpl}` : tpl))
                          setTemplatesOpen(false)
                          textareaRef.current?.focus()
                        }}
                        className="min-w-0 flex-1 px-3 py-2 text-start text-xs text-noc-t2 hover:text-noc-t1"
                      >
                        {tpl}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplates((prev) => prev.filter((t) => t !== tpl))}
                        title="מחיקת תבנית"
                        className="me-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-noc-t4 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-400 group-hover/tpl:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 border-t border-noc-border p-2">
                  <input
                    type="text"
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTemplate()
                      }
                    }}
                    placeholder="תבנית חדשה..."
                    className="h-8 min-w-0 flex-1 rounded-lg border border-noc-border bg-noc-bg/40 px-2 text-xs text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
                  />
                  <button
                    type="button"
                    onClick={addTemplate}
                    disabled={!newTemplate.trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-noc-gradient text-white disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Link a follow-up to an open incident */}
        {openIncidents.length > 0 && tag !== 'incident' && (
          <span className="flex items-center gap-1 rounded-full ring-1 ring-noc-border px-1 py-0.5">
            <Link2 className="h-3 w-3 text-red-400" />
            <select
              value={incidentLink}
              onChange={(e) => setIncidentLink(e.target.value)}
              className="max-w-44 bg-transparent text-[11px] font-bold text-noc-t3 outline-none"
            >
              <option value="">ללא שיוך לתקלה</option>
              {openIncidents.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </span>
        )}

        {/* Send to another date/shift */}
        <button
          type="button"
          onClick={() => setScheduleOpen((v) => !v)}
          title="שליחה לתאריך/משמרת אחרים"
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
            scheduleOpen
              ? 'bg-violet-500/15 text-violet-500 ring-violet-500/40 dark:text-violet-300'
              : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-t2'
          }`}
        >
          <Clock className="h-3 w-3" />
          למועד אחר
        </button>
        {scheduleOpen && (
          <span className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2 py-1 ring-1 ring-violet-500/30">
            <input
              type="date"
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
              className="bg-transparent text-[11px] text-noc-t2 outline-none"
            />
            <select
              value={schedShift}
              onChange={(e) => setSchedShift(e.target.value as ShiftId)}
              className="bg-transparent text-[11px] font-bold text-noc-t2 outline-none"
            >
              {SHIFT_DEFINITIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </span>
        )}

        {attachments.map((a) => (
          <span
            key={a.id}
            className="flex items-center gap-1.5 rounded-full border border-noc-border bg-noc-panel2 py-1 pe-1 ps-2 text-[11px] text-noc-t2"
          >
            {a.mimeType.startsWith('image/') ? (
              <img src={attachmentSrc(a)} alt={a.name} className="h-5 w-5 rounded object-cover" />
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

        {uploadingCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full border border-noc-accent/40 bg-noc-accent/10 px-2.5 py-1 text-[11px] font-medium text-noc-accent">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            מעלה {uploadingCount} {uploadingCount === 1 ? 'קובץ' : 'קבצים'}...
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        {/* Operator picker — avatar button with popup */}
        <div className="relative order-1">
          <button
            type="button"
            onClick={() => setOperatorMenuOpen((v) => !v)}
            title="בחירת נוקיסט"
            className={`flex h-11 shrink-0 items-center gap-2 rounded-xl border ps-1.5 pe-3 transition-colors ${
              operatorMenuOpen
                ? 'border-noc-accent/60 bg-noc-accent/10'
                : 'border-noc-border bg-noc-panel2 hover:border-noc-accent/50'
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ring-1 ${colorForOperator(
                selectedOperator || '?',
              )}`}
            >
              {(selectedOperator || '?').charAt(0)}
            </span>
            <span className="max-w-24 truncate text-sm font-semibold text-noc-t1">
              {selectedOperator || 'בחר נוקיסט'}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-noc-t4 transition-transform ${operatorMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {operatorMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOperatorMenuOpen(false)} />
              <div className="absolute bottom-full start-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-noc-border bg-noc-panel2 shadow-2xl">
                <p className="border-b border-noc-border bg-noc-panel3/50 px-3 py-1.5 text-[10px] font-bold text-noc-t3">
                  מי כותב עכשיו? ({operators.length} נוקיסטים)
                </p>
                <div className="relative">
                  <div
                    ref={operatorListRef}
                    onScroll={updateScrollHint}
                    className="max-h-72 overflow-y-auto scrollbar-thin"
                  >
                    {operators.map((name) => {
                      const selected = name === selectedOperator
                      if (editingOperator === name) {
                        return (
                          <div key={name} className="flex items-center gap-1.5 px-3 py-2">
                            <input
                              autoFocus
                              type="text"
                              value={editOperatorValue}
                              onChange={(e) => setEditOperatorValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  confirmRenameOperator(name)
                                }
                                if (e.key === 'Escape') setEditingOperator(null)
                              }}
                              className="h-8 min-w-0 flex-1 rounded-md border border-noc-accent/50 bg-noc-bg/40 px-2 text-sm text-noc-t1 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => confirmRenameOperator(name)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-noc-accent text-white"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingOperator(null)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-noc-border text-noc-t3"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      }
                      return (
                        <div
                          key={name}
                          ref={selected ? selectedOperatorRowRef : undefined}
                          className={`group/op flex w-full items-center gap-1.5 pe-2 transition-colors ${
                            selected ? 'bg-noc-accent/10' : 'hover:bg-noc-panel3'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectOperator(name)
                              setOperatorMenuOpen(false)
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-start"
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${colorForOperator(name)}`}
                            >
                              {name.charAt(0)}
                            </span>
                            <span
                              className={`min-w-0 flex-1 truncate text-sm ${
                                selected ? 'font-bold text-noc-accent' : 'font-medium text-noc-t1'
                              }`}
                            >
                              {name}
                            </span>
                            {selected && <Check className="h-4 w-4 shrink-0 text-noc-accent" />}
                          </button>
                          {deletingOperator === name ? (
                            <span className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteOperator(name)
                                  setDeletingOperator(null)
                                }}
                                title="אישור מחיקה"
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-400"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingOperator(null)}
                                title="ביטול"
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-noc-border text-noc-t3"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/op:opacity-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditOperatorValue(name)
                                  setEditingOperator(name)
                                }}
                                title="שינוי שם"
                                className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-noc-accent/15 hover:text-noc-accent"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingOperator(name)}
                                title="מחיקת נוקיסט"
                                className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Scroll hint — fades + bounces when more operators are below */}
                  {hasMoreBelow && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t from-noc-panel2 to-transparent pb-0.5">
                      <ChevronDown className="h-4 w-4 animate-bounce text-noc-accent" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOperatorMenuOpen(false)
                    setAddingOperator(true)
                  }}
                  className="flex w-full items-center gap-2.5 border-t border-noc-border px-3 py-2 text-start text-sm font-medium text-noc-accent2 transition-colors hover:bg-noc-accent/10"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-noc-accent2/50">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  הוספת נוקיסט
                </button>
              </div>
            </>
          )}
        </div>

        {/* Textarea — middle */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          dir={rtl ? 'rtl' : 'ltr'}
          rows={1}
          placeholder="הקלד עדכון... (Enter לשליחה, Ctrl+V להדבקת צילום מסך)"
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

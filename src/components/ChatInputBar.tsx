import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent as ClipboardPasteEvent, KeyboardEvent } from 'react'
import { Plus, Send, Paperclip, X, FileText, Loader2, Zap, ChevronDown, Check, Clock, Link2, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { firebaseEnabled, storage } from '../firebase'
import type { IncidentUrgency, MessageAttachment, MessageTag, ShiftId } from '../types'
import { BUILTIN_INCIDENT_TAG, SHIFT_DEFINITIONS, URGENCY_META } from '../types'
import { attachmentSrc, colorForOperator } from '../types'
import type { TagDef } from '../types'

// With Firebase, files go to Cloud Storage (only a link is kept in the message) — 10MB cap.
// In localStorage fallback mode they're stored inline as data URLs, so keep them small.
const MAX_FILE_BYTES = firebaseEnabled ? 10 * 1024 * 1024 : 700 * 1024
const MAX_FILE_LABEL = firebaseEnabled ? '10MB' : '700KB'
// When Storage upload fails, files up to this size fall back to inline storage
const INLINE_FALLBACK_BYTES = 700 * 1024
const MAX_FILES = 5
const MAX_TEXTAREA_HEIGHT = 160
const URGENCY_ORDER: IncidentUrgency[] = ['critical', 'high', 'medium', 'low']

export interface SendExtras {
  incidentId?: string
  urgency?: IncidentUrgency
  targetDateKey?: string
  targetShiftId?: ShiftId
}

interface ChatInputBarProps {
  operators: string[]
  selectedOperator: string
  tags: TagDef[]
  onAddTag: (input: { label: string; chip: string; ticketPrefix: string }) => void
  onUpdateTag: (id: string, input: { label: string; chip: string; ticketPrefix: string }) => void
  onDeleteTag: (id: string) => void
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

const TEMPLATES_KEY = 'noc-templates'
const DEFAULT_TEMPLATES = [
  'ערוץ __ נפל',
  'ערוץ __ חזר לשידור',
  'נפתחה פנייה לספק בנושא __',
  'בוצע ריסטרט ל__',
  'בדיקת ערוצים בוצעה — הכל תקין',
  'המשמרת נמסרה ללא תקלות פתוחות',
]


const TAG_COLOR_PRESETS = [
  'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  'bg-red-500/15 text-red-400 ring-red-500/30',
  'bg-amber-500/15 text-amber-500 ring-amber-500/30',
  'bg-violet-500/15 text-violet-500 ring-violet-500/30 dark:text-violet-400',
  'bg-orange-500/15 text-orange-500 ring-orange-500/30 dark:text-orange-400',
  'bg-rose-500/15 text-rose-500 ring-rose-500/30 dark:text-rose-400',
  'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30 dark:text-emerald-400',
  'bg-cyan-500/15 text-cyan-500 ring-cyan-500/30 dark:text-cyan-400',
]

function nextTagColor(usedCount: number): string {
  return TAG_COLOR_PRESETS[usedCount % TAG_COLOR_PRESETS.length]
}

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
  tags,
  onAddTag,
  onUpdateTag,
  onDeleteTag,
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
  const [urgency, setUrgency] = useState<IncidentUrgency>('medium')
  const [urgencyPickerOpen, setUrgencyPickerOpen] = useState(false)
  const [managingTags, setManagingTags] = useState(false)
  const [newTagLabel, setNewTagLabel] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editTagLabel, setEditTagLabel] = useState('')
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
  const [incidentLinkMenuOpen, setIncidentLinkMenuOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [schedDate, setSchedDate] = useState(currentDateKey)
  const [schedShift, setSchedShift] = useState<ShiftId>(currentShiftId)
  const [schedShiftMenuOpen, setSchedShiftMenuOpen] = useState(false)
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
      urgency: tag === BUILTIN_INCIDENT_TAG ? urgency : undefined,
      targetDateKey: scheduleOpen ? schedDate : undefined,
      targetShiftId: scheduleOpen ? schedShift : undefined,
    })
    setText('')
    setTag('update')
    setUrgency('medium')
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
      <div className="border-t border-noc-border bg-noc-panel/95 px-4 py-3 sm:px-6">
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
    <div className="border-t border-noc-border bg-noc-panel/95 px-4 py-3 sm:px-6">
      {/* Tag selector + templates + attachment previews */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((t) => {
            const selected = t.id === tag
            const isIncidentTag = t.id === BUILTIN_INCIDENT_TAG
            return (
              <span key={t.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setTag(t.id)
                    if (isIncidentTag) setUrgencyPickerOpen(true)
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                    selected ? t.chip : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-t2'
                  }`}
                >
                  {t.label}
                  {isIncidentTag && selected && (
                    <span className="ms-1 opacity-80">· {URGENCY_META[urgency].label}</span>
                  )}
                </button>
                {isIncidentTag && urgencyPickerOpen && selected && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUrgencyPickerOpen(false)} />
                    <div className="absolute bottom-full start-0 z-50 mb-2 w-40 overflow-hidden rounded-xl border border-noc-border bg-noc-panel2 shadow-2xl">
                      <p className="border-b border-noc-border bg-noc-panel3/50 px-3 py-1.5 text-[10px] font-bold text-noc-t3">
                        רמת דחיפות
                      </p>
                      {URGENCY_ORDER.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => {
                            setUrgency(u)
                            setUrgencyPickerOpen(false)
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-semibold transition-colors hover:bg-noc-panel3 ${
                            urgency === u ? 'text-noc-t1' : 'text-noc-t3'
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${URGENCY_META[u].dot}`} />
                          {URGENCY_META[u].label}
                          {urgency === u && <Check className="ms-auto h-3 w-3 text-noc-accent" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </span>
            )
          })}
          <button
            type="button"
            onClick={() => setManagingTags((v) => !v)}
            title="ניהול תיוגים"
            className={`flex items-center justify-center rounded-full px-2 py-1 ring-1 transition-all ${
              managingTags
                ? 'bg-noc-accent/15 text-noc-accent ring-noc-accent/40'
                : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-t2'
            }`}
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>

        {managingTags && (
          <div className="w-full rounded-xl border border-noc-accent/40 bg-noc-panel2 p-2.5">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((t) =>
                editingTagId === t.id ? (
                  <div
                    key={t.id}
                    className="flex items-center gap-1 rounded-full border border-noc-accent/50 bg-noc-bg/60 py-1 ps-2.5 pe-1"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={editTagLabel}
                      onChange={(e) => setEditTagLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const label = editTagLabel.trim()
                          if (label) onUpdateTag(t.id, { label, chip: t.chip, ticketPrefix: `[${label}] ` })
                          setEditingTagId(null)
                        }
                        if (e.key === 'Escape') setEditingTagId(null)
                      }}
                      className="h-6 w-24 bg-transparent text-xs text-noc-t1 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const label = editTagLabel.trim()
                        if (label) onUpdateTag(t.id, { label, chip: t.chip, ticketPrefix: `[${label}] ` })
                        setEditingTagId(null)
                      }}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-noc-accent text-white"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTagId(null)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel3"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    key={t.id}
                    className={`group/tagrow flex items-center gap-1 rounded-full py-1 ps-2.5 pe-1 text-[11px] font-bold ring-1 ${t.chip}`}
                  >
                    <span>{t.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditTagLabel(t.label)
                        setEditingTagId(t.id)
                      }}
                      title="עריכת תיוג"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    {!t.builtin && (
                      <button
                        type="button"
                        onClick={() => onDeleteTag(t.id)}
                        title="מחיקת תיוג"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:bg-red-500/20 hover:opacity-100"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const label = newTagLabel.trim()
                    if (label) onAddTag({ label, chip: nextTagColor(tags.length), ticketPrefix: `[${label}] ` })
                    setNewTagLabel('')
                  }
                }}
                placeholder="תיוג חדש..."
                className="h-8 min-w-0 flex-1 rounded-lg border border-noc-border bg-noc-bg/40 px-2 text-xs text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
              />
              <button
                type="button"
                onClick={() => {
                  const label = newTagLabel.trim()
                  if (label) onAddTag({ label, chip: nextTagColor(tags.length), ticketPrefix: `[${label}] ` })
                  setNewTagLabel('')
                }}
                disabled={!newTagLabel.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-noc-gradient text-white disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

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
          <div className="relative">
            <button
              type="button"
              onClick={() => setIncidentLinkMenuOpen((v) => !v)}
              className={`flex max-w-52 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                incidentLink
                  ? 'bg-red-500/10 text-red-400 ring-red-500/40'
                  : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-t2'
              }`}
            >
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate">
                {incidentLink ? openIncidents.find((i) => i.id === incidentLink)?.label : 'שיוך לתקלה'}
              </span>
              <ChevronDown
                className={`h-3 w-3 shrink-0 transition-transform ${incidentLinkMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {incidentLinkMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIncidentLinkMenuOpen(false)} />
                <div className="absolute bottom-full start-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-noc-border bg-noc-panel2 shadow-2xl">
                  <p className="border-b border-noc-border bg-noc-panel3/50 px-3 py-1.5 text-[10px] font-bold text-noc-t3">
                    שיוך העדכון לתקלה פתוחה
                  </p>
                  <div className="max-h-60 overflow-y-auto scrollbar-thin">
                    <button
                      type="button"
                      onClick={() => {
                        setIncidentLink('')
                        setIncidentLinkMenuOpen(false)
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors hover:bg-noc-panel3 ${
                        !incidentLink ? 'font-bold text-noc-accent' : 'font-medium text-noc-t2'
                      }`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-noc-t4/50 text-noc-t4">
                        <X className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">ללא שיוך לתקלה</span>
                      {!incidentLink && <Check className="h-4 w-4 shrink-0 text-noc-accent" />}
                    </button>
                    {openIncidents.map((i) => {
                      const selected = i.id === incidentLink
                      return (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => {
                            setIncidentLink(i.id)
                            setIncidentLinkMenuOpen(false)
                          }}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors hover:bg-noc-panel3 ${
                            selected ? 'bg-noc-accent/10' : ''
                          }`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400 ring-1 ring-red-500/30">
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate text-sm ${
                              selected ? 'font-bold text-noc-accent' : 'font-medium text-noc-t1'
                            }`}
                          >
                            {i.label}
                          </span>
                          {selected && <Check className="h-4 w-4 shrink-0 text-noc-accent" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Send to another date/shift */}
        <div className="relative">
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
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  setScheduleOpen(false)
                  setSchedShiftMenuOpen(false)
                }}
              />
              <div className="absolute bottom-full start-0 z-50 mb-2 w-60 space-y-2 rounded-xl border border-violet-500/40 bg-noc-panel2 p-2.5 shadow-2xl">
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 text-xs text-noc-t1 outline-none focus:border-violet-500/60"
                />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSchedShiftMenuOpen((v) => !v)}
                    className="flex h-9 w-full items-center justify-between rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 text-xs font-semibold text-noc-t1 transition-colors hover:border-violet-500/50"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{SHIFT_DEFINITIONS.find((d) => d.id === schedShift)?.emoji}</span>
                      {SHIFT_DEFINITIONS.find((d) => d.id === schedShift)?.label}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-noc-t4 transition-transform ${schedShiftMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {schedShiftMenuOpen && (
                    <div className="absolute top-full start-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-noc-border bg-noc-panel3 shadow-2xl">
                      {SHIFT_DEFINITIONS.map((d) => {
                        const selected = d.id === schedShift
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSchedShift(d.id)
                              setSchedShiftMenuOpen(false)
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-start text-xs transition-colors hover:bg-noc-panel2 ${
                              selected ? 'font-bold text-noc-accent' : 'font-medium text-noc-t2'
                            }`}
                          >
                            <span>{d.emoji}</span>
                            <span className="min-w-0 flex-1 truncate">{d.label}</span>
                            {selected && <Check className="h-3.5 w-3.5 shrink-0 text-noc-accent" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

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

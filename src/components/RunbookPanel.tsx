import { useMemo, useState } from 'react'
import type { ClipboardEvent as ClipboardPasteEvent } from 'react'
import { X, BookOpen, Plus, Pencil, Trash2, Check, Copy, Search, ChevronDown, Loader2, ImagePlus } from 'lucide-react'
import type { RunbookApi, RunbookEntry, RunbookInput } from '../hooks/useRunbook'
import { copyToClipboard } from '../clipboard'
import HighlightText from './HighlightText'
import { filesFromClipboard, processAttachmentFile } from '../attachments'
import { attachmentSrc } from '../types'
import type { MessageAttachment } from '../types'

interface RunbookPanelProps {
  open: boolean
  onClose: () => void
  api: RunbookApi
  onCopied: () => void
  onError: (message: string) => void
}

const EMPTY: RunbookInput = { title: '', category: '', content: '', images: [] }
const MAX_IMAGES = 8

export default function RunbookPanel({ open, onClose, api, onCopied, onError }: RunbookPanelProps) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<RunbookInput>(EMPTY)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [lightbox, setLightbox] = useState<MessageAttachment | null>(null)

  const categories = useMemo(
    () => [...new Set(api.entries.map((e) => e.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')),
    [api.entries],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return api.entries.filter((e) => {
      if (categoryFilter !== 'all' && e.category.trim() !== categoryFilter) return false
      if (!q) return true
      return (
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      )
    })
  }, [api.entries, query, categoryFilter])

  if (!open) return null

  const startNew = () => {
    setForm({ ...EMPTY, category: categoryFilter !== 'all' ? categoryFilter : '' })
    setEditingId('new')
  }

  const startEdit = (e: RunbookEntry) => {
    setForm({ title: e.title, category: e.category, content: e.content, images: e.images ?? [] })
    setEditingId(e.id)
  }

  /** Paste a screenshot straight into the procedure being edited */
  const handlePasteImage = async (e: ClipboardPasteEvent) => {
    const files = filesFromClipboard(e.clipboardData).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    e.preventDefault()
    for (const file of files) {
      if (form.images.length + uploadingCount >= MAX_IMAGES) {
        onError(`עד ${MAX_IMAGES} תמונות לנוהל`)
        break
      }
      setUploadingCount((c) => c + 1)
      const result = await processAttachmentFile(file)
      setUploadingCount((c) => c - 1)
      if (result.ok) setForm((f) => ({ ...f, images: [...f.images, result.attachment] }))
      else onError(result.error)
    }
  }

  const save = () => {
    if (!form.title.trim() || !form.content.trim() || uploadingCount > 0) return
    if (editingId === 'new') api.addEntry(form)
    else if (editingId) api.updateEntry(editingId, form)
    setEditingId(null)
    setForm(EMPTY)
  }

  const copyEntry = async (e: RunbookEntry) => {
    if (await copyToClipboard(`${e.title}\n\n${e.content}`)) onCopied()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-b-2xl border border-t-0 border-noc-border bg-noc-panel shadow-2xl sm:top-6 sm:rounded-2xl sm:border-t">
        <div className="flex items-center justify-between border-b border-noc-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-noc-t1">
            <BookOpen className="h-5 w-5 text-noc-accent" />
            יומן תפעול
            <span className="rounded-full bg-noc-accent/15 px-2 py-0.5 text-[10px] font-bold text-noc-accent">
              {api.entries.length} נהלים
            </span>
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={startNew}
              className="flex items-center gap-1 rounded-full bg-noc-gradient px-3 py-1.5 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> נוהל חדש
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search + category filter */}
        <div className="space-y-2 border-b border-noc-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noc-t4" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='חיפוש מהיר — למשל "ריסטרט לאנקודר"...'
              autoFocus
              className="h-10 w-full rounded-full border border-noc-border bg-noc-panel2 pe-10 ps-4 text-sm text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
            />
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                  categoryFilter === 'all'
                    ? 'bg-noc-accent/15 text-noc-accent ring-noc-accent/40'
                    : 'text-noc-t4 ring-noc-border hover:text-noc-t2'
                }`}
              >
                הכל
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(categoryFilter === c ? 'all' : c)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                    categoryFilter === c
                      ? 'bg-sky-500/15 text-sky-500 ring-sky-500/40 dark:text-sky-300'
                      : 'text-noc-t4 ring-noc-border hover:text-noc-t2'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {editingId && (
            <div className="mb-3 space-y-2 rounded-xl border border-noc-accent/50 bg-noc-panel2 p-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="כותרת הנוהל *"
                  className="col-span-2 h-9 rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 text-sm text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
                />
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="קטגוריה"
                  list="runbook-categories"
                  className="h-9 rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 text-sm text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
                />
                <datalist id="runbook-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                onPaste={handlePasteImage}
                placeholder={'השלבים, שורה אחרי שורה (Ctrl+V להדבקת צילום מסך):\n1. ...\n2. ...'}
                rows={7}
                className="w-full rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 py-2 text-sm leading-relaxed text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
                style={{ resize: 'none' }}
              />
              {(form.images.length > 0 || uploadingCount > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {form.images.map((img) => (
                    <span key={img.id} className="group/img relative">
                      <img
                        src={attachmentSrc(img)}
                        alt={img.name}
                        className="h-14 w-14 rounded-lg border border-noc-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, images: f.images.filter((i) => i.id !== img.id) }))}
                        title="הסרת תמונה"
                        className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover/img:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {uploadingCount > 0 && (
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-noc-accent/50">
                      <Loader2 className="h-4 w-4 animate-spin text-noc-accent" />
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-noc-t4">
                    <ImagePlus className="h-3 w-3" />
                    Ctrl+V להוספה
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={save}
                  disabled={!form.title.trim() || !form.content.trim() || uploadingCount > 0}
                  className="flex items-center gap-1 rounded-full bg-noc-accent px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" /> שמירה
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-full border border-noc-border px-3 py-1.5 text-xs font-bold text-noc-t2 hover:bg-noc-panel3"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {filtered.length === 0 && !editingId ? (
            <p className="py-10 text-center text-xs text-noc-t4">
              {api.entries.length === 0
                ? 'אין נהלים עדיין — תעדו כאן איך מטפלים בדברים, פעם אחת ולתמיד'
                : 'לא נמצאו נהלים תואמים'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => {
                const expanded = expandedId === e.id
                return (
                  <div key={e.id} className="overflow-hidden rounded-xl border border-noc-border bg-noc-panel2">
                    <div className="group flex items-center gap-2 px-3.5 py-2.5">
                      <button
                        onClick={() => setExpandedId(expanded ? null : e.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-start"
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-noc-t4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-noc-t1">
                          <HighlightText text={e.title} term={query} />
                        </span>
                        {e.category && (
                          <span className="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-500 ring-1 ring-sky-500/30 dark:text-sky-300">
                            {e.category}
                          </span>
                        )}
                        {(e.images?.length ?? 0) > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-noc-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-noc-accent ring-1 ring-noc-accent/30">
                            <ImagePlus className="h-2.5 w-2.5" />
                            {e.images.length}
                          </span>
                        )}
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => copyEntry(e)}
                          title="העתקת הנוהל"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-noc-accent/15 hover:text-noc-accent"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => startEdit(e)}
                          title="עריכה"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-noc-accent/15 hover:text-noc-accent"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => api.deleteEntry(e.id)}
                          title="מחיקה"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="border-t border-noc-border bg-noc-bg/30 px-4 py-3">
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-noc-t2">
                          <HighlightText text={e.content} term={query} />
                        </p>
                        {(e.images?.length ?? 0) > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {e.images.map((img) => (
                              <button
                                key={img.id}
                                type="button"
                                onClick={() => setLightbox(img)}
                                title={`${img.name} — לחצו להגדלה`}
                                className="cursor-zoom-in overflow-hidden rounded-lg border border-noc-border transition-opacity hover:opacity-90"
                              >
                                <img src={attachmentSrc(img)} alt={img.name} className="h-24 max-w-40 object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-10"
          onClick={() => setLightbox(null)}
        >
          <img
            src={attachmentSrc(lightbox)}
            alt={lightbox.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            onClick={() => setLightbox(null)}
            title="סגירה"
            className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="absolute bottom-4 max-w-[80%] truncate rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/80">
            {lightbox.name}
          </p>
        </div>
      )}
    </>
  )
}

import { useMemo, useState } from 'react'
import type { ClipboardEvent as ClipboardPasteEvent } from 'react'
import {
  X,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Check,
  ExternalLink,
  Send,
  Loader2,
  ImagePlus,
  FileText,
  Download,
  Archive,
  Search,
} from 'lucide-react'
import type { IncidentItem, IncidentUrgency, MessageAttachment, ShiftId } from '../types'
import { URGENCY_META, attachmentSrc } from '../types'
import type { IncidentsApi, NewIncidentInput } from '../hooks/useIncidents'
import { filesFromClipboard, processAttachmentFile } from '../attachments'
import { formatDateShort, formatTime } from '../dateUtils'
import HighlightText from './HighlightText'

interface IncidentBoardProps {
  open: boolean
  onClose: () => void
  api: IncidentsApi
  operator: string
  onError: (message: string) => void
  onJumpToChat: (dateKey: string, shiftId: ShiftId, messageId: string) => void
  onRequestResolve: (incident: IncidentItem) => void
  onOpenArchive: () => void
}

const URGENCY_ORDER: IncidentUrgency[] = ['critical', 'high', 'medium', 'low']

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const EMPTY_FORM = { title: '', description: '', urgency: 'medium' as IncidentUrgency }

export default function IncidentBoard({
  open,
  onClose,
  api,
  operator,
  onError,
  onJumpToChat,
  onRequestResolve,
  onOpenArchive,
}: IncidentBoardProps) {
  const [query, setQuery] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState<IncidentUrgency | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [timelineDraft, setTimelineDraft] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<MessageAttachment | null>(null)

  const open_ = api.incidents.filter((i) => i.open)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return open_
      .filter((i) => urgencyFilter === 'all' || i.urgency === urgencyFilter)
      .filter(
        (i) => !q || i.title.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => URGENCY_META[a.urgency].order - URGENCY_META[b.urgency].order || b.createdAt - a.createdAt)
  }, [open_, query, urgencyFilter])

  if (!open) return null

  const attachFiles = async (files: File[]) => {
    for (const file of files) {
      setUploadingCount((c) => c + 1)
      const result = await processAttachmentFile(file)
      setUploadingCount((c) => c - 1)
      if (result.ok) setPendingAttachments((prev) => [...prev, result.attachment])
      else onError(result.error)
    }
  }

  const handlePaste = (e: ClipboardPasteEvent) => {
    const files = filesFromClipboard(e.clipboardData)
    if (files.length === 0) return
    e.preventDefault()
    void attachFiles(files)
  }

  const createIncident = () => {
    if (!form.title.trim() || uploadingCount > 0) return
    const input: NewIncidentInput = {
      title: form.title,
      description: form.description,
      urgency: form.urgency,
      createdBy: operator,
      source: { kind: 'manual' },
      attachments: pendingAttachments,
    }
    api.addIncident(input)
    setForm(EMPTY_FORM)
    setPendingAttachments([])
    setCreating(false)
  }

  const startEdit = (i: IncidentItem) => {
    setEditForm({ title: i.title, description: i.description ?? '', urgency: i.urgency })
    setEditingId(i.id)
  }

  const saveEdit = (id: string) => {
    if (!editForm.title.trim()) return
    api.updateIncident(id, {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      urgency: editForm.urgency,
    })
    setEditingId(null)
  }

  const submitTimeline = (id: string) => {
    const text = (timelineDraft[id] ?? '').trim()
    if (!text) return
    api.addTimelineEntry(id, text, operator)
    setTimelineDraft((prev) => ({ ...prev, [id]: '' }))
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 z-50 flex w-full max-w-md flex-col border-e border-noc-border bg-noc-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-noc-border px-4 py-3.5">
          <h2 className="flex items-center gap-2 text-base font-bold text-noc-t1">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            עמודת תקלות
            {open_.length > 0 && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-500">
                {open_.length} פתוחות
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenArchive}
              title="ארכיון תקלות שנפתרו"
              className="flex h-8 w-8 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1"
            >
              <Archive className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search + urgency filter */}
        <div className="space-y-2 border-b border-noc-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noc-t4" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש בתקלות פתוחות..."
              className="h-9 w-full rounded-full border border-noc-border bg-noc-panel2 pe-9 ps-3 text-sm text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setUrgencyFilter('all')}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                urgencyFilter === 'all'
                  ? 'bg-noc-accent/15 text-noc-accent ring-noc-accent/40'
                  : 'text-noc-t4 ring-noc-border hover:text-noc-t2'
              }`}
            >
              הכל
            </button>
            {URGENCY_ORDER.map((u) => (
              <button
                key={u}
                onClick={() => setUrgencyFilter(urgencyFilter === u ? 'all' : u)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                  urgencyFilter === u ? URGENCY_META[u].chip : 'text-noc-t4 ring-noc-border hover:text-noc-t2'
                }`}
              >
                {URGENCY_META[u].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-noc-accent/40 py-2.5 text-sm font-bold text-noc-accent transition-colors hover:bg-noc-accent/10"
            >
              <Plus className="h-4 w-4" /> תקלה חדשה
            </button>
          ) : (
            <div className="mb-3 space-y-2 rounded-xl border border-noc-accent/50 bg-noc-panel2 p-3">
              <input
                autoFocus
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="כותרת התקלה..."
                className="h-9 w-full rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 text-sm text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                onPaste={handlePaste}
                placeholder="תיאור מפורט (לא חובה)..."
                rows={2}
                className="w-full rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 py-2 text-xs text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
                style={{ resize: 'none' }}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {URGENCY_ORDER.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, urgency: u }))}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                      form.urgency === u ? URGENCY_META[u].chip : 'text-noc-t4 ring-noc-border hover:text-noc-t2'
                    }`}
                  >
                    {URGENCY_META[u].label}
                  </button>
                ))}
              </div>
              {(pendingAttachments.length > 0 || uploadingCount > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {pendingAttachments.map((a) => (
                    <span
                      key={a.id}
                      className="flex items-center gap-1 rounded-full border border-noc-border bg-noc-bg/40 py-1 pe-1 ps-2 text-[10px] text-noc-t2"
                    >
                      {a.mimeType.startsWith('image/') ? (
                        <img src={attachmentSrc(a)} alt={a.name} className="h-4 w-4 rounded object-cover" />
                      ) : (
                        <FileText className="h-3 w-3 text-noc-accent2" />
                      )}
                      <span className="max-w-20 truncate">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setPendingAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                        className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-red-500/20 hover:text-red-400"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  {uploadingCount > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin text-noc-accent" />}
                </div>
              )}
              <p className="flex items-center gap-1 text-[10px] text-noc-t4">
                <ImagePlus className="h-3 w-3" /> Ctrl+V בשדה התיאור להדבקת תמונה/קובץ
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={createIncident}
                  disabled={!form.title.trim() || uploadingCount > 0}
                  className="flex items-center gap-1 rounded-full bg-noc-accent px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" /> יצירה
                </button>
                <button
                  onClick={() => {
                    setCreating(false)
                    setForm(EMPTY_FORM)
                    setPendingAttachments([])
                  }}
                  className="rounded-full border border-noc-border px-3 py-1.5 text-xs font-bold text-noc-t2 hover:bg-noc-panel3"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-noc-t4">
              {open_.length === 0 ? 'אין תקלות פתוחות כרגע 🎉' : 'לא נמצאו תקלות תואמות'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((incident) => {
                const expanded = expandedId === incident.id
                const um = URGENCY_META[incident.urgency]
                return (
                  <div
                    key={incident.id}
                    className={`overflow-hidden rounded-xl border bg-noc-panel2 ${
                      incident.urgency === 'critical' ? 'border-red-500/50' : 'border-noc-border'
                    }`}
                  >
                    {editingId === incident.id ? (
                      <div className="space-y-2 p-3">
                        <input
                          autoFocus
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 text-sm text-noc-t1 outline-none focus:border-noc-accent"
                        />
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="תיאור מפורט (לא חובה)..."
                          rows={2}
                          className="w-full rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 py-2 text-xs text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
                          style={{ resize: 'none' }}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {URGENCY_ORDER.map((u) => (
                            <button
                              key={u}
                              onClick={() => setEditForm((f) => ({ ...f, urgency: u }))}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
                                editForm.urgency === u ? URGENCY_META[u].chip : 'text-noc-t4 ring-noc-border'
                              }`}
                            >
                              {URGENCY_META[u].label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => saveEdit(incident.id)}
                            className="flex items-center gap-1 rounded-full bg-noc-accent px-3 py-1.5 text-xs font-bold text-white"
                          >
                            <Check className="h-3.5 w-3.5" /> שמירה
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-noc-border px-3 py-1.5 text-xs font-bold text-noc-t2"
                          >
                            ביטול
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="group flex items-start gap-2 px-3.5 py-2.5">
                          <button
                            onClick={() => setExpandedId(expanded ? null : incident.id)}
                            className="min-w-0 flex-1 text-start"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${um.chip}`}>
                                {um.label}
                              </span>
                              {(incident.attachments?.length ?? 0) > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] text-noc-t4">
                                  <ImagePlus className="h-2.5 w-2.5" />
                                  {incident.attachments.length}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold leading-snug text-noc-t1">
                              <HighlightText text={incident.title} term={query} />
                            </p>
                            <p className="mt-0.5 text-[10px] text-noc-t4">
                              {incident.createdBy} · {formatDateShort(formatDateForTimestamp(incident.createdAt))} ·{' '}
                              {formatTime(incident.createdAt)}
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            {incident.source.kind === 'chat' &&
                              (() => {
                                const source = incident.source
                                return (
                                  <button
                                    onClick={() => onJumpToChat(source.dateKey, source.shiftId, source.messageId)}
                                    title="מעבר להודעה בצ'אט"
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-noc-accent/15 hover:text-noc-accent"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </button>
                                )
                              })()}
                            <button
                              onClick={() => startEdit(incident)}
                              title="עריכה"
                              className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-noc-accent/15 hover:text-noc-accent"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            {deletingId === incident.id ? (
                              <>
                                <button
                                  onClick={() => {
                                    api.deleteIncident(incident.id)
                                    setDeletingId(null)
                                  }}
                                  title="אישור מחיקה"
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-400"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  title="ביטול"
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-noc-border text-noc-t3"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setDeletingId(incident.id)}
                                title="מחיקה"
                                className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {expanded && (
                          <div className="space-y-3 border-t border-noc-border bg-noc-bg/30 px-4 py-3">
                            {incident.description && (
                              <p className="whitespace-pre-wrap rounded-lg bg-noc-panel2 px-2.5 py-2 text-xs leading-relaxed text-noc-t2">
                                <HighlightText text={incident.description} term={query} />
                              </p>
                            )}
                            {incident.attachments && incident.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {incident.attachments.map((a) =>
                                  a.mimeType.startsWith('image/') ? (
                                    <button
                                      key={a.id}
                                      type="button"
                                      onClick={() => setLightbox(a)}
                                      title={`${a.name} (${sizeLabel(a.size)}) — לחצו להגדלה`}
                                      className="block cursor-zoom-in overflow-hidden rounded-lg border border-noc-border transition-opacity hover:opacity-90"
                                    >
                                      <img
                                        src={attachmentSrc(a)}
                                        alt={a.name}
                                        className="h-20 max-w-32 object-cover"
                                      />
                                    </button>
                                  ) : (
                                    <a
                                      key={a.id}
                                      href={attachmentSrc(a)}
                                      download={a.name}
                                      target={a.url ? '_blank' : undefined}
                                      rel={a.url ? 'noreferrer' : undefined}
                                      className="flex items-center gap-1.5 rounded-lg border border-noc-border bg-noc-panel2 px-2 py-1.5 text-[10px] text-noc-t2"
                                    >
                                      <FileText className="h-3 w-3 text-noc-accent2" />
                                      <span className="max-w-24 truncate">{a.name}</span>
                                      <span className="text-noc-t4">{sizeLabel(a.size)}</span>
                                      <Download className="h-3 w-3" />
                                    </a>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Timeline */}
                            <div className="space-y-2">
                              {incident.timeline.length === 0 ? (
                                <p className="text-[11px] text-noc-t4">אין עדכוני סטטוס עדיין</p>
                              ) : (
                                incident.timeline.map((entry) => (
                                  <div key={entry.id} className="flex gap-2 text-xs">
                                    <span className="shrink-0 text-noc-t4">{formatTime(entry.at)}</span>
                                    <div className="min-w-0 flex-1 text-noc-t2">
                                      <span>
                                        <span className="font-semibold text-noc-t1">{entry.operator}:</span>{' '}
                                        {entry.text}
                                      </span>
                                      {entry.attachments && entry.attachments.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                          {entry.attachments.map((a) =>
                                            a.mimeType.startsWith('image/') ? (
                                              <button
                                                key={a.id}
                                                type="button"
                                                onClick={() => setLightbox(a)}
                                                title={`${a.name} (${sizeLabel(a.size)}) — לחצו להגדלה`}
                                                className="block cursor-zoom-in overflow-hidden rounded-lg border border-noc-border transition-opacity hover:opacity-90"
                                              >
                                                <img
                                                  src={attachmentSrc(a)}
                                                  alt={a.name}
                                                  className="h-16 max-w-28 object-cover"
                                                />
                                              </button>
                                            ) : (
                                              <a
                                                key={a.id}
                                                href={attachmentSrc(a)}
                                                download={a.name}
                                                target={a.url ? '_blank' : undefined}
                                                rel={a.url ? 'noreferrer' : undefined}
                                                className="flex items-center gap-1 rounded-lg border border-noc-border bg-noc-panel2 px-2 py-1 text-[10px] text-noc-t2"
                                              >
                                                <FileText className="h-3 w-3 text-noc-accent2" />
                                                <span className="max-w-20 truncate">{a.name}</span>
                                              </a>
                                            ),
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={timelineDraft[incident.id] ?? ''}
                                onChange={(e) =>
                                  setTimelineDraft((prev) => ({ ...prev, [incident.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    submitTimeline(incident.id)
                                  }
                                }}
                                placeholder="הוספת עדכון סטטוס..."
                                className="h-8 min-w-0 flex-1 rounded-lg border border-noc-border bg-noc-panel2 px-2.5 text-xs text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
                              />
                              <button
                                onClick={() => submitTimeline(incident.id)}
                                disabled={!(timelineDraft[incident.id] ?? '').trim()}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-noc-gradient text-white disabled:opacity-40"
                              >
                                <Send className="h-3.5 w-3.5 -scale-x-100" />
                              </button>
                            </div>

                            <button
                              onClick={() => onRequestResolve(incident)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                            >
                              <Check className="h-3.5 w-3.5" /> סימון כטופל
                            </button>
                          </div>
                        )}
                      </>
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
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-10"
          onClick={() => setLightbox(null)}
        >
          <img
            src={attachmentSrc(lightbox)}
            alt={lightbox.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
          <div className="absolute top-4 left-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <a
              href={attachmentSrc(lightbox)}
              download={lightbox.name}
              target={lightbox.url ? '_blank' : undefined}
              rel={lightbox.url ? 'noreferrer' : undefined}
              title="הורדת הקובץ"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={() => setLightbox(null)}
              title="סגירה"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="absolute bottom-4 max-w-[80%] truncate rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/80">
            {lightbox.name} · {sizeLabel(lightbox.size)}
          </p>
        </div>
      )}
    </>
  )
}

function formatDateForTimestamp(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

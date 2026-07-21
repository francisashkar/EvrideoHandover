import { useMemo, useState } from 'react'
import { X, Archive, Search, RotateCcw, ExternalLink, Pencil, Trash2, Check } from 'lucide-react'
import type { IncidentsApi } from '../hooks/useIncidents'
import type { IncidentUrgency, ShiftId } from '../types'
import { URGENCY_META } from '../types'
import { formatDateShort, formatTime } from '../dateUtils'
import HighlightText from './HighlightText'

const URGENCY_ORDER: IncidentUrgency[] = ['critical', 'high', 'medium', 'low']

const RESOLUTION_LABEL: Record<string, string> = {
  note: 'תועד',
  'self-resolved': 'נפתר מעצמו',
  skipped: 'דולג',
}

interface IncidentArchiveProps {
  open: boolean
  onClose: () => void
  api: IncidentsApi
  onJumpToChat: (dateKey: string, shiftId: ShiftId, messageId: string) => void
  onReopened: () => void
}

function toDateKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY_EDIT_FORM = { title: '', description: '', urgency: 'medium' as IncidentUrgency }

export default function IncidentArchive({ open, onClose, api, onJumpToChat, onReopened }: IncidentArchiveProps) {
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const resolved = useMemo(() => api.incidents.filter((i) => !i.open), [api.incidents])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return resolved
    return resolved.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        i.createdBy.toLowerCase().includes(q) ||
        (i.resolution?.note ?? '').toLowerCase().includes(q) ||
        i.resolution?.resolvedBy.toLowerCase().includes(q) ||
        i.timeline.some((t) => t.text.toLowerCase().includes(q)),
    )
  }, [resolved, query])

  if (!open) return null

  const startEdit = (i: (typeof resolved)[number]) => {
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-b-2xl border border-t-0 border-noc-border bg-noc-panel shadow-2xl sm:top-6 sm:rounded-2xl sm:border-t">
        <div className="flex items-center justify-between border-b border-noc-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-noc-t1">
            <Archive className="h-5 w-5 text-noc-accent" />
            ארכיון תקלות
            <span className="rounded-full bg-noc-accent/15 px-2 py-0.5 text-[10px] font-bold text-noc-accent">
              {resolved.length}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-noc-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noc-t4" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי כותרת, מדווח, או אופן הפתרון..."
              autoFocus
              className="h-10 w-full rounded-full border border-noc-border bg-noc-panel2 pe-10 ps-4 text-sm text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-noc-t4">
              {resolved.length === 0 ? 'אין תקלות סגורות עדיין' : 'לא נמצאו תוצאות'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((i) => {
                const um = URGENCY_META[i.urgency]
                if (editingId === i.id) {
                  return (
                    <div key={i.id} className="space-y-2 rounded-xl border border-noc-accent/50 bg-noc-panel2 p-3.5">
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
                          onClick={() => saveEdit(i.id)}
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
                  )
                }
                return (
                  <div key={i.id} className="group rounded-xl border border-noc-border bg-noc-panel2 p-3.5">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${um.chip}`}>
                        {um.label}
                      </span>
                      {i.resolution && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500 ring-1 ring-emerald-500/40 dark:text-emerald-400">
                          {RESOLUTION_LABEL[i.resolution.kind]}
                        </span>
                      )}
                      <span className="text-[10px] text-noc-t4">
                        נוצר {formatDateShort(toDateKey(i.createdAt))} {formatTime(i.createdAt)} · {i.createdBy}
                      </span>
                      <span className="ms-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => startEdit(i)}
                          title="עריכה"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-noc-accent/15 hover:text-noc-accent"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {deletingId === i.id ? (
                          <>
                            <button
                              onClick={() => {
                                api.deleteIncident(i.id)
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
                            onClick={() => setDeletingId(i.id)}
                            title="מחיקה"
                            className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-noc-t1">
                      <HighlightText text={i.title} term={query} />
                    </p>
                    {i.description && (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-noc-t3">
                        <HighlightText text={i.description} term={query} />
                      </p>
                    )}
                    {i.resolution?.note && (
                      <p className="mt-1 rounded-lg bg-noc-bg/40 px-2.5 py-1.5 text-xs leading-relaxed text-noc-t2">
                        <HighlightText text={i.resolution.note} term={query} />
                      </p>
                    )}
                    {i.timeline.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-noc-border pt-2">
                        {i.timeline.map((entry) => (
                          <p key={entry.id} className="text-[11px] text-noc-t3">
                            <span className="text-noc-t4">{formatTime(entry.at)}</span>{' '}
                            <span className="font-semibold text-noc-t2">{entry.operator}:</span>{' '}
                            <HighlightText text={entry.text} term={query} />
                          </p>
                        ))}
                      </div>
                    )}
                    {i.resolution && (
                      <p className="mt-1.5 text-[10px] text-noc-t4">
                        נסגר ע"י {i.resolution.resolvedBy} · {formatDateShort(toDateKey(i.resolution.resolvedAt))}{' '}
                        {formatTime(i.resolution.resolvedAt)}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5">
                      {i.source.kind === 'chat' &&
                        (() => {
                          const source = i.source
                          return (
                            <button
                              onClick={() => onJumpToChat(source.dateKey, source.shiftId, source.messageId)}
                              className="flex items-center gap-1 rounded-full border border-noc-border px-2.5 py-1 text-[10px] font-bold text-noc-t2 hover:border-noc-accent/50 hover:text-noc-accent"
                            >
                              <ExternalLink className="h-3 w-3" /> מעבר לצ'אט
                            </button>
                          )
                        })()}
                      <button
                        onClick={() => {
                          api.reopenIncident(i.id)
                          onReopened()
                        }}
                        className="flex items-center gap-1 rounded-full border border-noc-border px-2.5 py-1 text-[10px] font-bold text-noc-t2 hover:border-amber-500/50 hover:text-amber-500"
                      >
                        <RotateCcw className="h-3 w-3" /> פתיחה מחדש
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

import { X, ListTree, Copy, CircleAlert, CheckCircle2, Sparkles, SkipForward, PenLine } from 'lucide-react'
import type { ChatMessage, IncidentItem } from '../types'
import { colorForOperator } from '../types'
import { formatTime } from '../dateUtils'
import { copyToClipboard } from '../clipboard'

interface IncidentThreadModalProps {
  incidentId: string | null
  messages: ChatMessage[]
  incidents: IncidentItem[]
  onClose: () => void
  onCopied: () => void
}

const RESOLUTION_LABEL: Record<string, string> = {
  note: 'תועד',
  'self-resolved': 'נפתר מעצמו',
  skipped: 'דולג',
}
const RESOLUTION_ICON: Record<string, typeof PenLine> = {
  note: PenLine,
  'self-resolved': Sparkles,
  skipped: SkipForward,
}

export default function IncidentThreadModal({
  incidentId,
  messages,
  incidents,
  onClose,
  onCopied,
}: IncidentThreadModalProps) {
  if (!incidentId) return null

  const root = messages.find((m) => m.id === incidentId)
  const thread = messages
    .filter((m) => m.id === incidentId || m.incidentId === incidentId)
    .sort((a, b) => a.timestamp - b.timestamp)
  // The board incident isn't necessarily among `messages` (it may span a
  // different date/shift) — matched by its chat source id instead
  const incident = incidents.find((i) => i.source.kind === 'chat' && i.source.messageId === incidentId)
  // Manually-typed timeline entries have no source chat message, so they'd
  // otherwise be invisible here — show them alongside the real messages
  const manualEntries = (incident?.timeline ?? []).filter((t) => !t.sourceMessageId)

  const copyThread = async () => {
    const lines = thread.map((m) => `[${formatTime(m.timestamp)}] ${m.text}`)
    for (const t of manualEntries) lines.push(`[${formatTime(t.at)}] ${t.text}`)
    if (incident?.resolution) {
      const kind = RESOLUTION_LABEL[incident.resolution.kind]
      lines.push(`[${formatTime(incident.resolution.resolvedAt)}] נסגר (${kind})${incident.resolution.note ? ': ' + incident.resolution.note : ''}`)
    }
    const text = lines.join('\n')
    if (await copyToClipboard('‏' + text.split('\n').join('\n‏'))) onCopied()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-b-2xl border border-t-0 border-noc-border bg-noc-panel shadow-2xl sm:top-8 sm:rounded-2xl sm:border-t">
        <div className="flex items-center justify-between border-b border-noc-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-noc-t1">
            <ListTree className="h-5 w-5 text-red-400" />
            ציר זמן של התקלה
            {(incident ? incident.open : root?.unresolved !== false) ? (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                <CircleAlert className="h-3 w-3" /> פתוחה
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                <CheckCircle2 className="h-3 w-3" /> טופלה
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={copyThread}
              className="flex items-center gap-1 rounded-full bg-noc-gradient px-3 py-1.5 text-xs font-bold text-white"
            >
              <Copy className="h-3.5 w-3.5" /> העתקת הציר
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-0 overflow-y-auto p-5 scrollbar-thin">
          {thread.map((m, i) => (
            <div key={m.id} className="relative flex gap-3 pb-4">
              {(i < thread.length - 1 || manualEntries.length > 0 || incident?.resolution) && (
                <span className="absolute top-7 bottom-0 right-[13px] w-px bg-noc-border" />
              )}
              <span
                className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${colorForOperator(m.operator)}`}
              >
                {m.operator.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-noc-t3">
                  {m.operator} · {formatTime(m.timestamp)}
                  {m.id === incidentId && <span className="ms-2 font-bold text-red-400">פתיחת התקלה</span>}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-noc-t1">{m.text}</p>
              </div>
            </div>
          ))}

          {/* Timeline entries added directly on the incident board (not sent as chat messages) */}
          {manualEntries.map((t, i) => (
            <div key={t.id} className="relative flex gap-3 pb-4">
              {(i < manualEntries.length - 1 || incident?.resolution) && (
                <span className="absolute top-7 bottom-0 right-[13px] w-px bg-noc-border" />
              )}
              <span
                className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${colorForOperator(t.operator)}`}
              >
                {t.operator.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-noc-t3">
                  {t.operator} · {formatTime(t.at)}
                  <span className="ms-2 font-bold text-noc-accent">עדכון מעמודת התקלות</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-noc-t1">{t.text}</p>
              </div>
            </div>
          ))}

          {/* How the incident was closed */}
          {incident?.resolution &&
            (() => {
              const r = incident.resolution
              const Icon = RESOLUTION_ICON[r.kind]
              return (
                <div className="flex gap-3">
                  <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/40">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-noc-t3">
                      {r.resolvedBy} · {formatTime(r.resolvedAt)}
                      <span className="ms-2 font-bold text-emerald-500">
                        התקלה נסגרה · {RESOLUTION_LABEL[r.kind]}
                      </span>
                    </p>
                    {r.note && (
                      <p className="mt-0.5 whitespace-pre-wrap break-words rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-sm leading-relaxed text-noc-t1">
                        {r.note}
                      </p>
                    )}
                  </div>
                </div>
              )
            })()}
        </div>
      </div>
    </>
  )
}

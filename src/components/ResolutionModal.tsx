import { useState } from 'react'
import { X, CheckCircle2, SkipForward, Sparkles, PenLine, Check } from 'lucide-react'
import type { IncidentItem, IncidentResolution, ResolutionKind } from '../types'

interface ResolutionModalProps {
  incident: IncidentItem | null
  operator: string
  onClose: () => void
  onResolve: (resolution: IncidentResolution) => void
}

const OPTIONS: { kind: ResolutionKind; label: string; hint: string; icon: typeof PenLine }[] = [
  { kind: 'note', label: 'תיעוד אופן הפתרון', hint: 'כתבו מה בוצע כדי לפתור את התקלה', icon: PenLine },
  { kind: 'self-resolved', label: 'נפתר מעצמו', hint: 'סימון מהיר — התקלה חלפה ללא התערבות', icon: Sparkles },
  { kind: 'skipped', label: 'דילוג', hint: 'סגירה בלי לתעד את אופן הפתרון', icon: SkipForward },
]

export default function ResolutionModal({ incident, operator, onClose, onResolve }: ResolutionModalProps) {
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<ResolutionKind | null>(null)

  if (!incident) return null

  const confirm = (kind: ResolutionKind) => {
    onResolve({
      kind,
      note: kind === 'note' ? note.trim() || undefined : undefined,
      resolvedBy: operator,
      resolvedAt: Date.now(),
    })
    setNote('')
    setMode(null)
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-[71] mx-auto w-full max-w-md overflow-hidden rounded-b-2xl border border-t-0 border-noc-border bg-noc-panel shadow-2xl sm:top-12 sm:rounded-2xl sm:border-t">
        <div className="flex items-center justify-between border-b border-noc-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-noc-t1">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            סגירת תקלה
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <p className="rounded-lg bg-noc-panel2 px-3 py-2 text-sm font-semibold text-noc-t1">{incident.title}</p>

          {mode === 'note' ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="כיצד נפתרה התקלה?"
                rows={4}
                className="w-full rounded-lg border border-noc-border bg-noc-panel2 px-3 py-2 text-sm text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
                style={{ resize: 'none' }}
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => confirm('note')}
                  className="flex items-center gap-1 rounded-full bg-noc-accent px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                >
                  <Check className="h-3.5 w-3.5" /> שמירה וסגירה
                </button>
                <button
                  onClick={() => setMode(null)}
                  className="rounded-full border border-noc-border px-3 py-1.5 text-xs font-bold text-noc-t2 hover:bg-noc-panel3"
                >
                  חזרה
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.kind}
                    onClick={() => (opt.kind === 'note' ? setMode('note') : confirm(opt.kind))}
                    className="flex w-full items-start gap-3 rounded-xl border border-noc-border bg-noc-panel2 px-3.5 py-3 text-start transition-colors hover:border-noc-accent/50 hover:bg-noc-panel3"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-noc-accent" />
                    <span>
                      <span className="block text-sm font-bold text-noc-t1">{opt.label}</span>
                      <span className="block text-[11px] text-noc-t3">{opt.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

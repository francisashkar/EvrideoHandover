import { CheckCircle2, TriangleAlert, Undo2 } from 'lucide-react'

export interface ToastState {
  text: string
  variant: 'success' | 'error'
  action?: { label: string; onClick: () => void }
}

export default function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div
      className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
        toast ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-2xl ${
            toast.variant === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-300 shadow-emerald-500/10'
              : 'border-red-500/40 bg-red-950/90 text-red-300 shadow-red-500/10'
          }`}
        >
          {toast.variant === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <TriangleAlert className="h-4 w-4" />
          )}
          {toast.text}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20"
            >
              <Undo2 className="h-3 w-3" />
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { RadioTower, LogIn, Loader2 } from 'lucide-react'

interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<string | null>
}

export default function LoginScreen({ onSignIn }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || busy) return
    setBusy(true)
    setError(null)
    const err = await onSignIn(email, password)
    if (err) setError(err)
    setBusy(false)
  }

  return (
    <div className="wa-wallpaper flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-noc-border bg-noc-panel p-6 shadow-2xl shadow-black/40">
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-noc-gradient shadow-lg shadow-emerald-500/25">
            <RadioTower className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-noc-t1">
              יומן משמרות <span className="text-gradient">NOC</span>
            </h1>
            <p className="mt-1 text-xs text-noc-t3">התחברות לחשבון הצוות</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="אימייל"
            dir="ltr"
            autoComplete="username"
            className="h-11 w-full rounded-xl border border-noc-border bg-noc-panel2 px-3 text-center text-sm text-noc-t1 placeholder-noc-t4 outline-none transition-colors focus:border-noc-accent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמה"
            dir="ltr"
            autoComplete="current-password"
            className="h-11 w-full rounded-xl border border-noc-border bg-noc-panel2 px-3 text-center text-sm text-noc-t1 placeholder-noc-t4 outline-none transition-colors focus:border-noc-accent"
          />

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs font-medium text-red-500 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!email.trim() || !password || busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-noc-gradient text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            התחברות
          </button>
        </form>
      </div>
    </div>
  )
}

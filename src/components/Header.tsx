import { RadioTower, CalendarDays, Clock, LayoutGrid, Sun, Moon, ListTodo, LogOut, Undo2, BookUser, BookOpen, AlertTriangle } from 'lucide-react'
import { firebaseEnabled } from '../firebase'
import { formatDateLong, shiftDateKey } from '../dateUtils'

interface HeaderProps {
  dateKey: string
  onDateChange: (dateKey: string) => void
  now: Date
  onToggleOverview: () => void
  overviewOpen: boolean
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onToggleTasks: () => void
  tasksOpen: boolean
  openTaskCount: number
  onSignOut: () => void
  onOpenContacts: () => void
  onOpenRunbook: () => void
  onOpenIncidents: () => void
  openIncidentCount: number
}

export default function Header({
  dateKey,
  onDateChange,
  now,
  onToggleOverview,
  overviewOpen,
  theme,
  onToggleTheme,
  onToggleTasks,
  tasksOpen,
  openTaskCount,
  onSignOut,
  onOpenContacts,
  onOpenRunbook,
  onOpenIncidents,
  openIncidentCount,
}: HeaderProps) {
  const timeLabel = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <header className="relative border-b border-noc-border bg-noc-panel/90 backdrop-blur-xl supports-[backdrop-filter]:bg-noc-panel/70">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-noc-gradient shadow-lg shadow-emerald-500/25">
            <RadioTower className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-noc-t1 sm:text-lg">
              יומן משמרות <span className="text-gradient">NOC</span>
            </h1>
            <p className="text-xs text-noc-t3">{formatDateLong(dateKey)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-noc-border bg-noc-panel2 px-4 py-2 tabular-nums sm:flex">
            <Clock className="h-4 w-4 text-noc-accent2" />
            <span className="text-sm font-semibold text-noc-t2">{timeLabel}</span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-noc-border bg-noc-panel2 px-4 py-2">
            <CalendarDays className="h-4 w-4 text-noc-accent2" />
            <input
              type="date"
              value={dateKey}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-sm font-semibold text-noc-t2 outline-none"
            />
          </div>

          {dateKey !== shiftDateKey() && (
            <button
              onClick={() => onDateChange(shiftDateKey())}
              title="חזרה לתאריך של היום"
              className="flex items-center gap-1.5 rounded-full border border-noc-accent/50 bg-noc-accent/15 px-3 py-2 text-sm font-bold text-noc-accent transition-colors hover:bg-noc-accent/25"
            >
              <Undo2 className="h-4 w-4" />
              היום
            </button>
          )}

          <button
            onClick={onOpenIncidents}
            title="עמודת תקלות"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-noc-border bg-noc-panel2 text-noc-t2 transition-colors hover:border-red-400/50 hover:text-red-400"
          >
            <AlertTriangle className="h-4 w-4" />
            {openIncidentCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {openIncidentCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenContacts}
            title="ספר טלפונים — אסקלציה"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-noc-border bg-noc-panel2 text-noc-t2 transition-colors hover:border-noc-borderLight hover:text-noc-accent"
          >
            <BookUser className="h-4 w-4" />
          </button>

          <button
            onClick={onOpenRunbook}
            title="יומן תפעול — נהלים והוראות"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-noc-border bg-noc-panel2 text-noc-t2 transition-colors hover:border-noc-borderLight hover:text-noc-accent"
          >
            <BookOpen className="h-4 w-4" />
          </button>

          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-noc-border bg-noc-panel2 text-noc-t2 transition-colors hover:border-noc-borderLight hover:text-noc-accent"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={onToggleTasks}
            title="רשימת משימות"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
              tasksOpen
                ? 'border-noc-accent/60 bg-noc-accent/20 text-noc-accent'
                : 'border-noc-border bg-noc-panel2 text-noc-t2 hover:border-noc-borderLight hover:text-noc-accent'
            }`}
          >
            <ListTodo className="h-4 w-4" />
            {openTaskCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-noc-accent px-1 text-[9px] font-bold text-white">
                {openTaskCount}
              </span>
            )}
          </button>

          <button
            onClick={onToggleOverview}
            title="תצוגה כללית של היום"
            className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              overviewOpen
                ? 'border-noc-accent/60 bg-noc-accent/20 text-noc-accent2'
                : 'border-noc-border bg-noc-panel2 text-noc-t2 hover:border-noc-borderLight'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">תצוגה כללית</span>
          </button>

          {firebaseEnabled && (
            <button
              onClick={onSignOut}
              title="התנתקות"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-noc-border bg-noc-panel2 text-noc-t3 transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

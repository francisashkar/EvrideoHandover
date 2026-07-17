import { useEffect, useMemo, useRef, useState } from 'react'
import { Ticket, CloudOff, ArrowLeftRight, X } from 'lucide-react'
import Header from './components/Header'
import ShiftTabs from './components/ShiftTabs'
import ShiftStatsBar from './components/ShiftStatsBar'
import SearchBar from './components/SearchBar'
import ChatFeed from './components/ChatFeed'
import ChatInputBar from './components/ChatInputBar'
import Toast from './components/Toast'
import type { ToastState } from './components/Toast'
import DailyOverview from './components/DailyOverview'
import TaskPanel from './components/TaskPanel'
import TaskRail from './components/TaskRail'
import LoginScreen from './components/LoginScreen'
import GlobalSearchModal from './components/GlobalSearchModal'
import { useAuth } from './hooks/useAuth'
import { useChatStore } from './hooks/useChatStore'
import { useOperators } from './hooks/useOperators'
import { useTasks, isTaskDone } from './hooks/useTasks'
import { useTheme } from './hooks/useTheme'
import { firebaseEnabled } from './firebase'
import { SHIFT_DEFINITIONS, STATUS_META, TAG_META } from './types'
import type { CarryOverItem, MessageAttachment, MessageTag, ShiftId, ShiftStatus } from './types'
import { getActiveShiftId, todayKey } from './dateUtils'
import { copyToClipboard } from './clipboard'
import { generateTicketUpdate } from './ticketGenerator'

function App() {
  const [dateKey, setDateKey] = useState<string>(todayKey())
  const [now, setNow] = useState(new Date())
  const [activeTab, setActiveTab] = useState<ShiftId>(() => getActiveShiftId())
  const [selectedOperator, setSelectedOperator] = useState<string>('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(false)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [tagFilter, setTagFilter] = useState<MessageTag | 'all'>('all')
  const [shiftPrompt, setShiftPrompt] = useState<ShiftId | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const skipSearchClearRef = useRef(false)
  const prevLiveShiftRef = useRef<ShiftId | null>(null)

  const {
    getDayMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    mergeWithPrevious,
    restoreMessage,
    getCarryOver,
    searchAll,
    storageError,
  } = useChatStore(dateKey)
  const { operators, addOperator } = useOperators()
  const { theme, toggleTheme } = useTheme()
  const { tasks, addTask, updateTask, toggleTask, deleteTask } = useTasks()
  const { state: authState, signIn, signOut } = useAuth()

  const showToast = (
    text: string,
    variant: ToastState['variant'] = 'success',
    action?: ToastState['action'],
    duration = 2600,
  ) => {
    clearTimeout(toastTimer.current)
    setToast({ text, variant, action })
    toastTimer.current = setTimeout(() => setToast(null), duration)
  }

  useEffect(() => {
    if (!selectedOperator && operators.length > 0) setSelectedOperator(operators[0])
  }, [operators, selectedOperator])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Global-search navigation sets its own query — don't wipe it
    if (skipSearchClearRef.current) {
      skipSearchClearRef.current = false
      return
    }
    setSearchQuery('')
    setTagFilter('all')
  }, [activeTab, dateKey])

  useEffect(() => {
    if (storageError) {
      showToast(
        firebaseEnabled ? 'שגיאה בשמירה לענן — בדקו את החיבור' : 'האחסון המקומי מלא — מחקו הודעות או קבצים ישנים',
        'error',
      )
    }
  }, [storageError])

  const isToday = dateKey === todayKey()
  const liveShiftId = isToday ? getActiveShiftId(now) : null

  // Offer to switch tabs when the real-world shift changes while the app is open
  useEffect(() => {
    const prev = prevLiveShiftRef.current
    prevLiveShiftRef.current = liveShiftId
    if (!liveShiftId || !prev || prev === liveShiftId) return
    setShiftPrompt(liveShiftId)
  }, [liveShiftId])

  const dayMessages = getDayMessages(dateKey)
  const activeShiftDef = SHIFT_DEFINITIONS.find((s) => s.id === activeTab)!
  const activeMessages = dayMessages[activeTab]
  const carryOver = getCarryOver(dateKey, activeTab)

  // Shift status is derived automatically: an open (unresolved) incident
  // makes the shift תקלה; once everything is resolved it returns to תקין
  const statuses = useMemo(
    () =>
      Object.fromEntries(
        SHIFT_DEFINITIONS.map((def) => [
          def.id,
          dayMessages[def.id].some((m) => m.tag === 'incident' && m.unresolved) ? 'major' : 'ok',
        ]),
      ) as Record<ShiftId, ShiftStatus>,
    [dayMessages],
  )
  const activeStatus = statuses[activeTab]

  const messageCounts = useMemo(
    () =>
      Object.fromEntries(SHIFT_DEFINITIONS.map((def) => [def.id, dayMessages[def.id].length])) as Record<
        ShiftId,
        number
      >,
    [dayMessages],
  )

  const tagCounts = useMemo(() => {
    const counts = new Map<MessageTag, number>()
    for (const m of activeMessages) {
      const t = m.tag ?? 'update'
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return counts
  }, [activeMessages])

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return activeMessages.filter((m) => {
      if (tagFilter !== 'all' && (m.tag ?? 'update') !== tagFilter) return false
      if (!query) return true
      return m.text.toLowerCase().includes(query) || m.operator.toLowerCase().includes(query)
    })
  }, [activeMessages, searchQuery, tagFilter])

  // A message is mergeable when the message directly before it (in the full,
  // unfiltered feed) is from the same operator
  const mergeableIds = useMemo(() => {
    const ids = new Set<string>()
    for (let i = 1; i < activeMessages.length; i++) {
      if (activeMessages[i].operator === activeMessages[i - 1].operator) {
        ids.add(activeMessages[i].id)
      }
    }
    return ids
  }, [activeMessages])

  const handleSend = (text: string, tag: MessageTag, attachments: MessageAttachment[]) => {
    if (!selectedOperator) return
    addMessage(dateKey, activeTab, {
      operator: selectedOperator,
      text,
      tag,
      // Incidents open as unresolved — this flips the shift status to תקלה
      // until someone marks them as resolved
      unresolved: tag === 'incident' ? true : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
  }

  const handleResolveCarryOver = (item: CarryOverItem) => {
    updateMessage(item.dateKey, item.shiftId, item.message.id, { unresolved: false })
    showToast('סומן כטופל')
  }

  const handleCopyTicketUpdate = async () => {
    const message = generateTicketUpdate(activeShiftDef, activeMessages)
    const ok = await copyToClipboard(message)
    if (ok) showToast('הועתק ללוח!')
  }

  if (authState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-noc-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-noc-accent border-t-transparent" />
      </div>
    )
  }

  if (authState === 'signed-out') {
    return <LoginScreen onSignIn={signIn} />
  }

  return (
    <div className="flex h-screen flex-col bg-noc-bg">
      <Header
        dateKey={dateKey}
        onDateChange={setDateKey}
        now={now}
        onToggleOverview={() => setOverviewOpen((v) => !v)}
        overviewOpen={overviewOpen}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleTasks={() => setTasksOpen((v) => !v)}
        tasksOpen={tasksOpen}
        openTaskCount={tasks.filter((t) => !isTaskDone(t, dateKey)).length}
        onSignOut={signOut}
      />

      {!firebaseEnabled && (
        <div className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <CloudOff className="h-3.5 w-3.5" />
          מצב מקומי — Firebase לא מוגדר, ההודעות נשמרות בדפדפן זה בלבד
        </div>
      )}

      {firebaseEnabled && storageError && (
        <div className="flex items-center justify-center gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
          <CloudOff className="h-3.5 w-3.5" />
          אין גישה ל-Firestore — בדקו את חוקי האבטחה (Rules) בקונסולת Firebase
        </div>
      )}

      <ShiftTabs
        activeTab={activeTab}
        liveShiftId={liveShiftId}
        messageCounts={messageCounts}
        statuses={statuses}
        onSelect={setActiveTab}
      />

      <div className="flex w-full flex-1 overflow-hidden">
        <TaskRail tasks={tasks} shiftId={activeTab} dateKey={dateKey} onToggle={(id) => toggleTask(id, dateKey)} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-noc-t3">
            <span>{activeShiftDef.emoji}</span>
            <span className="font-semibold text-noc-t2">{activeShiftDef.label}</span>
            <span className="text-noc-t4">·</span>
            <span>{activeShiftDef.timeRange}</span>

            {liveShiftId && activeTab !== liveShiftId && (
              <button
                onClick={() => {
                  setActiveTab(liveShiftId)
                  setShiftPrompt(null)
                }}
                title="חזרה למשמרת שפעילה כרגע"
                className="flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-300"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                חזרה למשמרת הפעילה
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Shift status — derived automatically from open incidents */}
            <div
              title={
                activeStatus === 'major'
                  ? 'יש תקלה פתוחה במשמרת — סמנו אותה כטופלה כדי לחזור לתקין'
                  : 'אין תקלות פתוחות במשמרת'
              }
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                activeStatus === 'major'
                  ? 'border-red-500/50 bg-red-500/15 text-red-500 dark:text-red-400'
                  : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${STATUS_META[activeStatus].dot}`} />
              {activeStatus === 'major' ? 'תקלה פתוחה' : 'תקין'}
            </div>

            <button
              onClick={handleCopyTicketUpdate}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-orange-500/20 transition-transform hover:scale-105 active:scale-95"
            >
              <Ticket className="h-3.5 w-3.5" />
              העתקה לכרטיס HubSpot
            </button>
          </div>
        </div>

        <ShiftStatsBar messages={activeMessages} />
        <SearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onOpenGlobal={() => setGlobalSearchOpen(true)}
        />

        {/* Tag filter chips */}
        <div className="flex flex-wrap items-center gap-1 px-4 pb-2 sm:px-6">
          <button
            onClick={() => setTagFilter('all')}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
              tagFilter === 'all'
                ? 'bg-noc-accent/15 text-noc-accent ring-noc-accent/40'
                : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-t2'
            }`}
          >
            הכל ({activeMessages.length})
          </button>
          {(Object.keys(TAG_META) as MessageTag[])
            .filter((t) => (tagCounts.get(t) ?? 0) > 0)
            .map((t) => {
              const meta = TAG_META[t]
              const selected = tagFilter === t
              return (
                <button
                  key={t}
                  onClick={() => setTagFilter(selected ? 'all' : t)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                    selected ? meta.chip : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-t2'
                  }`}
                >
                  {meta.label} ({tagCounts.get(t)})
                </button>
              )
            })}
        </div>

        {/* Shift-change prompt */}
        {shiftPrompt && isToday && activeTab !== shiftPrompt && (
          <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-xl border border-noc-accent/40 bg-noc-accent/10 px-3 py-2 sm:mx-6">
            <span className="flex items-center gap-2 text-xs font-semibold text-noc-t1">
              <ArrowLeftRight className="h-4 w-4 text-noc-accent" />
              המשמרת התחלפה — לעבור ל{SHIFT_DEFINITIONS.find((s) => s.id === shiftPrompt)!.label}?
            </span>
            <span className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setActiveTab(shiftPrompt)
                  setShiftPrompt(null)
                }}
                className="rounded-full bg-noc-accent px-3 py-1 text-[11px] font-bold text-white hover:opacity-90"
              >
                מעבר
              </button>
              <button
                onClick={() => setShiftPrompt(null)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <ChatFeed
            messages={filteredMessages}
            hasUnfilteredMessages={activeMessages.length > 0}
            carryOver={carryOver}
            mergeableIds={mergeableIds}
            highlightTerm={searchQuery}
            onDeleteMessage={(id) => {
              const m = activeMessages.find((x) => x.id === id)
              if (!m) return
              const dk = dateKey
              const tab = activeTab
              deleteMessage(dk, tab, id)
              showToast(
                'ההודעה נמחקה',
                'success',
                {
                  label: 'ביטול',
                  onClick: () => {
                    restoreMessage(dk, tab, m)
                    showToast('ההודעה שוחזרה')
                  },
                },
                5000,
              )
            }}
            onTogglePin={(id) => {
              const m = activeMessages.find((x) => x.id === id)
              updateMessage(dateKey, activeTab, id, { pinned: !m?.pinned })
            }}
            onToggleUnresolved={(id) => {
              const m = activeMessages.find((x) => x.id === id)
              updateMessage(dateKey, activeTab, id, { unresolved: !m?.unresolved })
            }}
            onMergeMessage={(id) => mergeWithPrevious(dateKey, activeTab, id)}
            onCopyMessage={async (id) => {
              const m = activeMessages.find((x) => x.id === id)
              if (!m?.text) return
              const ok = await copyToClipboard(m.text)
              if (ok) showToast('ההודעה הועתקה!')
            }}
            onEditMessage={(id, newText) => {
              updateMessage(dateKey, activeTab, id, { text: newText, edited: true })
              showToast('ההודעה עודכנה')
            }}
            onResolveCarryOver={handleResolveCarryOver}
          />
        </div>

        <ChatInputBar
          operators={operators}
          selectedOperator={selectedOperator}
          onSelectOperator={setSelectedOperator}
          onAddOperator={addOperator}
          onSend={handleSend}
          onFileError={(msg) => showToast(msg, 'error')}
        />
        </div>
      </div>

      {tasksOpen && (
        <TaskPanel
          tasks={tasks}
          operators={operators}
          currentDateKey={dateKey}
          onAdd={addTask}
          onUpdate={updateTask}
          onToggle={(id) => toggleTask(id, dateKey)}
          onDelete={deleteTask}
          onClose={() => setTasksOpen(false)}
        />
      )}

      <DailyOverview
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        dayMessages={dayMessages}
        activeTab={activeTab}
        liveShiftId={liveShiftId}
        onSelectShift={setActiveTab}
      />

      <GlobalSearchModal
        open={globalSearchOpen}
        initialQuery={searchQuery}
        onClose={() => setGlobalSearchOpen(false)}
        onSearch={searchAll}
        onNavigate={(dk, shiftId, q) => {
          skipSearchClearRef.current = true
          setDateKey(dk)
          setActiveTab(shiftId)
          setSearchQuery(q)
          setGlobalSearchOpen(false)
        }}
      />

      <Toast toast={toast} />
    </div>
  )
}

export default App

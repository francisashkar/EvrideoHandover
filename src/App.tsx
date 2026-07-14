import { useEffect, useMemo, useRef, useState } from 'react'
import { Ticket, CloudOff } from 'lucide-react'
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
import StickyNotes from './components/StickyNotes'
import { useChatStore } from './hooks/useChatStore'
import { useOperators } from './hooks/useOperators'
import { useShiftStatus } from './hooks/useShiftStatus'
import { useTasks } from './hooks/useTasks'
import { useTheme } from './hooks/useTheme'
import { firebaseEnabled } from './firebase'
import { SHIFT_DEFINITIONS, STATUS_META } from './types'
import type { CarryOverItem, MessageAttachment, MessageTag, ShiftId, ShiftStatus } from './types'
import { getActiveShiftId, todayKey } from './dateUtils'
import { copyToClipboard } from './clipboard'
import { generateTicketUpdate } from './ticketGenerator'

const STATUS_ORDER: ShiftStatus[] = ['ok', 'minor', 'major']

function App() {
  const [dateKey, setDateKey] = useState<string>(todayKey())
  const [now, setNow] = useState(new Date())
  const [activeTab, setActiveTab] = useState<ShiftId>(() => getActiveShiftId())
  const [selectedOperator, setSelectedOperator] = useState<string>('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const {
    getDayMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    mergeWithPrevious,
    getCarryOver,
    storageError,
  } = useChatStore(dateKey)
  const { operators, addOperator } = useOperators()
  const { getStatus, setStatus } = useShiftStatus()
  const { theme, toggleTheme } = useTheme()
  const { tasks, addTask, toggleTask, deleteTask } = useTasks()

  const showToast = (text: string, variant: ToastState['variant'] = 'success') => {
    clearTimeout(toastTimer.current)
    setToast({ text, variant })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    if (!selectedOperator && operators.length > 0) setSelectedOperator(operators[0])
  }, [operators, selectedOperator])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setSearchQuery('')
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

  const dayMessages = getDayMessages(dateKey)
  const activeShiftDef = SHIFT_DEFINITIONS.find((s) => s.id === activeTab)!
  const activeMessages = dayMessages[activeTab]
  const activeStatus = getStatus(dateKey, activeTab)
  const carryOver = getCarryOver(dateKey, activeTab)

  const messageCounts = useMemo(
    () =>
      Object.fromEntries(SHIFT_DEFINITIONS.map((def) => [def.id, dayMessages[def.id].length])) as Record<
        ShiftId,
        number
      >,
    [dayMessages],
  )

  const statuses = useMemo(
    () =>
      Object.fromEntries(SHIFT_DEFINITIONS.map((def) => [def.id, getStatus(dateKey, def.id)])) as Record<
        ShiftId,
        ShiftStatus
      >,
    [dateKey, getStatus],
  )

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return activeMessages
    return activeMessages.filter(
      (m) => m.text.toLowerCase().includes(query) || m.operator.toLowerCase().includes(query),
    )
  }, [activeMessages, searchQuery])

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
      attachments: attachments.length > 0 ? attachments : undefined,
    })
  }

  const handleResolveCarryOver = (item: CarryOverItem) => {
    updateMessage(item.dateKey, item.shiftId, item.message.id, { unresolved: false })
    showToast('סומן כטופל')
  }

  const handleCopyTicketUpdate = async () => {
    const message = generateTicketUpdate(dateKey, activeShiftDef, activeMessages, activeStatus)
    const ok = await copyToClipboard(message)
    if (ok) showToast('הועתק ללוח!')
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
        openTaskCount={tasks.filter((t) => !t.done).length}
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

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-noc-t3">
            <span>{activeShiftDef.emoji}</span>
            <span className="font-semibold text-noc-t2">{activeShiftDef.label}</span>
            <span className="text-noc-t4">·</span>
            <span>{activeShiftDef.timeRange}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Shift status selector */}
            <div className="flex items-center gap-1 rounded-full border border-noc-border bg-noc-panel2 p-1">
              {STATUS_ORDER.map((s) => {
                const meta = STATUS_META[s]
                const selected = s === activeStatus
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(dateKey, activeTab, s)}
                    title={meta.label}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                      selected ? 'bg-noc-panel3 text-noc-t1 shadow-sm' : 'text-noc-t4 hover:text-noc-t2'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <span className={selected ? '' : 'hidden sm:inline'}>{meta.label}</span>
                  </button>
                )
              })}
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
        <SearchBar query={searchQuery} onQueryChange={setSearchQuery} />

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <StickyNotes tasks={tasks} shiftId={activeTab} onToggle={toggleTask} />
          <ChatFeed
            messages={filteredMessages}
            hasUnfilteredMessages={activeMessages.length > 0}
            carryOver={carryOver}
            mergeableIds={mergeableIds}
            onDeleteMessage={(id) => deleteMessage(dateKey, activeTab, id)}
            onTogglePin={(id) => {
              const m = activeMessages.find((x) => x.id === id)
              updateMessage(dateKey, activeTab, id, { pinned: !m?.pinned })
            }}
            onToggleUnresolved={(id) => {
              const m = activeMessages.find((x) => x.id === id)
              updateMessage(dateKey, activeTab, id, { unresolved: !m?.unresolved })
            }}
            onMergeMessage={(id) => mergeWithPrevious(dateKey, activeTab, id)}
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

      {tasksOpen && (
        <TaskPanel
          tasks={tasks}
          operators={operators}
          onAdd={addTask}
          onToggle={toggleTask}
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

      <Toast toast={toast} />
    </div>
  )
}

export default App

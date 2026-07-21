import { useEffect, useMemo, useRef, useState } from 'react'
import { Ticket, CloudOff, ArrowLeftRight, X, Hand } from 'lucide-react'
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
import ContactsPanel from './components/ContactsPanel'
import RunbookPanel from './components/RunbookPanel'
import IncidentThreadModal from './components/IncidentThreadModal'
import IncidentBoard from './components/IncidentBoard'
import IncidentArchive from './components/IncidentArchive'
import ResolutionModal from './components/ResolutionModal'
import { useAuth } from './hooks/useAuth'
import { useContacts } from './hooks/useContacts'
import { useRunbook } from './hooks/useRunbook'
import { useHandover } from './hooks/useHandover'
import { useTags } from './hooks/useTags'
import { useIncidents } from './hooks/useIncidents'
import { useChatStore } from './hooks/useChatStore'
import { useOperators } from './hooks/useOperators'
import { useTasks, isTaskDone } from './hooks/useTasks'
import { useTheme } from './hooks/useTheme'
import { firebaseEnabled } from './firebase'
import { SHIFT_DEFINITIONS, STATUS_META, colorForOperator } from './types'
import type { CarryOverItem, IncidentItem, IncidentResolution, MessageAttachment, MessageTag, ShiftId, ShiftStatus } from './types'
import type { SendExtras } from './components/ChatInputBar'
import { getActiveShiftId, shiftDateKey, formatTime, formatDateShort } from './dateUtils'
import { copyToClipboard, copyRichText } from './clipboard'
import { generateTicketUpdate, generateTicketUpdateHtml } from './ticketGenerator'

function App() {
  const [dateKey, setDateKey] = useState<string>(() => shiftDateKey())
  const [now, setNow] = useState(new Date())
  const [activeTab, setActiveTab] = useState<ShiftId>(() => getActiveShiftId())
  // The chosen operator is remembered per station (browser)
  const [selectedOperator, setSelectedOperator] = useState<string>(() => {
    try {
      return window.localStorage.getItem('noc-selected-operator') ?? ''
    } catch {
      return ''
    }
  })
  const [toast, setToast] = useState<ToastState | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(false)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [tagFilter, setTagFilter] = useState<MessageTag | 'all'>('all')
  const [operatorFilter, setOperatorFilter] = useState<string>('all')
  const [shiftPrompt, setShiftPrompt] = useState<ShiftId | null>(null)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [runbookOpen, setRunbookOpen] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [incidentBoardOpen, setIncidentBoardOpen] = useState(false)
  const [incidentArchiveOpen, setIncidentArchiveOpen] = useState(false)
  const [resolvingIncident, setResolvingIncident] = useState<IncidentItem | null>(null)
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
  const { operators, addOperator, renameOperator, deleteOperator } = useOperators()
  const { theme, toggleTheme } = useTheme()
  const { tasks, addTask, updateTask, toggleTask, deleteTask } = useTasks()
  const { state: authState, signIn, signOut } = useAuth()
  const contactsApi = useContacts()
  const runbookApi = useRunbook()
  const { getAck, acceptShift } = useHandover()
  const tagsApi = useTags()
  const { tags } = tagsApi
  const incidentsApi = useIncidents()

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
    try {
      if (selectedOperator) window.localStorage.setItem('noc-selected-operator', selectedOperator)
    } catch {
      // ignore
    }
  }, [selectedOperator])

  useEffect(() => {
    if (operators.length === 0) return
    // No selection yet, or the remembered operator was removed from the roster
    if (!selectedOperator || !operators.includes(selectedOperator)) setSelectedOperator(operators[0])
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
    setOperatorFilter('all')
  }, [activeTab, dateKey])

  useEffect(() => {
    if (storageError) {
      showToast(
        firebaseEnabled ? 'שגיאה בשמירה לענן — בדקו את החיבור' : 'האחסון המקומי מלא — מחקו הודעות או קבצים ישנים',
        'error',
      )
    }
  }, [storageError])

  // The operational "today" — between midnight and 07:00 this is yesterday's
  // date, because the night shift belongs to the day it started on
  const operationalToday = shiftDateKey(now)
  const isToday = dateKey === operationalToday
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
  const handoverAck = getAck(dateKey, activeTab)

  // Open incidents, offered in the chat composer so a follow-up message can be
  // linked to one. The id used here is the original incident-tagged message's
  // id (message.incidentId) — it doubles as both the chat-thread key
  // (IncidentThreadModal) and, via findBySource, the incident board's item
  const openIncidents = useMemo(
    () =>
      activeMessages
        .filter((m) => m.tag === 'incident' && m.unresolved)
        .map((m) => ({ id: m.id, label: m.text.slice(0, 40) || 'תקלה' })),
    [activeMessages],
  )

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

  const operatorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of activeMessages) counts.set(m.operator, (counts.get(m.operator) ?? 0) + 1)
    return counts
  }, [activeMessages])

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return activeMessages.filter((m) => {
      if (tagFilter !== 'all' && (m.tag ?? 'update') !== tagFilter) return false
      if (operatorFilter !== 'all' && m.operator !== operatorFilter) return false
      if (!query) return true
      return m.text.toLowerCase().includes(query) || m.operator.toLowerCase().includes(query)
    })
  }, [activeMessages, searchQuery, tagFilter, operatorFilter])

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

  const handleSend = (text: string, tag: MessageTag, attachments: MessageAttachment[], extras: SendExtras) => {
    if (!selectedOperator) return
    const targetDate = extras.targetDateKey ?? dateKey
    const targetShift = extras.targetShiftId ?? activeTab
    const sentElsewhere = targetDate !== dateKey || targetShift !== activeTab
    const messageId = addMessage(targetDate, targetShift, {
      operator: selectedOperator,
      text,
      tag,
      // Incidents open as unresolved — this flips the shift status to תקלה
      // until someone marks them as resolved
      unresolved: tag === 'incident' ? true : undefined,
      incidentId: extras.incidentId,
      scheduled: sentElsewhere || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
    // A message tagged "incident" is automatically tracked on the incident
    // board until someone resolves it there (or from the chat bubble). The
    // full message becomes the title — no truncation, so nothing is cut off.
    if (tag === 'incident' && messageId) {
      incidentsApi.addIncident({
        title: text.trim() || 'תקלה ללא תיאור',
        urgency: extras.urgency ?? 'medium',
        createdBy: selectedOperator,
        source: { kind: 'chat', dateKey: targetDate, shiftId: targetShift, messageId },
        attachments,
      })
    }
    // A follow-up message explicitly linked to an open incident is appended to
    // that incident's timeline, so the board reflects updates made from chat.
    // extras.incidentId is the original incident-tagged message's id (see
    // openIncidents) — resolve it to the actual board item via its chat source.
    // The new message's own id is stored on the entry (sourceMessageId) so the
    // entry can be removed later if this follow-up message gets deleted.
    if (extras.incidentId && text.trim() && messageId) {
      const linkedIncident = incidentsApi.findBySource(dateKey, activeTab, extras.incidentId)
      if (linkedIncident) incidentsApi.addTimelineEntry(linkedIncident.id, text.trim(), selectedOperator, messageId)
    }
    if (sentElsewhere) {
      const shiftLabel = SHIFT_DEFINITIONS.find((d) => d.id === targetShift)!.label
      showToast(`נשלח ל${shiftLabel} · ${formatDateShort(targetDate)}`)
    }
  }

  const handleToggleAck = (id: string) => {
    const m = activeMessages.find((x) => x.id === id)
    if (!m || !selectedOperator) return
    const acks = new Set(m.acks ?? [])
    if (acks.has(selectedOperator)) acks.delete(selectedOperator)
    else acks.add(selectedOperator)
    updateMessage(dateKey, activeTab, id, { acks: [...acks] })
  }

  const handleResolveCarryOver = (item: CarryOverItem) => {
    // Same resolution popup as closing from the chat bubble or the incident
    // board — never resolve silently, always ask how it was resolved
    const incident = incidentsApi.findBySource(item.dateKey, item.shiftId, item.message.id)
    if (incident) {
      setResolvingIncident(incident)
    } else {
      updateMessage(item.dateKey, item.shiftId, item.message.id, { unresolved: false })
      showToast('סומן כטופל')
    }
  }

  const handleConfirmResolution = (resolution: IncidentResolution) => {
    if (!resolvingIncident) return
    incidentsApi.resolveIncident(resolvingIncident.id, resolution)
    if (resolvingIncident.source.kind === 'chat') {
      const { dateKey: dk, shiftId: sid, messageId } = resolvingIncident.source
      updateMessage(dk, sid, messageId, { unresolved: false })
    }
    setResolvingIncident(null)
    showToast('התקלה נסגרה')
  }

  const handleJumpToChat = (dk: string, shiftId: ShiftId, messageId: string) => {
    setDateKey(dk)
    setActiveTab(shiftId)
    setIncidentBoardOpen(false)
    setIncidentArchiveOpen(false)
    showToast('עברתם להודעה בצ׳אט')
    void messageId
  }

  const handleCopyTicketUpdate = async () => {
    const plain = generateTicketUpdate(activeShiftDef, activeMessages)
    const html = generateTicketUpdateHtml(activeShiftDef, activeMessages)
    const ok = await copyRichText(plain, html)
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
        onOpenContacts={() => setContactsOpen(true)}
        onOpenRunbook={() => setRunbookOpen(true)}
        onOpenIncidents={() => setIncidentBoardOpen(true)}
        openIncidentCount={incidentsApi.incidents.filter((i) => i.open).length}
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
                  setDateKey(operationalToday)
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

            {handoverAck ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400">
                <Hand className="h-3 w-3" />
                התקבלה ע"י {handoverAck.operator} · {formatTime(handoverAck.at)}
              </span>
            ) : (
              <button
                onClick={() => {
                  acceptShift(dateKey, activeTab, selectedOperator)
                  showToast('המשמרת התקבלה ✋')
                }}
                title="אישור קבלת המשמרת — נרשם עם שם ושעה"
                className="flex items-center gap-1 rounded-full border border-noc-accent/50 bg-noc-accent/10 px-2.5 py-1 text-[11px] font-bold text-noc-accent transition-colors hover:bg-noc-accent/20"
              >
                <Hand className="h-3 w-3" />
                קבלת משמרת
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
          {tags
            .filter((t) => (tagCounts.get(t.id) ?? 0) > 0)
            .map((t) => {
              const selected = tagFilter === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTagFilter(selected ? 'all' : t.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                    selected ? t.chip : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-t2'
                  }`}
                >
                  {t.label} ({tagCounts.get(t.id)})
                </button>
              )
            })}

          {operatorCounts.size > 1 && <span className="mx-1 h-4 w-px bg-noc-border" />}
          {operatorCounts.size > 1 &&
            [...operatorCounts.entries()].map(([name, count]) => {
              const selected = operatorFilter === name
              return (
                <button
                  key={name}
                  onClick={() => setOperatorFilter(selected ? 'all' : name)}
                  title={`הצגת הודעות של ${name} בלבד`}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all ${
                    selected
                      ? colorForOperator(name)
                      : 'bg-transparent text-noc-t4 ring-noc-border hover:text-noc-t2'
                  }`}
                >
                  {name} ({count})
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
                  setDateKey(operationalToday)
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
            currentOperator={selectedOperator}
            tags={tags}
            onDeleteMessage={(id) => {
              const m = activeMessages.find((x) => x.id === id)
              if (!m) return
              const dk = dateKey
              const tab = activeTab
              if (m.tag === 'incident') {
                // This message is the incident's creation point — with it gone
                // there's no origin left, so remove the incident entirely
                const incident = incidentsApi.findBySource(dk, tab, id)
                if (incident) incidentsApi.deleteIncident(incident.id)
              } else if (m.incidentId) {
                // A follow-up linked to another incident — drop just its timeline entry
                const linkedIncident = incidentsApi.findBySource(dk, tab, m.incidentId)
                if (linkedIncident) incidentsApi.removeTimelineEntryBySource(linkedIncident.id, id)
              }
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
              if (!m) return
              if (!m.unresolved) {
                // Marking unresolved — put it back on the incident board too,
                // reopening its existing entry or creating one if none exists
                updateMessage(dateKey, activeTab, id, { unresolved: true })
                const existing = incidentsApi.findBySource(dateKey, activeTab, id)
                if (existing) {
                  if (!existing.open) incidentsApi.reopenIncident(existing.id)
                } else {
                  incidentsApi.addIncident({
                    title: m.text.trim() || 'תקלה ללא תיאור',
                    urgency: 'medium',
                    createdBy: selectedOperator,
                    source: { kind: 'chat', dateKey, shiftId: activeTab, messageId: id },
                    attachments: m.attachments,
                  })
                }
                return
              }
              // Closing an incident from the chat bubble goes through the same
              // resolution popup as closing it from the incident board
              const incident = incidentsApi.findBySource(dateKey, activeTab, id)
              if (incident) setResolvingIncident(incident)
              else updateMessage(dateKey, activeTab, id, { unresolved: false })
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
            onToggleAck={handleToggleAck}
            onOpenThread={setThreadId}
            onResolveCarryOver={handleResolveCarryOver}
          />
        </div>

        <ChatInputBar
          operators={operators}
          selectedOperator={selectedOperator}
          tags={tags}
          onAddTag={tagsApi.addTag}
          onUpdateTag={tagsApi.updateTag}
          onDeleteTag={tagsApi.deleteTag}
          draftKey={`${dateKey}_${activeTab}`}
          openIncidents={openIncidents}
          currentDateKey={dateKey}
          currentShiftId={activeTab}
          onSelectOperator={setSelectedOperator}
          onAddOperator={(name) => {
            addOperator(name)
            showToast(`${name.trim()} נוסף לרשימת הנוקיסטים`)
          }}
          onRenameOperator={(oldName, newName) => {
            renameOperator(oldName, newName)
            if (selectedOperator === oldName) setSelectedOperator(newName.trim())
            showToast('שם הנוקיסט עודכן')
          }}
          onDeleteOperator={(name) => {
            deleteOperator(name)
            showToast(`${name} הוסר מהרשימה`)
          }}
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

      <ContactsPanel open={contactsOpen} onClose={() => setContactsOpen(false)} api={contactsApi} />
      <RunbookPanel open={runbookOpen} onClose={() => setRunbookOpen(false)} api={runbookApi} onCopied={() => showToast('הנוהל הועתק!')} onError={(msg) => showToast(msg, 'error')} />
      <IncidentThreadModal
        incidentId={threadId}
        messages={activeMessages}
        incidents={incidentsApi.incidents}
        onClose={() => setThreadId(null)}
        onCopied={() => showToast('ציר הזמן הועתק!')}
      />

      <IncidentBoard
        open={incidentBoardOpen}
        onClose={() => setIncidentBoardOpen(false)}
        api={incidentsApi}
        operator={selectedOperator}
        onError={(msg) => showToast(msg, 'error')}
        onJumpToChat={handleJumpToChat}
        onRequestResolve={(incident) => setResolvingIncident(incident)}
        onOpenArchive={() => {
          setIncidentBoardOpen(false)
          setIncidentArchiveOpen(true)
        }}
      />
      <IncidentArchive
        open={incidentArchiveOpen}
        onClose={() => setIncidentArchiveOpen(false)}
        api={incidentsApi}
        onJumpToChat={handleJumpToChat}
        onReopened={() => showToast('התקלה נפתחה מחדש')}
      />
      <ResolutionModal
        incident={resolvingIncident}
        operator={selectedOperator}
        onClose={() => setResolvingIncident(null)}
        onResolve={handleConfirmResolution}
      />

      <Toast toast={toast} />
    </div>
  )
}

export default App

export type ShiftId = 'shift1' | 'shift2' | 'shift3'

export interface ShiftDefinition {
  id: ShiftId
  label: string
  shiftNumber: 1 | 2 | 3
  timeRange: string
  startHour: number
  endHour: number
  emoji: string
}

export const SHIFT_DEFINITIONS: ShiftDefinition[] = [
  {
    id: 'shift1',
    label: 'משמרת 1 — בוקר',
    shiftNumber: 1,
    timeRange: '07:00 - 15:00',
    startHour: 7,
    endHour: 15,
    emoji: '🌅',
  },
  {
    id: 'shift2',
    label: 'משמרת 2 — ערב',
    shiftNumber: 2,
    timeRange: '15:00 - 23:00',
    startHour: 15,
    endHour: 23,
    emoji: '🌇',
  },
  {
    id: 'shift3',
    label: 'משמרת 3 — לילה',
    shiftNumber: 3,
    timeRange: '23:00 - 07:00',
    startHour: 23,
    endHour: 7,
    emoji: '🌙',
  },
]

export const SHIFT_ORDER: ShiftId[] = ['shift1', 'shift2', 'shift3']

// Tags are user-editable (see useTags), but 'update' and 'incident' are the two
// built-in ids the app's logic depends on (default tag, and incident detection)
// and can be relabeled/recolored but never deleted.
export type MessageTag = string
export const BUILTIN_UPDATE_TAG = 'update'
export const BUILTIN_INCIDENT_TAG = 'incident'

export interface TagDef {
  id: string
  label: string
  chip: string
  ticketPrefix: string
  /** 'update' and 'incident' can't be deleted — the app's logic relies on their ids */
  builtin?: boolean
}

export const DEFAULT_TAGS: TagDef[] = [
  { id: 'update', label: 'עדכון', chip: 'bg-sky-500/15 text-sky-400 ring-sky-500/30', ticketPrefix: '', builtin: true },
  {
    id: 'incident',
    label: 'תקלה',
    chip: 'bg-red-500/15 text-red-400 ring-red-500/30',
    ticketPrefix: '[תקלה] ',
    builtin: true,
  },
  {
    id: 'followup',
    label: 'מעקב',
    chip: 'bg-amber-500/15 text-amber-500 ring-amber-500/30',
    ticketPrefix: '[מעקב] ',
  },
  {
    id: 'maintenance',
    label: 'תחזוקה',
    chip: 'bg-violet-500/15 text-violet-500 ring-violet-500/30 dark:text-violet-400',
    ticketPrefix: '[תחזוקה] ',
  },
  {
    id: 'provider',
    label: 'ספק',
    chip: 'bg-orange-500/15 text-orange-500 ring-orange-500/30 dark:text-orange-400',
    ticketPrefix: '[ספק] ',
  },
  {
    id: 'hardware',
    label: 'חומרה',
    chip: 'bg-rose-500/15 text-rose-500 ring-rose-500/30 dark:text-rose-400',
    ticketPrefix: '[חומרה] ',
  },
]

const FALLBACK_TAG: TagDef = {
  id: 'update',
  label: 'עדכון',
  chip: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  ticketPrefix: '',
  builtin: true,
}

/** Look up a tag's display info from the live tag list (falls back to a plain "update" look). */
export function tagMetaOf(tags: TagDef[], tagId: string | undefined): TagDef {
  return tags.find((t) => t.id === (tagId ?? BUILTIN_UPDATE_TAG)) ?? FALLBACK_TAG
}

export interface MessageAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  /** Inline base64 content — used in localStorage fallback mode (small files) */
  dataUrl?: string
  /** Firebase Storage download URL — used when Firebase is configured */
  url?: string
}

export function attachmentSrc(a: MessageAttachment): string {
  return a.url ?? a.dataUrl ?? ''
}

export interface ChatMessage {
  id: string
  operator: string
  text: string
  timestamp: number
  tag?: MessageTag
  pinned?: boolean
  unresolved?: boolean
  edited?: boolean
  /** Operators who marked this message as seen (ראיתי) */
  acks?: string[]
  /** Links this message to an incident message's id (ציר זמן של תקלה) */
  incidentId?: string
  /** Written ahead of time for a future shift */
  scheduled?: boolean
  attachments?: MessageAttachment[]
}

/** shiftId -> messages, for a single date */
export type DayMessages = Record<ShiftId, ChatMessage[]>

/** dateKey (YYYY-MM-DD) -> DayMessages */
export type ChatStore = Record<string, DayMessages>

export function createEmptyDayMessages(): DayMessages {
  return { shift1: [], shift2: [], shift3: [] }
}

export type ShiftStatus = 'ok' | 'minor' | 'major'

export const STATUS_META: Record<ShiftStatus, { label: string; dot: string; ticketLabel: string }> = {
  ok: { label: 'תקין', dot: 'bg-emerald-500', ticketLabel: 'תקין' },
  minor: { label: 'תקלות קלות', dot: 'bg-amber-400', ticketLabel: 'תקלות קלות' },
  major: { label: 'תקלה חמורה', dot: 'bg-red-500', ticketLabel: 'תקלה חמורה' },
}

/** dateKey -> shiftId -> status */
export type ShiftStatusStore = Record<string, Partial<Record<ShiftId, ShiftStatus>>>

export interface CarryOverItem {
  dateKey: string
  shiftId: ShiftId
  message: ChatMessage
}

export type IncidentUrgency = 'critical' | 'high' | 'medium' | 'low'

export const URGENCY_META: Record<IncidentUrgency, { label: string; chip: string; dot: string; order: number }> = {
  critical: { label: 'קריטי', chip: 'bg-red-500/15 text-red-500 ring-red-500/40 dark:text-red-400', dot: 'bg-red-500', order: 0 },
  high: { label: 'גבוה', chip: 'bg-orange-500/15 text-orange-500 ring-orange-500/40 dark:text-orange-400', dot: 'bg-orange-500', order: 1 },
  medium: { label: 'בינוני', chip: 'bg-amber-500/15 text-amber-500 ring-amber-500/40 dark:text-amber-400', dot: 'bg-amber-400', order: 2 },
  low: { label: 'נמוך', chip: 'bg-sky-500/15 text-sky-500 ring-sky-500/40 dark:text-sky-400', dot: 'bg-sky-400', order: 3 },
}

export type ResolutionKind = 'note' | 'skipped' | 'self-resolved'

export interface IncidentResolution {
  kind: ResolutionKind
  note?: string
  resolvedBy: string
  resolvedAt: number
}

export interface IncidentTimelineEntry {
  id: string
  text: string
  operator: string
  at: number
  /** Id of the chat message this entry was created from, if any (a linked follow-up) — lets it be removed if that message is later deleted */
  sourceMessageId?: string
}

export type IncidentSource =
  | { kind: 'chat'; dateKey: string; shiftId: ShiftId; messageId: string }
  | { kind: 'manual' }

/** A tracked incident in the incident board — separate from chat messages. */
export interface IncidentItem {
  id: string
  title: string
  description?: string
  urgency: IncidentUrgency
  open: boolean
  source: IncidentSource
  timeline: IncidentTimelineEntry[]
  attachments: MessageAttachment[]
  resolution?: IncidentResolution
  createdBy: string
  createdAt: number
}

export const OPERATOR_COLORS = [
  'bg-sky-500/20 text-sky-600 ring-sky-500/30 dark:text-sky-300',
  'bg-violet-500/20 text-violet-600 ring-violet-500/30 dark:text-violet-300',
  'bg-emerald-500/20 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300',
  'bg-amber-500/20 text-amber-600 ring-amber-500/30 dark:text-amber-300',
  'bg-pink-500/20 text-pink-600 ring-pink-500/30 dark:text-pink-300',
  'bg-cyan-500/20 text-cyan-600 ring-cyan-500/30 dark:text-cyan-300',
  'bg-orange-500/20 text-orange-600 ring-orange-500/30 dark:text-orange-300',
  'bg-indigo-500/20 text-indigo-600 ring-indigo-500/30 dark:text-indigo-300',
]

export function colorForOperator(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return OPERATOR_COLORS[hash % OPERATOR_COLORS.length]
}

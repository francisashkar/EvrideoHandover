import type { ChatMessage, ShiftDefinition, ShiftStatus } from './types'
import { STATUS_META, TAG_META } from './types'
import { formatDateShort, formatTime } from './dateUtils'

function formatMessageLine(m: ChatMessage): string {
  const prefix = m.tag ? TAG_META[m.tag].ticketPrefix : ''
  const unresolvedMark = m.unresolved ? ' (לא פתור — דורש מעקב)' : ''
  const attachmentNote =
    m.attachments && m.attachments.length > 0
      ? ` (מצורף: ${m.attachments.map((a) => a.name).join(', ')})`
      : ''
  const body = m.text || '(קובץ מצורף)'
  return `[${formatTime(m.timestamp)}] ${prefix}${m.operator}: ${body}${unresolvedMark}${attachmentNote}`
}

export function generateTicketUpdate(
  dateKey: string,
  shift: ShiftDefinition,
  messages: ChatMessage[],
  status: ShiftStatus,
): string {
  const lastOperator = messages.length > 0 ? messages[messages.length - 1].operator : 'לא צוין'

  const updateLines =
    messages.length > 0 ? messages.map(formatMessageLine).join('\n') : 'לא נרשמו עדכונים במשמרת זו.'

  const unresolved = messages.filter((m) => m.unresolved)
  const unresolvedSection =
    unresolved.length > 0
      ? ['', 'פריטים פתוחים למעקב:', ...unresolved.map((m) => `- ${m.text || '(קובץ מצורף)'}`)]
      : []

  return [
    `העברת משמרת NOC — ${formatDateShort(dateKey)} — ${shift.label}`,
    `טווח שעות: ${shift.timeRange}`,
    `סטטוס משמרת: ${STATUS_META[status].ticketLabel}`,
    `דווח על ידי: ${lastOperator}`,
    '',
    'עדכונים ואירועים:',
    updateLines,
    ...unresolvedSection,
  ].join('\n')
}

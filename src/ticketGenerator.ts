import type { ChatMessage, ShiftDefinition } from './types'

const SHIFT_NAME_HE: Record<1 | 2 | 3, string> = { 1: 'בוקר', 2: 'ערב', 3: 'לילה' }

/**
 * RIGHT-TO-LEFT MARK — prefixing each line nudges plain-text consumers
 * toward RTL paragraph direction.
 */
const RLM = '‏'

function ticketLines(shift: ShiftDefinition, messages: ChatMessage[]): string[] {
  const texts = messages.flatMap((m) => m.text.trim().split('\n')).filter(Boolean)
  const body = texts.length > 0 ? texts : ['לא נרשמו עדכונים במשמרת זו.']
  return [`סיכום משמרת ${SHIFT_NAME_HE[shift.shiftNumber]}:`, ...body]
}

/** Plain-text version (with RTL marks) for text-only paste targets. */
export function generateTicketUpdate(shift: ShiftDefinition, messages: ChatMessage[]): string {
  return ticketLines(shift, messages)
    .map((line) => RLM + line)
    .join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * HTML version with explicit dir="rtl" — rich-text editors (HubSpot tickets)
 * prefer this flavor, so the pasted lines keep true right-to-left layout.
 */
export function generateTicketUpdateHtml(shift: ShiftDefinition, messages: ChatMessage[]): string {
  const lines = ticketLines(shift, messages)
    .map((line) => `<div dir="rtl" style="direction:rtl;text-align:right">${escapeHtml(line)}</div>`)
    .join('')
  return `<div dir="rtl" style="direction:rtl;text-align:right">${lines}</div>`
}

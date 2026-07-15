import type { ChatMessage, ShiftDefinition } from './types'

const SHIFT_NAME_HE: Record<1 | 2 | 3, string> = { 1: 'בוקר', 2: 'ערב', 3: 'לילה' }

/**
 * RIGHT-TO-LEFT MARK — prefixing each line forces RTL paragraph direction
 * when the text is pasted into LTR editors (HubSpot), so mixed Hebrew +
 * numbers/English lines don't get scrambled.
 */
const RLM = '‏'

function rtlLines(text: string): string {
  return text
    .split('\n')
    .map((line) => RLM + line)
    .join('\n')
}

/**
 * Plain summary for pasting into a HubSpot ticket:
 * a shift header line, then each message's text on its own line(s) —
 * no operators, no times, no metadata.
 */
export function generateTicketUpdate(shift: ShiftDefinition, messages: ChatMessage[]): string {
  const texts = messages.map((m) => m.text.trim()).filter(Boolean)
  const body = texts.length > 0 ? texts.join('\n') : 'לא נרשמו עדכונים במשמרת זו.'
  return rtlLines(`סיכום משמרת ${SHIFT_NAME_HE[shift.shiftNumber]}:\n${body}`)
}

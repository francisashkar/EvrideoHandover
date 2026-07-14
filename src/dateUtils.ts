export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function formatDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Returns the ShiftId of whichever shift covers the current real-world clock time. */
export function getActiveShiftId(now: Date = new Date()): 'shift1' | 'shift2' | 'shift3' {
  const hour = now.getHours()
  if (hour >= 7 && hour < 15) return 'shift1'
  if (hour >= 15 && hour < 23) return 'shift2'
  return 'shift3'
}

/** DD/MM/YYYY, used inside the Hebrew WhatsApp template. */
export function formatDateShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y}`
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}

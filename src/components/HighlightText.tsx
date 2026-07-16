import type { ReactNode } from 'react'

/** Renders text with every case-insensitive occurrence of `term` marked. */
export default function HighlightText({ text, term }: { text: string; term: string }) {
  const t = term.trim()
  if (!t) return <>{text}</>

  const lower = text.toLowerCase()
  const lt = t.toLowerCase()
  const parts: ReactNode[] = []
  let cursor = 0
  let key = 0

  while (cursor <= text.length) {
    const idx = lower.indexOf(lt, cursor)
    if (idx < 0) {
      parts.push(text.slice(cursor))
      break
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx))
    parts.push(
      <mark key={key++} className="rounded bg-amber-400/60 px-0.5 text-inherit">
        {text.slice(idx, idx + t.length)}
      </mark>,
    )
    cursor = idx + t.length
  }

  return <>{parts}</>
}

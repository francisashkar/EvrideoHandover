import { useEffect, useRef, useState } from 'react'
import { X, Search, Loader2, SearchX } from 'lucide-react'
import type { CarryOverItem, ShiftId } from '../types'
import { SHIFT_DEFINITIONS, colorForOperator } from '../types'
import { formatDateShort, formatTime } from '../dateUtils'
import HighlightText from './HighlightText'

interface GlobalSearchModalProps {
  open: boolean
  initialQuery: string
  onClose: () => void
  onSearch: (query: string) => Promise<CarryOverItem[]>
  onNavigate: (dateKey: string, shiftId: ShiftId, query: string) => void
}

export default function GlobalSearchModal({
  open,
  initialQuery,
  onClose,
  onSearch,
  onNavigate,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<CarryOverItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) {
      setQuery(initialQuery)
      setResults([])
      setSearched(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Debounced search-as-you-type
  useEffect(() => {
    if (!open) return
    clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearched(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const found = await onSearch(trimmed)
      setResults(found)
      setSearched(true)
      setLoading(false)
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, open, onSearch])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-b-2xl border border-t-0 border-noc-border bg-noc-panel shadow-2xl sm:top-8 sm:rounded-2xl sm:border-t">
        <div className="flex items-center gap-2 border-b border-noc-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-noc-accent" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
            }}
            placeholder="חיפוש בכל התאריכים והמשמרות..."
            className="min-w-0 flex-1 bg-transparent text-sm text-noc-t1 placeholder-noc-t4 outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-noc-t3" />}
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {!searched && !loading && (
            <p className="px-4 py-8 text-center text-xs text-noc-t4">
              הקלידו טקסט כדי לחפש בכל ההיסטוריה — לדוגמה "ערוץ 12"
            </p>
          )}

          {searched && results.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-noc-t4">
              <SearchX className="h-8 w-8" />
              <p className="text-xs">לא נמצאו תוצאות</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="divide-y divide-noc-border">
              <p className="bg-noc-panel2/50 px-4 py-1.5 text-[10px] font-bold text-noc-t3">
                {results.length} תוצאות · מהחדש לישן
              </p>
              {results.map((item) => {
                const shiftDef = SHIFT_DEFINITIONS.find((s) => s.id === item.shiftId)!
                return (
                  <button
                    key={`${item.dateKey}-${item.message.id}`}
                    onClick={() => onNavigate(item.dateKey, item.shiftId, query.trim())}
                    className="block w-full px-4 py-3 text-start transition-colors hover:bg-noc-panel2"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-noc-t3">
                      <span className="font-bold text-noc-accent2">{formatDateShort(item.dateKey)}</span>
                      <span>
                        {shiftDef.emoji} {shiftDef.label}
                      </span>
                      <span>{formatTime(item.message.timestamp)}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ${colorForOperator(item.message.operator)}`}
                      >
                        {item.message.operator}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-noc-t1">
                      <HighlightText text={item.message.text || '(קובץ מצורף)'} term={query} />
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

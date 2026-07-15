import { Search, X, Globe } from 'lucide-react'

interface SearchBarProps {
  query: string
  onQueryChange: (query: string) => void
  onOpenGlobal: () => void
}

export default function SearchBar({ query, onQueryChange, onOpenGlobal }: SearchBarProps) {
  return (
    <div className="flex gap-1.5 px-4 pb-3 sm:px-6">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-noc-t3" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="חיפוש בהודעות..."
          className="w-full rounded-full border border-noc-border bg-noc-panel2 py-2.5 pe-11 ps-11 text-sm text-noc-t1 placeholder-noc-t4 outline-none transition-all focus:border-noc-accent/60 focus:bg-noc-panel3 focus:shadow-lg focus:shadow-emerald-500/10"
        />
        {query && (
          <button
            onClick={() => onQueryChange('')}
            className="absolute start-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-noc-t3 transition-colors hover:bg-noc-border hover:text-noc-t2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <button
        onClick={onOpenGlobal}
        title="חיפוש בכל התאריכים והמשמרות"
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-noc-border bg-noc-panel2 px-3.5 text-xs font-semibold text-noc-t2 transition-colors hover:border-noc-accent/50 hover:text-noc-accent"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">בכל התאריכים</span>
      </button>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'noc-chat-operators'
const DEFAULT_OPERATORS = ['פרנסיס', 'דניאל', 'אבי', 'שלומי', 'רפאל', 'חן', 'דני']
const LEGACY_NAMES = ['Francis', 'Daniel']

function loadOperators(): string[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      const parsed = JSON.parse(stored) as string[]
      if (Array.isArray(parsed)) {
        // Migrate: drop the old English defaults, then merge in any missing Hebrew defaults
        const kept = parsed.filter((n) => !LEGACY_NAMES.includes(n))
        const merged = [...kept, ...DEFAULT_OPERATORS.filter((n) => !kept.includes(n))]
        if (merged.length > 0) return merged
      }
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_OPERATORS
}

export function useOperators() {
  const [operators, setOperators] = useState<string[]>(loadOperators)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(operators))
    } catch {
      // localStorage unavailable — fail silently
    }
  }, [operators])

  const addOperator = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setOperators((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
  }, [])

  return { operators, addOperator }
}

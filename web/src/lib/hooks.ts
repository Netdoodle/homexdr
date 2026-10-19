import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Per-browser preference in localStorage; falls back to in-memory when unavailable. */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: T) => {
      setValue(v)
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        // ignore
      }
    },
    [key],
  )
  return [value, set]
}

/** Reads and patches URL search params; empty values are removed. */
export function useUrlState() {
  const [sp, setSp] = useSearchParams()
  const patch = useCallback(
    (changes: Record<string, string | number | undefined | null>, opts: { replace?: boolean } = {}) => {
      setSp(
        (prev) => {
          const n = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(changes)) {
            if (v === undefined || v === null || v === '') n.delete(k)
            else n.set(k, String(v))
          }
          return n
        },
        { replace: opts.replace ?? true },
      )
    },
    [setSp],
  )
  return [sp, patch] as const
}

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = `${title} · HomeXDR`
    return () => {
      document.title = prev
    }
  }, [title])
}

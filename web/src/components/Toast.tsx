import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../api/client'
import { Icon } from './Icon'

type Kind = 'info' | 'success' | 'error'
interface ToastItem {
  id: number
  kind: Kind
  text: ReactNode
}

interface ToastApi {
  show: (text: ReactNode, kind?: Kind) => void
  success: (text: ReactNode) => void
  error: (err: unknown) => void
}

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const show = useCallback(
    (text: ReactNode, kind: Kind = 'info') => {
      const id = nextId.current++
      setItems((xs) => [...xs.slice(-3), { id, kind, text }])
      setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (t) => show(t, 'success'),
      error: (e) => show(errorMessage(e), 'error'),
    }),
    [show],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon name={t.kind === 'error' ? 'warning' : t.kind === 'success' ? 'check' : 'info'} size={14} />
            <div className="grow">{t.text}</div>
            <button type="button" className="btn ghost icon sm" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast outside ToastProvider')
  return ctx
}

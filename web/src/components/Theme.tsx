import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeChoice = 'system' | 'dark' | 'light'
const KEY = 'homexdr.theme'

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {
    // storage unavailable (private mode, blocked): use the OS setting
  }
  return 'system'
}

function apply(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
}

const Ctx = createContext<{ choice: ThemeChoice; setChoice: (c: ThemeChoice) => void }>({
  choice: 'system',
  setChoice: () => undefined,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice)
  useEffect(() => apply(choice), [choice])
  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c)
    try {
      localStorage.setItem(KEY, c)
    } catch {
      // ignore
    }
  }, [])
  return <Ctx.Provider value={{ choice, setChoice }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)

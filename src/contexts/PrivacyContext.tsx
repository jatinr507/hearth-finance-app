import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

const STORAGE_KEY = 'hearth.privacyMode'

interface PrivacyValue {
  // When true, monetary amounts are masked (percentages where meaningful, dots
  // otherwise) so the app is safe to view or share in front of others.
  hidden: boolean
  toggle: () => void
}

const PrivacyContext = createContext<PrivacyValue | undefined>(undefined)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(hidden))
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }, [hidden])

  const toggle = useCallback(() => setHidden((h) => !h), [])

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>
}

export function usePrivacy(): PrivacyValue {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within a PrivacyProvider')
  return ctx
}

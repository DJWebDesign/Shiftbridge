'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { TOUR_STEPS, TOTAL_STEPS, COMPLETION_STEP } from './steps'

interface TourState {
  step: number   // 0=email modal, 1-19=tooltips, 20=completion
  active: boolean
}

interface TourContextValue extends TourState {
  advance: () => void
  retreat: () => void
  skip: () => void
  restart: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used within TourProvider')
  return ctx
}

interface Props {
  userId: string
  children: React.ReactNode
}

export function TourProvider({ userId, children }: Props) {
  const storageKey = `shiftbridge_tour_${userId}`
  const pathname = usePathname()

  // Start with defaults; sync from localStorage after hydration to avoid mismatch
  const [state, setState] = useState<TourState>({ step: 0, active: true })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TourState>
        setState({
          step: typeof parsed.step === 'number' ? parsed.step : 0,
          active: parsed.active !== false,
        })
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [storageKey])

  // Persist on every change
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch { /* ignore */ }
  }, [state, storageKey, hydrated])

  // Auto-advance when navigation matches nextPagePattern
  useEffect(() => {
    if (!state.active || state.step === 0 || state.step > TOTAL_STEPS) return
    const def = TOUR_STEPS[state.step - 1]
    if (def?.nextPagePattern?.test(pathname)) {
      setState(prev => ({
        ...prev,
        step: Math.min(prev.step + 1, COMPLETION_STEP),
      }))
    }
  }, [pathname, state.active, state.step])

  const advance = useCallback(() =>
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, COMPLETION_STEP) })),
  [])

  const retreat = useCallback(() =>
    setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 0) })),
  [])

  const skip = useCallback(() =>
    setState(prev => ({ ...prev, active: false })),
  [])

  const restart = useCallback(() =>
    setState({ step: 0, active: true }),
  [])

  // Don't render tour UI until hydrated (avoids flash of wrong step)
  const exposed: TourContextValue = {
    step: hydrated ? state.step : -1,
    active: hydrated ? state.active : false,
    advance,
    retreat,
    skip,
    restart,
  }

  return (
    <TourContext.Provider value={exposed}>
      {children}
    </TourContext.Provider>
  )
}

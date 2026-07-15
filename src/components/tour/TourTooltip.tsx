'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTour } from '@/lib/tour/context'
import { TOUR_STEPS, TOTAL_STEPS, COMPLETION_STEP } from '@/lib/tour/steps'

const TOOLTIP_WIDTH = 300
const TOOLTIP_GAP = 14    // gap between target and tooltip
const ARROW_SIZE = 8

interface Pos {
  top: number
  left: number
  arrowTop: number
  arrowLeft: number
  arrowRotation: string
}

function calcPos(rect: DOMRect, placement: string): Pos {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  let top = 0, left = 0
  let arrowTop = 0, arrowLeft = 0
  let arrowRotation = 'rotate(45deg)'

  if (placement === 'bottom') {
    top = rect.bottom + TOOLTIP_GAP
    left = Math.min(Math.max(cx - TOOLTIP_WIDTH / 2, 8), vw - TOOLTIP_WIDTH - 8)
    arrowTop = rect.bottom + TOOLTIP_GAP - ARROW_SIZE
    arrowLeft = cx - ARROW_SIZE / 2
  } else if (placement === 'top') {
    // height estimated: will be corrected after render; use 120 as estimate
    top = rect.top - TOOLTIP_GAP - 120
    left = Math.min(Math.max(cx - TOOLTIP_WIDTH / 2, 8), vw - TOOLTIP_WIDTH - 8)
    arrowTop = rect.top - TOOLTIP_GAP - ARROW_SIZE / 2
    arrowLeft = cx - ARROW_SIZE / 2
  } else if (placement === 'right') {
    left = rect.right + TOOLTIP_GAP
    if (left + TOOLTIP_WIDTH > vw - 8) left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP
    top = Math.min(Math.max(cy - 60, 8), vh - 160)
    arrowTop = cy - ARROW_SIZE / 2
    arrowLeft = rect.right + TOOLTIP_GAP - ARROW_SIZE
  } else { // left
    left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP
    if (left < 8) left = rect.right + TOOLTIP_GAP
    top = Math.min(Math.max(cy - 60, 8), vh - 160)
    arrowTop = cy - ARROW_SIZE / 2
    arrowLeft = rect.left - TOOLTIP_GAP - ARROW_SIZE / 2
  }

  return { top, left, arrowTop, arrowLeft, arrowRotation }
}

export default function TourTooltip() {
  const { step, active, advance, retreat, skip } = useTour()
  const [pos, setPos] = useState<Pos | null>(null)
  const [targetFound, setTargetFound] = useState(true)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const highlightedRef = useRef<Element | null>(null)

  const isTooltipStep = active && step >= 1 && step <= TOTAL_STEPS
  const isCompletion = active && step === COMPLETION_STEP
  const def = isTooltipStep ? TOUR_STEPS[step - 1] : null

  function updatePos() {
    if (!def) return
    const el = document.querySelector(`[data-tour-id="${def.targetId}"]`)
    if (!el) {
      setTargetFound(false)
      setPos(null)
      return
    }
    setTargetFound(true)
    const rect = el.getBoundingClientRect()
    setPos(calcPos(rect, def.placement))
  }

  // Manage highlight class
  useEffect(() => {
    // Remove from previous target
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove('tour-highlight')
      highlightedRef.current = null
    }
    if (!def) return
    const el = document.querySelector(`[data-tour-id="${def.targetId}"]`)
    if (el) {
      el.classList.add('tour-highlight')
      highlightedRef.current = el
    }
    return () => {
      if (highlightedRef.current) {
        highlightedRef.current.classList.remove('tour-highlight')
        highlightedRef.current = null
      }
    }
  }, [def?.targetId, isTooltipStep])

  // Position tooltip + reposition on resize/scroll
  useEffect(() => {
    if (!isTooltipStep) return
    updatePos()

    const ro = new ResizeObserver(updatePos)
    ro.observe(document.body)
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isTooltipStep])

  // Auto-advance when nextTargetId element appears in the DOM
  useEffect(() => {
    if (!def?.nextTargetId) return
    const id = def.nextTargetId
    const interval = setInterval(() => {
      if (document.querySelector(`[data-tour-id="${id}"]`)) {
        advance()
      }
    }, 150)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def?.nextTargetId])

  // Correct top position after tooltip renders (to account for actual height)
  useEffect(() => {
    if (!pos || !tooltipRef.current || !def) return
    if (def.placement === 'top') {
      const h = tooltipRef.current.offsetHeight
      const el = document.querySelector(`[data-tour-id="${def.targetId}"]`)
      if (el) {
        const rect = el.getBoundingClientRect()
        setPos(prev => prev ? { ...prev, top: rect.top - TOOLTIP_GAP - h } : prev)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos?.left, def?.targetId])

  if (!active || step < 1) return null

  if (typeof document === 'undefined') return null

  // ── Completion modal ──────────────────────────────────────────────────────
  if (isCompletion) {
    return createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10050,
        background: 'rgba(13,27,42,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 440, background: '#FFFFFF',
          borderRadius: 16, padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          fontFamily: 'var(--font-sans, DM Sans, sans-serif)',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#CCFBF1', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: 16,
          }}>
            <svg width="22" height="22" fill="none" stroke="#0D9488" strokeWidth={2.5}
              viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0D1B2A', marginBottom: 8 }}>
            You've seen the full picture.
          </h2>
          <ul style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, paddingLeft: 18, marginBottom: 24 }}>
            <li>Post shifts for facilities that aren't on ShiftBridge yet</li>
            <li>Coordinators confirm via email — or agencies confirm directly</li>
            <li>Connected facilities confirm in real-time, nurses see it instantly</li>
          </ul>
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            <a
              href="/signup"
              style={{
                display: 'block', textAlign: 'center',
                background: '#0D9488', color: '#FFFFFF',
                borderRadius: 8, padding: '11px 20px',
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
              }}
            >
              Start Free Trial →
            </a>
            <button
              onClick={skip}
              style={{
                background: 'none', border: '1px solid #E4EAF0',
                borderRadius: 8, padding: '10px 20px',
                fontSize: 14, color: '#5B6B80', cursor: 'pointer',
              }}
            >
              Explore on your own
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  // ── Tooltip step ─────────────────────────────────────────────────────────
  if (!def) return null

  const tooltipStyle: React.CSSProperties = pos
    ? { position: 'fixed', top: pos.top, left: pos.left, zIndex: 10050, width: TOOLTIP_WIDTH }
    : {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10050, width: TOOLTIP_WIDTH,
      }

  return createPortal(
    <>
      {/* Tooltip card */}
      <div ref={tooltipRef} style={tooltipStyle}>
        <div style={{
          background: '#FFFFFF', borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans, DM Sans, sans-serif)',
        }}>
          {/* Section label + step counter */}
          <div style={{
            padding: '10px 14px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: '#CCFBF1', color: '#0D9488',
              padding: '2px 8px', borderRadius: 20,
            }}>
              {def.section}
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              {step} / {TOTAL_STEPS}
            </span>
          </div>

          {/* Content */}
          <div style={{ padding: '10px 14px 14px' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 6, lineHeight: 1.4 }}>
              {def.title}
            </p>
            <p style={{ fontSize: 13, color: '#5B6B80', lineHeight: 1.6, margin: 0 }}>
              {def.body}
            </p>
          </div>

          {/* Target not found hint */}
          {!targetFound && (
            <div style={{ padding: '0 14px 10px' }}>
              <p style={{ fontSize: 11, color: '#F59E0B', fontStyle: 'italic' }}>
                Navigate to the right page to see the highlighted element.
              </p>
            </div>
          )}

          {/* Buttons */}
          <div style={{
            padding: '0 14px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {step > 1 && (
              <button
                onClick={retreat}
                style={{
                  fontSize: 12, color: '#94A3B8', background: 'none',
                  border: '1px solid #E4EAF0', borderRadius: 6,
                  padding: '6px 10px', cursor: 'pointer',
                }}
              >
                ← Prev
              </button>
            )}
            <button
              onClick={advance}
              style={{
                fontSize: 12, fontWeight: 600,
                color: '#FFFFFF', background: '#0D9488',
                border: 'none', borderRadius: 6,
                padding: '6px 14px', cursor: 'pointer',
              }}
            >
              {step === TOTAL_STEPS ? 'Finish →' : 'Next →'}
            </button>
            <button
              onClick={skip}
              style={{
                fontSize: 12, color: '#94A3B8', background: 'none',
                border: 'none', cursor: 'pointer',
                marginLeft: 'auto', padding: '6px 4px',
              }}
            >
              Skip tour
            </button>
          </div>
        </div>

        {/* Arrow */}
        {pos && (
          <div style={{
            position: 'absolute',
            width: ARROW_SIZE, height: ARROW_SIZE,
            background: '#FFFFFF',
            transform: 'rotate(45deg)',
            boxShadow: '-1px -1px 2px rgba(0,0,0,0.06)',
            ...arrowOffset(def.placement, TOOLTIP_WIDTH),
          }} />
        )}
      </div>
    </>,
    document.body,
  )
}

function arrowOffset(placement: string, tooltipWidth: number): React.CSSProperties {
  const half = ARROW_SIZE / 2
  switch (placement) {
    case 'bottom': return { top: -half, left: tooltipWidth / 2 - half }
    case 'top':    return { bottom: -half, left: tooltipWidth / 2 - half }
    case 'right':  return { top: 50, left: -half }
    case 'left':   return { top: 50, right: -half }
    default:       return {}
  }
}

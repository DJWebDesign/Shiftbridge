'use client'

import { createPortal } from 'react-dom'
import { useTour } from '@/lib/tour/context'
import { getNextThursdayStr } from '@/lib/tour/steps'

export default function TourEmailModal() {
  const { step, active, advance, skip } = useTour()

  if (!active || step !== 0) return null

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const thursdayStr = getNextThursdayStr()

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10050,
        background: 'rgba(13, 27, 42, 0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#FFFFFF',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans, DM Sans, sans-serif)',
      }}>
        {/* Email chrome header */}
        <div style={{
          background: '#0D1B2A',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #0D9488, #0891B2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth={2}
              viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 Q4 10 12 10 Q20 10 20 18" />
              <path d="M4 18h16" /><path d="M8 18v-4" /><path d="M16 18v-4" />
            </svg>
          </div>
          <span style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600 }}>ShiftBridge Demo</span>
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 8px', borderRadius: 4,
            background: 'rgba(13,148,136,0.25)', color: '#2DD4BF',
          }}>DEMO</span>
        </div>

        {/* Email header rows */}
        <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #F1F5F9' }}>
          {[
            ['From', 'Sarah Mitchell <coordinator@flinthills.example>'],
            ['To', 'Heartland Per Diem Staffing'],
            ['Date', today],
            ['Subject', `LPN coverage needed — ${thursdayStr}`],
          ].map(([label, value]) => (
            <div key={label} style={{
              display: 'flex', gap: 12, paddingBottom: 10,
              fontSize: 13, lineHeight: 1.5,
            }}>
              <span style={{ color: '#94A3B8', fontWeight: 600, width: 54, flexShrink: 0 }}>{label}</span>
              <span style={{ color: '#0D1B2A', fontWeight: label === 'Subject' ? 600 : 400 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Email body */}
        <div style={{ padding: '16px 20px', fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 12 }}>Hi,</p>
          <p style={{ marginBottom: 12 }}>
            We're in need of LPN coverage on <strong>{thursdayStr}</strong>, day shift (7:00 AM – 3:00 PM).
            We have a patient with complex medication needs and need someone licensed to administer.
          </p>
          <p style={{ marginBottom: 12 }}>
            Can you staff it? Please let me know as soon as possible.
          </p>
          <p style={{ marginBottom: 4 }}>Thanks,</p>
          <p style={{ fontWeight: 600, color: '#0D1B2A' }}>Sarah</p>
          <p style={{ fontSize: 12, color: '#94A3B8' }}>Flint Hills Rehabilitation Center</p>
        </div>

        {/* CTA + skip */}
        <div style={{
          padding: '0 20px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button
            onClick={skip}
            style={{
              fontSize: 13, color: '#94A3B8', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            Skip tour
          </button>
          <button
            onClick={advance}
            style={{
              background: '#0D9488', color: '#FFFFFF',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              padding: '10px 20px', fontSize: 14, fontWeight: 600,
            }}
          >
            Got it — let's help them →
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}

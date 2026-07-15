'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Database } from '@/lib/supabase/types'

type Shift = Database['public']['Tables']['shifts']['Row']

interface SavedContact {
  id: string
  email: string
  label: string | null
  last_used_at: string | null
}

interface Props {
  facilityId: string
  facilityName: string
  currentMonth: string  // "YYYY-MM"
  openShifts: Shift[]
  onClose: () => void
}

const CREDENTIAL_ORDER = ['CNA', 'CMA', 'LPN', 'LPN_IV', 'RN']
const CREDENTIAL_LABELS: Record<string, string> = {
  CNA: 'CNA', CMA: 'CMA', LPN: 'LPN', LPN_IV: 'LPN + IV', RN: 'RN',
}
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmtTime(t: string): string {
  const [h, min] = t.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

type Step = 'compose' | 'preview' | 'done'

export default function ShiftOutreachModal({
  facilityId, facilityName, currentMonth, openShifts, onClose,
}: Props) {
  const [step, setStep] = useState<Step>('compose')

  // Saved contacts (loaded on mount)
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([])
  const [checkedContacts, setCheckedContacts] = useState<Set<string>>(new Set())
  const [contactsLoading, setContactsLoading] = useState(true)

  // New manually-typed emails
  const [emailInput, setEmailInput] = useState('')
  const [newEmails, setNewEmails] = useState<string[]>([])
  const [inputError, setInputError] = useState('')

  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)

  const [y, m] = currentMonth.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`

  // Load saved contacts on mount
  useEffect(() => {
    setContactsLoading(true)
    fetch(`/api/outreach-contacts?facilityId=${facilityId}`)
      .then(r => r.json())
      .then(data => {
        const contacts: SavedContact[] = data.contacts ?? []
        setSavedContacts(contacts)
        setCheckedContacts(new Set(contacts.map(c => c.email)))
      })
      .catch(() => {})
      .finally(() => setContactsLoading(false))
  }, [facilityId])

  // All recipients = checked saved contacts + new manually-typed emails (deduped)
  const allRecipients = useMemo(() => {
    const set = new Set<string>([...Array.from(checkedContacts), ...newEmails])
    return Array.from(set)
  }, [checkedContacts, newEmails])

  // Group open shifts by credential for preview
  const grouped = useMemo(() => {
    const g: Record<string, Shift[]> = {}
    for (const s of openShifts) {
      if (!g[s.credential_required]) g[s.credential_required] = []
      g[s.credential_required].push(s)
    }
    return g
  }, [openShifts])

  function toggleContact(email: string) {
    setCheckedContacts(prev => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  function removeContact(id: string, email: string) {
    fetch(`/api/outreach-contacts/${id}`, { method: 'DELETE' }).catch(() => {})
    setSavedContacts(prev => prev.filter(c => c.id !== id))
    setCheckedContacts(prev => { const n = new Set(prev); n.delete(email); return n })
  }

  function addEmail() {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed) return
    if (!isValidEmail(trimmed)) { setInputError('Enter a valid email address'); return }
    const alreadySaved = savedContacts.some(c => c.email === trimmed)
    if (alreadySaved) {
      // Just make sure it's checked rather than adding a duplicate chip
      setCheckedContacts(prev => new Set([...prev, trimmed]))
      setEmailInput('')
      setInputError('')
      return
    }
    if (newEmails.includes(trimmed)) { setInputError('Already added'); return }
    setNewEmails(prev => [...prev, trimmed])
    setEmailInput('')
    setInputError('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addEmail() }
  }

  async function handleSend() {
    setSending(true)
    try {
      const res = await fetch('/api/shifts/outreach-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, recipientEmails: allRecipients, month: currentMonth }),
      })
      const data = await res.json()
      setResult(data)

      // Fire-and-forget: upsert all sent-to emails into saved contacts
      Promise.allSettled(
        allRecipients.map(email =>
          fetch('/api/outreach-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ facilityId, email }),
          })
        )
      )
    } catch {
      setResult({ sent: 0, failed: allRecipients.length, total: allRecipients.length })
    }
    setSending(false)
    setStep('done')
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2A', margin: 0 }}>
              {step === 'done' ? 'Email Sent' : 'Send Shift Needs Email'}
            </h2>
            {step !== 'done' && (
              <p style={{ fontSize: 12, color: '#6B7280', margin: '3px 0 0' }}>
                Notify an agency about your open shifts for {monthLabel}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F3F4F6', cursor: 'pointer', fontSize: 16, color: '#6B7280', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── Step 1: Compose ── */}
          {step === 'compose' && (
            <>
              {/* Saved contacts */}
              {!contactsLoading && savedContacts.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Previously contacted
                  </p>
                  <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                    {savedContacts.map((contact, idx) => (
                      <div
                        key={contact.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                          borderTop: idx === 0 ? 'none' : '1px solid #F3F4F6',
                          background: checkedContacts.has(contact.email) ? '#F0FDF4' : '#fff',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checkedContacts.has(contact.email)}
                          onChange={() => toggleContact(contact.email)}
                          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0D9488', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, color: '#111827', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {contact.email}
                          </span>
                          {contact.label && (
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{contact.label}</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeContact(contact.id, contact.email)}
                          title="Remove from saved contacts"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: 16, padding: '0 2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New email input */}
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {savedContacts.length > 0 ? 'Add another agency' : 'Agency email address'}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => { setEmailInput(e.target.value); setInputError('') }}
                  onKeyDown={handleKeyDown}
                  placeholder="agency@example.com"
                  style={{
                    flex: 1, padding: '9px 12px',
                    border: `1px solid ${inputError ? '#EF4444' : '#D1D5DB'}`,
                    borderRadius: 8, fontSize: 13, outline: 'none', color: '#111827',
                  }}
                />
                <button
                  onClick={addEmail}
                  style={{ padding: '9px 16px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}
                >
                  Add
                </button>
              </div>
              {inputError && <p style={{ fontSize: 12, color: '#EF4444', margin: '4px 0 0' }}>{inputError}</p>}
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: '6px 0 0' }}>
                Press Enter or click Add. New addresses are saved for next time.
              </p>

              {/* New email chips */}
              {newEmails.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {newEmails.map(email => (
                    <span
                      key={email}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 20, padding: '4px 10px 4px 12px', fontSize: 12, fontWeight: 500 }}
                    >
                      {email}
                      <button
                        onClick={() => setNewEmails(prev => prev.filter(e => e !== email))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', fontSize: 15, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {openShifts.length === 0 && (
                <div style={{ marginTop: 16, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px' }}>
                  <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}>
                    ⚠ No open shifts for {monthLabel}. The email will note this — you can still send it as a courtesy notice.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sending to</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {allRecipients.map(email => (
                    <span key={email} style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                      {email}
                    </span>
                  ))}
                </div>
              </div>

              {/* Email preview card */}
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', fontSize: 13 }}>
                <div style={{ background: '#0D9488', padding: '12px 20px' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>ShiftBridge</span>
                </div>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0D1B2A', margin: '0 0 2px' }}>{facilityName}</p>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>Open Shift Needs — {monthLabel}</p>
                </div>
                <div style={{ padding: '14px 20px' }}>
                  {openShifts.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>No open shifts are currently posted for this month.</p>
                  ) : (
                    CREDENTIAL_ORDER.filter(c => grouped[c]?.length).map(cred => (
                      <div key={cred} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '.07em', borderLeft: '2px solid #0D9488', paddingLeft: 8, marginBottom: 7 }}>
                          {CREDENTIAL_LABELS[cred] ?? cred}
                        </div>
                        {grouped[cred].map(s => {
                          const tier = s.priority_tier ?? 1
                          const bg = tier >= 3 ? '#FFF5F5' : tier === 2 ? '#FFFBEB' : '#F9FAFB'
                          return (
                            <div key={s.id} style={{ marginBottom: 3 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: bg, borderRadius: 5, gap: 8 }}>
                                <span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(s.shift_date)}</span>
                                <span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                                {tier >= 3 && <span style={{ color: '#DC2626', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>★★ Urgent</span>}
                                {tier === 2 && <span style={{ color: '#D97706', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>★ Priority</span>}
                              </div>
                              {s.notes && (
                                <p style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic', margin: '2px 0 2px 12px' }}>↳ {s.notes}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
                <div style={{ padding: '12px 20px 14px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#0D9488', fontWeight: 600, margin: '0 0 6px' }}>Claim These Shifts on ShiftBridge →</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Powered by ShiftBridge</p>
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
                Preview only — actual email may render slightly differently across email clients.
              </p>
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              {result.failed === 0 ? (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12, color: '#16A34A' }}>✓</div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#166534', margin: '0 0 6px' }}>
                    Sent to {result.sent} recipient{result.sent !== 1 ? 's' : ''}
                  </p>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                    The agency will see your open shifts and a link to join ShiftBridge.
                  </p>
                </>
              ) : result.sent === 0 ? (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#92400E', margin: '0 0 6px' }}>
                    Email delivery failed
                  </p>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                    Check that Resend is configured (RESEND_API_KEY / RESEND_FROM_ADDRESS).
                  </p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#92400E', margin: '0 0 6px' }}>
                    Sent to {result.sent} of {result.total}
                  </p>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                    {result.failed} address{result.failed !== 1 ? 'es' : ''} failed to deliver.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          {step === 'compose' && (
            <>
              <button
                onClick={onClose}
                style={{ padding: '9px 18px', border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={allRecipients.length === 0}
                style={{
                  padding: '9px 20px',
                  background: allRecipients.length === 0 ? '#E5E7EB' : '#0D9488',
                  color: allRecipients.length === 0 ? '#9CA3AF' : '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: allRecipients.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Preview Email →
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('compose')}
                style={{ padding: '9px 18px', border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}
              >
                ← Back
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  padding: '9px 20px',
                  background: sending ? '#E5E7EB' : '#0D9488',
                  color: sending ? '#9CA3AF' : '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: sending ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'Sending…' : `Send to ${allRecipients.length} recipient${allRecipients.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              style={{ marginLeft: 'auto', padding: '9px 24px', background: '#0D9488', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

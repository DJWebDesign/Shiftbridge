'use client'

import { useState } from 'react'

const CREDENTIAL_OPTIONS = [
  { value: '', label: 'All Credentials' },
  { value: 'CNA', label: 'CNA' },
  { value: 'CMA', label: 'CMA' },
  { value: 'LPN', label: 'LPN' },
  { value: 'LPN_IV', label: 'LPN (IV)' },
  { value: 'RN', label: 'RN' },
]

interface MassTextModalProps {
  agencyId: string
  onClose: () => void
}

export default function MassTextModal({ agencyId, onClose }: MassTextModalProps) {
  const [credentialType, setCredentialType] = useState('')
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<'compose' | 'confirm' | 'sending' | 'done'>('compose')
  const [result, setResult] = useState<{ totalTargeted: number; notificationsSent: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const MAX_CHARS = 320

  function handleProceed() {
    if (!message.trim()) return
    setStep('confirm')
  }

  async function handleSend() {
    setStep('sending')
    setError(null)
    try {
      const res = await fetch('/api/notifications/mass-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          credentialType: credentialType || null,
          message: message.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send')
        setStep('confirm')
        return
      }
      setResult(data)
      setStep('done')
    } catch {
      setError('Network error — please try again')
      setStep('confirm')
    }
  }

  const credLabel = credentialType
    ? CREDENTIAL_OPTIONS.find(o => o.value === credentialType)?.label
    : 'all nurses'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Send Mass Text</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5">
          {step === 'compose' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Send to
                </label>
                <select
                  value={credentialType}
                  onChange={e => setCredentialType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {CREDENTIAL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
                  rows={5}
                  placeholder="Type your message to nurses..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {message.length}/{MAX_CHARS}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceed}
                  disabled={!message.trim()}
                  className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Review & Send
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 font-medium">
                  You are about to send a text message to <strong>{credLabel}</strong> at your agency.
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  This will also send an in-app notification. This action cannot be undone.
                </p>
              </div>

              <div className="mb-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Message preview</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{message}</p>
              </div>

              {error && (
                <p className="text-sm text-red-600 mb-3">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('compose')}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover"
                >
                  Confirm & Send
                </button>
              </div>
            </>
          )}

          {step === 'sending' && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-teal-200 border-t-brand rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-600">Sending messages...</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✓</div>
              <p className="font-semibold text-gray-900 mb-1">Messages sent</p>
              <p className="text-sm text-gray-600">
                Sent to <strong>{result.totalTargeted}</strong> nurse{result.totalTargeted !== 1 ? 's' : ''}
                {' '}({result.notificationsSent} notification{result.notificationsSent !== 1 ? 's' : ''} dispatched)
              </p>
              <button
                onClick={onClose}
                className="mt-5 px-6 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

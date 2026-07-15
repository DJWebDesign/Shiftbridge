'use client'

import { useState } from 'react'

export default function SeedPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  async function run() {
    setStatus('running')
    const res = await fetch('/api/seed', { method: 'POST' })
    const data = await res.json()
    setResult(data)
    setStatus(data.ok ? 'done' : 'error')
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="font-serif text-2xl mb-2" style={{ color: '#0D1B2A' }}>Seed Test Data</h1>
      <p className="text-sm mb-6" style={{ color: '#5B6B80' }}>
        Creates 3 facilities, 5 test nurses (one per credential), ~25 open shifts, and 2 placeholder facilities.
        Safe to run multiple times — existing records are skipped.
      </p>

      <button
        onClick={run}
        disabled={status === 'running'}
        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
        style={{ background: '#0D9488' }}
      >
        {status === 'running' ? 'Seeding…' : 'Run Seed'}
      </button>

      {result && (
        <div
          className="mt-6 rounded-xl p-5 text-sm font-mono whitespace-pre-wrap overflow-auto"
          style={{
            background: status === 'done' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${status === 'done' ? '#BBF7D0' : '#FECACA'}`,
            color: '#0D1B2A',
          }}
        >
          {JSON.stringify(result, null, 2)}
        </div>
      )}
    </div>
  )
}

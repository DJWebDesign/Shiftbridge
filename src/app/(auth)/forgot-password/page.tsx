'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(13,148,136,0.12)' }}
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#0D9488' }}>
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-serif text-[24px] mb-2" style={{ color: '#0D1B2A' }}>Check your email</h2>
        <p className="text-[14px] mb-6" style={{ color: '#5B6B80' }}>
          If an account exists for <strong>{email}</strong>, a reset link is on its way.
        </p>
        <Link href="/login" className="text-[14px] font-medium" style={{ color: '#0D9488' }}>
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-[30px] leading-tight mb-1" style={{ color: '#0D1B2A' }}>
        Reset password
      </h1>
      <p className="text-[14px] mb-8" style={{ color: '#5B6B80' }}>
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-[13px] font-semibold mb-1.5" style={{ color: '#0D1B2A' }}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg text-[14px] outline-none transition-all"
            style={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = '#0D9488'; (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E4EAF0'; (e.target as HTMLElement).style.boxShadow = 'none' }}
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg text-[14px] font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: '#0D9488' }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0F766E' }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0D9488' }}
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>

        <p className="text-center text-[13px]" style={{ color: '#5B6B80' }}>
          <Link href="/login" className="font-medium" style={{ color: '#0D9488' }}>
            ← Back to sign in
          </Link>
        </p>
      </form>
    </div>
  )
}

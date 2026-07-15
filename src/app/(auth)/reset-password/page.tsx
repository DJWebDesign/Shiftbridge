'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const hash = window.location.hash
    const params = new URLSearchParams(hash.slice(1))
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type         = params.get('type')

    if (type === 'recovery' && accessToken && refreshToken) {
      // Set the session from the hash tokens directly
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setError('This link has expired. Ask your agency admin to resend the invite.')
          }
          setReady(true)
        })
    } else {
      // No hash tokens — link may have already been used or is invalid
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true)
        } else {
          setError('This link has expired. Ask your agency admin to resend the invite.')
          setReady(true)
        }
      })
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(`Failed to set password: ${error.message}`)
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => { window.location.href = '/' }, 2000)
  }

  const inputStyle = { border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }

  if (done) {
    return (
      <div>
        <h1 className="font-serif text-[30px] leading-tight mb-1" style={{ color: '#0D1B2A' }}>
          Password set!
        </h1>
        <p className="text-[14px]" style={{ color: '#5B6B80' }}>
          Signing you in…
        </p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div>
        <h1 className="font-serif text-[30px] leading-tight mb-1" style={{ color: '#0D1B2A' }}>
          Set new password
        </h1>
        <p className="text-[14px]" style={{ color: '#5B6B80' }}>
          Verifying your link…
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-[30px] leading-tight mb-1" style={{ color: '#0D1B2A' }}>
        Set your password
      </h1>
      <p className="text-[14px] mb-8" style={{ color: '#5B6B80' }}>
        Must be at least 8 characters.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {(['New password', 'Confirm password'] as const).map((label, i) => (
          <div key={label}>
            <label className="block text-[13px] font-semibold mb-1.5" style={{ color: '#0D1B2A' }}>
              {label}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={i === 0 ? password : confirm}
              onChange={e => i === 0 ? setPassword(e.target.value) : setConfirm(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg text-[14px] outline-none transition-all"
              style={inputStyle}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = '#0D9488'; (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E4EAF0'; (e.target as HTMLElement).style.boxShadow = 'none' }}
              placeholder="••••••••"
            />
          </div>
        ))}

        {error && (
          <div className="px-4 py-3 rounded-lg text-[13px]"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg text-[14px] font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: '#0D9488' }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0F766E' }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0D9488' }}
        >
          {loading ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)

  async function handleLaunchDemo() {
    setDemoError(null)
    setLaunching(true)
    try {
      const res = await fetch('/api/demo/launch', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setDemoError(data.error ?? 'Failed to launch demo. Please try again.')
        setLaunching(false)
        return
      }
      const supabase = createClient()
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (signInErr) {
        setDemoError('Demo account created but sign-in failed. Please try again.')
        setLaunching(false)
        return
      }
      window.location.href = '/demo'
    } catch {
      setDemoError('Something went wrong. Please try again.')
      setLaunching(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <div>
      <h1 className="font-serif text-[30px] leading-tight mb-1" style={{ color: '#0D1B2A' }}>
        Welcome back
      </h1>
      <p className="text-[14px] mb-8" style={{ color: '#5B6B80' }}>
        Sign in to your ShiftBridge account
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
            style={{
              border: '1px solid #E4EAF0',
              background: '#fff',
              color: '#0D1B2A',
            }}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = '#0D9488'; (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E4EAF0'; (e.target as HTMLElement).style.boxShadow = 'none' }}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-[13px] font-semibold" style={{ color: '#0D1B2A' }}>
              Password
            </label>
            <Link href="/forgot-password" className="text-[13px] font-medium transition-colors"
              style={{ color: '#0D9488' }}>
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg text-[14px] outline-none transition-all"
            style={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = '#0D9488'; (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E4EAF0'; (e.target as HTMLElement).style.boxShadow = 'none' }}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-[13px]"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg text-[14px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: loading ? '#0F766E' : '#0D9488' }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0F766E' }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0D9488' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-[13px] mt-8" style={{ color: '#5B6B80' }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium" style={{ color: '#0D9488' }}>Sign up</Link>
      </p>

      {/* Demo launcher */}
      <div className="mt-6 pt-6" style={{ borderTop: '1px solid #E4EAF0' }}>
        <p className="text-center text-[12.5px] mb-3" style={{ color: '#8A99A8' }}>
          Want to explore first?
        </p>
        <button
          onClick={handleLaunchDemo}
          disabled={launching || loading}
          className="w-full py-2.5 rounded-lg text-[13.5px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            border: '1.5px solid #0D9488',
            color: '#0D9488',
            background: 'transparent',
          }}
          onMouseEnter={e => { if (!launching && !loading) (e.currentTarget as HTMLElement).style.background = 'rgba(13,148,136,0.06)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          {launching ? 'Setting up your demo...' : 'Launch Interactive Demo →'}
        </button>
        {demoError && (
          <p className="text-center text-[12px] mt-2" style={{ color: '#B91C1C' }}>{demoError}</p>
        )}
      </div>
    </div>
  )
}

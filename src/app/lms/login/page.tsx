'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('expired') === 'true') setSessionExpired(true)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn('credentials', {
    email,
    password,
    redirect: false,
  })
      if (result?.error) {
  setError(
    result.error === 'CredentialsSignin'
      ? 'Invalid email or password'
      : result.error
  )
} else {
  window.location.href = '/dashboard'
}
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-trustiva-navy text-white flex flex-col lg:flex-row">
      {/* Left — branding (desktop) / top (mobile) */}
      <section className="relative flex flex-col justify-center px-6 py-10 lg:w-1/2 lg:px-12 lg:py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-trustiva-panel via-trustiva-navy to-black opacity-90" />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-trustiva-lime/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-lg mx-auto lg:mx-0 text-center lg:text-left">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-trustiva-lime text-trustiva-navy font-bold text-xl shadow-lg mb-6">
            T
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
            Trustiva Setu
          </h1>
          <p className="mt-2 text-trustiva-lime font-semibold text-sm sm:text-base">
            Healthcare Partner Console
          </p>
          <p className="mt-4 text-trustiva-muted text-sm sm:text-base leading-relaxed max-w-md mx-auto lg:mx-0">
            Lead management, clinic onboarding, lender approvals — all in one dashboard.
          </p>

          <ul className="hidden sm:flex flex-col gap-3 mt-8 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-trustiva-lime" />
              Region-wise data & RM panels
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-trustiva-lime" />
              Real-time leads & analytics
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-trustiva-lime" />
              Secure @trustivasetu.com access
            </li>
          </ul>
        </div>
      </section>

      {/* Right — login form */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:px-12 bg-trustiva-navy lg:bg-trustiva-panel/50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <p className="text-trustiva-lime text-xs font-semibold uppercase tracking-wider">Sign in</p>
            <h2 className="text-xl font-bold mt-1">Trustiva Setu LMS</h2>
          </div>

          <div className="bg-trustiva-panel border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8">
            <h2 className="hidden lg:block text-xl font-semibold text-white mb-1">Sign in</h2>
            <p className="hidden lg:block text-trustiva-muted text-sm mb-6">
              Use your Trustiva Setu official email
            </p>

            {sessionExpired && (
              <div className="mb-4 p-3 bg-amber-500/15 border border-amber-400/40 rounded-lg text-sm text-amber-200 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Session expired due to inactivity. Please sign in again.
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-500/15 border border-red-400/40 rounded-lg text-sm text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@trustivasetu.com"
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime/60 focus:border-trustiva-lime/40 transition"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Enter password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime/60 focus:border-trustiva-lime/40 transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-trustiva-lime hover:bg-trustiva-lime-dark text-trustiva-navy font-bold py-3 px-4 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {loading ? (
                  <>
                    <svg width="18" height="18" className="animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
              <div className="text-center pt-1">
                <a href="/lms/forgot-password"
                  className="text-sm text-trustiva-muted hover:text-trustiva-lime transition">
                  Forgot Password?
                </a>
              </div>
            </form>
<p className="text-xs text-trustiva-muted text-center mt-6">
  Secure access for authorized Trustiva Setu users only.
</p>
            
          </div>

          <p className="text-center text-[11px] text-slate-500 mt-6">
            Desktop: split view · Mobile: stacked layout
          </p>
        </div>
      </section>
    </div>
  )
}

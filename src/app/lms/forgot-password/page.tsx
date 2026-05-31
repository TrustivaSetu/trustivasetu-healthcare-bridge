'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [email, setEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCountdown() {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current!); return 0 } return c - 1 })
    }, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault()
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to send OTP'); setLoading(false); return }
    if (data._devOtp) setDevOtp(data._devOtp)
    setStep(2)
    startCountdown()
    setLoading(false)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!emailOtp || emailOtp.length !== 6) { setError('Enter the 6-digit OTP from your email.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/verify-reset-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, emailOtp }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Invalid OTP'); setLoading(false); return }
    setStep(3); setLoading(false)
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, newPassword }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to reset password'); setLoading(false); return }
    setStep(3); setLoading(false)
    // Success — redirect after 3 seconds
    setTimeout(() => router.push('/lms/login'), 3000)
  }

  const steps = ['Verify Email', 'Enter OTP', 'New Password']
  const isSuccess = step === 3 && !loading && !error && newPassword && newPassword === confirmPassword

  return (
    <div className="min-h-screen bg-trustiva-navy flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-trustiva-lime text-trustiva-navy font-bold text-lg shadow-lg mb-3">T</div>
          <p className="text-white font-bold text-lg">Trustiva Setu LMS</p>
          <p className="text-trustiva-muted text-sm mt-1">Password Recovery</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((label, i) => {
            const s = (i + 1) as Step
            const isActive = step === s
            const isDone = step > s
            return (
              <div key={s} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    isDone ? 'bg-trustiva-lime text-trustiva-navy' : isActive ? 'bg-white text-trustiva-navy' : 'bg-white/10 text-slate-400'
                  }`}>
                    {isDone ? '✓' : s}
                  </div>
                  <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-slate-400'}`}>{label}</span>
                </div>
                {i < steps.length - 1 && <div className={`w-8 h-px ${step > s ? 'bg-trustiva-lime' : 'bg-white/20'}`} />}
              </div>
            )
          })}
        </div>

        <div className="bg-trustiva-panel border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8">

          {/* STEP 1 — Email */}
          {step === 1 && (
            <form onSubmit={sendOtp} className="space-y-5">
              <div>
                <h2 className="text-white text-lg font-semibold mb-1">Forgot Password?</h2>
                <p className="text-trustiva-muted text-sm">Enter your registered email to receive an OTP.</p>
              </div>
              {error && <div className="p-3 bg-red-500/15 border border-red-400/40 rounded-lg text-sm text-red-200">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Registered Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                  placeholder="you@trustivasetu.com"
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime/60 transition" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-trustiva-lime hover:opacity-90 text-trustiva-navy font-bold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                {loading ? <><Spinner />Sending OTP...</> : 'Send OTP'}
              </button>
              <div className="text-center">
                <Link href="/lms/login" className="text-sm text-trustiva-muted hover:text-white transition">← Back to Login</Link>
              </div>
            </form>
          )}

          {/* STEP 2 — OTP */}
          {step === 2 && (
            <form onSubmit={verifyOtp} className="space-y-5">
              <div>
                <h2 className="text-white text-lg font-semibold mb-1">Enter OTP</h2>
                <p className="text-trustiva-muted text-sm">
                  A 6-digit OTP has been sent to <strong className="text-white">{email}</strong>.
                  {' '}Valid for 10 minutes.
                </p>
              </div>
              {devOtp && (
                <div className="p-3 bg-amber-500/15 border border-amber-400/40 rounded-lg text-sm text-amber-200">
                  Dev mode OTP: <strong className="font-mono text-base tracking-widest">{devOtp}</strong>
                </div>
              )}
              {error && <div className="p-3 bg-red-500/15 border border-red-400/40 rounded-lg text-sm text-red-200">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email OTP (6 digits)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  value={emailOtp} onChange={e => { setEmailOtp(e.target.value.replace(/\D/g, '')); setError('') }}
                  placeholder="______" autoFocus
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-500 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-trustiva-lime/60 transition" />
              </div>
              <button type="submit" disabled={loading || emailOtp.length !== 6}
                className="w-full bg-trustiva-lime hover:opacity-90 text-trustiva-navy font-bold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                {loading ? <><Spinner />Verifying...</> : 'Verify OTP'}
              </button>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => { setStep(1); setEmailOtp(''); setError('') }}
                  className="text-sm text-trustiva-muted hover:text-white transition">← Back</button>
                {countdown > 0 ? (
                  <span className="text-sm text-trustiva-muted">Resend in {countdown}s</span>
                ) : (
                  <button type="button" onClick={() => { sendOtp(); setEmailOtp('') }}
                    className="text-sm text-trustiva-lime hover:opacity-80 transition">Resend OTP</button>
                )}
              </div>
            </form>
          )}

          {/* STEP 3 — New Password or Success */}
          {step === 3 && isSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center text-3xl mx-auto">✓</div>
              <h2 className="text-white text-lg font-semibold">Password Changed!</h2>
              <p className="text-trustiva-muted text-sm">Your password has been updated successfully. Redirecting to login in 3 seconds...</p>
              <Link href="/lms/login" className="text-sm text-trustiva-lime hover:opacity-80 transition">Go to Login →</Link>
            </div>
          ) : step === 3 && (
            <form onSubmit={resetPassword} className="space-y-5">
              <div>
                <h2 className="text-white text-lg font-semibold mb-1">Set New Password</h2>
                <p className="text-trustiva-muted text-sm">Choose a strong password (minimum 8 characters).</p>
              </div>
              {error && <div className="p-3 bg-red-500/15 border border-red-400/40 rounded-lg text-sm text-red-200">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
                <input type="password" value={newPassword} onChange={e => { setNewPassword(e.target.value); setError('') }}
                  required minLength={8} placeholder="Minimum 8 characters" autoFocus
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime/60 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  required placeholder="Re-enter password"
                  className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 transition ${
                    confirmPassword && confirmPassword !== newPassword ? 'border-red-400/60 focus:ring-red-400/40' : 'border-white/15 focus:ring-trustiva-lime/60'
                  }`} />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-300 mt-1">Passwords do not match</p>
                )}
              </div>
              {/* Password strength indicator */}
              <PasswordStrength password={newPassword} />
              <button type="submit" disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="w-full bg-trustiva-lime hover:opacity-90 text-trustiva-navy font-bold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                {loading ? <><Spinner />Changing Password...</> : 'Change Password'}
              </button>
              <button type="button" onClick={() => { setStep(2); setError('') }}
                className="w-full text-center text-sm text-trustiva-muted hover:text-white transition">← Back</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" className="animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-400']
  return (
    <div>
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= score ? colors[score] : 'bg-white/15'}`} />
        ))}
      </div>
      <p className="text-xs text-slate-400">{labels[score]}</p>
    </div>
  )
}

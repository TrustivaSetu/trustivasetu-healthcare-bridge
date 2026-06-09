'use client'

// Set to false to restore real OTP + lead submission flow
const TESTING_MODE = true

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface ClinicData {
  id: string
  name: string
  externalId: string
  address: string
}

type Step = 'form' | 'otp' | 'done'

function LeadForm() {
  const searchParams = useSearchParams()
  const clinicParam = searchParams.get('clinic')

  const [clinic, setClinic] = useState<ClinicData | null>(null)
  const [clinicError, setClinicError] = useState('')
  const [clinicLoading, setClinicLoading] = useState(!!clinicParam)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')

  const [step, setStep] = useState<Step>('form')
  const [otpValue, setOtpValue] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refId, setRefId] = useState('')

  // Pre-fill OTP with 123456 when testing mode and user reaches OTP step via real Send OTP button
  useEffect(() => {
    if (TESTING_MODE && step === 'otp') setOtpValue('123456')
  }, [step])

  useEffect(() => {
    if (!clinicParam) { setClinicLoading(false); return }
    fetch(`/api/public/clinic/${encodeURIComponent(clinicParam)}`)
      .then(r => r.json())
      .then(d => {
        if (d.data) setClinic(d.data)
        else setClinicError('Invalid clinic link. Please scan the QR code again.')
      })
      .catch(() => setClinicError('Could not load clinic info. Please try again.'))
      .finally(() => setClinicLoading(false))
  }, [clinicParam])

  // Step 1: validate form and send OTP
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!clinic) return
    if (!consent) { setError('Please accept the terms to proceed.'); return }
    if (phone.length !== 10) { setError('Please enter a valid 10-digit mobile number.'); return }
    const amt = parseFloat(amount)
    if (!amt || amt < 1000) { setError('Minimum loan amount is ₹1,000.'); return }

    setOtpSending(true)
    setError('')
    try {
      const res = await fetch('/api/public/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (res.ok) {
        setStep('otp')
        setOtpValue('')
      } else {
        setError(data.error ?? 'Failed to send OTP. Please try again.')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setOtpSending(false)
    }
  }

  async function handleResendOtp() {
    setOtpSending(true)
    setError('')
    try {
      const res = await fetch('/api/public/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed to resend OTP.')
    } catch {
      setError('Network error.')
    } finally {
      setOtpSending(false)
    }
  }

  // Step 2: verify OTP then submit lead
  async function handleVerifyAndSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (otpValue.length !== 6) { setError('Please enter the 6-digit OTP.'); return }

    // TESTING_MODE: bypass OTP verify + lead submission — client-side only
    if (TESTING_MODE && otpValue === '123456') {
      setRefId('DEV-' + Math.random().toString(36).slice(2, 8).toUpperCase())
      setStep('done')
      return
    }

    setOtpVerifying(true)
    setError('')
    try {
      const verifyRes = await fetch('/api/public/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otpValue }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyData.verified) {
        setError(verifyData.message ?? 'Incorrect OTP. Please try again.')
        setOtpVerifying(false)
        return
      }

      setSubmitting(true)
      const res = await fetch('/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: clinic!.id,
          applicantName: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          amount: parseFloat(amount),
          treatmentName: purpose.trim() || undefined,
          source: 'QR',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setRefId(data.referenceId)
        setStep('done')
      } else {
        setError(data.error ?? 'Submission failed. Please try again.')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setOtpVerifying(false)
      setSubmitting(false)
    }
  }

  if (clinicLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#07111f]">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-[#bef264] border-t-transparent" />
      </div>
    )
  }

  if (clinicError) {
    return (
      <div className="min-h-screen bg-[#07111f] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Invalid QR Code</h2>
          <p className="text-sm text-gray-500">{clinicError}</p>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#07111f] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Application Submitted!</h2>
          <p className="text-sm text-gray-500 mb-4">
            Thank you! Our team will contact you shortly.
          </p>
          <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-gray-400">Reference ID</p>
            <p className="font-mono font-bold text-lg text-gray-800">{refId}</p>
          </div>
          <p className="text-xs text-gray-400">Please save your reference ID. Our team will call you within 2 hours.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07111f]">
      {/* Header */}
      <div className="px-4 py-5 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#bef264] text-[#07111f] font-bold text-lg shadow-lg mb-3">
          T
        </div>
        <h1 className="text-white font-bold text-xl">Trustiva Setu</h1>
        <p className="text-[#bef264] text-sm font-medium">Healthcare Loan Assistance</p>
      </div>

      {/* Clinic badge */}
      {clinic && (
        <div className="mx-4 mb-4">
          <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#bef264] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[#07111f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{clinic.name}</p>
              <p className="text-white/60 text-xs">{clinic.address}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form card */}
      <div className="mx-4 mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6">

          {/* ── Step 1: Application Form ── */}
          {step === 'form' && (
            <>
              <h2 className="text-gray-800 font-bold text-lg mb-1">Apply for Medical Loan</h2>
              <p className="text-gray-500 text-sm mb-5">Fill in your details to get started</p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="As per Aadhaar card"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bef264]/60 focus:border-[#bef264]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Mobile Number *</label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 shrink-0">+91</span>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit number"
                      maxLength={10}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bef264]/60 focus:border-[#bef264]"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">OTP will be sent to this number</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email Address <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bef264]/60 focus:border-[#bef264]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Loan Amount Required *</label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 shrink-0">₹</span>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      min="1000"
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bef264]/60 focus:border-[#bef264]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Purpose <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    placeholder="e.g. Dental treatment, IVF, Eye surgery"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bef264]/60 focus:border-[#bef264]"
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#07111f]"
                  />
                  <span className="text-xs text-gray-500 leading-relaxed">
                    I agree to share my details with Trustiva Setu and its partner lenders for loan processing. I have read the{' '}
                    <a href="/privacy-policy" target="_blank" className="text-blue-600 underline">Privacy Policy</a> and{' '}
                    <a href="/terms" target="_blank" className="text-blue-600 underline">Terms</a>.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={otpSending || !consent}
                  className="w-full bg-[#07111f] text-[#bef264] font-bold py-3.5 rounded-xl hover:bg-[#0d1f38] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {otpSending ? 'Sending OTP...' : 'Verify Mobile & Continue →'}
                </button>

                {TESTING_MODE && (
                  <div className="space-y-2 pt-1">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                      ⚠️ Testing Mode — Not a real credit application.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRefId('DEV-' + Math.random().toString(36).slice(2, 8).toUpperCase())
                        setStep('done')
                      }}
                      className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-400 text-sm hover:bg-gray-50 transition"
                    >
                      ⚡ Skip OTP (Dev Mode)
                    </button>
                  </div>
                )}
              </form>
            </>
          )}

          {/* ── Step 2: OTP Verification ── */}
          {step === 'otp' && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-[#bef264]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-[#07111f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-gray-800 font-bold text-lg mb-1">Verify Your Mobile</h2>
                <p className="text-gray-500 text-sm">
                  OTP sent to <span className="font-semibold text-gray-700">+91 {phone}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}

              {TESTING_MODE && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  ⚡ Testing Mode — OTP pre-filled with <strong>123456</strong>. Click Submit to proceed.
                </div>
              )}

              <form onSubmit={handleVerifyAndSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Enter 6-Digit OTP</label>
                  <input
                    type="tel"
                    value={otpValue}
                    onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    maxLength={6}
                    autoFocus
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#bef264]/60 focus:border-[#bef264]"
                  />
                  <p className="text-xs text-gray-400 mt-1.5 text-center">OTP is valid for 5 minutes</p>
                </div>

                <button
                  type="submit"
                  disabled={otpVerifying || submitting || otpValue.length !== 6}
                  className="w-full bg-[#07111f] text-[#bef264] font-bold py-3.5 rounded-xl hover:bg-[#0d1f38] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {submitting ? 'Submitting Application...' : otpVerifying ? 'Verifying...' : 'Submit Application →'}
                </button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setStep('form'); setError(''); setOtpValue('') }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition"
                  >
                    ← Change Number
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpSending}
                    className="text-xs text-[#07111f] font-semibold hover:underline disabled:opacity-50 transition"
                  >
                    {otpSending ? 'Sending...' : 'Resend OTP'}
                  </button>
                </div>
              </form>
            </>
          )}

          <p className="text-center text-[11px] text-gray-400 mt-4 leading-relaxed">
            Trustiva Setu is a loan facilitation platform. Loans are provided by partner banks and NBFCs.
            Approval at lender&apos;s discretion.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LeadPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#07111f]">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-[#bef264] border-t-transparent" />
      </div>
    }>
      <LeadForm />
    </Suspense>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// ─── India Post pincode API ──────────────────────────────────────────────────
async function fetchCityByPincode(pincode: string): Promise<{ city: string; state: string } | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
    if (!res.ok) return null
    const data = await res.json() as Array<{
      Status: string
      PostOffice: Array<{ District: string; State: string }> | null
    }>
    if (data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
      return { city: data[0].PostOffice[0].District, state: data[0].PostOffice[0].State }
    }
    return null
  } catch {
    return null
  }
}

function calcOffer(amount: number) {
  const eligible = Math.min(Math.max(amount || 100000, 50000), 500000)
  return { eligible, rate: 14, fee: Math.round(eligible * 0.02) }
}

function calcEmi(amount: number, rate: number, months: number) {
  const r = rate / 12 / 100
  if (r === 0) return Math.round(amount / months)
  return Math.round((amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1))
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface Clinic { id: string; name: string }

interface Props {
  initial?: Partial<{
    id: string; applicantName: string; phone: string; clinicId: string
    amount: number; status: string; treatmentName: string; remarks: string
  }>
  onSuccess: () => void
  onCancel: () => void
}

const STEP_LABELS = ['Basic Details', 'PAN & Employment', 'Address', 'Offer & Decision']
const EMI_TENURES = [6, 12, 18, 24, 36]

// ─── Component ──────────────────────────────────────────────────────────────
export function LeadForm({ initial, onSuccess, onCancel }: Props) {
  const isEdit = !!initial?.id
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [clinics, setClinics] = useState<Clinic[]>([])

  // Step 1
  const [clinicId, setClinicId] = useState(initial?.clinicId ?? '')
  const [applicantName, setApplicantName] = useState(initial?.applicantName ?? '')
  const [mobile, setMobile] = useState(initial?.phone ?? '')
  const [treatmentName, setTreatmentName] = useState(initial?.treatmentName ?? '')
  const [loanAmount, setLoanAmount] = useState(initial?.amount ? String(initial.amount) : '')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [mobileVerified, setMobileVerified] = useState(isEdit)
  const [otpTimer, setOtpTimer] = useState(0)
  const [tcChecked, setTcChecked] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)

  // Step 2
  const [panNumber, setPanNumber] = useState('')
  const [panVerified, setPanVerified] = useState<boolean | null>(null)
  const [panLoading, setPanLoading] = useState(false)
  const [employmentType, setEmploymentType] = useState<'SALARIED' | 'SELF_EMPLOYED' | ''>('')
  const [email, setEmail] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [empPincode, setEmpPincode] = useState('')
  const [empCity, setEmpCity] = useState('')
  const [empCityLoading, setEmpCityLoading] = useState(false)
  const [empPincodeErr, setEmpPincodeErr] = useState('')

  // Step 3
  const [houseNo, setHouseNo] = useState('')
  const [street, setStreet] = useState('')
  const [landmark, setLandmark] = useState('')
  const [pincode, setPincode] = useState('')
  const [city, setCity] = useState('')
  const [cityLoading, setCityLoading] = useState(false)
  const [pincodeErr, setPincodeErr] = useState('')
  const [sameAddress, setSameAddress] = useState(false)
  const [permHouseNo, setPermHouseNo] = useState('')
  const [permStreet, setPermStreet] = useState('')
  const [permLandmark, setPermLandmark] = useState('')
  const [permPincode, setPermPincode] = useState('')
  const [permCity, setPermCity] = useState('')
  const [permCityLoading, setPermCityLoading] = useState(false)
  const [permPincodeErr, setPermPincodeErr] = useState('')

  // Step 4
  const [step4Loading, setStep4Loading] = useState(true)
  const [offer, setOffer] = useState<{ eligible: number; rate: number; fee: number } | null>(null)
  const [tenure, setTenure] = useState(12)
  const [kycDone, setKycDone] = useState(false)
  const [nachDone, setNachDone] = useState(false)
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [showAgreement, setShowAgreement] = useState(false)
  const [enhancementTab, setEnhancementTab] = useState<'aa' | 'netbanking' | 'upload'>('aa')
  const [enhancedOffer, setEnhancedOffer] = useState<{ eligible: number; rate: number; fee: number } | null>(null)
  const [processingEnhancement, setProcessingEnhancement] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [applicationId, setApplicationId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/clinics?minimal=1').then(r => r.json()).then(d => setClinics(d.data ?? []))
  }, [])

  // OTP timer countdown
  useEffect(() => {
    if (otpTimer <= 0) return
    const t = setTimeout(() => setOtpTimer(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [otpTimer])

  // Step 4 skeleton loader (2 sec)
  useEffect(() => {
    if (step !== 4) return
    setStep4Loading(true)
    setOffer(null)
    const t = setTimeout(() => {
      setOffer(calcOffer(parseFloat(loanAmount) || 100000))
      setStep4Loading(false)
    }, 2000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Pincode → city (India Post API)
  useEffect(() => {
    if (pincode.length !== 6) { setCity(''); setPincodeErr(''); return }
    setCityLoading(true); setPincodeErr('')
    fetchCityByPincode(pincode)
      .then(r => { setCity(r ? r.city : ''); if (!r) setPincodeErr('Invalid PIN Code') })
      .catch(() => { setCity(''); setPincodeErr('Could not fetch city') })
      .finally(() => setCityLoading(false))
  }, [pincode])

  useEffect(() => {
    if (empPincode.length !== 6) { setEmpCity(''); setEmpPincodeErr(''); return }
    setEmpCityLoading(true); setEmpPincodeErr('')
    fetchCityByPincode(empPincode)
      .then(r => { setEmpCity(r ? r.city : ''); if (!r) setEmpPincodeErr('Invalid PIN Code') })
      .catch(() => { setEmpCity(''); setEmpPincodeErr('Could not fetch city') })
      .finally(() => setEmpCityLoading(false))
  }, [empPincode])

  useEffect(() => {
    if (sameAddress || permPincode.length !== 6) { if (!sameAddress) { setPermCity(''); setPermPincodeErr('') } return }
    setPermCityLoading(true); setPermPincodeErr('')
    fetchCityByPincode(permPincode)
      .then(r => { setPermCity(r ? r.city : ''); if (!r) setPermPincodeErr('Invalid PIN Code') })
      .catch(() => { setPermCity(''); setPermPincodeErr('Could not fetch city') })
      .finally(() => setPermCityLoading(false))
  }, [permPincode, sameAddress])

  // Same address copy
  useEffect(() => {
    if (!sameAddress) return
    setPermHouseNo(houseNo); setPermStreet(street); setPermLandmark(landmark)
    setPermPincode(pincode); setPermCity(city)
  }, [sameAddress, houseNo, street, landmark, pincode, city])

  // ─── OTP ─────────────────────────────────────────────────────────────────
  async function handleSendOTP() {
    setOtpLoading(true)
    try {
      const res = await fetch('/api/leads/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile }),
      })
      const json = await res.json()
      if (json.success) { setOtpSent(true); setOtpTimer(30); toast.success('OTP sent to +91 ' + mobile) }
      else toast.error(json.error ?? 'Failed to send OTP')
    } catch { toast.error('Failed to send OTP') }
    finally { setOtpLoading(false) }
  }

  function handleOtpChange(idx: number, val: string) {
    const v = val.replace(/\D/g, '').slice(0, 1)
    const next = [...otp]; next[idx] = v; setOtp(next)
    if (v && idx < 5) otpRefs.current[idx + 1]?.focus()
  }

  function handleOtpKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus()
  }

  async function handleVerifyOTP() {
    setOtpLoading(true)
    try {
      const res = await fetch('/api/leads/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile, otp: otp.join('') }),
      })
      const json = await res.json()
      if (json.verified) { setMobileVerified(true); toast.success('Mobile verified! ✅') }
      else toast.error(json.message ?? 'Invalid OTP')
    } catch { toast.error('OTP verification failed') }
    finally { setOtpLoading(false) }
  }

  // ─── PAN ─────────────────────────────────────────────────────────────────
  async function handleVerifyPAN() {
    if (panNumber.length !== 10) { toast.error('Enter a valid 10-character PAN'); return }
    setPanLoading(true)
    try {
      const res = await fetch('/api/leads/verify-pan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pan: panNumber.toUpperCase(), name: applicantName }),
      })
      const json = await res.json()
      setPanVerified(json.verified)
      if (json.verified) toast.success('PAN verified! ✅')
      else toast.error(json.message ?? 'PAN verification failed')
    } catch { toast.error('PAN verify failed') }
    finally { setPanLoading(false) }
  }

  // ─── Enhancement (3 sec mock) ────────────────────────────────────────────
  function handleRequestEnhancement() {
    setProcessingEnhancement(true)
    setTimeout(() => {
      const base = offer?.eligible ?? 100000
      setEnhancedOffer({ eligible: Math.min(Math.round(base * 1.5), 500000), rate: 13, fee: Math.round(base * 1.5 * 0.015) })
      setProcessingEnhancement(false)
      toast.success('Enhanced offer ready! 🎉')
    }, 3000)
  }

  // ─── Final submit ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    try {
      const activeOffer = enhancedOffer ?? offer
      const appId = 'TRV-' + Math.random().toString(36).substring(2, 10).toUpperCase()
      const payload = {
        applicantName, phone: mobile,
        email: email || undefined,
        amount: parseFloat(loanAmount) || 0,
        clinicId, treatmentName,
        applicationDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'PENDING',
        metadata: {
          panNumber, panVerified: panVerified ?? false,
          employmentType, monthlyIncome, companyName, empPincode, empCity,
          currentAddress: { houseNo, street, landmark, pincode, city },
          permanentAddress: sameAddress
            ? { houseNo, street, landmark, pincode, city }
            : { houseNo: permHouseNo, street: permStreet, landmark: permLandmark, pincode: permPincode, city: permCity },
          offer: activeOffer, tenure, emi: calcEmi(activeOffer?.eligible ?? 0, activeOffer?.rate ?? 14, tenure),
          applicationId: appId,
        },
      }
      const url = isEdit ? `/api/leads/${initial!.id}` : '/api/leads'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
      setApplicationId(appId)
      setSubmitted(true)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit')
    } finally { setSubmitting(false) }
  }

  const mobileValid = /^[6-9]\d{9}$/.test(mobile)
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  const activeOffer = enhancedOffer ?? offer
  const emi = activeOffer ? calcEmi(activeOffer.eligible, activeOffer.rate, tenure) : 0

  // ─── Success screen ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="text-center py-8 space-y-5">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-800">Application Submitted!</h3>
          <p className="text-gray-500 text-sm mt-1">Your application has been successfully received.</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 inline-block mx-auto">
          <p className="text-xs text-green-600 font-medium">Application ID</p>
          <p className="text-2xl font-bold text-green-800 font-mono mt-1 tracking-wider">{applicationId}</p>
        </div>
        <button onClick={onSuccess} className="w-full py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700">
          Done
        </button>
      </div>
    )
  }

  // ─── Stepper ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-start">
        {STEP_LABELS.map((label, idx) => {
          const n = (idx + 1) as 1 | 2 | 3 | 4
          const done = step > n
          const active = step === n
          return (
            <div key={n} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  done ? 'bg-green-600 border-green-600 text-white' :
                  active ? 'border-green-600 text-green-600 bg-white' :
                  'border-gray-300 text-gray-400 bg-white'
                }`}>
                  {done ? '✓' : n}
                </div>
                <span className={`text-[10px] mt-1 text-center leading-tight w-16 ${
                  active ? 'text-green-600 font-semibold' : done ? 'text-green-500' : 'text-gray-400'
                }`}>
                  {label}
                </span>
              </div>
              {idx < 3 && <div className={`flex-1 h-0.5 mb-5 mx-1 ${step > n ? 'bg-green-600' : 'bg-gray-200'}`} />}
            </div>
          )
        })}
      </div>

      {/* ═══════════════ STEP 1: Basic Details ═══════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className={lbl}>Hospital / Clinic</label>
            <select value={clinicId} onChange={e => setClinicId(e.target.value)} className={inp}>
              <option value="">Select Clinic</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className={lbl}>Applicant Full Name *</label>
            <input
              value={applicantName}
              onChange={e => setApplicantName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
              placeholder="Full name (alphabets only)"
              className={inp}
            />
            {applicantName && applicantName.trim().length < 3 &&
              <p className={err}>Minimum 3 characters required</p>}
          </div>

          <div>
            <label className={lbl}>Mobile Number *</label>
            <div className="flex gap-2">
              <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-500 shrink-0">+91</span>
              <input
                value={mobile}
                onChange={e => {
                  setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                  setOtpSent(false); setMobileVerified(false); setOtp(['', '', '', '', '', ''])
                }}
                placeholder="10-digit number" maxLength={10}
                className={`${inp} flex-1`}
                disabled={mobileVerified}
              />
              {!mobileVerified && mobileValid && (
                <button onClick={handleSendOTP} disabled={otpLoading || otpTimer > 0}
                  className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-60 shrink-0">
                  {otpLoading ? '...' : otpTimer > 0 ? `${otpTimer}s` : 'Send OTP'}
                </button>
              )}
            </div>
            {mobile && !mobileValid && <p className={err}>Must start with 6–9 and be 10 digits</p>}
          </div>

          {otpSent && !mobileVerified && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-gray-600">OTP sent to <strong>+91 {mobile}</strong></p>
              <div className="flex gap-2 justify-center">
                {otp.map((d, i) => (
                  <input key={i}
                    ref={el => { otpRefs.current[i] = el }}
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    maxLength={1}
                    className="w-10 h-12 text-center text-lg font-bold border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                  />
                ))}
              </div>
              <button onClick={handleVerifyOTP} disabled={otpLoading || otp.join('').length !== 6}
                className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60">
                {otpLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button onClick={handleSendOTP} disabled={otpTimer > 0 || otpLoading}
                className="w-full text-xs text-green-600 hover:text-green-800 py-1 disabled:text-gray-400 transition-colors">
                {otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'Resend OTP'}
              </button>
            </div>
          )}

          {mobileVerified && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-600">✅</span>
              <span className="text-sm text-green-700 font-medium">Mobile Verified</span>
              {!isEdit && (
                <button onClick={() => { setMobileVerified(false); setOtpSent(false); setOtp(['', '', '', '', '', '']) }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600">Change</button>
              )}
            </div>
          )}

          <div>
            <label className={lbl}>Treatment Name</label>
            <input value={treatmentName} onChange={e => setTreatmentName(e.target.value)}
              placeholder="e.g. LASIK, IVF, Knee Replacement" className={inp} />
          </div>

          <div>
            <label className={lbl}>Required Loan Amount (₹)</label>
            <input type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)}
              placeholder="₹10,000 – ₹10,00,000" className={inp} />
            {loanAmount && (Number(loanAmount) < 10000 || Number(loanAmount) > 1000000) &&
              <p className={err}>Amount must be between ₹10,000 and ₹10,00,000</p>}
            {loanAmount && Number(loanAmount) >= 10000 && Number(loanAmount) <= 1000000 &&
              <p className="text-xs text-gray-500 mt-1">= ₹{Number(loanAmount).toLocaleString('en-IN')}</p>}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={tcChecked} onChange={e => setTcChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 shrink-0" />
              <span className="text-xs text-gray-700 leading-relaxed">
                I confirm the applicant has consented to share personal data with Trustiva Setu and partner lenders.
                I have explained the{' '}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-green-600 underline">Privacy Policy</a>
                {' '}and{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 underline">Terms &amp; Conditions</a>
                {' '}to the applicant.<span className="text-red-500"> *</span>
              </span>
            </label>
          </div>

          <button onClick={() => {
            if (!applicantName || applicantName.trim().length < 3) { toast.error('Enter applicant full name (min 3 chars)'); return }
            if (!mobileValid) { toast.error('Enter a valid 10-digit mobile number starting 6–9'); return }
            if (!mobileVerified) { toast.error('Please verify mobile number via OTP'); return }
            if (!tcChecked) { toast.error('Please accept Terms & Conditions'); return }
            setStep(2)
          }} className="w-full py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition">
            Continue: PAN &amp; Employment →
          </button>
          <button onClick={onCancel} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}

      {/* ═══════════════ STEP 2: PAN & Employment ═══════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className={lbl}>PAN Number *</label>
            <div className="flex gap-2">
              <input
                value={panNumber}
                onChange={e => { setPanNumber(e.target.value.toUpperCase()); setPanVerified(null) }}
                placeholder="AAAAA0000A" maxLength={10}
                className={`${inp} font-mono flex-1`}
              />
              <button onClick={handleVerifyPAN} disabled={panLoading || panNumber.length !== 10}
                className={`px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-60 shrink-0 transition-colors ${
                  panVerified === true ? 'bg-green-100 text-green-700 border border-green-300' :
                  panVerified === false ? 'bg-red-100 text-red-700 border border-red-300' :
                  'bg-green-600 text-white hover:bg-green-700'
                }`}>
                {panLoading ? '...' : panVerified === true ? '✅ Verified' : panVerified === false ? '❌ Failed' : 'Verify'}
              </button>
            </div>
            {panNumber.length === 10 && !panRegex.test(panNumber) &&
              <p className={err}>Invalid PAN format (e.g. ABCDE1234F)</p>}
          </div>

          <div>
            <label className={lbl}>Employment Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {([['SALARIED', '🏢', 'Salaried'], ['SELF_EMPLOYED', '💼', 'Self-Employed']] as const).map(([val, icon, label]) => (
                <button key={val} type="button" onClick={() => setEmploymentType(val)}
                  className={`py-4 px-4 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                    employmentType === val ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  <span className="text-2xl">{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Email ID</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="applicant@email.com" className={inp} />
          </div>

          <div>
            <label className={lbl}>{employmentType === 'SELF_EMPLOYED' ? 'Monthly Business Income (₹)' : 'Monthly Salary (₹)'}</label>
            <input type="number" value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)}
              placeholder="e.g. 50000" className={inp} />
          </div>

          <div>
            <label className={lbl}>{employmentType === 'SELF_EMPLOYED' ? 'Business Name' : 'Company Name'}</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder={employmentType === 'SELF_EMPLOYED' ? 'Your business name' : 'Your employer name'}
              className={inp} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Employment PIN Code</label>
              <input value={empPincode} onChange={e => setEmpPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit" maxLength={6} className={inp} />
              {empPincodeErr && <p className={err}>{empPincodeErr}</p>}
            </div>
            <div>
              <label className={lbl}>City</label>
              <div className="relative">
                <input value={empCityLoading ? '' : empCity} readOnly
                  placeholder={empCityLoading ? 'Fetching...' : 'Auto-filled'}
                  className={`${inp} bg-gray-50 text-gray-500`} />
                {empCityLoading && <Spinner />}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep(1)} className={back}>← Back</button>
            <button onClick={() => {
              if (!panNumber) { toast.error('PAN number is required'); return }
              if (!employmentType) { toast.error('Select employment type'); return }
              setStep(3)
            }} className={next}>Continue: Address →</button>
          </div>
          <button onClick={onCancel} className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}

      {/* ═══════════════ STEP 3: Address ═══════════════ */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700 border-b pb-2">Current Address</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>House No. / Floor No.</label>
              <input value={houseNo} onChange={e => setHouseNo(e.target.value)} placeholder="e.g. 12B, Floor 3" className={inp} />
            </div>
            <div>
              <label className={lbl}>Street / Locality</label>
              <input value={street} onChange={e => setStreet(e.target.value)} placeholder="Street name" className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Landmark</label>
            <input value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Nearby landmark" className={inp} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>PIN Code</label>
              <input value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit" maxLength={6} className={inp} />
              {pincodeErr && <p className={err}>{pincodeErr}</p>}
            </div>
            <div>
              <label className={lbl}>City</label>
              <div className="relative">
                <input value={cityLoading ? '' : city} readOnly
                  placeholder={cityLoading ? 'Fetching...' : 'Auto-filled'}
                  className={`${inp} bg-gray-50 text-gray-500`} />
                {cityLoading && <Spinner />}
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Permanent Address</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sameAddress} onChange={e => setSameAddress(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600" />
                <span className="text-xs text-gray-600">Same as Current Address</span>
              </label>
            </div>

            {sameAddress ? (
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-0.5">
                <p>{[houseNo, street].filter(Boolean).join(', ')}</p>
                {landmark && <p>{landmark}</p>}
                <p>{[city, pincode].filter(Boolean).join(' – ')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>House No. / Floor No.</label>
                    <input value={permHouseNo} onChange={e => setPermHouseNo(e.target.value)} placeholder="e.g. 12B" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Street / Locality</label>
                    <input value={permStreet} onChange={e => setPermStreet(e.target.value)} placeholder="Street name" className={inp} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Landmark</label>
                  <input value={permLandmark} onChange={e => setPermLandmark(e.target.value)} placeholder="Nearby landmark" className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>PIN Code</label>
                    <input value={permPincode} onChange={e => setPermPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit" maxLength={6} className={inp} />
                    {permPincodeErr && <p className={err}>{permPincodeErr}</p>}
                  </div>
                  <div>
                    <label className={lbl}>City</label>
                    <div className="relative">
                      <input value={permCityLoading ? '' : permCity} readOnly
                        placeholder={permCityLoading ? 'Fetching...' : 'Auto-filled'}
                        className={`${inp} bg-gray-50 text-gray-500`} />
                      {permCityLoading && <Spinner />}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep(2)} className={back}>← Back</button>
            <button onClick={() => setStep(4)} className={next}>Continue: Offer →</button>
          </div>
          <button onClick={onCancel} className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}

      {/* ═══════════════ STEP 4: Offer & Decision ═══════════════ */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Skeleton */}
          {step4Loading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-2/3" />
              <div className="h-32 bg-gray-200 rounded-2xl" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-2/5" />
              <p className="text-center text-xs text-gray-400">Calculating your offer...</p>
            </div>
          )}

          {!step4Loading && offer && !enhancedOffer && (
            <>
              {/* Offer Card */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🎉</span>
                  <div>
                    <h3 className="font-bold text-green-800 text-sm">Congratulations, {applicantName.split(' ')[0]}!</h3>
                    <p className="text-xs text-green-600">Pre-approved offer</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Eligible Amount', `₹${offer.eligible.toLocaleString('en-IN')}`, 'text-green-700'],
                    ['Interest Rate', `${offer.rate}% p.a.`, 'text-blue-700'],
                    ['Processing Fee', `₹${offer.fee.toLocaleString('en-IN')}`, 'text-gray-700'],
                  ].map(([label, value, cls]) => (
                    <div key={label} className="bg-white rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-gray-500">{label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${cls}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Option 1: Accept */}
              <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Option 1 — Accept Offer</p>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">EMI Tenure</label>
                  <div className="flex gap-2 flex-wrap">
                    {EMI_TENURES.map(t => (
                      <button key={t} type="button" onClick={() => setTenure(t)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          tenure === t ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600 hover:border-green-400'
                        }`}>{t}m</button>
                    ))}
                  </div>
                  <p className="text-sm font-semibold text-green-700 mt-2">
                    EMI: ₹{calcEmi(offer.eligible, offer.rate, tenure).toLocaleString('en-IN')}/month
                  </p>
                </div>

                {[
                  { label: 'KYC Verification', sub: 'Identity verification', done: kycDone, onDo: () => { setKycDone(true); toast.success('KYC Completed! ✅') }, btnLabel: 'Complete KYC' },
                  { label: 'Auto Debit / e-NACH', sub: 'For EMI auto-payment', done: nachDone, onDo: () => { setNachDone(true); toast.success('e-NACH Enabled! ✅') }, btnLabel: 'Enable e-NACH' },
                ].map(({ label, sub, done, onDo, btnLabel }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-t">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{label}</p>
                      <p className="text-xs text-gray-500">{sub}</p>
                    </div>
                    {done
                      ? <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">✅ Done</span>
                      : <button onClick={onDo} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">{btnLabel}</button>
                    }
                  </div>
                ))}

                <div className="flex items-center justify-between py-2 border-t">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Loan Agreement</p>
                    <p className="text-xs text-gray-500">Review and accept terms</p>
                  </div>
                  {agreementAccepted
                    ? <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">✅ Accepted</span>
                    : <button onClick={() => setShowAgreement(true)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">View &amp; Accept</button>
                  }
                </div>

                <button onClick={handleSubmit} disabled={!kycDone || !nachDone || !agreementAccepted || submitting}
                  className="w-full py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition mt-1">
                  {submitting ? 'Processing...' : 'Proceed with Application ✓'}
                </button>
              </div>

              {/* Option 2: Enhancement */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Option 2 — Request Enhancement</p>
                <p className="text-xs text-gray-500">Upload income proof for a higher loan amount</p>

                <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                  {([['aa', '📱 Acct Aggregator'], ['netbanking', '🌐 Net Banking'], ['upload', '📄 Upload PDF']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setEnhancementTab(key)}
                      className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition ${
                        enhancementTab === key ? 'bg-white shadow text-gray-700' : 'text-gray-500 hover:text-gray-700'
                      }`}>{label}</button>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-xl p-4 text-center space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {enhancementTab === 'aa' && 'Send AA Consent Link'}
                    {enhancementTab === 'netbanking' && 'Connect via Net Banking'}
                    {enhancementTab === 'upload' && (employmentType === 'SELF_EMPLOYED' ? 'Upload 6 Months Bank Statements' : 'Upload 3 Months Salary Slips')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {enhancementTab === 'aa' && 'Customer consents — bank data fetched digitally'}
                    {enhancementTab === 'netbanking' && 'Securely connect bank account'}
                    {enhancementTab === 'upload' && 'PDF format supported'}
                  </p>
                  <button onClick={handleRequestEnhancement} disabled={processingEnhancement}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 mx-auto">
                    {processingEnhancement && <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />}
                    {processingEnhancement ? 'Processing...' : 'Submit'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Enhanced offer result */}
          {!step4Loading && enhancedOffer && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🚀</span>
                  <div>
                    <h3 className="font-bold text-blue-800 text-sm">Enhanced Offer Ready!</h3>
                    <p className="text-xs text-blue-600">Based on income verification</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Enhanced Amount', `₹${enhancedOffer.eligible.toLocaleString('en-IN')}`, 'text-blue-700'],
                    ['Interest Rate', `${enhancedOffer.rate}% p.a.`, 'text-green-700'],
                    ['Processing Fee', `₹${enhancedOffer.fee.toLocaleString('en-IN')}`, 'text-gray-700'],
                  ].map(([label, value, cls]) => (
                    <div key={label} className="bg-white rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-gray-500">{label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${cls}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">EMI Tenure</label>
                <div className="flex gap-2 flex-wrap">
                  {EMI_TENURES.map(t => (
                    <button key={t} type="button" onClick={() => setTenure(t)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        tenure === t ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600 hover:border-green-400'
                      }`}>{t}m</button>
                  ))}
                </div>
                <p className="text-sm font-semibold text-green-700 mt-2">EMI: ₹{emi.toLocaleString('en-IN')}/month</p>
              </div>

              <button onClick={handleSubmit} disabled={submitting}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-60 transition">
                {submitting ? 'Submitting...' : '✓ Complete Application'}
              </button>
            </div>
          )}

          <button onClick={() => setStep(3)} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            ← Back
          </button>
        </div>
      )}

      {/* ═══ Loan Agreement Modal ═══ */}
      {showAgreement && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-800">Loan Agreement</h3>
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-2 h-44 overflow-y-auto">
              <p className="font-semibold">LOAN AGREEMENT — TRUSTIVA SETU FINANCIAL SERVICES</p>
              <p>This Agreement is entered between the Borrower and Trustiva Setu Financial Services.</p>
              <p>1. Loan Amount: ₹{(activeOffer?.eligible ?? 0).toLocaleString('en-IN')}</p>
              <p>2. Interest Rate: {activeOffer?.rate ?? 14}% per annum</p>
              <p>3. Tenure: {tenure} months · EMI: ₹{emi.toLocaleString('en-IN')}/month</p>
              <p>4. Processing Fee: ₹{(activeOffer?.fee ?? 0).toLocaleString('en-IN')}</p>
              <p>5. The borrower agrees to repay as per the agreed schedule.</p>
              <p>6. Late payment charges may apply as per lender policy.</p>
              <p>7. The lender may recover dues through legal means if defaulted.</p>
              <p>By accepting, the borrower confirms all provided details are accurate.</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={agreementAccepted} onChange={e => setAgreementAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 shrink-0" />
              <span className="text-sm text-gray-700">I have read and accept this Loan Agreement</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setShowAgreement(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                Close
              </button>
              <button onClick={() => { if (agreementAccepted) setShowAgreement(false); else toast.error('Please accept the agreement first') }}
                disabled={!agreementAccepted}
                className="flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60">
                Accept &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const lbl = 'block text-sm font-medium text-gray-700 mb-1'
const err = 'text-xs text-red-500 mt-1'
const back = 'px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50'
const next = 'flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition'

function Spinner() {
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2">
      <div className="animate-spin h-3.5 w-3.5 border-2 border-green-500 border-t-transparent rounded-full" />
    </div>
  )
}

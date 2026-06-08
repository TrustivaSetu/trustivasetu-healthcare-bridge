'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useTabSession } from '@/contexts/TabSessionContext'
import { SmartOfferCard } from '@/components/leads/SmartOfferCard'
import { SmartScoreMeter } from '@/components/leads/SmartScoreMeter'
import { LoanSchemeSelector } from '@/components/leads/LoanSchemeSelector'

// TODO: OTP verification disabled for testing — set TESTING_MODE = false before production
const TESTING_MODE = true

interface Clinic { id: string; name: string }

interface LenderOffer {
  rank: number; lenderId: string; lenderName: string; lenderCode: string
  approvedAmount: number; interestRate: number; tenure: number; emi: number
  processingFee: number; confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  tag: string; instantApproval: boolean; requiresIncomeProof: boolean
  decisionTime: string; message: string
}

interface SmartScoreData {
  score: number; grade: 'A' | 'B' | 'C' | 'D'
  signals: string[]; maxInstantAmount: number
}

interface EnhancedDecision {
  status: 'INCOME_NOT_VERIFIED' | 'ENHANCEMENT_NOT_POSSIBLE' | 'ENHANCEMENT_DONE'
  message: string; approvedAmount?: number; lenderName?: string; details?: string
}

interface LoanScheme {
  type: 'ZERO_DP' | 'CUSTOM_DP'
  downPayment: number; downPaymentPct: number
  processingFeePct: number; processingFeeAmount: number
  tenure: number; emi: number; totalPayable: number; netLoanAmount: number
}

type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'OTHER'
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

const TREATMENT_CATEGORIES: Record<string, string[]> = {
  'Cosmetology & Aesthetics': ['LASIK Eye', 'Botox', 'Liposuction', 'Rhinoplasty', 'Facelift', 'Breast Augmentation'],
  'Hair Transplant': ['FUE', 'FUT', 'DHI', 'PRP Therapy', 'Beard Transplant'],
  'Ophthalmology': ['LASIK', 'SMILE', 'Cataract Surgery', 'ICL', 'Retina Surgery'],
  'Dental': ['Implants', 'Clear Aligners', 'Braces', 'Veneers', 'Root Canal', 'Smile Makeover'],
  'IVF & Fertility': ['IVF', 'IUI', 'ICSI', 'Egg Freezing', 'Hysteroscopy'],
  'Orthopaedics': ['Knee Replacement', 'Hip Replacement', 'ACL Repair', 'Spine Surgery'],
  'Cardiology': ['Angioplasty', 'Bypass Surgery', 'Pacemaker', 'Valve Replacement'],
  'Bariatric': ['Gastric Bypass', 'Sleeve Gastrectomy', 'Gastric Band'],
  'General Surgery': ['Hernia Repair', 'Piles Treatment', 'Kidney Stone', 'Gallbladder'],
  'Hearing (ENT)': ['Cochlear Implant', 'Hearing Aid', 'BAHA', 'Tympanoplasty'],
}

interface Props {
  initial?: Partial<{
    id: string; applicantName: string; phone: string; clinicId: string
    amount: number; status: string; approvedAmount: number; disbursedAmount: number
    applicationDate: string; remarks: string; treatmentName: string
    lenderId: string
  }>
  onSuccess: () => void
  onCancel: () => void
}

export function LeadForm({ initial, onSuccess, onCancel }: Props) {
  const { user: sessionUser } = useTabSession()
  const isSuperAdmin = sessionUser?.role === 'SUPER_ADMIN'
  const isEdit = !!initial?.id

  const [step, setStep] = useState<Step>(1)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(false)

  // Patient Info
  const [applicantName, setApplicantName] = useState(initial?.applicantName ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState('')

  // KYC
  const [panNumber, setPanNumber] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [panVerified, setPanVerified] = useState(false)
  const [aadhaarVerified, setAadhaarVerified] = useState(false)

  // Employment
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [pincode, setPincode] = useState('')
  const [city, setCity] = useState('')

  // Treatment & Loan
  const [clinicId, setClinicId] = useState(initial?.clinicId ?? '')
  const [treatmentCategory, setTreatmentCategory] = useState('')
  const [treatmentName, setTreatmentName] = useState(initial?.treatmentName ?? '')
  const [loanAmount, setLoanAmount] = useState(initial?.amount ? String(initial.amount) : '')
  const [loanScheme, setLoanScheme] = useState<LoanScheme | null>(null)
  const [remarks, setRemarks] = useState(initial?.remarks ?? '')

  // Smart Qualify
  const [smartScore, setSmartScore] = useState<SmartScoreData | null>(null)
  const [offers, setOffers] = useState<LenderOffer[]>([])
  const [selectedOffer, setSelectedOffer] = useState<LenderOffer | null>(null)
  const [qualifying, setQualifying] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpInput, setOtpInput] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [totalLenders, setTotalLenders] = useState(0)
  const [totalEligible, setTotalEligible] = useState(0)

  // Consent
  const [consentGiven, setConsentGiven] = useState(false)

  // Enhancement
  const [wantsEnhancement, setWantsEnhancement] = useState(false)
  const [aaConsentGiven, setAaConsentGiven] = useState(false)
  const [bankStatementUrl, setBankStatementUrl] = useState('')
  const [uploadingBS, setUploadingBS] = useState(false)
  const [enhancedDecision, setEnhancedDecision] = useState<EnhancedDecision | null>(null)

  useEffect(() => {
    fetch('/api/clinics?minimal=1').then(r => r.json()).then(d => setClinics(d.data ?? []))
  }, [])

  // TODO: OTP verification disabled for testing — remove this useEffect before production
  useEffect(() => {
    if (TESTING_MODE && step === 2) {
      setPhoneVerified(true)
      setStep(3)
    }
  }, [step])

  async function verifyPAN() {
    if (panNumber.length !== 10) { toast.error('Enter a valid 10-character PAN number'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/leads/verify-pan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pan: panNumber.toUpperCase(), name: applicantName }),
      })
      const json = await res.json()
      if (json.verified) { setPanVerified(true); toast.success('PAN verified! ✅') }
      else toast.error(json.message ?? 'PAN verification failed — you can proceed anyway')
    } catch { toast.error('PAN verify failed') }
    finally { setLoading(false) }
  }

  async function verifyAadhaar() {
    if (aadhaarNumber.length !== 12) { toast.error('Enter a valid 12-digit Aadhaar number'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/leads/verify-aadhaar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar: aadhaarNumber }),
      })
      const json = await res.json()
      if (json.verified) { setAadhaarVerified(true); toast.success('Aadhaar verified! ✅') }
      else toast.error(json.message ?? 'Aadhaar verification failed — you can proceed anyway')
    } catch { toast.error('Aadhaar verify failed') }
    finally { setLoading(false) }
  }

  async function sendOTP() {
    setLoading(true)
    try {
      const res = await fetch('/api/leads/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const json = await res.json()
      if (json.success) { setOtpSent(true); toast.success('OTP sent to +91 ' + phone) }
      else toast.error(json.error ?? 'Failed to send OTP')
    } catch { toast.error('Failed to send OTP') }
    finally { setLoading(false) }
  }

  async function verifyOTP() {
    setLoading(true)
    try {
      const res = await fetch('/api/leads/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otpInput }),
      })
      const json = await res.json()
      if (json.verified) {
        setPhoneVerified(true)
        toast.success('Phone verified! ✅')
        setStep(3)
      } else {
        toast.error(json.message ?? 'Invalid OTP')
      }
    } catch { toast.error('OTP verification failed') }
    finally { setLoading(false) }
  }

  const runSmartQualify = useCallback(async () => {
    setQualifying(true)
    setOffers([])
    setSmartScore(null)
    try {
      const res = await fetch('/api/leads/smart-qualify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone, applicantName, employmentType,
          monthlyIncome: parseFloat(monthlyIncome),
          pincode, loanAmount: parseFloat(loanAmount),
          treatmentCategory, panNumber, aadhaarVerified,
          processingFeePct: loanScheme?.processingFeePct ?? 2,
          preferredTenure: loanScheme?.tenure ?? 12,
          downPayment: loanScheme?.downPayment ?? 0,
          netLoanAmount: loanScheme?.netLoanAmount ?? parseFloat(loanAmount),
        }),
      })
      const json = await res.json()
      setSmartScore(json.smartScore)
      setOffers(json.offers ?? [])
      setTotalLenders(json.totalLendersChecked ?? 0)
      setTotalEligible(json.totalEligible ?? 0)
      if ((json.offers ?? []).length === 0) toast.error('No offers found — check income or loan amount')
    } catch { toast.error('Qualification failed — please retry') }
    finally { setQualifying(false) }
  }, [phone, applicantName, employmentType, monthlyIncome, pincode, loanAmount,
      treatmentCategory, panNumber, aadhaarVerified, loanScheme])

  async function uploadBankStatement(file: File) {
    setUploadingBS(true)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('folder', 'bank-statements')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); setBankStatementUrl(d.url); toast.success('Bank statement uploaded!') }
      else toast.error('Upload failed')
    } catch { toast.error('Upload failed') }
    finally { setUploadingBS(false) }
  }

  async function getEnhancedDecision() {
    setLoading(true)
    try {
      const res = await fetch('/api/leads/enhanced-decision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyIncome: parseFloat(monthlyIncome),
          loanAmount: parseFloat(loanAmount),
          selectedLender: selectedOffer,
          bankStatementUrl, aaConsentGiven,
        }),
      })
      const json = await res.json()
      setEnhancedDecision(json.decision)
    } catch { toast.error('Enhanced decision failed') }
    finally { setLoading(false) }
  }

  async function finalSubmit() {
    setLoading(true)
    try {
      const finalAmount = enhancedDecision?.status === 'ENHANCEMENT_DONE'
        ? enhancedDecision.approvedAmount
        : selectedOffer?.approvedAmount ?? parseFloat(loanAmount)

      const payload = {
        applicantName, phone, email: email || undefined,
        amount: parseFloat(loanAmount),
        clinicId, lenderId: selectedOffer?.lenderId || undefined,
        treatmentName, applicationDate: format(new Date(), 'yyyy-MM-dd'),
        remarks, status: selectedOffer ? 'APPROVED' : 'PENDING',
        approvedAmount: finalAmount,
        metadata: {
          panNumber, aadhaarVerified, panVerified,
          phoneVerified: true, // mock — OTP to be implemented
          employmentType, monthlyIncome, pincode, city, treatmentCategory,
          schemeType: loanScheme?.type,
          downPayment: loanScheme?.downPayment,
          downPaymentPct: loanScheme?.downPaymentPct,
          processingFeePct: loanScheme?.processingFeePct,
          processingFeeAmount: loanScheme?.processingFeeAmount,
          tenure: loanScheme?.tenure ?? selectedOffer?.tenure,
          emi: loanScheme?.emi ?? selectedOffer?.emi,
          netLoanAmount: loanScheme?.netLoanAmount,
          smartScore, allOffers: offers,
          selectedOffer, wantsEnhancement,
          aaConsentGiven, bankStatementUrl, enhancedDecision,
        },
      }

      const url = isEdit ? `/api/leads/${initial!.id}` : '/api/leads'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }

      const created = await res.json()
      const leadId = created.data?.id

      if (!isEdit && leadId && process.env.NEXT_PUBLIC_TESTING_MODE === 'true') {
        toast.success('Lead created! Auto-processing in 2–5 seconds... (Testing Mode)')
        const delay = 2000 + Math.random() * 3000
        setTimeout(async () => {
          try {
            await fetch(`/api/leads/${leadId}/auto-process`, { method: 'POST' })
          } catch { /* fire-and-forget */ }
        }, delay)
      } else {
        toast.success('Lead successfully created! 🎉')
      }

      onSuccess()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setLoading(false) }
  }

  const STEP_LABELS: Record<number, string> = {
    1: 'Basic Info', 2: 'Phone OTP', 3: 'KYC', 4: 'Employment',
    5: 'Treatment & Scheme', 6: 'Smart Qualify', 7: 'Confirm',
    8: 'Income Verify', 9: 'Enhanced Decision', 10: 'Final Submit',
  }
  // TODO: OTP verification disabled for testing — restore step 2 in both arrays before production
  const STEP_NUMS = TESTING_MODE
    ? (wantsEnhancement ? [1,3,4,5,6,7,8,9,10] : [1,3,4,5,6,7])
    : (wantsEnhancement ? [1,2,3,4,5,6,7,8,9,10] : [1,2,3,4,5,6,7])
  const currentIdx = STEP_NUMS.indexOf(step)
  const progress = Math.round(((currentIdx + 1) / STEP_NUMS.length) * 100)
  const treatments = treatmentCategory ? TREATMENT_CATEGORIES[treatmentCategory] ?? [] : []

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs font-medium text-gray-600">
            Step {currentIdx + 1} of {STEP_NUMS.length}: {STEP_LABELS[step]}
          </p>
          <p className="text-xs text-gray-400">{progress}% complete</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* STEP 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-4">
          <StepHeader icon="👤" title="Basic Info" subtitle="Patient ka naam aur contact details" />
          <Field label="Applicant Name *" value={applicantName} onChange={setApplicantName}
            placeholder="Full name as per Aadhaar" required />
          <Field label="Phone Number *" value={phone}
            onChange={v => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number" maxLength={10} required />
          <Field label="Email" value={email} onChange={setEmail} placeholder="patient@email.com" type="email" />
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={e => setConsentGiven(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-400 text-blue-600 shrink-0"
              />
              <span className="text-xs text-gray-700 leading-relaxed">
                I confirm that the applicant has consented to share their personal data (including identity
                documents and financial details) with Trustiva Setu and its partner lenders for the purpose
                of processing a loan application. I have explained the{' '}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Privacy Policy</a>
                {' '}and{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Terms &amp; Conditions</a>
                {' '}to the applicant. <span className="text-red-600 font-medium">*</span>
              </span>
            </label>
          </div>
          <NavBtn
            onNext={() => {
              if (!applicantName || phone.length < 10) {
                toast.error('Name and 10-digit phone number are required'); return
              }
              if (!consentGiven) {
                toast.error('Patient consent is required before proceeding'); return
              }
              // TODO: OTP verification disabled for testing — remove this block and restore setStep(2) before production
              if (TESTING_MODE) {
                setPhoneVerified(true)
                toast.success('Testing Mode: OTP step bypassed ⚡')
                setStep(3)
              } else {
                setStep(2)
              }
            }}
            onCancel={onCancel} nextLabel="Next: KYC →" />
        </div>
      )}

      {/* STEP 2: Phone OTP */}
      {step === 2 && (
        <div className="space-y-4">
          <StepHeader icon="📱" title="Phone Verification" subtitle="Verify mobile number via OTP" />
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <p className="text-sm text-gray-700">Sending OTP to <strong>+91 {phone}</strong></p>
            {!otpSent ? (
              <button onClick={sendOTP} disabled={loading}
                className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Sending...' : '📲 Send OTP'}
              </button>
            ) : !phoneVerified ? (
              <div className="space-y-3">
                <input
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button onClick={verifyOTP} disabled={loading || otpInput.length !== 6}
                  className="w-full py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-60">
                  {loading ? 'Verifying...' : '✅ Verify OTP'}
                </button>
                <button type="button" onClick={sendOTP} disabled={loading}
                  className="w-full text-xs text-blue-600 hover:text-blue-800 py-1">
                  Resend OTP
                </button>
              </div>
            ) : null}
            {phoneVerified && <StatusBadge ok text="Phone Verified" />}
          </div>
          {isSuperAdmin && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs text-yellow-700">⚠️ Dev mode: use <strong>123456</strong> as OTP to bypass</p>
            </div>
          )}
          <NavBtn onBack={() => setStep(1)} onCancel={onCancel} hideNext />
        </div>
      )}

      {/* STEP 3: KYC */}
      {step === 3 && (
        <div className="space-y-4">
          <StepHeader icon="🪪" title="KYC Verification" subtitle="Verify PAN and Aadhaar" />
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-gray-700">PAN Card</p>
            <div className="flex gap-2">
              <input value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())}
                placeholder="AAAAA0000A" maxLength={10} className={`${inputCls} font-mono flex-1`} />
              <button onClick={verifyPAN} disabled={loading || panVerified}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-60">
                {panVerified ? '✅' : loading ? '...' : 'Verify'}
              </button>
            </div>
            {panVerified && <StatusBadge ok text="PAN Verified" />}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-gray-700">Aadhaar Card</p>
            <div className="flex gap-2">
              <input value={aadhaarNumber}
                onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="12-digit Aadhaar" maxLength={12} className={`${inputCls} font-mono flex-1`} />
              <button onClick={verifyAadhaar} disabled={loading || aadhaarVerified}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-60">
                {aadhaarVerified ? '✅' : loading ? '...' : 'Verify'}
              </button>
            </div>
            {aadhaarVerified && <StatusBadge ok text="Aadhaar Verified" />}
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <p className="text-xs text-yellow-700">⚠️ If verification fails — you can proceed manually</p>
          </div>
          <NavBtn onBack={() => setStep(1)} onNext={() => setStep(4)} nextLabel="Next: Employment →" onCancel={onCancel} />
        </div>
      )}

      {/* STEP 4: Employment */}
      {step === 4 && (
        <div className="space-y-4">
          <StepHeader icon="💼" title="Employment & Income" subtitle="Employment type and monthly income" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {(['SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'OTHER'] as EmploymentType[]).map(t => (
                <button key={t} type="button" onClick={() => setEmploymentType(t)}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                    employmentType === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {t === 'SALARIED' ? '👔 Salaried' : t === 'SELF_EMPLOYED' ? '🧑‍💻 Self Employed' : t === 'BUSINESS' ? '🏢 Business' : '🔧 Other'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income (₹) *</label>
            <input type="number" value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)}
              placeholder="e.g. 50000" className={inputCls} />
            {monthlyIncome && <p className="text-xs text-gray-500 mt-1">= ₹{Number(monthlyIncome).toLocaleString('en-IN')}/month</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pincode *" value={pincode} onChange={v => setPincode(v.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit" maxLength={6} />
            <Field label="City" value={city} onChange={setCity} placeholder="City name" />
          </div>
          <NavBtn onBack={() => setStep(3)}
            onNext={() => {
              if (!employmentType || !monthlyIncome || !pincode) { toast.error('Employment, income aur pincode zaroori hai'); return }
              setStep(5)
            }}
            nextLabel="Next: Treatment & Scheme →" onCancel={onCancel} />
        </div>
      )}

      {/* STEP 5: Treatment + Scheme */}
      {step === 5 && (
        <div className="space-y-4">
          <StepHeader icon="🏥" title="Treatment & Loan Scheme" subtitle="Configure treatment, amount and scheme" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic / Hospital *</label>
            <select value={clinicId} onChange={e => setClinicId(e.target.value)} className={inputCls}>
              <option value="">Select Clinic</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select value={treatmentCategory} onChange={e => { setTreatmentCategory(e.target.value); setTreatmentName('') }} className={inputCls}>
                <option value="">Select</option>
                {Object.keys(TREATMENT_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Treatment *</label>
              <select value={treatmentName} onChange={e => setTreatmentName(e.target.value)}
                disabled={!treatmentCategory} className={`${inputCls} disabled:bg-gray-100`}>
                <option value="">Select</option>
                {treatments.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (₹) *</label>
            <input type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} placeholder="e.g. 75000" className={inputCls} />
            {loanAmount && <p className="text-xs text-gray-500 mt-1">= ₹{Number(loanAmount).toLocaleString('en-IN')}</p>}
          </div>
          {loanAmount && Number(loanAmount) > 0 && (
            <LoanSchemeSelector loanAmount={Number(loanAmount)} onSchemeChange={setLoanScheme} />
          )}
          <Field label="Additional Remarks" value={remarks} onChange={setRemarks} placeholder="Any notes..." />
          <NavBtn onBack={() => setStep(4)}
            onNext={() => {
              if (!clinicId || !treatmentName || !loanAmount || !loanScheme) { toast.error('Clinic, treatment, amount and scheme are required'); return }
              if (TESTING_MODE) {
                const amt = Math.min(parseFloat(loanAmount), 100000)
                const mockOffer: LenderOffer = {
                  rank: 1, lenderId: '', lenderName: 'Mock Lender (Testing)', lenderCode: 'TEST',
                  approvedAmount: amt, interestRate: 14, tenure: loanScheme?.tenure ?? 12,
                  emi: Math.round(amt / (loanScheme?.tenure ?? 12)), processingFee: 0,
                  confidence: 'HIGH', tag: 'Best Match', instantApproval: true,
                  requiresIncomeProof: false, decisionTime: 'Instant',
                  message: '[Testing Mode] Not a real credit decision.',
                }
                setSmartScore({ score: 82, grade: 'A', signals: ['Testing Mode — Mock Data'], maxInstantAmount: amt })
                setOffers([mockOffer])
                setSelectedOffer(mockOffer)
                setTotalLenders(3)
                setTotalEligible(1)
                setStep(6)
              } else {
                setStep(6); runSmartQualify()
              }
            }}
            nextLabel="🚀 Get Smart Offers →" onCancel={onCancel} />
        </div>
      )}

      {/* STEP 6: Smart Qualify */}
      {step === 6 && (
        <div className="space-y-4">
          <StepHeader icon="⚡" title="Smart Pre-Qualification" subtitle="No CIBIL hit — instant offers" />
          {TESTING_MODE && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              ⚠️ Testing Mode — Showing mock lender offer. Not a real credit decision.
            </div>
          )}
          {qualifying && (
            <div className="text-center py-10">
              <div className="relative mx-auto w-20 h-20 mb-4">
                <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-100 border-t-blue-600" />
                <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
              </div>
              <p className="text-sm font-bold text-gray-700">Checking all lenders...</p>
              <p className="text-xs text-gray-400 mt-1">No CIBIL hit — score safe hai ✅</p>
              <p className="text-xs text-blue-500 mt-1 animate-pulse">Usually 10-30 seconds</p>
            </div>
          )}
          {!qualifying && smartScore && (
            <SmartScoreMeter score={smartScore.score} grade={smartScore.grade}
              signals={smartScore.signals} totalLenders={totalLenders} eligibleLenders={totalEligible} />
          )}
          {!qualifying && offers.length === 0 && smartScore && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 font-bold">No offers found</p>
              <p className="text-xs text-red-500 mt-1">Increase income or reduce loan amount</p>
              <button onClick={runSmartQualify} className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg">🔄 Retry</button>
            </div>
          )}
          {!qualifying && offers.map(offer => (
            <SmartOfferCard key={offer.lenderId || String(offer.rank)} offer={offer}
              selected={selectedOffer?.lenderId === offer.lenderId}
              onSelect={() => setSelectedOffer(offer)} />
          ))}
          {!qualifying && offers.length > 0 && (
            <NavBtn onBack={() => setStep(5)}
              onNext={() => { if (!selectedOffer) { toast.error('Please select an offer'); return } setStep(7) }}
              nextLabel="Next: Confirm Offer →" nextDisabled={!selectedOffer} onCancel={onCancel} />
          )}
          {!qualifying && offers.length === 0 && smartScore && (
            <NavBtn onBack={() => setStep(5)} onCancel={onCancel} hideNext />
          )}
        </div>
      )}

      {/* STEP 7: Confirm */}
      {step === 7 && (
        <div className="space-y-4">
          <StepHeader icon="✅" title="Confirm Offer" subtitle="Accept or request enhancement" />
          {selectedOffer && loanScheme && (
            <div className="bg-green-50 border border-green-300 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between">
                <p className="font-bold text-green-800">{selectedOffer.lenderName}</p>
                <p className="text-2xl font-bold text-green-700">₹{selectedOffer.approvedAmount.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white rounded-xl p-3 space-y-2 text-sm">
                <SummaryRow label="Scheme" value={loanScheme.type === 'ZERO_DP' ? 'Zero Downpayment' : `${loanScheme.downPaymentPct}% Downpayment`} />
                {loanScheme.downPayment > 0 && <SummaryRow label="Downpayment (upfront)" value={`₹${loanScheme.downPayment.toLocaleString('en-IN')}`} />}
                <SummaryRow label="Net Loan (financed)" value={`₹${loanScheme.netLoanAmount.toLocaleString('en-IN')}`} />
                <SummaryRow label="✨ No Cost EMI" value={`₹${loanScheme.emi.toLocaleString('en-IN')}/month × ${loanScheme.tenure} months`} bold />
                <SummaryRow label={`Processing Fee (${loanScheme.processingFeePct}%)`}
                  value={loanScheme.processingFeeAmount > 0 ? `₹${loanScheme.processingFeeAmount.toLocaleString('en-IN')}` : 'ZERO'} />
                <div className="border-t pt-2">
                  <SummaryRow label="Total Customer Pays"
                    value={`₹${((loanScheme.emi * loanScheme.tenure) + loanScheme.processingFeeAmount).toLocaleString('en-IN')}`} bold />
                </div>
              </div>
            </div>
          )}
          {selectedOffer && loanAmount && selectedOffer.approvedAmount < parseFloat(loanAmount) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs text-yellow-700">⚠️ Approved amount is less than requested. Verify income for enhancement.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setWantsEnhancement(false); finalSubmit() }} disabled={loading}
              className="py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-60 text-sm">
              {loading ? '⏳...' : '✅ Accept & Submit'}
            </button>
            <button type="button" onClick={() => { setWantsEnhancement(true); setStep(8) }}
              className="py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 text-sm">
              📈 Request Enhancement
            </button>
          </div>
          <NavBtn onBack={() => setStep(6)} onCancel={onCancel} hideNext />
        </div>
      )}

      {/* STEP 8: Income Verify */}
      {step === 8 && (
        <div className="space-y-4">
          <StepHeader icon="📊" title="Income Verification" subtitle="Verify via AA or Bank Statement" />
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-bold text-blue-800 mb-2">Option 1: Account Aggregator (AA)</p>
            <p className="text-xs text-blue-600 mb-3">Customer ka consent lo — digitally bank data fetch hoga</p>
            {!aaConsentGiven ? (
              <button onClick={() => { setAaConsentGiven(true); toast.success('AA Consent given!'); setTimeout(() => toast.success('Income verified via AA ✅'), 2000) }}
                className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                📲 AA Consent Link Bhejo
              </button>
            ) : <StatusBadge ok text="AA Consent Received — Income Fetched" />}
          </div>
          <div className="text-center text-sm text-gray-400">— ya —</div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-bold text-gray-700 mb-1">Option 2: Bank Statement PDF</p>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
              <input type="file" accept=".pdf" id="bank-stmt"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadBankStatement(f) }} className="hidden" />
              <label htmlFor="bank-stmt" className="cursor-pointer">
                <p className="text-2xl mb-1">📄</p>
                <p className="text-xs text-gray-600">Upload PDF</p>
                <div className="mt-2 px-3 py-1.5 bg-gray-600 text-white text-xs rounded-lg inline-block">
                  {uploadingBS ? 'Uploading...' : 'Browse PDF'}
                </div>
              </label>
              {bankStatementUrl && <p className="text-xs text-green-600 mt-2">✅ Uploaded!</p>}
            </div>
          </div>
          <NavBtn onBack={() => setStep(7)}
            onNext={() => {
              if (!aaConsentGiven && !bankStatementUrl) { toast.error('AA consent or bank statement is required'); return }
              setStep(9); getEnhancedDecision()
            }}
            nextLabel="Get Enhanced Decision →" onCancel={onCancel} />
        </div>
      )}

      {/* STEP 9: Enhanced Decision */}
      {step === 9 && (
        <div className="space-y-4">
          <StepHeader icon="🎯" title="Enhanced Decision" subtitle="Result after income verification" />
          {loading && (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-sm text-gray-600">Processing...</p>
            </div>
          )}
          {!loading && enhancedDecision && (
            <div className={`rounded-2xl p-5 border-2 ${
              enhancedDecision.status === 'ENHANCEMENT_DONE' ? 'bg-green-50 border-green-400' :
              enhancedDecision.status === 'ENHANCEMENT_NOT_POSSIBLE' ? 'bg-yellow-50 border-yellow-400' : 'bg-red-50 border-red-400'
            }`}>
              <p className="text-lg font-bold mb-2">
                {enhancedDecision.status === 'ENHANCEMENT_DONE' ? '✅ Enhancement Approved!' :
                 enhancedDecision.status === 'ENHANCEMENT_NOT_POSSIBLE' ? '⚠️ Enhancement Not Possible' : '❌ Income Not Verified'}
              </p>
              <p className="text-sm text-gray-700">{enhancedDecision.message}</p>
              {enhancedDecision.approvedAmount && (
                <div className="mt-3 bg-white rounded-xl p-3">
                  <p className="text-xs text-gray-500">Enhanced Amount</p>
                  <p className="text-2xl font-bold text-green-700">₹{enhancedDecision.approvedAmount.toLocaleString('en-IN')}</p>
                  {enhancedDecision.lenderName && <p className="text-xs text-gray-500 mt-1">via {enhancedDecision.lenderName}</p>}
                </div>
              )}
            </div>
          )}
          {!loading && enhancedDecision && (
            <NavBtn onBack={() => setStep(8)} onNext={() => setStep(10)} nextLabel="Next: Final Submit →" onCancel={onCancel} />
          )}
        </div>
      )}

      {/* STEP 10: Final Summary */}
      {step === 10 && (
        <div className="space-y-4">
          <StepHeader icon="🚀" title="Final Summary" subtitle="Review all details and submit" />
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
            <SummaryRow label="Patient" value={applicantName} />
            <SummaryRow label="Phone" value={`+91 ${phone}`} />
            <SummaryRow label="PAN" value={`${panNumber} ${panVerified ? '✅' : ''}`} />
            <SummaryRow label="Treatment" value={`${treatmentCategory} → ${treatmentName}`} />
            <SummaryRow label="Loan Amount" value={`₹${Number(loanAmount).toLocaleString('en-IN')}`} />
            {loanScheme && (
              <>
                <SummaryRow label="Scheme" value={loanScheme.type === 'ZERO_DP' ? 'Zero Downpayment' : `${loanScheme.downPaymentPct}% DP`} />
                {loanScheme.downPayment > 0 && <SummaryRow label="Downpayment" value={`₹${loanScheme.downPayment.toLocaleString('en-IN')}`} />}
                <SummaryRow label="No Cost EMI" value={`₹${loanScheme.emi.toLocaleString('en-IN')}/month × ${loanScheme.tenure}m`} bold />
                <SummaryRow label="Processing Fee"
                  value={loanScheme.processingFeeAmount > 0 ? `₹${loanScheme.processingFeeAmount.toLocaleString('en-IN')} (${loanScheme.processingFeePct}%)` : 'ZERO'} />
              </>
            )}
            {enhancedDecision?.status === 'ENHANCEMENT_DONE'
              ? <SummaryRow label="Final Approved" value={`₹${enhancedDecision.approvedAmount?.toLocaleString('en-IN')} (Enhanced)`} bold />
              : selectedOffer && <SummaryRow label="Approved via" value={`₹${selectedOffer.approvedAmount.toLocaleString('en-IN')} — ${selectedOffer.lenderName}`} bold />
            }
          </div>
          <button onClick={finalSubmit} disabled={loading}
            className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-60 text-base">
            {loading ? '⏳ Submitting...' : '🚀 Submit Lead'}
          </button>
          <NavBtn onBack={() => setStep(wantsEnhancement ? 9 : 7)} onCancel={onCancel} hideNext />
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

function Field({ label, value, onChange, placeholder, required, type = 'text', maxLength, extraCls = '' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string; maxLength?: number; extraCls?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} maxLength={maxLength}
        className={`${inputCls} ${extraCls}`} />
    </div>
  )
}

function StepHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 pb-2 border-b">
      <span className="text-3xl">{icon}</span>
      <div>
        <h3 className="text-base font-bold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  )
}

function StatusBadge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`px-3 py-2 rounded-lg text-xs font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {ok ? '✅' : '❌'} {text}
    </div>
  )
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-bold text-gray-800' : 'text-gray-700'} text-right max-w-[60%]`}>{value}</span>
    </div>
  )
}

function NavBtn({ onBack, onNext, onCancel, nextLabel = 'Next →', nextDisabled = false, hideNext = false }: {
  onBack?: () => void; onNext?: () => void; onCancel: () => void
  nextLabel?: string; nextDisabled?: boolean; hideNext?: boolean
}) {
  return (
    <div className="flex gap-2 pt-2 border-t">
      {onBack && (
        <button type="button" onClick={onBack}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
          ← Back
        </button>
      )}
      {!hideNext && onNext && (
        <button type="button" onClick={onNext} disabled={nextDisabled}
          className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {nextLabel}
        </button>
      )}
      <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-400 text-sm hover:text-gray-600">
        Cancel
      </button>
    </div>
  )
}

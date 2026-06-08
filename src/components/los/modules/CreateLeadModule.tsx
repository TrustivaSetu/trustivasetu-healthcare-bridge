'use client'

// TODO: OTP verification disabled for testing — set TESTING_MODE = false before production
// Set to false to restore real OTP verification and credit engine
const TESTING_MODE = true

import { useState } from 'react'
import { useLos } from '../LosProvider'
import { btnPrimary, btnSecondary, Field, inputCls, selectCls } from '../ui'
import type { LeadFormData } from '@/lib/los/types'

type DecisionResult = 'APPROVED' | 'CONDITIONAL' | 'REJECTED' | null

function getSalaryDecision(salaryStr: string): DecisionResult {
  const s = parseInt(salaryStr, 10)
  if (isNaN(s) || salaryStr === '') return null
  if (s >= 50000) return 'APPROVED'
  if (s >= 25000) return 'CONDITIONAL'
  return 'REJECTED'
}

const emptyForm: LeadFormData = {
  enquiryType: '',
  mobileNumber: '',
  motherName: '',
  patientName: '',
  customerType: '',
  bedType: '',
  admissionDate: '',
  dischargeDate: '',
  consultationDate: '',
  email: '',
  hospitalName: '',
  treatmentName: '',
  medicalEstimate: '',
  financingRequired: '',
  callbackDate: '',
  remarks: '',
}

export function CreateLeadModule() {
  const { db, hospitals, createLead, updateLead, setLeadStatus, session, syncing } = useLos()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<LeadFormData>(emptyForm)
  const [leadId, setLeadId] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [showOtp, setShowOtp] = useState(false)
  const [showDecision, setShowDecision] = useState(false)
  const [decisionSalary, setDecisionSalary] = useState('')
  const [employment, setEmployment] = useState({ companyName: '', salary: '', employmentType: 'Salaried' })
  const [coApp, setCoApp] = useState({ name: '', relation: '', income: '' })

  const validMobile = /^[6-9]\d{9}$/.test(form.mobileNumber)
  const step1Ok =
    form.enquiryType &&
    validMobile &&
    form.motherName &&
    form.patientName &&
    form.hospitalName &&
    form.financingRequired

  async function afterOtp() {
    if (TESTING_MODE) {
      if (otp !== '123456') return alert('Testing Mode: Use OTP 123456')
    } else {
      if (otp !== '123456') return alert('Invalid OTP. Please try again.')
    }
    const lead = await createLead(form, session?.email ?? 'system', { status: 'OTP_VERIFIED' })
    setLeadId(lead.id)
    setShowOtp(false)
    if (TESTING_MODE) {
      setShowDecision(true)
    } else {
      setStep(2)
    }
  }

  async function saveAndAdvance(next: number, status?: Parameters<typeof setLeadStatus>[1]) {
    if (!leadId) return
    const lead = db.leads.find((l) => l.id === leadId)
    if (!lead) return
    const updated = {
      ...lead,
      form,
      employment: step >= 3 ? employment : lead.employment,
      coApplicant: step >= 4 ? { name: coApp.name, relation: coApp.relation, income: coApp.income } : lead.coApplicant,
    }
    await updateLead(updated, true)
    if (status) await setLeadStatus(leadId, status, session?.email ?? 'system')
    setStep(next)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Patient Enquiry Registration</h2>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((s) => (
          <div key={s} className={`w-8 h-8 rounded flex items-center justify-center text-xs ${step === s ? 'bg-blue-500' : 'bg-white/10'}`}>
            {s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <Field label="Enquiry category" required>
            <select className={selectCls} value={form.enquiryType} onChange={(e) => setForm({ ...form, enquiryType: e.target.value })}>
              <option value="">Select</option>
              {['IPD', 'OPD', 'IVF', 'Dental', 'Cosmetology'].map((o) => (
                <option key={o} value={o} className="text-black">{o}</option>
              ))}
            </select>
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Mobile" required>
              <input className={inputCls} maxLength={10} value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} />
            </Field>
            <Field label="Guardian name" required>
              <input className={inputCls} value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} />
            </Field>
            <Field label="Patient name" required>
              <input className={inputCls} value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
            </Field>
            <Field label="Hospital" required>
              <select className={selectCls} value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })}>
                <option value="">Select</option>
                {hospitals.map((h) => (
                  <option key={h} value={h} className="text-black">{h}</option>
                ))}
              </select>
            </Field>
            <Field label="Medical estimate (₹)">
              <input type="number" className={inputCls} value={form.medicalEstimate} onChange={(e) => setForm({ ...form, medicalEstimate: e.target.value })} />
            </Field>
            <Field label="Financing required" required>
              <select className={selectCls} value={form.financingRequired} onChange={(e) => setForm({ ...form, financingRequired: e.target.value })}>
                <option value="">Select</option>
                <option value="Yes" className="text-black">Yes</option>
                <option value="No" className="text-black">No</option>
              </select>
            </Field>
          </div>
          <button
            type="button"
            disabled={!step1Ok || syncing}
            className={btnSecondary + ' w-full'}
            onClick={async () => {
              if (TESTING_MODE) {
                // TODO: OTP verification disabled for testing — re-enable before production (restore: setShowOtp(true))
                const lead = await createLead(form, session?.email ?? 'system', { status: 'OTP_VERIFIED' })
                setLeadId(lead.id)
                setShowDecision(true)
              } else {
                setShowOtp(true)
              }
            }}
          >
            {TESTING_MODE ? 'Create Enquiry (Testing — OTP skipped)' : 'Create Enquiry & Send OTP'}
          </button>
        </div>
      )}

      {showOtp && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#071827] max-w-md w-full rounded-2xl p-6">
            <p className="text-center mb-4">OTP sent to +91 {form.mobileNumber} (demo: 123456)</p>
            <input className={inputCls} maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
            <button type="button" className={btnSecondary + ' w-full mt-4'} onClick={afterOtp} disabled={syncing}>
              Verify OTP
            </button>
          </div>
        </div>
      )}

      {showDecision && TESTING_MODE && (() => {
        const decision = getSalaryDecision(decisionSalary)
        const decisionMeta: Record<NonNullable<DecisionResult>, { label: string; icon: string; color: string; border: string }> = {
          APPROVED:    { label: 'Approved',             icon: '✅', color: 'text-green-300', border: 'border-green-500/40' },
          CONDITIONAL: { label: 'Conditional Approval', icon: '⚠️', color: 'text-yellow-300', border: 'border-yellow-500/40' },
          REJECTED:    { label: 'Rejected',             icon: '❌', color: 'text-red-400',   border: 'border-red-500/40'   },
        }
        const meta = decision ? decisionMeta[decision] : null
        return (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold">Salary Eligibility Check</h3>
            <Field label="Monthly Salary (₹)" required>
              <input
                type="number"
                className={inputCls}
                placeholder="Enter monthly salary"
                value={decisionSalary}
                onChange={(e) => setDecisionSalary(e.target.value)}
              />
            </Field>

            {meta && (
              <div className={`rounded-xl border p-4 space-y-2 ${meta.border}`}>
                <p className={`text-xl font-bold ${meta.color}`}>{meta.icon} {meta.label}</p>
                <p className="text-sm text-gray-300">Salary entered: <span className="text-white font-medium">₹{parseInt(decisionSalary, 10).toLocaleString()}</span></p>
                {decision === 'CONDITIONAL' && (
                  <p className="text-sm text-yellow-300">Documentation required to proceed.</p>
                )}
                <p className="text-sm text-gray-400">Reason: Decision based on salary eligibility</p>
                <p className="text-xs text-orange-400 mt-1">⚠️ Testing Mode — Not a real credit decision</p>
              </div>
            )}

            <button
              type="button"
              className={btnPrimary}
              disabled={!decision}
              onClick={() => { setShowDecision(false); setStep(2) }}
            >
              Continue to Application
            </button>
          </div>
        )
      })()}

      {step === 2 && leadId && (
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-lg font-semibold">Address Details</h3>
          <textarea className={inputCls} rows={3} placeholder="Current address" onChange={() => {}} />
          <button type="button" className={btnPrimary} onClick={() => saveAndAdvance(3, 'KYC_PENDING')}>
            Save Address → Employment
          </button>
        </div>
      )}

      {step === 3 && leadId && (
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-lg font-semibold">Employment</h3>
          <input className={inputCls} placeholder="Company" value={employment.companyName} onChange={(e) => setEmployment({ ...employment, companyName: e.target.value })} />
          <input className={inputCls} placeholder="Salary" value={employment.salary} onChange={(e) => setEmployment({ ...employment, salary: e.target.value })} />
          <button type="button" className={btnPrimary} onClick={() => saveAndAdvance(4, 'KYC_COMPLETED')}>
            Save Employment
          </button>
        </div>
      )}

      {step === 4 && leadId && (
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-lg font-semibold">Co-applicant</h3>
          <input className={inputCls} placeholder="Name" value={coApp.name} onChange={(e) => setCoApp({ ...coApp, name: e.target.value })} />
          <input className={inputCls} placeholder="Relation" value={coApp.relation} onChange={(e) => setCoApp({ ...coApp, relation: e.target.value })} />
          <button type="button" className={btnPrimary} onClick={() => saveAndAdvance(5, 'BANKING_PENDING')}>
            Save Co-applicant
          </button>
        </div>
      )}

      {step === 5 && leadId && (
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-semibold mb-4">Documents</h3>
          <p className="text-gray-400 text-sm mb-4">Upload Aadhaar, PAN, estimate (demo — mark uploaded)</p>
          <button type="button" className={btnPrimary} onClick={() => saveAndAdvance(6, 'CREDIT_REVIEW')}>
            Mark documents uploaded
          </button>
        </div>
      )}

      {step === 6 && leadId && (
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-semibold mb-4">Credit check</h3>
          <p className="text-lime-300">Eligible amount: ₹{form.medicalEstimate || '1,00,000'}</p>
          <button type="button" className={`${btnPrimary} mt-4`} onClick={() => saveAndAdvance(7)}>
            Credit check done
          </button>
        </div>
      )}

      {step === 7 && leadId && (
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-semibold mb-4">Final submission</h3>
          <button
            type="button"
            className={btnPrimary + ' w-full'}
            disabled={syncing}
            onClick={async () => {
              await setLeadStatus(leadId, 'APPROVED', session?.email ?? 'system', 'Application submitted')
              alert('Submitted to LMS — check Leads & Reports')
            }}
          >
            {syncing ? 'Syncing to LMS…' : 'Final Submit → LMS'}
          </button>
        </div>
      )}
    </div>
  )
}

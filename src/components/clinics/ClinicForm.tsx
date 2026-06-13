'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ClinicSchemeManager } from '@/components/clinics/ClinicSchemeManager'

interface Region { id: string; name: string }
interface RM { id: string; name: string; role?: string }

interface ClinicFormData {
  name: string
  brandName: string
  address: string
  accountNumber: string
  contactPerson: string
  contactNumber: string
  email: string
  businessPotential: string
  regionId: string
  assignedRMId: string
  gstNumber: string
  panNumber: string
  ifscCode: string
  bankName: string
  signingAuthority: string
  pincode: string
  city: string
  udyamNumber: string
  hospitalType: string
  contactPersonDesignation: string
  alternatePhone: string
  agreementUrl: string
  // Extended fields
  contactPersonEmail: string
  targetLeadsFTD: string
  targetDisbursalsFTD: string
  onboardingDate: string
  onboardingTime: string
}

interface ClinicStats {
  firstLeadDate?: string | null
  mtdLeads?: number
  lmtdLeads?: number
  mtdDisbursalValue?: number
  lmtdDisbursalValue?: number
  leadsGrowth?: number
}

interface Props {
  initial?: Partial<ClinicFormData & { id: string; externalId?: string; metadata?: Record<string, string> } & ClinicStats>
  onSuccess: () => void
  onCancel: () => void
}

const HOSPITAL_TYPES = [
  'Multi-Specialty Hospital',
  'Single-Specialty Clinic',
  'Dental Clinic',
  'Eye Care Center',
  'Hair Transplant Clinic',
  'Fertility / IVF Center',
  'Cosmetic Surgery Center',
  'Orthopaedic Center',
  'Diagnostic Center',
  'Ayurvedic / Wellness Center',
  'Other',
]

export function ClinicForm({ initial, onSuccess, onCancel }: Props) {
  const isEdit = !!initial?.id
  const meta = initial?.metadata ?? {}

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const timeStr = now.toTimeString().slice(0, 5)

  const [form, setForm] = useState<ClinicFormData>({
    name: initial?.name ?? '',
    brandName: (meta.brandName as string) ?? '',
    address: initial?.address ?? '',
    accountNumber: initial?.accountNumber ?? '',
    contactPerson: initial?.contactPerson ?? '',
    contactNumber: initial?.contactNumber ?? '',
    email: initial?.email ?? '',
    businessPotential: initial?.businessPotential ?? '',
    regionId: initial?.regionId ?? '',
    assignedRMId: initial?.assignedRMId ?? '',
    gstNumber: meta.gstNumber ?? '',
    panNumber: meta.panNumber ?? '',
    ifscCode: meta.ifscCode ?? '',
    bankName: meta.bankName ?? '',
    signingAuthority: meta.signingAuthority ?? '',
    pincode: meta.pincode ?? '',
    city: (meta.city as string) ?? '',
    udyamNumber: meta.udyamNumber ?? '',
    hospitalType: initial?.hospitalType ?? '',
    contactPersonDesignation: meta.contactPersonDesignation ?? '',
    alternatePhone: meta.alternatePhone ?? '',
    agreementUrl: meta.agreementUrl ?? '',
    contactPersonEmail: meta.contactPersonEmail ?? '',
    targetLeadsFTD: meta.targetLeadsFTD ?? '',
    targetDisbursalsFTD: meta.targetDisbursalsFTD ?? '',
    onboardingDate: todayStr,
    onboardingTime: timeStr,
  })

  const [regions, setRegions] = useState<Region[]>([])
  const [rms, setRms] = useState<RM[]>([])
  const [loading, setLoading] = useState(false)
  const [gstLoading, setGstLoading] = useState(false)
  const [ifscLoading, setIfscLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)

  const [clinicCode, setClinicCode] = useState<string | null>(initial?.externalId ?? null)
  const [tab, setTab] = useState<'agreement' | 'basic' | 'gst' | 'banking' | 'schemes'>('agreement')
  const [agreementFile, setAgreementFile] = useState<File | null>(null)
  
  useEffect(() => {
    Promise.all([
      fetch('/api/regions').then(r => r.json()),
      Promise.all([
        fetch('/api/users?role=TEAM_MEMBER&minimal=1').then(r => r.json()),
        fetch('/api/users?role=REGIONAL_MANAGER&minimal=1').then(r => r.json()),
      ]).then(([tm, rm]) => ({
        data: [...(tm.data ?? []), ...(rm.data ?? [])].sort((a: RM, b: RM) => a.name.localeCompare(b.name)),
      })),
    ]).then(([r, u]) => {
      setRegions(r.data ?? [])
      setRms(u.data ?? [])
    })
  }, [])

  function update(k: keyof ClinicFormData, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  // Agreement Upload
  async function uploadAgreement(file: File) {
    setUploadLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'clinic-agreements')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        update('agreementUrl', data.url)
        toast.success('Agreement uploaded successfully!')
      } else {
        toast.error('Upload failed — please try again later')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadLoading(false)
    }
  }

  // GST Auto-fetch
  async function fetchGSTDetails() {
    if (!form.gstNumber || form.gstNumber.length < 15) {
      toast.error('Enter a valid 15-character GSTIN')
      return
    }
    setGstLoading(true)
    try {
      const res = await fetch(`/api/gst-verify?gstin=${form.gstNumber.toUpperCase()}`)
      const data = await res.json()
      if (data.success) {
        setForm(f => ({
          ...f,
          name: data.tradeName || data.legalName || f.name,
          address: data.address || f.address,
          pincode: data.pincode || f.pincode,
        }))
        toast.success('Details auto-filled from GST!')
      } else {
        toast.error(data.error || 'GST fetch failed — please fill manually')
      }
    } catch {
      toast.error('GST fetch failed — please fill manually')
    } finally {
      setGstLoading(false)
    }
  }

  // IFSC Auto-fetch
  async function fetchBankDetails() {
    if (!form.ifscCode || form.ifscCode.length < 11) {
      toast.error('Enter a valid 11-character IFSC code')
      return
    }
    setIfscLoading(true)
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${form.ifscCode.toUpperCase()}`)
      const data = await res.json()
      if (data.BANK) {
        setForm(f => ({ ...f, bankName: `${data.BANK} — ${data.BRANCH}` }))
        toast.success('Bank details auto-filled!')
      } else {
        toast.error('IFSC not found — please enter manually')
      }
    } catch {
      toast.error('Bank fetch failed — please enter manually')
    } finally {
      setIfscLoading(false)
    }
  }


  // PIN Code → City auto-fetch (India Post API)
  async function fetchCityFromPin(pin: string) {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) return
    setPinLoading(true)
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`)
      const data = await res.json()
      if (Array.isArray(data) && data[0]?.Status === 'Success') {
        const po = data[0].PostOffice?.[0]
        if (po?.District) {
          update('city', po.District)
        }
      }
    } catch {
      // fail silently — user can enter manually
    } finally {
      setPinLoading(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    // Client-side validation — required fields may be on hidden tabs
    if (!form.name || form.name.trim().length < 2) {
      toast.error('Channel Partner name is required (min 2 chars)')
      setTab('basic')
      return
    }
    if (!form.address || form.address.trim().length < 5) {
      toast.error('Address is required (min 5 chars)')
      setTab('basic')
      return
    }
    if (!form.contactPerson || form.contactPerson.trim().length < 2) {
      toast.error('Contact person name is required')
      setTab('basic')
      return
    }
    if (!form.contactNumber || form.contactNumber.trim().length < 10) {
      toast.error('Contact number must be at least 10 digits')
      setTab('basic')
      return
    }
    if (!isEdit && !form.regionId) {
      toast.error('Please select a Region — go to Basic Info tab')
      setTab('basic')
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: form.name,
        address: form.address,
        accountNumber: form.accountNumber,
        contactPerson: form.contactPerson,
        contactNumber: form.contactNumber,
        email: form.email || undefined,
        businessPotential: form.businessPotential ? parseFloat(form.businessPotential) : undefined,
        regionId: form.regionId,
        assignedRMId: form.assignedRMId || undefined,
        hospitalType: form.hospitalType || undefined,
        metadata: {
          brandName: form.brandName,
          gstNumber: form.gstNumber,
          panNumber: form.panNumber,
          ifscCode: form.ifscCode,
          bankName: form.bankName,
          signingAuthority: form.signingAuthority,
          pincode: form.pincode,
          city: form.city,
          udyamNumber: form.udyamNumber,
          contactPersonDesignation: form.contactPersonDesignation,
          alternatePhone: form.alternatePhone,
          agreementUrl: form.agreementUrl,
          contactPersonEmail: form.contactPersonEmail,
          targetLeadsFTD: form.targetLeadsFTD,
          targetDisbursalsFTD: form.targetDisbursalsFTD,
          onboardingDate: form.onboardingDate,
          onboardingTime: form.onboardingTime,
        },
      }

      const url = isEdit ? `/api/clinics/${initial!.id}` : '/api/clinics'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        // Show field-level errors when available
        const fieldErrors = err.details?.fieldErrors as Record<string, string[]> | undefined
        if (fieldErrors) {
          const firstField = Object.entries(fieldErrors)[0]
          if (firstField) {
            throw new Error(`${firstField[0]}: ${firstField[1].join(', ')}`)
          }
        }
        throw new Error(err.error ?? 'Failed')
      }

      const result = await res.json()
      if (result.data?.externalId) {
        setClinicCode(result.data.externalId)
      }
      toast.success(isEdit ? 'Channel Partner updated!' : 'Channel Partner onboarded successfully!')
      onSuccess()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const tabClass = (t: string) =>
    `px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
      tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  return (
    <form onSubmit={submit} className="space-y-4">

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" className={tabClass('agreement')} onClick={() => setTab('agreement')}>
          1. Agreement
        </button>
        <button type="button" className={tabClass('basic')} onClick={() => setTab('basic')}>
          2. Basic Info
        </button>
        <button type="button" className={tabClass('gst')} onClick={() => setTab('gst')}>
          3. GST / PAN
        </button>
        <button type="button" className={tabClass('banking')} onClick={() => setTab('banking')}>
          4. Banking
        </button>
        <button type="button" className={tabClass('schemes')} onClick={() => setTab('schemes')}>
          5. Schemes
        </button>
      </div>

      {/* TAB 1: AGREEMENT */}
      {tab === 'agreement' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-800 mb-1">Step 1: Upload Agreement</p>
            <p className="text-xs text-blue-600">Upload the signed agreement PDF or DOC for this channel partner</p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <input type="file" accept=".pdf,.doc,.docx" id="clinic-agreement"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  setAgreementFile(file)
                  uploadAgreement(file)
                }
              }}
              className="hidden" />
            <label htmlFor="clinic-agreement" className="cursor-pointer">
              <div className="text-5xl mb-3">📄</div>
              <p className="text-sm font-medium text-gray-700">Choose agreement file</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX — max 10MB</p>
              <div className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg inline-block hover:bg-blue-700">
                {uploadLoading ? 'Uploading...' : 'Browse File'}
              </div>
            </label>
            {agreementFile && !uploadLoading && (
              <p className="text-xs text-gray-500 mt-2">{agreementFile.name}</p>
            )}
            {uploadLoading && (
              <p className="text-xs text-blue-600 mt-2 animate-pulse">Uploading...</p>
            )}
          </div>

          {form.agreementUrl && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-700 font-medium">✅ Agreement Uploaded!</p>
                  <p className="text-xs text-gray-500 mt-0.5 break-all">{form.agreementUrl}</p>
                </div>
                <div className="flex gap-2 ml-3">
                  <a href={form.agreementUrl} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 whitespace-nowrap">
                    View
                  </a>
                  <a href={form.agreementUrl} download
                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 whitespace-nowrap">
                    Download
                  </a>
                </div>
              </div>
            </div>
          )}

          {!form.agreementUrl && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs text-yellow-700">
                ⚠️ Agreement upload is optional — you can add it later. Click the next tab to continue.
              </p>
            </div>
          )}

          <button type="button" onClick={() => setTab('basic')}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Next: Basic Info →
          </button>
        </div>
      )}

      {/* TAB 2: BASIC INFO */}
      {tab === 'basic' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Field label="Channel Partner Name *" value={form.name} onChange={v => update('name', v)} required />
            </div>
            <div>
              <Field label="Brand Name" value={form.brandName} onChange={v => update('brandName', v)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel Partner Type</label>
              <select value={form.hospitalType} onChange={e => update('hospitalType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Select Type</option>
                {HOSPITAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <Field label="Address *" value={form.address} onChange={v => update('address', v)} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input
                type="text" maxLength={6} value={form.pincode}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '')
                  update('pincode', v)
                  if (v.length === 6) fetchCityFromPin(v)
                }}
                placeholder="6-digit PIN"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City {pinLoading && <span className="text-xs text-blue-500 ml-1">auto-fetching...</span>}
              </label>
              <input
                type="text" value={form.city}
                onChange={e => update('city', e.target.value)}
                placeholder="Auto-filled or enter manually"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <Field label="Contact Person *" value={form.contactPerson}
              onChange={v => update('contactPerson', v)} required />
            <Field label="Designation" value={form.contactPersonDesignation}
              onChange={v => update('contactPersonDesignation', v)} />

            <Field label="Contact Number *" value={form.contactNumber}
              onChange={v => update('contactNumber', v)} required />
            <Field label="Alternate Phone" value={form.alternatePhone}
              onChange={v => update('alternatePhone', v)} />
            <Field label="Concerned Person Email" value={form.contactPersonEmail}
              onChange={v => update('contactPersonEmail', v)} type="email" />
            <Field label="Email (Channel Partner Mail)" value={form.email}
              onChange={v => update('email', v)} type="email" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
              <select value={form.regionId} onChange={e => update('regionId', e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Select Region</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned RM</label>
              <select value={form.assignedRMId} onChange={e => update('assignedRMId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Not Assigned</option>
                {rms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          {/* Clinic Code */}
          {clinicCode && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium">Clinic Unique Code</p>
              <p className="text-xl font-bold text-green-800 font-mono">{clinicCode}</p>
            </div>
          )}

          {/* Onboarding Info */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Onboarding Info</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date of Onboarding</label>
                <input type="date" value={form.onboardingDate}
                  onChange={e => update('onboardingDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Time of Onboarding</label>
                <input type="time" value={form.onboardingTime}
                  onChange={e => update('onboardingTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {isEdit && initial?.firstLeadDate && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">First Lead Received</label>
                    <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                      {new Date(initial.firstLeadDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Onboarding to Lead TAT</label>
                    <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                      {Math.round((new Date(initial.firstLeadDate).getTime() - new Date(form.onboardingDate).getTime()) / (1000 * 60 * 60 * 24))} days
                    </p>
                  </div>
                </>
              )}
              <Field label="Total Potential (₹L)" value={form.businessPotential}
                onChange={v => update('businessPotential', v)} type="number" />
              <Field label="Target Leads (FTM)" value={form.targetLeadsFTD}
                onChange={v => update('targetLeadsFTD', v)} type="number" />
              <div className="col-span-2">
                <Field label="Target Disbursals (₹L FTM)" value={form.targetDisbursalsFTD}
                  onChange={v => update('targetDisbursalsFTD', v)} type="number" />
              </div>
            </div>
          </div>

          {/* Performance Tracking - only in edit mode */}
          {isEdit && (initial?.mtdLeads !== undefined || initial?.lmtdLeads !== undefined) && (
            <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50 space-y-2">
              <p className="text-sm font-semibold text-emerald-700">Performance (Live)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <PerfStat label="LMTD Leads" value={String(initial?.lmtdLeads ?? 0)} />
                <PerfStat label="MTD Leads" value={String(initial?.mtdLeads ?? 0)} accent />
                <PerfStat label="LMTD Disbursal" value={`₹${(initial?.lmtdDisbursalValue ?? 0).toFixed(1)}L`} />
                <PerfStat label="MTD Disbursal" value={`₹${(initial?.mtdDisbursalValue ?? 0).toFixed(1)}L`} accent />
                <div className="rounded-lg p-2 text-center bg-white border border-emerald-200">
                  <p className="text-xs text-gray-500">Growth</p>
                  <p className={`text-lg font-bold ${(initial?.leadsGrowth ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {(initial?.leadsGrowth ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(Math.round(initial?.leadsGrowth ?? 0))}%
                  </p>
                </div>
              </div>
            </div>
          )}

          <button type="button" onClick={() => setTab('gst')}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Next: GST / PAN →
          </button>
        </div>
      )}

      {/* TAB 3: GST / PAN */}
      {tab === 'gst' && (
        <div className="space-y-4">
          {/* GST Auto-fetch */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">
              Enter GST number — channel partner name and address will be auto-filled
            </p>
            <div className="flex gap-2">
              <input type="text" placeholder="GSTIN (15 characters)"
                value={form.gstNumber}
                onChange={e => update('gstNumber', e.target.value.toUpperCase())}
                maxLength={15}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button type="button" onClick={fetchGSTDetails} disabled={gstLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap">
                {gstLoading ? 'Fetching...' : '🔍 Auto-Fetch'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ⚠️ If auto-fetch fails — please fill manually
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="PAN Number" value={form.panNumber}
              onChange={v => update('panNumber', v.toUpperCase())} />
            <Field label="Udyam / MSME Number" value={form.udyamNumber}
              onChange={v => update('udyamNumber', v.toUpperCase())} />
            <div className="col-span-2">
              <Field label="Signing Authority" value={form.signingAuthority}
                onChange={v => update('signingAuthority', v)} />
            </div>
          </div>

          {/* Auto-fill result */}
          {(form.name || form.address || form.pincode) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs font-medium text-yellow-700 mb-1">Auto-fill result:</p>
              <p className="text-xs text-gray-600">Naam: {form.name || '—'}</p>
              <p className="text-xs text-gray-600">Address: {form.address || '—'}</p>
              <p className="text-xs text-gray-600">Pincode: {form.pincode || '—'}</p>
            </div>
          )}

          <button type="button" onClick={() => setTab('banking')}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Next: Banking Details →
          </button>
        </div>
      )}

      {/* TAB 4: BANKING */}
      {tab === 'banking' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">
              Enter IFSC code — bank name will be auto-filled
            </p>
            <div className="flex gap-2">
              <input type="text" placeholder="IFSC Code (11 characters)"
                value={form.ifscCode}
                onChange={e => update('ifscCode', e.target.value.toUpperCase())}
                maxLength={11}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button type="button" onClick={fetchBankDetails} disabled={ifscLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap">
                {ifscLoading ? 'Fetching...' : '🏦 Auto-Fetch'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Account Number" value={form.accountNumber}
              onChange={v => update('accountNumber', v)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name (auto-filled)
              </label>
              <input type="text" value={form.bankName}
                onChange={e => update('bankName', e.target.value)}
                placeholder="Auto-filled from IFSC"
                className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>

          {form.bankName && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs text-green-700 font-medium">✅ Bank Verified: {form.bankName}</p>
            </div>
          )}
        </div>
      )}

{tab === 'schemes' && (
  <div className="space-y-4">
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
      <p className="text-sm font-semibold text-blue-800">Step 5: Configure Loan Schemes</p>
      <p className="text-xs text-blue-600 mt-1">Add the schemes agreed with this clinic</p>
    </div>
    {initial?.id ? (
      <ClinicSchemeManager clinicId={initial.id} isAdmin={true} />
    ) : (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
        <p className="text-sm text-yellow-700">⚠️ Please save the clinic first — then you can add schemes</p>
        <button type="submit" disabled={loading}
          className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          Pehle Clinic Save Karo →
        </button>
      </div>
    )}
  </div>
)}

      {/* Submit Buttons — always visible */}
      <div className="flex gap-3 pt-2 border-t">
        <button type="submit" disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
          {loading ? 'Saving...' : isEdit ? 'Update Channel Partner' : '✅ Onboard Channel Partner'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
      </div>
    </form>
  )
}

function Field({ label, value, onChange, required, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
    </div>
  )
}

function PerfStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-2 text-center ${accent ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-200'}`}>
      <p className={`text-xs mb-0.5 ${accent ? 'text-emerald-100' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-base font-bold ${accent ? 'text-white' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

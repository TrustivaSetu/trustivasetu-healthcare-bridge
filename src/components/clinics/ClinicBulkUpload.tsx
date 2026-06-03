'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface Region { id: string; name: string }
interface RM { id: string; name: string }

interface BulkResult {
  message: string
  created: string[]
  failed: { row: number; name: string; error: string }[]
  total: number
  usersCreated: number
  emailsSent: number
}

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

export function ClinicBulkUpload({ onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<'agreement' | 'entity' | 'upload' | 'result'>('agreement')
  const [regions, setRegions] = useState<Region[]>([])
  const [rms, setRms] = useState<RM[]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<BulkResult | null>(null)

  // Agreement
  const [agreementFile, setAgreementFile] = useState<File | null>(null)
  const [agreementUrl, setAgreementUrl] = useState('')
  const [agreementUploading, setAgreementUploading] = useState(false)

  // Entity details
  const [legalEntityName, setLegalEntityName] = useState('')
  const [regionId, setRegionId] = useState('')
  const [assignedRMId, setAssignedRMId] = useState('')
  const [commonGst, setCommonGst] = useState('')
  const [commonPan, setCommonPan] = useState('')
  const [commonIfsc, setCommonIfsc] = useState('')
  const [commonBankName, setCommonBankName] = useState('')
  const [commonAccount, setCommonAccount] = useState('')
  const [ifscLoading, setIfscLoading] = useState(false)
  const [gstLoading, setGstLoading] = useState(false)

  // Excel file
  const [excelFile, setExcelFile] = useState<File | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/regions').then(r => r.json()),
      fetch('/api/users?role=TEAM_MEMBER&minimal=1').then(r => r.json()),
    ]).then(([r, u]) => {
      setRegions(r.data ?? [])
      setRms(u.data ?? [])
    })
  }, [])

  async function uploadAgreement(file: File) {
    setAgreementUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'clinic-agreements')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setAgreementUrl(data.url)
        toast.success('Agreement uploaded!')
      } else {
        toast.error('Agreement upload failed — you can continue without it')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setAgreementUploading(false)
    }
  }

  async function fetchGST() {
    if (!commonGst || commonGst.length < 15) { toast.error('Enter a valid 15-character GSTIN'); return }
    setGstLoading(true)
    try {
      const res = await fetch(`/api/gst-verify?gstin=${commonGst.toUpperCase()}`)
      const data = await res.json()
      if (data.success) {
        if (!legalEntityName) setLegalEntityName(data.tradeName || data.legalName || '')
        toast.success('GST verified!')
      } else {
        toast.error(data.error || 'GST verification failed — please fill manually')
      }
    } catch { toast.error('GST fetch failed') }
    finally { setGstLoading(false) }
  }

  async function fetchIFSC() {
    if (!commonIfsc || commonIfsc.length < 11) { toast.error('Enter a valid 11-character IFSC code'); return }
    setIfscLoading(true)
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${commonIfsc.toUpperCase()}`)
      const data = await res.json()
      if (data.BANK) {
        setCommonBankName(`${data.BANK} — ${data.BRANCH}`)
        toast.success('Bank details auto-fill!')
      } else { toast.error('IFSC not found') }
    } catch { toast.error('IFSC fetch failed') }
    finally { setIfscLoading(false) }
  }

  async function downloadTemplate() {
    const res = await fetch('/api/clinics/template')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clinic-bulk-upload-template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Template downloaded!')
  }

  async function handleUpload() {
    if (!excelFile) { toast.error('Please select an Excel file'); return }
    if (!legalEntityName) { toast.error('Please enter the legal entity name'); return }
    if (!regionId) { toast.error('Please select a region'); return }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', excelFile)
      fd.append('legalEntityName', legalEntityName)
      fd.append('regionId', regionId)
      if (assignedRMId) fd.append('assignedRMId', assignedRMId)
      if (commonGst) fd.append('commonGst', commonGst)
      if (commonPan) fd.append('commonPan', commonPan)
      if (commonIfsc) fd.append('commonIfsc', commonIfsc)
      if (commonBankName) fd.append('commonBankName', commonBankName)
      if (commonAccount) fd.append('commonAccountNumber', commonAccount)
      if (agreementUrl) fd.append('agreementUrl', agreementUrl)

      const res = await fetch('/api/clinics/bulk-upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setResult(data)
      setStep('result')
      toast.success(data.message)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const stepClass = (s: string) =>
    `px-3 py-1.5 text-xs font-medium rounded-full ${
      step === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
    }`

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex gap-2 items-center">
        <span className={stepClass('agreement')}>1. Agreement</span>
        <span className="text-gray-300">→</span>
        <span className={stepClass('entity')}>2. Entity Details</span>
        <span className="text-gray-300">→</span>
        <span className={stepClass('upload')}>3. Excel Upload</span>
        {result && <><span className="text-gray-300">→</span><span className={stepClass('result')}>4. Result</span></>}
      </div>

      {/* STEP 1: AGREEMENT */}
      {step === 'agreement' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800">Step 1: Upload Master Agreement</p>
            <p className="text-xs text-blue-600 mt-1">Signed agreement for the legal entity — applies to all branches</p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <input type="file" accept=".pdf,.doc,.docx" id="bulk-agreement"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { setAgreementFile(file); uploadAgreement(file) }
              }}
              className="hidden" />
            <label htmlFor="bulk-agreement" className="cursor-pointer">
              <div className="text-5xl mb-3">📄</div>
              <p className="text-sm font-medium text-gray-700">Upload agreement</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX — max 10MB</p>
              <div className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg inline-block hover:bg-blue-700">
                {agreementUploading ? 'Uploading...' : 'Browse File'}
              </div>
            </label>
            {agreementFile && <p className="text-xs text-gray-500 mt-2">{agreementFile.name}</p>}
          </div>

          {agreementUrl && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
              <p className="text-xs text-green-700 font-medium">✅ Agreement uploaded!</p>
              <a href={agreementUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline">View</a>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <p className="text-xs text-yellow-700">⚠️ Agreement is optional — can be added later</p>
          </div>

          <button onClick={() => setStep('entity')}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Next: Entity Details →
          </button>
        </div>
      )}

      {/* STEP 2: ENTITY DETAILS */}
      {step === 'entity' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800">Step 2: Legal Entity ki common details</p>
            <p className="text-xs text-blue-600 mt-1">These details apply to all branches (can be overridden per branch in Excel)</p>
          </div>

          {/* Legal Entity Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legal Entity Name *</label>
            <input value={legalEntityName} onChange={e => setLegalEntityName(e.target.value)} required
              placeholder="e.g. Apollo Hospitals Private Limited"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
              <select value={regionId} onChange={e => setRegionId(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Select Region</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned RM</label>
              <select value={assignedRMId} onChange={e => setAssignedRMId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Not Assigned</option>
                {rms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          {/* GST */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Common GST / PAN (same for all branches)</p>
            <div className="flex gap-2">
              <input value={commonGst} onChange={e => setCommonGst(e.target.value.toUpperCase())}
                placeholder="GSTIN (15 chars)" maxLength={15}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button type="button" onClick={fetchGST} disabled={gstLoading}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-60">
                {gstLoading ? '...' : 'Verify'}
              </button>
            </div>
            <input value={commonPan} onChange={e => setCommonPan(e.target.value.toUpperCase())}
              placeholder="PAN (10 chars)" maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* Bank */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Common Bank Details (if same across all branches)</p>
            <p className="text-xs text-gray-500">If different per branch, fill those columns in Excel — those values will override</p>
            <div className="flex gap-2">
              <input value={commonIfsc} onChange={e => setCommonIfsc(e.target.value.toUpperCase())}
                placeholder="IFSC Code (11 chars)" maxLength={11}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button type="button" onClick={fetchIFSC} disabled={ifscLoading}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-60">
                {ifscLoading ? '...' : '🏦 Fetch'}
              </button>
            </div>
            <input value={commonBankName} onChange={e => setCommonBankName(e.target.value)}
              placeholder="Bank Name (auto-filled)"
              className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input value={commonAccount} onChange={e => setCommonAccount(e.target.value)}
              placeholder="Account Number (if same for all)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('agreement')}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button onClick={() => setStep('upload')}
              disabled={!legalEntityName || !regionId}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
              Next: Upload Excel →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: EXCEL UPLOAD */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-800">Step 3: Upload Excel File</p>
            <p className="text-xs text-green-600 mt-1">Entity: <strong>{legalEntityName}</strong></p>
          </div>

          {/* Download template */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Download Template → Fill it in → Upload</p>
            <button onClick={downloadTemplate}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2">
              ⬇ Download Excel Template
            </button>
            <p className="text-xs text-blue-600 mt-2">The template includes an Instructions sheet — please read it</p>
          </div>

          {/* Excel upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <input type="file" accept=".xlsx,.xls,.csv" id="bulk-excel"
              onChange={e => setExcelFile(e.target.files?.[0] ?? null)}
              className="hidden" />
            <label htmlFor="bulk-excel" className="cursor-pointer">
              <div className="text-5xl mb-3">📊</div>
              <p className="text-sm font-medium text-gray-700">Upload the filled Excel file</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv supported</p>
              <div className="mt-4 px-5 py-2 bg-green-600 text-white text-sm rounded-lg inline-block hover:bg-green-700">
                Browse Excel File
              </div>
            </label>
            {excelFile && (
              <div className="mt-3 bg-green-50 rounded-lg p-2">
                <p className="text-xs text-green-700 font-medium">✅ {excelFile.name}</p>
                <p className="text-xs text-gray-500">{(excelFile.size / 1024).toFixed(1)} KB</p>
              </div>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <p className="text-xs text-yellow-700 font-medium">Important notes:</p>
            <ul className="text-xs text-yellow-600 mt-1 space-y-1 list-disc list-inside">
              <li>clinic_name*, address*, contact_person*, contact_number* are mandatory</li>
              <li>If any branch has different bank details, fill those columns in Excel</li>
              <li>Duplicate clinic names will be skipped</li>
              <li>Each clinic will get a unique TSC-XXXXXX code auto-generated</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('entity')}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button onClick={handleUpload} disabled={!excelFile || uploading}
              className="flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60">
              {uploading ? '⏳ Processing...' : '🚀 Upload & Create Clinics'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: RESULT */}
      {step === 'result' && result && (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 ${result.failed.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <p className="text-sm font-bold">{result.message}</p>
            <div className="flex gap-4 mt-2 flex-wrap">
              <span className="text-xs text-green-700 font-medium">✅ {result.created.length} clinics created</span>
              {result.usersCreated > 0 && (
                <span className="text-xs text-blue-700 font-medium">👤 {result.usersCreated} portal users created</span>
              )}
              {result.emailsSent > 0 && (
                <span className="text-xs text-teal-700 font-medium">📧 {result.emailsSent} welcome emails sent</span>
              )}
              {result.failed.length > 0 && (
                <span className="text-xs text-red-600 font-medium">❌ {result.failed.length} failed</span>
              )}
            </div>
          </div>

          {/* Created clinics */}
          {result.created.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-600 mb-2">Created Clinics:</p>
              {result.created.map((name, i) => (
                <p key={i} className="text-xs text-green-700 py-0.5">✅ {name}</p>
              ))}
            </div>
          )}

          {/* Failed */}
          {result.failed.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-red-700 mb-2">Failed rows:</p>
              {result.failed.map((f, i) => (
                <p key={i} className="text-xs text-red-600 py-0.5">
                  Row {f.row}: {f.name} — {f.error}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onSuccess}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              Done — Clinics List Dekho
            </button>
            {result.failed.length > 0 && (
              <button onClick={() => setStep('upload')}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                Retry Failed
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cancel */}
      {step !== 'result' && (
        <button onClick={onCancel}
          className="w-full py-2 text-gray-500 text-sm hover:text-gray-700">
          Cancel
        </button>
      )}
    </div>
  )
}

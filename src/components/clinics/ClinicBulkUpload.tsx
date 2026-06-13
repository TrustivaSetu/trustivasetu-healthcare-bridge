'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

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

interface ParsedRow { [key: string]: string }

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

const TEMPLATE_HEADERS = [
  'Clinic Name',
  'Contact Person',
  'Phone',
  'Email',
  'Address',
  'PIN Code',
  'City',
  'State',
  'IFSC Code',
  'Account Number',
  'Treatment Types',
]

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/

function validateRow(row: ParsedRow): string[] {
  const errors: string[] = []
  if (!row['Clinic Name']?.trim()) errors.push('Clinic Name required')
  if (!row['Contact Person']?.trim()) errors.push('Contact Person required')
  const phone = (row['Phone'] ?? '').replace(/\D/g, '')
  if (!/^\d{10}$/.test(phone)) errors.push('Phone: 10 digits required')
  if (row['Email'] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row['Email'])) errors.push('Invalid email')
  if (row['PIN Code'] && !/^\d{6}$/.test(row['PIN Code'])) errors.push('PIN Code: 6 digits')
  const ifsc = (row['IFSC Code'] ?? '').toUpperCase()
  if (ifsc && !IFSC_RE.test(ifsc)) errors.push('IFSC format invalid')
  return errors
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

  // Feature 1: Entity pincode → city/state
  const [commonPincode, setCommonPincode] = useState('')
  const [commonCity, setCommonCity] = useState('')
  const [commonState, setCommonState] = useState('')
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [pincodeErr, setPincodeErr] = useState('')

  // Feature 2: Account number with toggle + confirm
  const [showAccount, setShowAccount] = useState(false)
  const [confirmAccount, setConfirmAccount] = useState('')

  // Feature 3: Excel parsing
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/regions').then(r => r.json()),
      fetch('/api/users?role=TEAM_MEMBER&minimal=1').then(r => r.json()),
    ]).then(([r, u]) => {
      setRegions(r.data ?? [])
      setRms(u.data ?? [])
    })
  }, [])

  // Feature 1: auto-fetch city/state when pincode is 6 digits
  useEffect(() => {
    if (commonPincode.length !== 6) {
      setCommonCity('')
      setCommonState('')
      setPincodeErr('')
      return
    }
    setPincodeLoading(true)
    setPincodeErr('')
    fetch(`https://api.postalpincode.in/pincode/${commonPincode}`)
      .then(r => r.json())
      .then((data: Array<{ Status: string; PostOffice: Array<{ District: string; State: string }> | null }>) => {
        if (data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
          setCommonCity(data[0].PostOffice[0].District)
          setCommonState(data[0].PostOffice[0].State)
        } else {
          setCommonCity('')
          setCommonState('')
          setPincodeErr('Invalid PIN Code')
        }
      })
      .catch(() => {
        setCommonCity('')
        setCommonState('')
        setPincodeErr('Could not fetch city')
      })
      .finally(() => setPincodeLoading(false))
  }, [commonPincode])

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

  // Feature 2: IFSC auto-fetch on pattern match + manual button
  function triggerIfscFetch(ifsc: string) {
    if (!IFSC_RE.test(ifsc) || ifscLoading) return
    setIfscLoading(true)
    fetch(`https://ifsc.razorpay.com/${ifsc}`)
      .then(r => r.json())
      .then(data => {
        if (data.BANK) {
          setCommonBankName(`${data.BANK} — ${data.BRANCH}`)
          toast.success('Bank details fetched!')
        } else {
          toast.error('IFSC not found')
        }
      })
      .catch(() => toast.error('IFSC fetch failed'))
      .finally(() => setIfscLoading(false))
  }

  // Feature 3: client-side template download — headers only, no sample data
  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS])
    ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clinics')
    XLSX.writeFile(wb, 'clinic-upload-template.xlsx')
    toast.success('Template downloaded!')
  }

  // Feature 3: parse uploaded Excel file
  async function handleFileSelect(file: File) {
    setParsedRows([])
    setParseError('')
    setExcelFile(null)

    if (file.size > 5 * 1024 * 1024) { setParseError('File too large. Max 5MB.'); return }
    if (!file.name.match(/\.(xlsx|xls)$/i)) { setParseError('Please upload .xlsx or .xls only'); return }

    setExcelFile(file)
    try {
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: '' })

      if (rows.length === 0) { setParseError('No data found in file'); return }

      const keys = Object.keys(rows[0])
      const hasNewFormat = keys.includes('Clinic Name')
      const hasOldFormat = keys.includes('clinic_name*') || keys.includes('clinic_name')
      if (!hasNewFormat && !hasOldFormat) {
        setParseError('Column mismatch. Download correct template.')
        return
      }

      setParsedRows(rows)
    } catch {
      setParseError('Could not read file. Please upload a valid Excel file.')
    }
  }

  async function handleUpload() {
    if (!excelFile || parsedRows.length === 0) { toast.error('Please select and parse an Excel file'); return }
    if (!legalEntityName) { toast.error('Please enter the legal entity name'); return }
    if (!regionId) { toast.error('Please select a region'); return }

    const validRows = parsedRows.filter(r => validateRow(r).length === 0)
    if (validRows.length === 0) { toast.error('No valid rows to upload'); return }

    setUploading(true)
    try {
      // Map human-readable headers to API-expected column names
      const mappedRows = validRows.map(r => ({
        'clinic_name*': (r['Clinic Name'] || r['clinic_name*'] || r['clinic_name'] || '').trim(),
        'address*': (r['Address'] || r['address*'] || r['address'] || '').trim(),
        'contact_person*': (r['Contact Person'] || r['contact_person*'] || r['contact_person'] || '').trim(),
        'contact_number*': (r['Phone'] || r['contact_number*'] || r['contact_number'] || '').trim(),
        'email': (r['Email'] || r['email'] || '').trim(),
        'pincode': (r['PIN Code'] || r['pincode'] || '').trim(),
        'ifsc_code': (r['IFSC Code'] || r['ifsc_code'] || '').trim(),
        'account_number': (r['Account Number'] || r['account_number'] || '').trim(),
      }))

      // Rebuild XLSX with mapped column names for the API
      const ws = XLSX.utils.json_to_sheet(mappedRows)
      const wbOut = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wbOut, ws, 'Clinics Data')
      const buf = XLSX.write(wbOut, { type: 'array', bookType: 'xlsx' })
      const uploadFile = new File([buf], 'clinics.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const fd = new FormData()
      fd.append('file', uploadFile)
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

  const validCount = parsedRows.filter(r => validateRow(r).length === 0).length
  const invalidCount = parsedRows.length - validCount
  const accountMatch = commonAccount && confirmAccount
    ? commonAccount === confirmAccount
    : null

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className={stepClass('agreement')}>1. Agreement</span>
        <span className="text-gray-300">→</span>
        <span className={stepClass('entity')}>2. Entity Details</span>
        <span className="text-gray-300">→</span>
        <span className={stepClass('upload')}>3. Excel Upload</span>
        {result && <><span className="text-gray-300">→</span><span className={stepClass('result')}>4. Result</span></>}
      </div>

      {/* ─── STEP 1: AGREEMENT ─── */}
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

      {/* ─── STEP 2: ENTITY DETAILS ─── */}
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

          {/* Region + RM */}
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

          {/* Feature 1: Entity PIN Code → City / State auto-fetch */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Registered Address (optional)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">PIN Code</label>
                <div className="relative">
                  <input
                    value={commonPincode}
                    onChange={e => setCommonPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit PIN"
                    maxLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 pr-7"
                  />
                  {pincodeLoading && (
                    <span className="absolute right-2 top-2.5 text-gray-400 text-xs animate-spin">⟳</span>
                  )}
                </div>
                {pincodeErr && <p className="text-xs text-red-500 mt-0.5">{pincodeErr}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input
                  value={commonCity}
                  readOnly
                  placeholder="Auto-filled"
                  className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-600 focus:outline-none cursor-default"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <input
                  value={commonState}
                  readOnly
                  placeholder="Auto-filled"
                  className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-600 focus:outline-none cursor-default"
                />
              </div>
            </div>
          </div>

          {/* GST / PAN */}
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

          {/* Feature 2: Enhanced bank section */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Common Bank Details (if same across all branches)</p>
            <p className="text-xs text-gray-500">If different per branch, fill those columns in Excel — those values will override</p>

            {/* IFSC — Feature 2: auto-fetch on regex match */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">IFSC Code</label>
              <div className="flex gap-2">
                <input
                  value={commonIfsc}
                  onChange={e => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11)
                    setCommonIfsc(val)
                    if (IFSC_RE.test(val) && !ifscLoading) triggerIfscFetch(val)
                  }}
                  placeholder="IFSC Code (11 chars)"
                  maxLength={11}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button type="button" onClick={() => triggerIfscFetch(commonIfsc)} disabled={ifscLoading || !IFSC_RE.test(commonIfsc)}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-60">
                  {ifscLoading ? '...' : '🏦 Fetch'}
                </button>
              </div>
              {commonIfsc.length > 0 && commonIfsc.length < 11 && (
                <p className="text-xs text-gray-400 mt-0.5">{11 - commonIfsc.length} more characters</p>
              )}
            </div>

            {/* Bank name — auto-filled */}
            <input value={commonBankName} onChange={e => setCommonBankName(e.target.value)}
              placeholder="Bank Name (auto-filled)"
              className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />

            {/* Feature 2: Account number with password toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
              <div className="relative">
                <input
                  type={showAccount ? 'text' : 'password'}
                  value={commonAccount}
                  onChange={e => setCommonAccount(e.target.value)}
                  placeholder="Account number (if same for all)"
                  className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={() => setShowAccount(v => !v)}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-sm"
                >
                  {showAccount ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Feature 2: Confirm account number */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Account Number</label>
              <div className="relative">
                <input
                  type={showAccount ? 'text' : 'password'}
                  value={confirmAccount}
                  onChange={e => setConfirmAccount(e.target.value)}
                  placeholder="Re-enter account number"
                  className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {accountMatch !== null && (
                  <span className="absolute right-2.5 top-2.5 text-sm">
                    {accountMatch ? '✅' : '❌'}
                  </span>
                )}
              </div>
              {accountMatch === false && (
                <p className="text-xs text-red-500 mt-0.5">Account numbers do not match</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('agreement')}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={() => setStep('upload')}
              disabled={!legalEntityName || !regionId || accountMatch === false}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              Next: Upload Excel →
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: EXCEL UPLOAD ─── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-800">Step 3: Upload Excel File</p>
            <p className="text-xs text-green-600 mt-1">Entity: <strong>{legalEntityName}</strong></p>
          </div>

          {/* Feature 3: Download template — client-side, headers only */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-800 mb-1">Download Template → Fill it in → Upload</p>
            <p className="text-xs text-blue-600 mb-3">Template has blank rows — you fill in the data</p>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              ⬇ Download Excel Template
            </button>
            <p className="text-xs text-blue-500 mt-2 font-mono">
              Columns: {TEMPLATE_HEADERS.join(' · ')}
            </p>
          </div>

          {/* Feature 3: Excel upload with parsing */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <input type="file" accept=".xlsx,.xls" id="bulk-excel"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
              className="hidden" />
            <label htmlFor="bulk-excel" className="cursor-pointer">
              <div className="text-5xl mb-3">📊</div>
              <p className="text-sm font-medium text-gray-700">Upload the filled Excel file</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx or .xls — max 5MB</p>
              <div className="mt-4 px-5 py-2 bg-green-600 text-white text-sm rounded-lg inline-block hover:bg-green-700">
                Browse Excel File
              </div>
            </label>
            {excelFile && parsedRows.length === 0 && !parseError && (
              <p className="text-xs text-gray-500 mt-2">Parsing {excelFile.name}...</p>
            )}
          </div>

          {/* Feature 3: Parse error */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-700 font-medium">⚠️ {parseError}</p>
            </div>
          )}

          {/* Feature 3: Preview table */}
          {parsedRows.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  {parsedRows.length} rows parsed
                </p>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-700 font-medium">✅ {validCount} valid</span>
                  {invalidCount > 0 && <span className="text-red-600 font-medium">❌ {invalidCount} invalid</span>}
                </div>
              </div>
              <div className="overflow-x-auto max-h-52">
                <table className="min-w-full text-xs divide-y divide-gray-100">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Clinic Name</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Phone</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Email</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {parsedRows.map((row, i) => {
                      const errors = validateRow(row)
                      const isValid = errors.length === 0
                      return (
                        <tr key={i} className={isValid ? 'bg-white' : 'bg-red-50'}>
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-800">
                            {row['Clinic Name'] || row['clinic_name*'] || row['clinic_name'] || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-gray-600 font-mono">
                            {row['Phone'] || row['contact_number*'] || row['contact_number'] || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">
                            {row['Email'] || row['email'] || '—'}
                          </td>
                          <td className="px-3 py-1.5">
                            {isValid
                              ? <span className="text-green-700 font-medium">✅ Valid</span>
                              : <span className="text-red-600" title={errors.join(', ')}>❌ {errors[0]}</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {invalidCount > 0 && (
                <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200">
                  <p className="text-xs text-yellow-700">
                    {invalidCount} invalid rows will be skipped. Only {validCount} valid rows will be uploaded.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <p className="text-xs text-yellow-700 font-medium">Important notes:</p>
            <ul className="text-xs text-yellow-600 mt-1 space-y-1 list-disc list-inside">
              <li>Channel Partner Name, Contact Person, Phone are mandatory</li>
              <li>If any branch has different bank details, fill those columns in Excel</li>
              <li>Duplicate channel partner names will be skipped</li>
              <li>Each channel partner will get a unique TSC-XXXXXX code auto-generated</li>
            </ul>
          </div>

          {/* Feature 3: Progress indicator while uploading */}
          {uploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-blue-800">
                  Uploading {validCount} clinics...
                </p>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-1.5">
                <div className="bg-blue-600 h-1.5 rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('entity')}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={handleUpload}
              disabled={!excelFile || parsedRows.length === 0 || validCount === 0 || uploading}
              className="flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              {uploading
                ? `⏳ Uploading ${validCount} clinics...`
                : `🚀 Upload ${validCount > 0 ? `${validCount} Valid` : ''} Clinics`}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 4: RESULT ─── */}
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

          {result.created.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-600 mb-2">Created Clinics:</p>
              {result.created.map((name, i) => (
                <p key={i} className="text-xs text-green-700 py-0.5">✅ {name}</p>
              ))}
            </div>
          )}

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

      {step !== 'result' && (
        <button onClick={onCancel}
          className="w-full py-2 text-gray-500 text-sm hover:text-gray-700">
          Cancel
        </button>
      )}
    </div>
  )
}

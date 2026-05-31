'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

interface LenderConfig {
  apiUrl?: string
  apiKey?: string
  apiSecret?: string
  authType?: string
  sandboxMode?: boolean
  agreementUrl?: string
  // Auto-fetched fields
  legalName?: string
  tradeName?: string
  gstin?: string
  pan?: string
  udyamNumber?: string
  address?: string
  pincode?: string
  bankName?: string
  accountNumber?: string
  ifscCode?: string
  contactPerson?: string
  contactEmail?: string
  contactPhone?: string
}

interface Lender {
  id: string
  name: string
  code: string
  isActive: boolean
  metadata?: LenderConfig
}

const EMPTY_CONFIG: LenderConfig = {
  apiUrl: '', apiKey: '', apiSecret: '',
  authType: 'API_KEY', sandboxMode: true, agreementUrl: '',
  legalName: '', tradeName: '', gstin: '', pan: '', udyamNumber: '',
  address: '', pincode: '', bankName: '', accountNumber: '', ifscCode: '',
  contactPerson: '', contactEmail: '', contactPhone: '',
}

export default function AdminLendersPage() {
  const [lenders, setLenders] = useState<Lender[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editLender, setEditLender] = useState<Lender | null>(null)
  const [form, setForm] = useState({ name: '', code: '' })
  const [config, setConfig] = useState<LenderConfig>(EMPTY_CONFIG)
  const [agreementFile, setAgreementFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'agreement' | 'basic' | 'api'>('agreement')
  const [testingApi, setTestingApi] = useState(false)
  const [gstLoading, setGstLoading] = useState(false)
  const [ifscLoading, setIfscLoading] = useState(false)
  const [panLoading, setPanLoading] = useState(false)

  const fetchLenders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lenders?all=1')
      const json = await res.json()
      setLenders(json.data ?? [])
    } catch {
      toast.error('Failed to load lenders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLenders() }, [fetchLenders])

  function upd(k: keyof LenderConfig, v: string | boolean) {
    setConfig(c => ({ ...c, [k]: v }))
  }

  function openAdd() {
    setEditLender(null)
    setForm({ name: '', code: '' })
    setConfig(EMPTY_CONFIG)
    setAgreementFile(null)
    setActiveTab('agreement')
    setShowForm(true)
  }

  function openEdit(l: Lender) {
    setEditLender(l)
    setForm({ name: l.name, code: l.code })
    setConfig({ ...EMPTY_CONFIG, ...(l.metadata ?? {}) })
    setAgreementFile(null)
    setActiveTab('agreement')
    setShowForm(true)
  }

  async function toggleActive(l: Lender) {
    const res = await fetch(`/api/lenders/${l.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !l.isActive }),
    })
    if (res.ok) { toast.success(l.isActive ? 'Deactivated' : 'Activated'); fetchLenders() }
    else toast.error('Failed to update')
  }

  // GST Auto-fetch
  async function fetchGST() {
    if (!config.gstin || config.gstin.length < 15) { toast.error('Enter a valid 15-character GSTIN'); return }
    setGstLoading(true)
    try {
      const res = await fetch(`/api/gst-verify?gstin=${config.gstin.toUpperCase()}`)
      const data = await res.json()
      if (data.success) {
        setConfig(c => ({
          ...c,
          legalName: data.legalName || c.legalName,
          tradeName: data.tradeName || c.tradeName,
          address: data.address || c.address,
          pincode: data.pincode || c.pincode,
        }))
        if (!form.name && (data.tradeName || data.legalName)) {
          setForm(f => ({ ...f, name: data.tradeName || data.legalName }))
        }
        toast.success('Details auto-filled from GST!')
      } else {
        toast.error(data.error || 'GST fetch failed — please fill manually')
      }
    } catch { toast.error('GST fetch failed — please fill manually') }
    finally { setGstLoading(false) }
  }

  // IFSC Auto-fetch
  async function fetchIFSC() {
    if (!config.ifscCode || config.ifscCode.length < 11) { toast.error('Enter a valid 11-character IFSC code'); return }
    setIfscLoading(true)
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${config.ifscCode.toUpperCase()}`)
      const data = await res.json()
      if (data.BANK) {
        setConfig(c => ({ ...c, bankName: `${data.BANK} — ${data.BRANCH}` }))
        toast.success('Bank details auto-filled!')
      } else { toast.error('IFSC not found — please enter manually') }
    } catch { toast.error('IFSC fetch failed') }
    finally { setIfscLoading(false) }
  }

  // PAN Auto-fetch (basic verification)
  async function fetchPAN() {
    if (!config.pan || config.pan.length < 10) { toast.error('Enter a valid 10-character PAN number'); return }
    setPanLoading(true)
    try {
      const res = await fetch(`/api/pan-verify?pan=${config.pan.toUpperCase()}`)
      const data = await res.json()
      if (data.success) {
        setConfig(c => ({ ...c, legalName: data.name || c.legalName }))
        toast.success('PAN verified!')
      } else { toast.error(data.error || 'PAN verification failed — please fill manually') }
    } catch { toast.error('PAN fetch failed — please fill manually') }
    finally { setPanLoading(false) }
  }

  // Test API
  async function testApiConnection() {
    if (!config.apiUrl) { toast.error('Please enter an API URL first'); return }
    setTestingApi(true)
    try {
      const res = await fetch('/api/lenders/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: config.apiUrl, apiKey: config.apiKey, authType: config.authType }),
      })
      const data = await res.json()
      if (data.success) toast.success('API connection successful!')
      else toast.error('API failed: ' + (data.error ?? 'Unknown'))
    } catch { toast.error('Connection test failed') }
    finally { setTestingApi(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.code) { toast.error('Lender name and code are required'); return }
    setSaving(true)
    try {
      let agreementUrl = config.agreementUrl ?? ''
      if (agreementFile) {
        const fd = new FormData()
        fd.append('file', agreementFile)
        fd.append('folder', 'lender-agreements')
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (upRes.ok) {
          const upData = await upRes.json()
          agreementUrl = upData.url ?? agreementUrl
        }
      }

      const payload = {
        name: form.name,
        code: form.code.toUpperCase(),
        metadata: { ...config, agreementUrl },
      }

      const url = editLender ? `/api/lenders/${editLender.id}` : '/api/lenders'
      const method = editLender ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Failed') }
      toast.success(editLender ? 'Lender updated!' : 'Lender added!')
      setShowForm(false)
      fetchLenders()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setSaving(false) }
  }

  const tabClass = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 sm:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Lender Management</h1>
            <p className="text-sm text-gray-500">API integrations, agreements & webhook setup</p>
          </div>
          <button onClick={openAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
            + Add Lender
          </button>
        </div>

        {/* Webhook info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">Share these Webhook URLs with the Lender</p>
          <div className="space-y-1">
            <p className="text-xs font-mono text-blue-700 bg-blue-100 px-3 py-1 rounded">
              Status: https://lms.trustivasetu.com/api/webhooks/lenders/&#123;LENDER_ID&#125;/status
            </p>
            <p className="text-xs font-mono text-blue-700 bg-blue-100 px-3 py-1 rounded">
              Disbursal: https://lms.trustivasetu.com/api/webhooks/lenders/&#123;LENDER_ID&#125;/disbursal
            </p>
          </div>
          <p className="text-xs text-blue-600 mt-2">⚡ Once webhooks are set up, leads will be decided within 5–10 minutes</p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Lender', 'Code', 'API Setup', 'Agreement', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lenders.map(l => {
                  const meta = l.metadata as LenderConfig | undefined
                  const hasApi = !!(meta?.apiUrl && meta?.apiKey)
                  const hasAgreement = !!meta?.agreementUrl
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800">{l.name}</p>
                        {meta?.gstin && <p className="text-xs text-gray-400 font-mono">{meta.gstin}</p>}
                        {meta?.sandboxMode && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Sandbox</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{l.code}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${hasApi ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {hasApi ? '✓ Configured' : '✗ Not set'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {hasAgreement
                          ? <a href={meta?.agreementUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                          : <span className="text-xs text-gray-400">Not uploaded</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {l.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(l)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                          <button onClick={() => toggleActive(l)}
                            className={`text-xs font-medium ${l.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}>
                            {l.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {lenders.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-400 text-sm"></p>
                <button onClick={openAdd} className="mt-3 text-sm text-blue-600 hover:underline"></button>
              </div>
            )}
          </div>
        )}

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-800">
                  {editLender ? `Edit: ${editLender.name}` : 'Add New Lender'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Name + Code always visible */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lender Name *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                      placeholder="e.g. HDFC Bank"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code * (max 10)</label>
                    <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required maxLength={10}
                      placeholder="HDFC"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b pb-2">
                  <button type="button" className={tabClass('agreement')} onClick={() => setActiveTab('agreement')}>
                    1. Agreement
                  </button>
                  <button type="button" className={tabClass('basic')} onClick={() => setActiveTab('basic')}>
                    2. Details (Auto-fetch)
                  </button>
                  <button type="button" className={tabClass('api')} onClick={() => setActiveTab('api')}>
                    3. API Config
                  </button>
                </div>

                {/* TAB 1: AGREEMENT */}
                {activeTab === 'agreement' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-sm font-medium text-blue-800 mb-1">Step 1: Upload Agreement</p>
                      <p className="text-xs text-blue-600">Upload the signed agreement in PDF, DOC or DOCX format</p>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                      <input type="file" accept=".pdf,.doc,.docx" id="agreement-upload"
                        onChange={e => setAgreementFile(e.target.files?.[0] ?? null)}
                        className="hidden" />
                      <label htmlFor="agreement-upload" className="cursor-pointer">
                        <div className="text-4xl mb-2">📄</div>
                        <p className="text-sm font-medium text-gray-700">Choose agreement file</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX supported</p>
                        <div className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg inline-block hover:bg-blue-700">
                          Browse File
                        </div>
                      </label>
                      {agreementFile && (
                        <p className="text-xs text-green-600 mt-3 font-medium">✓ {agreementFile.name}</p>
                      )}
                    </div>
                    {config.agreementUrl && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                        <p className="text-xs text-green-700 font-medium">Current Agreement:</p>
                        <a href={config.agreementUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline break-all">{config.agreementUrl}</a>
                      </div>
                    )}
                    <button type="button" onClick={() => setActiveTab('basic')}
                      className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                      Next: Fill Details →
                    </button>
                  </div>
                )}

                {/* TAB 2: BASIC DETAILS with auto-fetch */}
                {activeTab === 'basic' && (
                  <div className="space-y-4">
                    {/* GST Auto-fetch */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-sm font-medium text-blue-800 mb-2">Auto-fill from GST</p>
                      <div className="flex gap-2">
                        <input value={config.gstin ?? ''} onChange={e => upd('gstin', e.target.value.toUpperCase())}
                          placeholder="GSTIN (15 characters)" maxLength={15}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <button type="button" onClick={fetchGST} disabled={gstLoading}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-60 whitespace-nowrap">
                          {gstLoading ? 'Fetching...' : '🔍 Fetch'}
                        </button>
                      </div>
                    </div>

                    {/* PAN */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">PAN Number</label>
                        <input value={config.pan ?? ''} onChange={e => upd('pan', e.target.value.toUpperCase())}
                          placeholder="AAAAA0000A" maxLength={10}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div className="flex items-end">
                        <button type="button" onClick={fetchPAN} disabled={panLoading}
                          className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg disabled:opacity-60 whitespace-nowrap">
                          {panLoading ? '...' : 'Verify'}
                        </button>
                      </div>
                    </div>

                    {/* Udyam */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Udyam / MSME Number</label>
                      <input value={config.udyamNumber ?? ''} onChange={e => upd('udyamNumber', e.target.value.toUpperCase())}
                        placeholder="UDYAM-XX-00-0000000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>

                    {/* Auto-filled result */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Legal Name (auto-filled)</label>
                        <input value={config.legalName ?? ''} onChange={e => upd('legalName', e.target.value)}
                          placeholder="Auto-filled"
                          className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Trade Name (auto-filled)</label>
                        <input value={config.tradeName ?? ''} onChange={e => upd('tradeName', e.target.value)}
                          placeholder="Auto-filled"
                          className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Address (auto-filled)</label>
                        <input value={config.address ?? ''} onChange={e => upd('address', e.target.value)}
                          placeholder="Auto-filled from GST"
                          className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                        <input value={config.pincode ?? ''} onChange={e => upd('pincode', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                    </div>

                    {/* Bank Details with IFSC */}
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Bank Details</p>
                      <div className="flex gap-2 mb-3">
                        <input value={config.ifscCode ?? ''} onChange={e => upd('ifscCode', e.target.value.toUpperCase())}
                          placeholder="IFSC Code (11 chars)" maxLength={11}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <button type="button" onClick={fetchIFSC} disabled={ifscLoading}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-60 whitespace-nowrap">
                          {ifscLoading ? '...' : '🏦 Fetch Bank'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name (auto-filled)</label>
                          <input value={config.bankName ?? ''} onChange={e => upd('bankName', e.target.value)}
                            placeholder="Auto-filled"
                            className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
                          <input value={config.accountNumber ?? ''} onChange={e => upd('accountNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Contact Person</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                          <input value={config.contactPerson ?? ''} onChange={e => upd('contactPerson', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                          <input type="email" value={config.contactEmail ?? ''} onChange={e => upd('contactEmail', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                          <input value={config.contactPhone ?? ''} onChange={e => upd('contactPhone', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                      </div>
                    </div>

                    <button type="button" onClick={() => setActiveTab('api')}
                      className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                      Next: API Config →
                    </button>
                  </div>
                )}

                {/* TAB 3: API CONFIG */}
                {activeTab === 'api' && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                      <p className="text-xs text-green-700 font-medium">
                        ⚡ Configuring the API enables automatic lead decisions within 5–10 minutes
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Auth Type</label>
                      <select value={config.authType} onChange={e => upd('authType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="API_KEY">API Key</option>
                        <option value="OAUTH">OAuth 2.0</option>
                        <option value="BASIC">Basic Auth</option>
                        <option value="BEARER">Bearer Token</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                      <input value={config.apiUrl ?? ''} onChange={e => upd('apiUrl', e.target.value)}
                        placeholder="https://api.lender.com/v1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key / Client ID</label>
                        <input value={config.apiKey ?? ''} onChange={e => upd('apiKey', e.target.value)}
                          type="password" placeholder="••••••••"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
                        <input value={config.apiSecret ?? ''} onChange={e => upd('apiSecret', e.target.value)}
                          type="password" placeholder="••••••••"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={config.sandboxMode ?? true}
                        onChange={e => upd('sandboxMode', e.target.checked)}
                        className="rounded text-blue-600" />
                      <span className="text-sm text-gray-700">Sandbox Mode (testing — disable for production)</span>
                    </label>
                    <button type="button" onClick={testApiConnection} disabled={testingApi}
                      className="w-full py-2 border-2 border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-60">
                      {testingApi ? 'Testing...' : '🔌 Test API Connection'}
                    </button>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                      <p className="text-xs text-yellow-700 font-medium">Share with Lender (Webhook URLs):</p>
                      <p className="text-xs font-mono text-yellow-700 mt-1">
                        https://lms.trustivasetu.com/api/webhooks/lenders/{editLender?.id ?? 'LENDER_ID'}/status
                      </p>
                      <p className="text-xs font-mono text-yellow-700">
                        https://lms.trustivasetu.com/api/webhooks/lenders/{editLender?.id ?? 'LENDER_ID'}/disbursal
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <div className="flex gap-3 pt-2 border-t">
                  <button type="submit" disabled={saving}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                    {saving ? 'Saving...' : editLender ? 'Update Lender' : 'Add Lender'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

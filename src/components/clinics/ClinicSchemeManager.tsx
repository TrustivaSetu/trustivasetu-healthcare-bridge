'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface SchemeTemplate {
  id: string
  name: string
  tenure: number
  advanceEmi: number
  balanceEmi: number
  isCustom: boolean
}

interface ClinicScheme {
  id: string
  schemeTemplateId: string
  hospitalSubventionPct: number
  subventionGstType: 'INCLUDED' | 'EXCLUDED'
  gstOnSubvention: number
  totalSubventionPct: number
  processingFeePct: number
  processingFeeGstType: 'INCLUDED' | 'EXCLUDED'
  gstOnPF: number
  schemeTemplate: SchemeTemplate
}

interface Props {
  clinicId: string
  isAdmin?: boolean
}

const GST_RATE = 18

export function ClinicSchemeManager({ clinicId, isAdmin = false }: Props) {
  const [templates, setTemplates] = useState<SchemeTemplate[]>([])
  const [clinicSchemes, setClinicSchemes] = useState<ClinicScheme[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddScheme, setShowAddScheme] = useState(false)
  const [showAddTemplate, setShowAddTemplate] = useState(false)

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [subventionPct, setSubventionPct] = useState('')
  const [subventionGstType, setSubventionGstType] = useState<'INCLUDED' | 'EXCLUDED'>('EXCLUDED')
  const [pfPct, setPfPct] = useState('0')
  const [pfGstType, setPfGstType] = useState<'INCLUDED' | 'EXCLUDED'>('EXCLUDED')
  const [editingScheme, setEditingScheme] = useState<ClinicScheme | null>(null)

  // New template form
  const [newTenure, setNewTenure] = useState('')
  const [newAdvanceEmi, setNewAdvanceEmi] = useState('0')

  useEffect(() => {
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  async function fetchAll() {
    setLoading(true)
    try {
      const [tRes, sRes] = await Promise.all([
        fetch('/api/schemes'),
        fetch(`/api/clinics/${clinicId}/schemes`),
      ])
      const [tData, sData] = await Promise.all([tRes.json(), sRes.json()])
      setTemplates(tData.data ?? [])
      setClinicSchemes(sData.data ?? [])
    } catch { toast.error('Data load failed') }
    finally { setLoading(false) }
  }

  // Already added scheme IDs
  const addedTemplateIds = new Set(clinicSchemes.map(s => s.schemeTemplateId))
  const availableTemplates = templates.filter(t => !addedTemplateIds.has(t.id))

  // Live calculation
  const subPct = parseFloat(subventionPct) || 0
  const totalSubvention = subventionGstType === 'EXCLUDED'
    ? subPct * (1 + GST_RATE / 100)
    : subPct
  const subventionGstAmount = subventionGstType === 'EXCLUDED'
    ? subPct * GST_RATE / 100
    : subPct - (subPct / (1 + GST_RATE / 100))

  const pfPctNum = parseFloat(pfPct) || 0
  const totalPF = pfGstType === 'EXCLUDED'
    ? pfPctNum * (1 + GST_RATE / 100)
    : pfPctNum
  const pfGstAmount = pfGstType === 'EXCLUDED'
    ? pfPctNum * GST_RATE / 100
    : pfPctNum - (pfPctNum / (1 + GST_RATE / 100))

  function openEditScheme(cs: ClinicScheme) {
    setEditingScheme(cs)
    setSelectedTemplateId(cs.schemeTemplateId)
    setSubventionPct(String(cs.hospitalSubventionPct))
    setSubventionGstType(cs.subventionGstType)
    setPfPct(String(cs.processingFeePct))
    setPfGstType(cs.processingFeeGstType)
    setShowAddScheme(true)
  }

  function resetForm() {
    setShowAddScheme(false)
    setEditingScheme(null)
    setSelectedTemplateId('')
    setSubventionPct('')
    setPfPct('0')
    setSubventionGstType('EXCLUDED')
    setPfGstType('EXCLUDED')
  }

  async function addScheme() {
    if (!selectedTemplateId) { toast.error('Please select a scheme'); return }
    if (!subventionPct || parseFloat(subventionPct) <= 0) { toast.error('Please enter a subvention %'); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/schemes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeTemplateId: selectedTemplateId,
          hospitalSubventionPct: parseFloat(subventionPct),
          subventionGstType,
          gstOnSubvention: GST_RATE,
          processingFeePct: parseFloat(pfPct) || 0,
          processingFeeGstType: pfGstType,
          gstOnPF: GST_RATE,
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success(editingScheme ? 'Scheme updated!' : 'Scheme added!')
      resetForm()
      fetchAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setSaving(false) }
  }

  async function removeScheme(schemeId: string) {
    if (!confirm('Is scheme ko remove karna chahte ho?')) return
    try {
      await fetch(`/api/clinics/${clinicId}/schemes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeId }),
      })
      toast.success('Scheme removed')
      fetchAll()
    } catch { toast.error('Remove failed') }
  }

  async function addTemplate() {
    if (!newTenure) { toast.error('Please enter a tenure'); return }
    const t = parseInt(newTenure)
    const a = parseInt(newAdvanceEmi)
    if (a >= t) { toast.error('Advance EMI must be less than tenure'); return }

    try {
      const res = await fetch('/api/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenure: t, advanceEmi: a }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Scheme ${t}/${a} added!`)
      setShowAddTemplate(false)
      setNewTenure('')
      setNewAdvanceEmi('0')
      fetchAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">Agreed Loan Schemes</p>
          <p className="text-xs text-gray-500">{clinicSchemes.length} scheme(s) configured</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => setShowAddTemplate(!showAddTemplate)}
              className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700">
              + New Scheme Type
            </button>
          )}
          <button onClick={() => setShowAddScheme(!showAddScheme)}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
            + Add Scheme
          </button>
        </div>
      </div>

      {/* Add New Template (Admin only) */}
      {isAdmin && showAddTemplate && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-purple-800">New Scheme Type Create Karo</p>
          <p className="text-xs text-purple-600">Format: Tenure/AdvanceEMI (e.g. 15/5)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tenure (months) *</label>
              <input type="number" value={newTenure} onChange={e => setNewTenure(e.target.value)}
                placeholder="e.g. 15" min={1} max={120}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Advance EMI count</label>
              <input type="number" value={newAdvanceEmi} onChange={e => setNewAdvanceEmi(e.target.value)}
                placeholder="e.g. 5" min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          {newTenure && (
            <div className="bg-white rounded-lg p-2 text-xs text-gray-600">
              Preview: <strong>{newTenure}/{newAdvanceEmi}</strong> —
              Balance EMI = {Math.max(0, parseInt(newTenure || '0') - parseInt(newAdvanceEmi || '0'))} months
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={addTemplate}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
              Create Scheme
            </button>
            <button onClick={() => setShowAddTemplate(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Scheme */}
      {showAddScheme && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
          <p className="text-sm font-bold text-blue-800">{editingScheme ? `Edit Scheme: ${editingScheme.schemeTemplate.name}` : 'Add Scheme for Channel Partner'}</p>

          {/* Scheme Select */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Select Scheme *</label>
            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
              {availableTemplates.map(t => (
                <button key={t.id} type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    selectedTemplateId === t.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-blue-300 bg-white'
                  }`}>
                  {t.name}
                  {t.isCustom && <span className="ml-1 text-yellow-500">★</span>}
                </button>
              ))}
              {availableTemplates.length === 0 && (
                <p className="col-span-4 text-xs text-gray-400 text-center py-2">All schemes have already been added</p>
              )}
            </div>
          </div>

          {/* Scheme Preview */}
          {selectedTemplate && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-700">Selected: {selectedTemplate.name}</p>
              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                <span>Tenure: {selectedTemplate.tenure}m</span>
                <span>Advance EMI: {selectedTemplate.advanceEmi}</span>
                <span>Balance EMI: {selectedTemplate.balanceEmi}m</span>
              </div>
            </div>
          )}

          {/* Subvention */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-gray-700">Channel Partner Subvention</p>
            <p className="text-xs text-gray-500">Channel partner pays this amount to the lender (not visible to customer)</p>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Subvention % *</label>
                <input type="number" value={subventionPct}
                  onChange={e => setSubventionPct(e.target.value)}
                  placeholder="e.g. 9" step="0.1" min="0" max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GST Type</label>
                <div className="flex gap-1 mt-1">
                  {(['EXCLUDED', 'INCLUDED'] as const).map(type => (
                    <button key={type} type="button"
                      onClick={() => setSubventionGstType(type)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        subventionGstType === type
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600'
                      }`}>
                      GST {type === 'EXCLUDED' ? 'Extra' : 'Incl.'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subvention Live Calc */}
            {subPct > 0 && (
              <div className="bg-gray-50 rounded-lg p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Channel Partner Subvention</span>
                  <span className="font-medium">{subPct.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GST @18% ({subventionGstType === 'EXCLUDED' ? 'Extra' : 'Incl.'})</span>
                  <span className="font-medium">{subventionGstAmount.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="font-bold text-gray-700">Total Subvention to Lender</span>
                  <span className="font-bold text-orange-600">{totalSubvention.toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Processing Fee */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-gray-700">💳 Processing Fee (Customer pays)</p>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">PF %</label>
                <div className="flex gap-1 flex-wrap">
                  {[0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(p => (
                    <button key={p} type="button"
                      onClick={() => setPfPct(String(p))}
                      className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                        pfPct === String(p)
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-orange-300'
                      }`}>
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GST Type</label>
                <div className="flex gap-1 mt-1">
                  {(['EXCLUDED', 'INCLUDED'] as const).map(type => (
                    <button key={type} type="button"
                      onClick={() => setPfGstType(type)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        pfGstType === type
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600'
                      }`}>
                      GST {type === 'EXCLUDED' ? 'Extra' : 'Incl.'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* PF Live Calc */}
            {pfPctNum > 0 && (
              <div className="bg-gray-50 rounded-lg p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Processing Fee</span>
                  <span className="font-medium">{pfPctNum.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GST @18% ({pfGstType === 'EXCLUDED' ? 'Extra' : 'Incl.'})</span>
                  <span className="font-medium">{pfGstAmount.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="font-bold text-gray-700">Total PF (Customer pays)</span>
                  <span className="font-bold text-blue-600">{totalPF.toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>

          {!selectedTemplateId && (
            <p className="text-xs text-red-600 font-medium">
              ⚠️ Please select a scheme above before saving
            </p>
          )}
          {selectedTemplateId && (!subventionPct || parseFloat(subventionPct) <= 0) && (
            <p className="text-xs text-red-600 font-medium">
              ⚠️ Please enter a valid subvention % (must be greater than 0)
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={addScheme} disabled={saving || !selectedTemplateId || !subventionPct || parseFloat(subventionPct) <= 0}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving...' : editingScheme ? '✅ Update Scheme' : '✅ Add Scheme'}
            </button>
            <button onClick={resetForm}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing Schemes List */}
      {clinicSchemes.length === 0 && !showAddScheme && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-sm text-yellow-700">No schemes configured</p>
          <p className="text-xs text-yellow-500 mt-1">Click + Add Scheme to get started</p>
        </div>
      )}

      {clinicSchemes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Configured Schemes</p>
          {clinicSchemes.map(cs => (
            <div key={cs.id} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-lg font-bold text-blue-700">{cs.schemeTemplate.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {cs.schemeTemplate.tenure}m tenure • {cs.schemeTemplate.advanceEmi} advance EMI • {cs.schemeTemplate.balanceEmi} balance EMI
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditScheme(cs)}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium">Edit</button>
                  <button onClick={() => removeScheme(cs.id)}
                    className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {/* Subvention */}
                <div className="bg-orange-50 rounded-lg p-2">
                  <p className="font-medium text-orange-700 mb-1">Subvention (Internal)</p>
                  <p className="text-gray-600">Channel Partner: {cs.hospitalSubventionPct}%</p>
                  <p className="text-gray-600">GST: {cs.subventionGstType === 'EXCLUDED' ? 'Extra' : 'Incl.'} @18%</p>
                  <p className="font-bold text-orange-700">Total: {cs.totalSubventionPct.toFixed(2)}%</p>
                </div>
                {/* PF */}
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="font-medium text-blue-700 mb-1">💳 PF (Customer)</p>
                  <p className="text-gray-600">PF: {cs.processingFeePct}%</p>
                  <p className="text-gray-600">GST: {cs.processingFeeGstType === 'EXCLUDED' ? 'Extra' : 'Incl.'} @18%</p>
                  <p className="font-bold text-blue-700">
                    Total: {cs.processingFeeGstType === 'EXCLUDED'
                      ? (cs.processingFeePct * 1.18).toFixed(2)
                      : cs.processingFeePct.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

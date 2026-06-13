'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'

import { ClinicTable } from '@/components/clinics/ClinicTable'
import { ClinicForm } from '@/components/clinics/ClinicForm'
import { ClinicBulkUpload } from '@/components/clinics/ClinicBulkUpload'
import { CredentialsModal } from '@/components/clinics/CredentialsModal'
import { hasPermission } from '@/lib/permissions'
import toast from 'react-hot-toast'

export default function ClinicsPage() {
  const { user: session } = useTabSession()
  const [clinics, setClinics] = useState<unknown[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [regionId, setRegionId] = useState('')
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [editClinic, setEditClinic] = useState<unknown>(null)

  const canCreate = session && hasPermission(session?.role, 'CLINIC_CREATE')
  const canDelete = session && hasPermission(session?.role, 'CLINIC_DELETE')

  type CredResult = { clinicName: string; email: string; plainPassword: string; emailSent: boolean; generatedAt: string; generatedBy: string }
  const [genLoading, setGenLoading] = useState<string | null>(null)
  const [credResult, setCredResult] = useState<CredResult | null>(null)

  useEffect(() => {
    fetch('/api/regions').then(r => r.json()).then(d => setRegions(d.data ?? []))
  }, [])

  const fetchClinics = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (search) params.set('search', search)
    if (regionId) params.set('regionId', regionId)
    const res = await fetch(`/api/clinics?${params}`)
    const data = await res.json()
    setClinics(data.data ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, search, regionId])

  useEffect(() => { fetchClinics() }, [fetchClinics])

  async function handleDelete(clinic: { id: string; name: string }) {
    if (!confirm(`Permanently delete clinic "${clinic.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/clinics/${clinic.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Clinic deleted')
      fetchClinics()
    } else {
      toast.error('Failed to delete clinic')
    }
  }

  async function handleGenerateCredentials(clinicId: string, _clinicName: string) {
    if (genLoading) return
    setGenLoading(clinicId)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/generate-credentials`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to generate credentials'); return }
      setCredResult(data)
      fetchClinics()
    } catch { toast.error('Something went wrong') }
    finally { setGenLoading(null) }
  }

  async function handleExport() {
    const params = new URLSearchParams({ type: 'clinics' })
    if (search) params.set('search', search)
    if (regionId) params.set('regionId', regionId)
    const res = await fetch(`/api/export?${params}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `clinics-${new Date().toISOString().split('T')[0]}.xlsx`
    a.click(); URL.revokeObjectURL(url)
  }

  const pageCount = Math.ceil(total / 20)

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text" placeholder="Search channel partners..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-64"
          />
          <select value={regionId} onChange={e => { setRegionId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
            <option value="">All Regions</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <div className="ml-auto flex gap-2">
            {canCreate && (
              <>
                {/* Bulk Upload Button */}
                <button
                  onClick={() => { setShowBulk(true) }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Bulk Upload (5+ Channel Partners)
                </button>

                {/* Single Add Button */}
                <button
                  onClick={() => { setEditClinic(null); setShowForm(true) }}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Channel Partner
                </button>
              </>
            )}

            <button onClick={handleExport}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Single Clinic Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-semibold text-gray-800">
                  {editClinic ? 'Edit Channel Partner' : 'Add New Channel Partner'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ClinicForm
                initial={editClinic as Parameters<typeof ClinicForm>[0]['initial']}
                onSuccess={() => { setShowForm(false); fetchClinics() }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        )}

        {/* Bulk Upload Modal */}
        {showBulk && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Bulk Clinic Upload</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Onboard Legal Entity's branches in bulk</p>
                </div>
                <button onClick={() => setShowBulk(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ClinicBulkUpload
                onSuccess={() => { setShowBulk(false); fetchClinics() }}
                onCancel={() => setShowBulk(false)}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : (
          <ClinicTable
            clinics={clinics as Parameters<typeof ClinicTable>[0]['clinics']}
            onEdit={canCreate ? (c) => { setEditClinic(c); setShowForm(true) } : undefined}
            onDelete={canDelete ? (handleDelete as unknown as Parameters<typeof ClinicTable>[0]['onDelete']) : undefined}
            canDelete={!!canDelete}
            onGenerateCredentials={session?.role !== 'CLINIC_USER' ? handleGenerateCredentials : undefined}
          />
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex justify-center items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span className="text-sm text-gray-600">Page {page} of {pageCount}</span>
            <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        )}
      </div>

      {credResult && (
        <CredentialsModal result={credResult} onClose={() => setCredResult(null)} />
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { formatDate, cn } from '@/lib/utils'
import { useTabSession } from '@/contexts/TabSessionContext'
import toast from 'react-hot-toast'

const ENTITY_TYPES = ['ALL', 'Lead', 'Clinic', 'Lender', 'User']

const TYPE_BADGE: Record<string, string> = {
  Lead: 'bg-blue-100 text-blue-700',
  Clinic: 'bg-purple-100 text-purple-700',
  Lender: 'bg-yellow-100 text-yellow-700',
  User: 'bg-red-100 text-red-700',
}

interface RecycleBinItem {
  id: string
  entityType: string
  entityId: string
  entityName: string
  deletedBy: string
  deletedAt: string
  snapshot: Record<string, unknown>
  deletedByUser: { id: string; name: string; email: string } | null
}

export default function RecycleBinPage() {
  const { user } = useTabSession()
  const [items, setItems] = useState<RecycleBinItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [entityType, setEntityType] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 20

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), entityType })
    fetch(`/api/recycle-bin?${params}`)
      .then(r => r.json())
      .then(d => { setItems(d.data ?? []); setTotal(d.total ?? 0); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(load, [entityType, page])

  async function permanentDelete(id: string, name: string) {
    if (!confirm(`Permanently delete "${name}" from Recycle Bin? This cannot be undone.`)) return
    const res = await fetch(`/api/recycle-bin/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Permanently deleted'); load() }
    else toast.error('Delete failed')
  }

  async function restore(id: string, name: string) {
    const res = await fetch(`/api/recycle-bin/${id}`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) { toast.success(`"${name}" restored successfully`); load() }
    else toast.error(data.error ?? 'Restore failed')
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Recycle Bin" />
        <div className="p-6 text-center text-gray-500">Super Admin only</div>
      </div>
    )
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Recycle Bin" subtitle={`${total} deleted items`} />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {ENTITY_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setEntityType(t); setPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition',
                entityType === t ? 'bg-trustiva-navy text-trustiva-lime border-trustiva-navy' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Type', 'Name', 'Deleted By', 'Deleted At', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', TYPE_BADGE[item.entityType] ?? 'bg-gray-100 text-gray-700')}>
                          {item.entityType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{item.entityName}</p>
                        <p className="text-xs text-gray-400 font-mono">{item.entityId.slice(-8)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.deletedByUser?.name ?? item.deletedBy.slice(-6)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(item.deletedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => restore(item.id, item.entityName)}
                            className="px-2.5 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => permanentDelete(item.id, item.entityName)}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition"
                          >
                            Delete Forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Recycle bin is empty</p>}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Prev</button>
              <button type="button" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

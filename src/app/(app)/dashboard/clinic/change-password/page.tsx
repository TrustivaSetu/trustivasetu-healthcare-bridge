'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { useTabSession } from '@/contexts/TabSessionContext'
import toast from 'react-hot-toast'

const TOKEN_KEY = 'trustiva-tab-token'

export default function ClinicChangePasswordPage() {
  const router = useRouter()
  const { user } = useTabSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const isMustChange = user?.mustChangePassword === true

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { toast.error('Passwords do not match'); return }
    if (next.length < 8) { toast.error('Password must be at least 8 characters'); return }

    setLoading(true)
    try {
      const token = sessionStorage.getItem(TOKEN_KEY)
      const res = await fetch('/api/clinic/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }

      // Update tab session token
      if (data.token) {
        sessionStorage.setItem(TOKEN_KEY, data.token)
        // Reload page to re-read the new token
        toast.success('Password changed successfully')
        setTimeout(() => { window.location.href = '/dashboard/clinic' }, 800)
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Change Password" />

      <div className="flex-1 p-6 flex justify-center">
        <div className="w-full max-w-md">
          {isMustChange && (
            <div className="mb-5 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
              You must change your password before accessing the portal.
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-5">Set New Password</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
                <input
                  type="password"
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                <input
                  type="password"
                  value={next}
                  onChange={e => setNext(e.target.value)}
                  required
                  minLength={8}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
                  placeholder="Re-enter new password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-trustiva-navy text-trustiva-lime font-semibold py-2.5 rounded-lg hover:bg-gray-800 transition disabled:opacity-60 text-sm"
              >
                {loading ? 'Saving...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

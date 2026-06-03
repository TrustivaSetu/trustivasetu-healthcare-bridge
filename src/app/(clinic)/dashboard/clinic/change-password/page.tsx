'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { storeTabToken } from '@/contexts/TabSessionContext'
import toast from 'react-hot-toast'

export default function ClinicChangePasswordPage() {
  const router = useRouter()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (form.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/clinic/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to change password')
        return
      }
      // Store new token (without mustChangePassword)
      if (data.token) {
        storeTabToken(data.token)
        window.dispatchEvent(new Event('trustiva-session-change'))
      }
      toast.success('Password changed successfully')
      router.replace('/dashboard/clinic')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">Change Password</h1>
        <p className="text-sm text-gray-500">Set a new secure password for your clinic portal</p>
      </div>

      <div className="flex-1 p-6 flex items-start justify-center">
        <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 mb-5">
            Please set a new password to secure your account before continuing.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={form.currentPassword}
                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-trustiva-navy text-trustiva-lime font-semibold py-2.5 rounded-lg hover:bg-gray-800 transition disabled:opacity-60"
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

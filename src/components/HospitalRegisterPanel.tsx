'use client'

import { useState } from 'react'

const empty = {
  identifierName: '',
  fullName: '',
  phone: '',
  email: '',
  building: '',
  locality: '',
  pincode: '',
  city: '',
  state: '',
  hospitalType: '',
  accountName: '',
  accountNo: '',
  bankName: '',
  bankBranch: '',
  ifsc: '',
}

type Props = {
  onSync: (payload: Record<string, unknown>) => Promise<unknown>
  onRegistered: (displayName: string) => void
  syncing: boolean
}

export function HospitalRegisterPanel({ onSync, onRegistered, syncing }: Props) {
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')

  const set = (name: keyof typeof empty, value: string) =>
    setForm((p) => ({ ...p, [name]: value }))

  async function handleRegister() {
    setError('')
    const displayName =
      form.fullName.trim() ||
      `${form.identifierName.trim()} - ${form.city.trim().toUpperCase()}`.trim()
    if (!displayName || displayName === ' - ') {
      setError('Full name or Identifier + City required')
      return
    }
    if (!form.phone || !/^[6-9]\d{9}$/.test(form.phone)) {
      setError('Valid 10-digit phone required')
      return
    }

    try {
      await onSync({
        identifierName: form.identifierName,
        fullName: displayName,
        name: displayName,
        phone: form.phone,
        email: form.email || undefined,
        address: [form.building, form.locality, form.city, form.state].filter(Boolean).join(', '),
        locality: form.locality,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        hospitalType: form.hospitalType,
        accountNumber: form.accountNo,
        accountName: form.accountName,
        bankName: form.bankName,
        bankBranch: form.bankBranch,
        ifsc: form.ifsc,
        contactPerson: form.fullName || form.identifierName,
        contactNumber: form.phone,
      })
      onRegistered(displayName)
      setForm(empty)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    }
  }

  const field = (label: string, name: keyof typeof empty, type = 'text', required = false) => (
    <div>
      <label className="text-sm text-gray-400">{label}{required ? ' *' : ''}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        className="w-full px-3 py-2 bg-white/10 rounded mt-2"
      />
    </div>
  )

  return (
    <div className="space-y-6 overflow-y-auto max-h-[85vh] pr-2">
      <h3 className="text-2xl font-semibold">Register Healthcare Partner</h3>
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {field('Identifier Name', 'identifierName', 'text', true)}
          {field('Full Name', 'fullName', 'text', true)}
          {field('Phone no', 'phone', 'text', true)}
          {field('Email', 'email', 'email')}
          {field('Account Name', 'accountName')}
          {field('Account no', 'accountNo')}
          {field('Bank Name', 'bankName')}
          {field('Bank Branch', 'bankBranch')}
          {field('IFSC Code', 'ifsc')}
        </div>
        <div className="space-y-4">
          {field('Building/House no', 'building', 'text', true)}
          {field('Locality/Area', 'locality', 'text', true)}
          {field('Pincode', 'pincode', 'text', true)}
          {field('City', 'city', 'text', true)}
          {field('State', 'state', 'text', true)}
          <div>
            <label className="text-sm text-gray-400">Channel Partner Type *</label>
            <select
              value={form.hospitalType}
              onChange={(e) => set('hospitalType', e.target.value)}
              className="w-full px-3 py-2 bg-white/10 rounded mt-2"
            >
              <option value="">Select hospital type</option>
              <option>Multispeciality</option>
              <option>Clinic</option>
              <option>Eye Hospital</option>
              <option>Dental</option>
            </select>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={syncing}
        onClick={handleRegister}
        className="w-full bg-lime-300 text-black px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
      >
        {syncing ? 'Syncing to LMS…' : 'Register Healthcare Partner'}
      </button>
    </div>
  )
}

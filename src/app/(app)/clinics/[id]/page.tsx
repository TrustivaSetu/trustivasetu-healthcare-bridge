'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { useTabSession } from '@/contexts/TabSessionContext'
import toast from 'react-hot-toast'

import { formatDate, formatLakhs, cn } from '@/lib/utils'
import { CredentialsModal } from '@/components/clinics/CredentialsModal'

export default function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useTabSession()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [leads, setLeads] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [qrError, setQrError] = useState(false)
  const [copied, setCopied] = useState<'id' | 'link' | null>(null)
  const [portalStatus, setPortalStatus] = useState<{ portalAccessSent: boolean; portalUser: { email: string; mustChangePassword: boolean } | null } | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(null)
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null)
  const [reportSending, setReportSending] = useState(false)
  const [reportEmails, setReportEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)

  type CredResult = { clinicName: string; email: string; plainPassword: string; emailSent: boolean; generatedAt: string; generatedBy: string }
  const [credResult, setCredResult] = useState<CredResult | null>(null)
  const [genLoading, setGenLoading] = useState(false)

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isClinicUser = user?.role === 'CLINIC_USER'
  const canManageReportEmails = isAdmin || isClinicUser

  useEffect(() => {
    Promise.all([
      fetch(`/api/clinics/${id}`).then(r => r.json()),
      fetch(`/api/leads?clinicId=${id}&pageSize=10`).then(r => r.json()),
    ]).then(([c, l]) => {
      setData(c.data)
      setLeads(l.data ?? [])
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (isAdmin) {
      fetch(`/api/clinics/${id}/portal-access`)
        .then(r => r.json())
        .then(d => setPortalStatus(d.data ?? null))
        .catch(() => {})
    }
  }, [id, isAdmin])

  useEffect(() => {
    if (canManageReportEmails) {
      fetch(`/api/clinics/${id}/report-emails`)
        .then(r => r.json())
        .then(d => setReportEmails(d.data ?? []))
        .catch(() => {})
    }
  }, [id, canManageReportEmails])

  function handleGrantAccess() {
    setIsResetting(false)
    setShowConfirmModal(true)
  }

  function handleResetAccess() {
    setIsResetting(true)
    setShowConfirmModal(true)
  }

  async function confirmPortalAccess() {
    setShowConfirmModal(false)
    setPortalLoading(true)
    try {
      const res = await fetch(`/api/clinics/${id}/portal-access`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      setCredentials({ email: data.email, tempPassword: data.tempPassword })
      setShowCredentials(true)
      toast.success('Portal access granted successfully')
      fetch(`/api/clinics/${id}/portal-access`).then(r => r.json()).then(d => setPortalStatus(d.data ?? null))
    } catch { toast.error('Something went wrong') }
    finally { setPortalLoading(false) }
  }

  function copyToClipboard(text: string, field: 'email' | 'password') {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  async function saveReportEmails(emails: string[]) {
    setEmailSaving(true)
    try {
      const res = await fetch(`/api/clinics/${id}/report-emails`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportEmails: emails }),
      })
      const d = await res.json()
      if (res.ok) { setReportEmails(d.data ?? emails); toast.success('Report emails updated') }
      else toast.error(d.error ?? 'Failed to save')
    } catch { toast.error('Something went wrong') }
    finally { setEmailSaving(false) }
  }

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault()
    const email = newEmail.trim().toLowerCase()
    if (!email || reportEmails.includes(email)) return
    const updated = [...reportEmails, email]
    setNewEmail('')
    await saveReportEmails(updated)
  }

  async function handleRemoveEmail(email: string) {
    await saveReportEmails(reportEmails.filter(e => e !== email))
  }

  async function handleSendReport() {
    setReportSending(true)
    try {
      // Uses the tab Bearer token automatically (fetch interceptor adds Authorization header)
      const res = await fetch(`/api/clinics/${id}/send-report`, { method: 'POST' })
      const data = await res.json()
      if (data.sent > 0) toast.success('Monthly report sent successfully')
      else if (data.sent === 0) toast.error('No email configured or SMTP not set up')
      else toast.error(data.error ?? 'Failed to send report')
    } catch { toast.error('Something went wrong') }
    finally { setReportSending(false) }
  }

  async function handleGenerateCredentials() {
    setGenLoading(true)
    try {
      const res = await fetch(`/api/clinics/${id}/generate-credentials`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to generate credentials'); return }
      setCredResult(data)
      // Refresh portal status
      fetch(`/api/clinics/${id}/portal-access`).then(r => r.json()).then(d => setPortalStatus(d.data ?? null))
    } catch { toast.error('Something went wrong') }
    finally { setGenLoading(false) }
  }

  const clinic = data as Record<string, unknown> | null
  const externalId = clinic?.externalId as string | undefined

  const chatLink = typeof window !== 'undefined'
    ? `${window.location.origin}/chat?clinic=${encodeURIComponent(externalId ?? id)}`
    : `/chat?clinic=${encodeURIComponent(externalId ?? id)}`

  function copy(text: string, type: 'id' | 'link') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const downloadQr = useCallback(() => {
    const a = document.createElement('a')
    a.href = `/api/clinics/${id}/qr`
    a.download = `trustiva-qr-${externalId ?? id}.png`
    a.click()
  }, [id, externalId])

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Channel Partner Details" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }
  if (!clinic) return <div className="p-6 text-red-600">Channel Partner not found</div>

  return (
    <div className="flex flex-col min-h-full">
      <Header title={clinic.name as string} subtitle="Channel Partner Details" />

      <div className="flex-1 p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/clinics" className="hover:text-blue-600">Channel Partners</Link>
          <span>/</span>
          <span className="text-gray-800">{clinic.name as string}</span>
        </div>

        {/* Main info + target row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Channel Partner Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoItem label="Address" value={clinic.address as string} />
              <InfoItem label="Contact Person" value={clinic.contactPerson as string} />
              <InfoItem label="Contact Number" value={clinic.contactNumber as string} />
              <InfoItem label="Email" value={(clinic.email as string) ?? '—'} />
              <InfoItem label="Account Number" value={(clinic.accountNumber as string) ?? '—'} />
              <InfoItem label="Business Potential" value={formatLakhs(clinic.businessPotential as number)} />
              <InfoItem label="Region" value={(clinic.region as Record<string, string>)?.name ?? '—'} />
              <InfoItem label="Assigned RM" value={(clinic.assignedRM as Record<string, string>)?.name ?? 'Not Assigned'} />
              <InfoItem label="Onboarded" value={formatDate(clinic.onboardedAt as string)} />
              <InfoItem label="Status" value={clinic.isActive ? 'Active' : 'Inactive'} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">This Month&apos;s Target</h3>
            {Array.isArray(clinic.targets) && (clinic.targets as unknown[]).length > 0 ? (
              <div className="space-y-3">
                {(clinic.targets as Array<Record<string, unknown>>).map(t => (
                  <div key={t.id as string}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Leads Target</span>
                      <span className="font-semibold">{t.leadsTarget as number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Disbursal Target</span>
                      <span className="font-semibold">{formatLakhs(t.disbursalTarget as number)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No target set</p>}
          </div>
        </div>

        {/* Clinic Access Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Clinic ID Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Clinic ID</h3>
            <p className="text-xs text-gray-500 mb-3">
              Share this ID with the clinic. Patients enter it in the chatbot to start their loan application.
            </p>
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Clinic ID</p>
                <p className="font-mono font-bold text-xl text-gray-800 tracking-wider">
                  {externalId ?? id.slice(-8).toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(externalId ?? id, 'id')}
                className="flex items-center gap-1.5 text-xs bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition"
              >
                {copied === 'id' ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy ID
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={chatLink}
                className="flex-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono truncate"
              />
              <button
                type="button"
                onClick={() => copy(chatLink, 'link')}
                className="shrink-0 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 transition"
              >
                {copied === 'link' ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* QR Code Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">QR Code</h3>
            <p className="text-xs text-gray-500 mb-4">
              Print this QR code and place it at the clinic reception. Patients scan it to apply for a loan.
            </p>
            <div className="flex flex-col items-center gap-4">
              {qrError ? (
                <div className="w-36 h-36 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-xs text-center px-2">
                  QR code unavailable
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/clinics/${id}/qr`}
                  alt={`QR code for ${clinic.name as string}`}
                  className="w-40 h-40 rounded-xl border border-gray-100 shadow-sm"
                  onError={() => setQrError(true)}
                />
              )}
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={downloadQr}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-[#07111f] text-[#bef264] font-semibold px-3 py-2.5 rounded-lg hover:bg-gray-800 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PNG
                </button>
                <a
                  href={chatLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 font-medium px-3 py-2.5 rounded-lg hover:bg-blue-100 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Chat
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Portal Access & Report — Admin only */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Create Portal Access */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Clinic Portal Access</h3>
              {portalStatus?.portalUser ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <p className="text-sm text-gray-700">Active: <span className="font-medium">{portalStatus.portalUser.email}</span></p>
                  </div>
                  {portalStatus.portalUser.mustChangePassword && (
                    <p className="text-xs text-yellow-600 bg-yellow-50 rounded px-2 py-1">Awaiting first login (password change pending)</p>
                  )}
                  <button
                    type="button"
                    onClick={handleResetAccess}
                    disabled={portalLoading}
                    className="mt-2 flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 px-3 py-2 rounded-lg hover:bg-orange-100 transition disabled:opacity-60"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {portalLoading ? 'Resetting...' : 'Reset & Resend Credentials'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    {portalStatus === null ? 'Loading...' : 'No portal access created yet. Click below to create credentials and send to clinic email.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleGrantAccess}
                    disabled={portalLoading || !(data?.email)}
                    className="flex items-center gap-1.5 text-xs bg-trustiva-navy text-trustiva-lime font-semibold px-3 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-60"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    {portalLoading ? 'Creating...' : 'Grant Portal Access'}
                  </button>
                  {!data?.email && <p className="text-xs text-red-500">Add an email to this clinic first</p>}
                </div>
              )}
            </div>

            {/* Send Monthly Report */}
            {isSuperAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Monthly Report</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Auto-sent on the 2nd of every month. Click below to send the previous month&apos;s report immediately.
                </p>
                <button
                  type="button"
                  onClick={handleSendReport}
                  disabled={reportSending}
                  className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 transition disabled:opacity-60"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {reportSending ? 'Sending...' : 'Send Report Now'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Generate Portal Password — visible to all non-CLINIC_USER */}
        {!isClinicUser && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Generate Portal Password</h3>
            <p className="text-xs text-gray-500 mb-3">
              Generate a fresh password if the clinic didn&apos;t receive their welcome email or needs a reset.
              Password is shown once — you can share it via WhatsApp or call.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleGenerateCredentials}
                disabled={genLoading}
                className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 border border-amber-300 px-3 py-2 rounded-lg hover:bg-amber-100 transition disabled:opacity-60 font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {genLoading ? 'Generating...' : '🔑 Generate New Password'}
              </button>
            </div>
            {!data?.email && <p className="text-xs text-red-500 mt-2">Add an email to this clinic first</p>}
          </div>
        )}

        {/* Report Email Settings */}
        {canManageReportEmails && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Report Email Settings</h3>
            <p className="text-xs text-gray-500 mb-3">
              Monthly reports will be sent to the clinic email and all addresses below.
            </p>
            <div className="space-y-2 mb-3">
              {reportEmails.length === 0 && <p className="text-xs text-gray-400 italic">No additional emails configured.</p>}
              {reportEmails.map(email => (
                <div key={email} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-mono text-gray-700">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    disabled={emailSaving}
                    className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddEmail} className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="Add email address"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
              />
              <button
                type="submit"
                disabled={emailSaving || !newEmail.trim()}
                className="text-xs bg-trustiva-navy text-trustiva-lime font-semibold px-3 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-60"
              >
                {emailSaving ? 'Saving...' : 'Add'}
              </button>
            </form>
          </div>
        )}

        {/* Confirm Portal Access Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-800">
                    {isResetting ? 'Reset Portal Access?' : 'Grant Portal Access?'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{clinic.name as string}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-5">
                {isResetting
                  ? 'A new password will be generated and emailed to the clinic. The old password will stop working immediately.'
                  : 'Login credentials will be created and emailed to the clinic. They must change the password on first login.'}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPortalAccess}
                  className="flex-1 px-4 py-2 text-sm bg-trustiva-navy text-trustiva-lime font-semibold rounded-lg hover:bg-gray-800 transition"
                >
                  {isResetting ? 'Yes, Reset' : 'Yes, Grant Access'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Credentials Modal */}
        {showCredentials && credentials && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Portal Access Granted</h3>
                </div>
                <button type="button" onClick={() => setShowCredentials(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-700">
                  <strong>Save these credentials now.</strong> The password will not be shown again. Credentials have also been emailed to the clinic.
                </p>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Login Email</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                    <span className="flex-1 text-sm font-mono text-gray-800 truncate">{credentials.email}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(credentials.email, 'email')}
                      className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                    >
                      {copiedField === 'email' ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Temporary Password</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                    <span className="flex-1 text-sm font-mono font-bold text-gray-800 tracking-wider">{credentials.tempPassword}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(credentials.tempPassword, 'password')}
                      className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                    >
                      {copiedField === 'password' ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center mb-4">
                Clinic will be prompted to change this password on first login.
              </p>

              <button
                type="button"
                onClick={() => setShowCredentials(false)}
                className="w-full px-4 py-2.5 text-sm bg-trustiva-navy text-trustiva-lime font-semibold rounded-lg hover:bg-gray-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Recent Leads */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">Recent Leads</h3>
            <Link href={`/leads?clinicId=${id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Applicant', 'Amount', 'Status', 'Source', 'Applied On'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(leads as Array<Record<string, unknown>>).map(l => {
                  const meta = l.metadata as Record<string, unknown> | null
                  const source = meta?.source as string | undefined
                  return (
                    <tr key={l.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{l.applicantName as string}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{formatLakhs(l.amount as number)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadge(l.status as string))}>
                          {l.status as string}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {source ? (
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', source === 'QR' ? 'bg-purple-100 text-purple-700' : source === 'CHATBOT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                            {source === 'QR' ? 'QR Scan' : source === 'CHATBOT' ? 'Chatbot' : 'Internal'}
                          </span>
                        ) : <span className="text-gray-400 text-xs">Internal</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{formatDate(l.applicationDate as string)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {leads.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No leads yet</p>}
          </div>
        </div>
      </div>

      {credResult && (
        <CredentialsModal result={credResult} onClose={() => setCredResult(null)} />
      )}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-gray-800 mt-0.5">{value}</p>
    </div>
  )
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    DISBURSED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-800'
}

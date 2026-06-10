'use client'
import { useState } from 'react'

interface CredentialResult {
  clinicName: string
  email: string
  plainPassword: string
  emailSent: boolean
  generatedAt: string
  generatedBy: string
}

interface Props {
  result: CredentialResult
  onClose: () => void
}

export function CredentialsModal({ result, onClose }: Props) {
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'all' | null>(null)

  function copyField(text: string, field: 'email' | 'password' | 'all') {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }).catch(() => {
      // fallback for older browsers
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  function copyAll() {
    const loginUrl = 'https://lms.trustivasetu.com'
    const text = `Trustiva Setu Portal Access\nClinic: ${result.clinicName}\nLogin URL: ${loginUrl}\nUsername: ${result.email}\nPassword: ${result.plainPassword}\nPlease change password on first login.`
    copyField(text, 'all')
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Portal Credentials Generated</h2>
            <p className="text-xs text-gray-500">{result.clinicName}</p>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Email status banner */}
          {result.emailSent ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-green-700">Email sent to clinic automatically</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-700">Email could not be sent. Share credentials manually.</p>
            </div>
          )}

          {/* Credential rows */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Email ID</label>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 truncate">
                  {result.email}
                </span>
                <button
                  onClick={() => copyField(result.email, 'email')}
                  className="shrink-0 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                  title="Copy email"
                >
                  {copiedField === 'email' ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Password</label>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 font-bold tracking-wider">
                  {result.plainPassword}
                </span>
                <button
                  onClick={() => copyField(result.plainPassword, 'password')}
                  className="shrink-0 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                  title="Copy password"
                >
                  {copiedField === 'password' ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Login URL box */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Login URL</p>
            <p className="text-xs font-medium text-gray-700 font-mono">lms.trustivasetu.com</p>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400 space-y-0.5">
            <p>Generated by: <span className="text-gray-600">{result.generatedBy}</span></p>
            <p>Generated at: <span className="text-gray-600">{fmtDate(result.generatedAt)}</span></p>
          </div>

          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            Password shown only once. Close this modal and you cannot retrieve it again.
          </p>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            onClick={copyAll}
            className="flex-1 flex items-center justify-center gap-2 bg-[#07111f] text-[#bef264] font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-gray-800 transition"
          >
            {copiedField === 'all' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy All Details
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

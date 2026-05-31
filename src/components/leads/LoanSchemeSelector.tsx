'use client'

import { useState, useEffect } from 'react'

interface LoanScheme {
  type: 'ZERO_DP' | 'CUSTOM_DP'
  downPayment: number
  downPaymentPct: number
  processingFeePct: number
  processingFeeAmount: number
  tenure: number
  emi: number
  totalPayable: number
  netLoanAmount: number
}

interface Props {
  loanAmount: number
  onSchemeChange: (scheme: LoanScheme) => void
}

const TENURE_OPTIONS = [3, 6, 9, 12, 18, 24]

export function LoanSchemeSelector({ loanAmount, onSchemeChange }: Props) {
  const [schemeType, setSchemeType] = useState<'ZERO_DP' | 'CUSTOM_DP'>('ZERO_DP')
  const [downPaymentPct, setDownPaymentPct] = useState(0)
  const [processingFeePct, setProcessingFeePct] = useState(2)
  const [tenure, setTenure] = useState(12)

  useEffect(() => {
    if (!loanAmount || loanAmount <= 0) return
    const dpPct = schemeType === 'ZERO_DP' ? 0 : downPaymentPct
    const downPayment = Math.round(loanAmount * dpPct / 100)
    const netLoanAmount = loanAmount - downPayment
    const processingFeeAmount = Math.round(netLoanAmount * processingFeePct / 100)
    const emi = Math.round(netLoanAmount / tenure)
    const totalPayable = emi * tenure + processingFeeAmount
    onSchemeChange({ type: schemeType, downPayment, downPaymentPct: dpPct, processingFeePct, processingFeeAmount, tenure, emi, totalPayable, netLoanAmount })
  }, [schemeType, downPaymentPct, processingFeePct, tenure, loanAmount, onSchemeChange])

  if (!loanAmount || loanAmount <= 0) return null

  const dpAmt = Math.round(loanAmount * (schemeType === 'ZERO_DP' ? 0 : downPaymentPct) / 100)
  const netLoan = loanAmount - dpAmt
  const pfAmt = Math.round(netLoan * processingFeePct / 100)
  const emi = Math.round(netLoan / tenure)

  return (
    <div className="space-y-4 bg-gray-50 border border-gray-200 rounded-2xl p-4">
      <p className="text-sm font-bold text-gray-800">📋 Loan Scheme Configure Karo</p>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Downpayment Scheme *</label>
        <div className="grid grid-cols-2 gap-3">
          <button type="button"
            onClick={() => { setSchemeType('ZERO_DP'); setDownPaymentPct(0) }}
            className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
              schemeType === 'ZERO_DP' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            <p className="font-bold">Zero Downpayment</p>
            <p className="text-xs opacity-70 mt-0.5">Customer pays nothing upfront</p>
          </button>
          <button type="button"
            onClick={() => setSchemeType('CUSTOM_DP')}
            className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
              schemeType === 'CUSTOM_DP' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            <p className="font-bold">Custom Downpayment</p>
            <p className="text-xs opacity-70 mt-0.5">Customer pays a portion upfront</p>
          </button>
        </div>
      </div>

      {schemeType === 'CUSTOM_DP' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Downpayment % — {downPaymentPct}%
            <span className="text-blue-600 ml-2 font-bold">= ₹{dpAmt.toLocaleString('en-IN')}</span>
          </label>
          <input type="range" min={5} max={50} step={5} value={downPaymentPct}
            onChange={e => setDownPaymentPct(Number(e.target.value))}
            className="w-full h-2 rounded-full accent-blue-600" />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>5%</span><span>25%</span><span>50%</span>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Processing Fee % (set by RM)
          <span className="text-orange-600 ml-2 font-bold">{processingFeePct}% = ₹{pfAmt.toLocaleString('en-IN')}</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {[0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(pct => (
            <button key={pct} type="button" onClick={() => setProcessingFeePct(pct)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                processingFeePct === pct ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-orange-300'
              }`}>
              {pct}%
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Customer yahi ek baar pay karega — No Interest</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Preferred Tenure (Months) *</label>
        <div className="flex gap-2 flex-wrap">
          {TENURE_OPTIONS.map(t => (
            <button key={t} type="button" onClick={() => setTenure(t)}
              className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                tenure === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}>
              {t}m
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-gray-700 mb-2">📊 Live Calculation</p>
        <Row label="Total Loan Amount" value={`₹${loanAmount.toLocaleString('en-IN')}`} />
        {schemeType === 'CUSTOM_DP' && dpAmt > 0 && (
          <Row label={`Downpayment (${downPaymentPct}%)`} value={`- ₹${dpAmt.toLocaleString('en-IN')}`} color="text-red-600" />
        )}
        <Row label="Net Loan (financed)" value={`₹${netLoan.toLocaleString('en-IN')}`} bold />
        <Row label={`Processing Fee (${processingFeePct}%)`}
          value={pfAmt > 0 ? `₹${pfAmt.toLocaleString('en-IN')}` : 'ZERO'}
          color={pfAmt > 0 ? 'text-orange-600' : 'text-green-600'} />

        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-3 mt-2">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-white text-xs font-medium">✨ No Cost EMI</p>
              <p className="text-green-100 text-xs">0% Interest — Subvention Model</p>
            </div>
            <div className="text-right">
              <p className="text-white text-2xl font-bold">₹{emi.toLocaleString('en-IN')}</p>
              <p className="text-green-100 text-xs">/month × {tenure} months</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between text-sm pt-1">
          <span className="text-gray-500">Total Customer Pays</span>
          <span className="font-bold text-gray-800">₹{(emi * tenure + pfAmt).toLocaleString('en-IN')}</span>
        </div>

        {schemeType === 'ZERO_DP' && pfAmt === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center">
            <p className="text-xs text-yellow-700 font-medium">
              🎉 True Zero Cost! Customer pays ₹{emi.toLocaleString('en-IN')}/month only
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-gray-800' : color ?? 'text-gray-700'}`}>{value}</span>
    </div>
  )
}

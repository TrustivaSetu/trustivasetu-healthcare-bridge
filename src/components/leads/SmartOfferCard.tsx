'use client'

interface LenderOffer {
  rank: number
  lenderId: string
  lenderName: string
  lenderCode: string
  approvedAmount: number
  interestRate: number
  tenure: number
  emi: number
  processingFee: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  tag: string
  instantApproval: boolean
  requiresIncomeProof: boolean
  decisionTime: string
  message: string
}

interface Props {
  offer: LenderOffer
  selected: boolean
  onSelect: () => void
}

export function SmartOfferCard({ offer, selected, onSelect }: Props) {
  const confidenceColor = {
    HIGH: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-gray-100 text-gray-600',
  }[offer.confidence]

  const borderColor = selected
    ? 'border-green-500 shadow-lg shadow-green-100'
    : offer.rank === 1
    ? 'border-blue-400 shadow-md shadow-blue-50'
    : 'border-gray-200'

  return (
    <div
      onClick={onSelect}
      className={`border-2 rounded-2xl p-4 cursor-pointer transition-all duration-200 ${borderColor} ${
        selected ? 'bg-green-50' : 'bg-white hover:border-blue-300'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-800">{offer.lenderName}</span>
            {selected && <span className="text-green-600 text-lg">✅</span>}
          </div>
          <span className="text-xs font-medium text-blue-600">{offer.tag}</span>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-700">
            ₹{offer.approvedAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500">Approved Amount</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">✨ No Cost EMI</p>
          <p className="text-green-100 text-xs">0% Interest — Subvention Model</p>
        </div>
        <div className="text-right">
          <p className="text-white font-bold text-lg">₹{offer.emi.toLocaleString('en-IN')}</p>
          <p className="text-green-100 text-xs">/month</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-xl p-2 text-center">
          <p className="text-xs text-gray-500">Tenure</p>
          <p className="text-sm font-bold text-gray-800">{offer.tenure} months</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2 text-center">
          <p className="text-xs text-gray-500">Processing Fee</p>
          <p className="text-sm font-bold text-gray-800">
            {offer.processingFee > 0 ? `₹${offer.processingFee.toLocaleString('en-IN')}` : 'Zero'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceColor}`}>
            {offer.confidence === 'HIGH' ? '🔥 High Confidence' :
             offer.confidence === 'MEDIUM' ? '👍 Good Match' : '✔️ Eligible'}
          </span>
          {offer.instantApproval && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              ⚡ Instant
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{offer.decisionTime}</span>
      </div>

      <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2 flex justify-between items-center">
        <p className="text-xs text-gray-500">Total Payable</p>
        <p className="text-sm font-bold text-gray-700">
          ₹{(offer.emi * offer.tenure + offer.processingFee).toLocaleString('en-IN')}
        </p>
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t border-green-200 text-center">
          <p className="text-xs text-green-700 font-medium">✅ Selected — Proceed to accept</p>
        </div>
      )}
    </div>
  )
}

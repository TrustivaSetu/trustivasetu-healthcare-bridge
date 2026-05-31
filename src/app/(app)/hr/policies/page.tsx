'use client'

import { useState, useEffect } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const LAST_UPDATED = '01 June 2025'

interface PolicySection {
  id: string
  icon: string
  title: string
  content: React.ReactNode
}

const POLICIES: PolicySection[] = [
  {
    id: 'health',
    icon: '🏥',
    title: '1. Health Insurance Policy',
    content: (
      <ul className="space-y-2 text-sm text-gray-600">
        <li className="flex gap-2"><span className="text-green-500 mt-0.5 flex-shrink-0">✓</span><span><strong>Coverage:</strong> Employee + Spouse + 2 Children + Employee's Parents + Spouse's Parents</span></li>
        <li className="flex gap-2"><span className="text-green-500 mt-0.5 flex-shrink-0">✓</span><span><strong>Cashless hospitalization</strong> at all network hospitals — no upfront payment required</span></li>
        <li className="flex gap-2"><span className="text-green-500 mt-0.5 flex-shrink-0">✓</span><span><strong>Annual health checkup</strong> covered for employee and spouse</span></li>
        <li className="flex gap-2"><span className="text-green-500 mt-0.5 flex-shrink-0">✓</span><span>Claims process: Contact HR for TPA details. Policy cards issued to all insured members within 30 days of joining.</span></li>
      </ul>
    ),
  },
  {
    id: 'leave',
    icon: '🗓️',
    title: '2. Leave Policy',
    content: (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { type: 'Paid Leave (PL)', days: '12 days/year', note: '1 per month, accrued monthly', color: 'bg-green-50 border-green-200 text-green-800' },
            { type: 'Casual Leave (CL)', days: '6 days/year', note: 'Can be taken in advance', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { type: 'Medical Leave', days: '6 days/year', note: 'Medical certificate required for 3+ days', color: 'bg-purple-50 border-purple-200 text-purple-800' },
            { type: 'Maternity Leave', days: '60 days fully paid', note: '2 months, no questions asked', color: 'bg-pink-50 border-pink-200 text-pink-800' },
            { type: 'Paternity Leave', days: '10 days fully paid', note: 'Within 3 months of birth', color: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
            { type: 'Complementary Family Leave', days: '12 days/year', note: '6 days every 6 months — family time, no questions asked', color: 'bg-amber-50 border-amber-200 text-amber-800' },
            { type: 'Mental Health Days', days: '2 days/year', note: 'No questions asked, no documentation required', color: 'bg-violet-50 border-violet-200 text-violet-800' },
            { type: 'Unplanned Leave', days: 'Unpaid', note: 'Needs manager approval. Deducted from salary.', color: 'bg-red-50 border-red-200 text-red-700' },
          ].map(l => (
            <div key={l.type} className={cn('border rounded-xl p-3', l.color)}>
              <p className="font-semibold text-xs">{l.type}</p>
              <p className="text-lg font-bold mt-0.5">{l.days}</p>
              <p className="text-xs opacity-75 mt-0.5">{l.note}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Leave carry-forward: Up to 6 PL days can be carried forward to the next year. CL and Medical do not carry forward.</p>
      </div>
    ),
  },
  {
    id: 'gift',
    icon: '🎁',
    title: '3. Lifetime Occasion Gift Policy',
    content: (
      <div className="space-y-2 text-sm text-gray-600">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="font-bold text-yellow-800 text-base">₹5,001 Cash Gift or Voucher</p>
          <p className="text-yellow-700 text-xs mt-1">Given once per occasion per employee for any of the following life milestones:</p>
        </div>
        <ul className="space-y-1.5 mt-2">
          {['Marriage', 'Birth of a Child', 'Purchase of First Home', 'Any major life milestone approved by HR'].map(o => (
            <li key={o} className="flex gap-2"><span className="text-yellow-500">🎉</span><span>{o}</span></li>
          ))}
        </ul>
        <p className="text-xs text-gray-400 mt-2">Apply by informing HR within 30 days of the occasion. Gift processed within 15 working days.</p>
      </div>
    ),
  },
  {
    id: 'incentive',
    icon: '💰',
    title: '4. Incentive Policy',
    content: (
      <ul className="space-y-2 text-sm text-gray-600">
        {[
          ['Monthly Performance Incentive', 'Based on individual target achievement. Paid with monthly salary.'],
          ['Quarterly Bonus', 'Based on team and regional targets. Declared at end of each quarter.'],
          ['Annual Variable Pay', 'Based on company performance. Declared in April with annual increment.'],
          ['Referral Bonus', 'Refer a teammate who joins and completes probation — get ₹5,000 (₹10,000 for Manager+ roles).'],
          ['Spot Recognition Awards', 'Awarded by Management for exceptional work any time during the year.'],
        ].map(([title, desc]) => (
          <li key={title} className="flex gap-2"><span className="text-brand-500 mt-0.5 flex-shrink-0">✦</span><span><strong>{title}:</strong> {desc}</span></li>
        ))}
      </ul>
    ),
  },
  {
    id: 'increment',
    icon: '📈',
    title: '5. Annual Performance Increment Policy',
    content: (
      <div className="space-y-3 text-sm text-gray-600">
        <p>Yearly performance-based salary increment effective every <strong>April 1st</strong> (financial year basis). Increment letter issued formally and stored in employee profile.</p>
        <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
          <thead className="bg-gray-50">
            <tr><th className="p-2 text-left">Rating</th><th className="p-2 text-left">Score</th><th className="p-2 text-left">Increment Range</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Outstanding', '5/5', '20–30%', 'bg-green-50'],
              ['Exceeds Expectations', '4/5', '15–20%', 'bg-teal-50'],
              ['Meets Expectations', '3/5', '8–15%', 'bg-blue-50'],
              ['Needs Improvement', '2/5', '0–5%', 'bg-amber-50'],
              ['Unsatisfactory', '1/5', 'No increment + PIP', 'bg-red-50'],
            ].map(([r, s, i, bg]) => (
              <tr key={r} className={bg}><td className="p-2 font-medium">{r}</td><td className="p-2">{s}</td><td className="p-2 font-semibold">{i}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'tenure',
    icon: '🏆',
    title: '6. Special Tenure Allowance (Year of Service Bonus)',
    content: (
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {[
            { year: '1 Year', amount: '₹5,000', extras: 'Certificate of Appreciation', color: 'bg-gray-50 border-gray-200' },
            { year: '2 Years', amount: '₹10,000', extras: 'Trophy', color: 'bg-bronze-50 bg-amber-50 border-amber-200' },
            { year: '3 Years', amount: '₹15,000', extras: 'Trophy + 1 extra leave', color: 'bg-amber-100 border-amber-300' },
            { year: '4 Years', amount: '₹20,000', extras: 'Trophy + 2 extra leaves', color: 'bg-yellow-100 border-yellow-300' },
            { year: '5 Years+', amount: '₹25,000', extras: 'Trophy + 3 extra leaves + Loyalty Badge', color: 'bg-brand-50 border-brand-200' },
          ].map(t => (
            <div key={t.year} className={cn('border rounded-xl p-3 text-center', t.color)}>
              <p className="text-xs font-bold text-gray-500">{t.year}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{t.amount}</p>
              <p className="text-[10px] text-gray-500 mt-1">{t.extras}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">HR and Super Admin notified 30 days before each employee's work anniversary to process the bonus.</p>
      </div>
    ),
  },
  {
    id: 'awards',
    icon: '⭐',
    title: '7. Quarterly Achievement Awards',
    content: (
      <div className="space-y-2 text-sm text-gray-600">
        <div className="grid grid-cols-2 gap-2">
          {[
            { award: 'Star of the Quarter', prize: '₹3,000 + Certificate', note: 'Featured on company portal' },
            { award: 'Best Team Award', prize: '₹2,000 per member', note: '+ Group Trophy' },
            { award: 'Most Improved Employee', prize: '₹1,500 + Certificate', note: 'Peer + Management vote' },
            { award: 'Best New Joiner', prize: '₹1,500 + Certificate', note: 'Q1 and Q2 only' },
          ].map(a => (
            <div key={a.award} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="font-semibold text-amber-800 text-xs">{a.award}</p>
              <p className="font-bold text-amber-900 mt-0.5">{a.prize}</p>
              <p className="text-xs text-amber-700">{a.note}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500"><strong>Voting:</strong> Peer voting (30%) + Management decision (70%). Awards announced on portal with employee photo.</p>
      </div>
    ),
  },
  {
    id: 'ld',
    icon: '📚',
    title: '8. Learning & Development',
    content: (
      <ul className="space-y-2 text-sm text-gray-600">
        <li className="flex gap-2"><span className="text-brand-500 flex-shrink-0">✓</span><span><strong>Annual L&D Budget:</strong> ₹10,000 per employee for courses, books, and workshops</span></li>
        <li className="flex gap-2"><span className="text-brand-500 flex-shrink-0">✓</span><span><strong>Certifications:</strong> Company pays 100% for job-relevant professional certifications</span></li>
        <li className="flex gap-2"><span className="text-brand-500 flex-shrink-0">✓</span><span><strong>Study Leave:</strong> 2 paid days for exams (proof required)</span></li>
      </ul>
    ),
  },
  {
    id: 'wellness',
    icon: '🧘',
    title: '9. Mental Health & Wellness',
    content: (
      <ul className="space-y-2 text-sm text-gray-600">
        <li className="flex gap-2"><span className="text-purple-500 flex-shrink-0">✓</span><span><strong>Free Counseling:</strong> 2 sessions per quarter with a professional wellness counselor — 100% confidential</span></li>
        <li className="flex gap-2"><span className="text-purple-500 flex-shrink-0">✓</span><span><strong>Mental Health Days:</strong> 2 additional paid days per year, no questions asked</span></li>
        <li className="flex gap-2"><span className="text-purple-500 flex-shrink-0">✓</span><span><strong>Stress Management Workshops:</strong> Conducted every quarter for all employees</span></li>
      </ul>
    ),
  },
  {
    id: 'celebrations',
    icon: '🎉',
    title: '10. Celebrations & Fun at Work',
    content: (
      <ul className="space-y-1.5 text-sm text-gray-600">
        {[
          'Birthday celebration at office with team cake and gift',
          'Work anniversary shoutout to entire company on the portal',
          'Festive gifts on Diwali, Holi, and Eid',
          'Annual company picnic — fully paid by Trustiva Setu',
          'Monthly team lunch sponsored by the company',
        ].map(c => (
          <li key={c} className="flex gap-2"><span>🎊</span><span>{c}</span></li>
        ))}
      </ul>
    ),
  },
  {
    id: 'referral',
    icon: '🤝',
    title: '11. Employee Referral Program',
    content: (
      <div className="space-y-3 text-sm text-gray-600">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-xs font-bold text-green-700">Any Role Referral</p>
            <p className="text-xl font-bold text-green-800 mt-1">₹5,000</p>
            <p className="text-xs text-green-600 mt-1">Paid when referred employee completes 3 months</p>
          </div>
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-3">
            <p className="text-xs font-bold text-brand-700">Manager & Above Referral</p>
            <p className="text-xl font-bold text-brand-800 mt-1">₹10,000</p>
            <p className="text-xs text-brand-600 mt-1">Paid when referred employee completes probation</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'flexible',
    icon: '⏰',
    title: '12. Flexible Work Benefits',
    content: (
      <ul className="space-y-2 text-sm text-gray-600">
        <li className="flex gap-2"><span className="text-teal-500 flex-shrink-0">✓</span><span><strong>Core Hours:</strong> 10 AM to 5 PM mandatory. Rest of hours flexible.</span></li>
        <li className="flex gap-2"><span className="text-teal-500 flex-shrink-0">✓</span><span><strong>Work From Home:</strong> Up to 4 days per month for eligible roles (based on manager approval)</span></li>
        <li className="flex gap-2"><span className="text-teal-500 flex-shrink-0">✓</span><span><strong>Early Exit Fridays:</strong> Leave at 4 PM on the last Friday of every month</span></li>
      </ul>
    ),
  },
  {
    id: 'recognition',
    icon: '📣',
    title: '13. Recognition Wall',
    content: (
      <ul className="space-y-2 text-sm text-gray-600">
        <li className="flex gap-2"><span className="text-pink-500 flex-shrink-0">✓</span><span>Digital recognition wall on the portal where any employee can give a shoutout to any colleague</span></li>
        <li className="flex gap-2"><span className="text-pink-500 flex-shrink-0">✓</span><span>Shoutouts visible to the entire company on the dashboard</span></li>
        <li className="flex gap-2"><span className="text-pink-500 flex-shrink-0">✓</span><span>Monthly top 3 most recognized employees highlighted with a special badge</span></li>
      </ul>
    ),
  },
  {
    id: 'financial',
    icon: '🏦',
    title: '14. Financial Benefits',
    content: (
      <ul className="space-y-1.5 text-sm text-gray-600">
        {[
          ['Salary Advance', 'Up to 1 month salary, interest-free, repayable in 3 EMIs'],
          ['Emergency Loan', 'Up to ₹50,000 at nominal interest — requires HR approval'],
          ['PF Contribution', 'Company contributes 12% of Basic Salary to Provident Fund'],
          ['Gratuity', '4.81% of Basic Salary contribution by company, payable after 5 years as per law'],
          ['Professional Tax', 'As per applicable state laws — handled by company'],
        ].map(([t, d]) => (
          <li key={t} className="flex gap-2"><span className="text-blue-500 flex-shrink-0">✓</span><span><strong>{t}:</strong> {d}</span></li>
        ))}
      </ul>
    ),
  },
  {
    id: 'career',
    icon: '🚀',
    title: '15. Career Growth',
    content: (
      <ul className="space-y-2 text-sm text-gray-600">
        {[
          'All open positions posted internally first — employees get first opportunity to apply',
          'Fast-track promotion program for consistently high performers',
          'Every new joiner assigned a senior mentor for the first 6 months',
          'Quarterly one-on-one career discussion with reporting manager — mandatory',
        ].map(c => (
          <li key={c} className="flex gap-2"><span className="text-brand-500 flex-shrink-0">→</span><span>{c}</span></li>
        ))}
      </ul>
    ),
  },
  {
    id: 'expense',
    icon: '🧾',
    title: '16. Expense Reimbursement Policy',
    content: (
      <ul className="space-y-2 text-sm text-gray-600">
        <li className="flex gap-2"><span className="text-orange-500 flex-shrink-0">✓</span><span><strong>Travel Allowance:</strong> RM Field roles — ₹3/km. Manager and above — ₹5/km.</span></li>
        <li className="flex gap-2"><span className="text-orange-500 flex-shrink-0">✓</span><span><strong>Outstation Travel:</strong> Flights and 3-5 star hotels booked and paid by company. Employees claim local cab, meals, and incidentals.</span></li>
        <li className="flex gap-2"><span className="text-orange-500 flex-shrink-0">✓</span><span><strong>Monthly Cap:</strong> RM Field — ₹5,000 | Manager level — ₹10,000 | Admin/Head — ₹20,000</span></li>
        <li className="flex gap-2"><span className="text-orange-500 flex-shrink-0">✓</span><span>Mobile and internet allowance for eligible grades. Medical reimbursement up to health policy limits.</span></li>
      </ul>
    ),
  },
  {
    id: 'termination',
    icon: '⚠️',
    title: '17. Termination & Exit Policy',
    content: (
      <div className="space-y-5 text-sm">
        {/* Immediate termination */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-bold text-red-800 mb-3 flex items-center gap-2">
            <span className="text-base">🚫</span> Grounds for Immediate Termination (Without Notice)
          </p>
          <ul className="space-y-1.5 text-red-700">
            {[
              'Theft, fraud, or financial misconduct of any kind',
              'Falsification of company records, documents, or data',
              'Serious insubordination or willful violation of company policies',
              'Harassment (sexual, workplace, or any form) of colleagues, clients, or vendors',
              'Sharing confidential company data or client information with competitors or outsiders',
              'Being under the influence of alcohol or drugs during working hours',
              'Violent behavior or physical assault on any employee',
              'Moonlighting (working for a competitor) without prior written company approval',
              'Gross negligence causing significant financial or reputational damage to the company',
              'Providing false information during hiring (fake degrees, experience, or documents)',
            ].map(g => (
              <li key={g} className="flex gap-2"><span className="text-red-400 mt-0.5 flex-shrink-0">✗</span><span>{g}</span></li>
            ))}
          </ul>
        </div>

        {/* PIP-based termination */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="font-bold text-orange-800 mb-3 flex items-center gap-2">
            <span className="text-base">📋</span> Performance-Based Termination (PIP Process)
          </p>
          <ul className="space-y-1.5 text-orange-700">
            {[
              'Consistent failure to meet job targets for 2 consecutive quarters',
              'Employee placed on a 60-day Performance Improvement Plan (PIP)',
              'If no measurable improvement during PIP period — termination with notice period',
              'Full and final settlement processed within 30 days of last working day',
            ].map(g => (
              <li key={g} className="flex gap-2"><span className="text-orange-400 mt-0.5 flex-shrink-0">→</span><span>{g}</span></li>
            ))}
          </ul>
        </div>

        {/* Notice period */}
        <div>
          <p className="font-semibold text-gray-700 mb-2">⏱ Notice Period Policy</p>
          <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50">
              <tr><th className="p-2 text-left">Stage</th><th className="p-2 text-left">Notice Period</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              <tr><td className="p-2">Probation (first 3 months)</td><td className="p-2 font-medium">7 days — either side</td></tr>
              <tr><td className="p-2">After Confirmation</td><td className="p-2 font-medium">30 days — employee | 30 days — company</td></tr>
              <tr><td className="p-2">Manager and above</td><td className="p-2 font-medium">60 days — both sides</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-2">Company may pay notice period salary in lieu of serving notice (buyout). Employees serving notice must complete full knowledge transfer and handover.</p>
        </div>

        {/* Resignation process */}
        <div>
          <p className="font-semibold text-gray-700 mb-2">📝 Resignation Process</p>
          <ol className="space-y-1.5 text-gray-600">
            {[
              'Submit resignation via portal or email to reporting manager',
              'Manager acknowledges within 24 hours',
              'HR initiates exit formalities and clearance process',
              'Exit interview mandatory before last working day',
              'Company assets (laptop, ID card, access cards) returned on last day',
              'Full and final settlement — salary, pending leave encashment, and expenses within 30 days',
            ].map((s, i) => (
              <li key={s} className="flex gap-2"><span className="text-gray-400 font-bold w-4 flex-shrink-0">{i + 1}.</span><span>{s}</span></li>
            ))}
          </ol>
        </div>

        {/* Exit benefits */}
        <div>
          <p className="font-semibold text-gray-700 mb-2">🎁 Exit Benefits</p>
          <ul className="space-y-1.5 text-gray-600">
            {[
              ['Gratuity', 'Paid if employee has completed 5 or more years of continuous service'],
              ['PF Withdrawal', 'HR assistance provided for PF withdrawal and transfer'],
              ['Experience Letter', 'Issued within 7 working days of last working day'],
              ['Relieving Letter', 'Issued within 7 working days confirming last working date'],
              ['Reference', 'Positive reference provided for employees exiting in good standing'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2"><span className="text-green-500 flex-shrink-0">✓</span><span><strong>{t}:</strong> {d}</span></li>
            ))}
          </ul>
        </div>

        {/* Non-compete */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-bold text-amber-800 mb-2 flex items-center gap-2"><span>🔒</span> Non-Compete & Confidentiality</p>
          <ul className="space-y-1.5 text-amber-700">
            {[
              'Employee must not join a direct competitor for 6 months after exit',
              'All company data, client lists, and proprietary information must be returned on last day',
              'NDAs signed during employment remain fully binding after exit',
              'Violation of NDA or non-compete clause may result in legal action',
            ].map(g => (
              <li key={g} className="flex gap-2"><span className="flex-shrink-0">•</span><span>{g}</span></li>
            ))}
          </ul>
        </div>

        {/* Rehire */}
        <div>
          <p className="font-semibold text-gray-700 mb-2">🔄 Rehire Policy</p>
          <ul className="space-y-1.5 text-gray-600">
            <li className="flex gap-2"><span className="text-green-500 flex-shrink-0">✓</span><span>Employees who resigned in good standing may be considered for rehire after 6 months</span></li>
            <li className="flex gap-2"><span className="text-red-400 flex-shrink-0">✗</span><span>Employees terminated for misconduct are not eligible for rehire</span></li>
            <li className="flex gap-2"><span className="text-blue-500 flex-shrink-0">→</span><span>Previous tenure may be counted for seniority if rehired within 2 years</span></li>
          </ul>
        </div>
      </div>
    ),
  },
]

export default function PoliciesPage() {
  const { user: session } = useTabSession()
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [letterNotification, setLetterNotification] = useState<{ id: string; letterNumber: string } | null>(null)
  const [noSalaryWarning, setNoSalaryWarning] = useState(false)
  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'
  const [ackList, setAckList] = useState<Array<{ id: string; name: string; email: string; employeeProfile: { designation: string | null; policyAcknowledgedAt: string | null } | null }>>([])
  const [showAckList, setShowAckList] = useState(false)

  useEffect(() => {
    fetch('/api/hr/policies/acknowledge')
      .then(r => r.json())
      .then(d => setAcknowledgedAt(d.policyAcknowledgedAt ?? null))
    // Also check if letter already exists
    fetch('/api/hr/appointment-letter')
      .then(r => r.json())
      .then(d => { if (d.data?.[0]) setLetterNotification({ id: d.data[0].id, letterNumber: d.data[0].letterNumber }) })
      .catch(() => {})
  }, [])

  async function acknowledge() {
    setAcknowledging(true)
    const res = await fetch('/api/hr/policies/acknowledge', { method: 'POST' })
    const d = await res.json()
    if (d.success) {
      setAcknowledgedAt(d.acknowledgedAt)
      toast.success('Acknowledgement recorded!')
      if (d.letter) setLetterNotification({ id: d.letter.id, letterNumber: d.letter.letterNumber })
      else if (d.noSalary) setNoSalaryWarning(true)
    }
    setAcknowledging(false)
  }

  async function loadAckList() {
    if (ackList.length > 0) { setShowAckList(true); return }
    const res = await fetch('/api/hr/policies/acknowledge?all=1')
    const d = await res.json()
    setAckList(d.data ?? [])
    setShowAckList(true)
  }

  const acknowledged = ackList.filter(u => u.employeeProfile?.policyAcknowledgedAt)
  const notAcknowledged = ackList.filter(u => !u.employeeProfile?.policyAcknowledgedAt)

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-trustiva-navy to-slate-800 text-white rounded-2xl p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-trustiva-lime rounded-xl flex items-center justify-center text-trustiva-navy font-bold text-2xl flex-shrink-0">T</div>
          <div>
            <h1 className="text-2xl font-bold">Trustiva Setu Employee Handbook</h1>
            <p className="text-slate-300 text-sm mt-1">HR Policies & Benefits — All the good stuff we offer</p>
            <p className="text-slate-400 text-xs mt-2">Last Updated: {LAST_UPDATED}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition flex items-center gap-1.5 print:hidden">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Download PDF
          </button>
          {isAdmin && (
            <button onClick={loadAckList}
              className="px-4 py-2 bg-trustiva-lime text-trustiva-navy text-sm font-bold rounded-lg hover:opacity-90 transition print:hidden">
              View Acknowledgements
            </button>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {POLICIES.map(p => (
          <button key={p.id} onClick={() => { setActiveSection(p.id); document.getElementById(p.id)?.scrollIntoView({ behavior: 'smooth' }) }}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition',
              activeSection === p.id
                ? (p.id === 'termination' ? 'bg-red-600 text-white border-red-600' : 'bg-brand-600 text-white border-brand-600')
                : p.id === 'termination'
                  ? 'border-red-300 text-red-600 hover:bg-red-50'
                  : 'border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600')}>
            {p.icon} {p.title.replace(/^\d+\.\s/, '')}
          </button>
        ))}
      </div>

      {/* Policy sections */}
      <div className="space-y-4">
        {POLICIES.map(policy => {
          const isTermination = policy.id === 'termination'
          return (
            <div key={policy.id} id={policy.id}
              className={cn(
                'rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition',
                isTermination
                  ? 'border-2 border-red-300 bg-white'
                  : 'border border-gray-200 bg-white'
              )}>
              <div className={cn(
                'flex items-center gap-3 px-5 py-4 border-b',
                isTermination
                  ? 'bg-red-600 border-red-700'
                  : 'bg-gray-50/50 border-gray-100'
              )}>
                <span className="text-2xl">{policy.icon}</span>
                <div>
                  <h2 className={cn('text-sm font-bold', isTermination ? 'text-white' : 'text-gray-800')}>{policy.title}</h2>
                  {isTermination && <p className="text-xs text-red-200 mt-0.5">Please read carefully — these policies are strictly enforced</p>}
                </div>
              </div>
              <div className="px-5 py-4">{policy.content}</div>
            </div>
          )
        })}
      </div>

      {/* Acknowledgement */}
      <div className={cn('rounded-2xl border-2 p-6 print:hidden', acknowledgedAt ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-300')}>
        {acknowledgedAt ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-2xl">✓</div>
            <div>
              <p className="font-bold text-green-800">Policies Acknowledged</p>
              <p className="text-sm text-green-600">You acknowledged these policies on {format(new Date(acknowledgedAt), 'dd MMMM yyyy, HH:mm')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-bold text-amber-800">Please acknowledge that you have read and understood these HR policies</p>
                <p className="text-sm text-amber-700 mt-1">Clicking the button below records your acknowledgement with a timestamp. This is required for all employees.</p>
              </div>
            </div>
            <button onClick={acknowledge} disabled={acknowledging}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition disabled:opacity-60">
              {acknowledging ? 'Recording...' : 'I have read and understood the HR Policies'}
            </button>
          </div>
        )}
      </div>

      {/* Letter Notification */}
      {letterNotification && (
        <div className="bg-brand-50 border-2 border-brand-200 rounded-2xl p-5 print:hidden">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-xl">📄</div>
              <div>
                <p className="font-bold text-brand-800">Your Appointment Letter is Ready!</p>
                <p className="text-sm text-brand-600">Letter No: {letterNotification.letterNumber} — Please review and acknowledge</p>
              </div>
            </div>
            <Link href={`/hr/appointment-letter/${letterNotification.id}`}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl transition">
              View & Acknowledge →
            </Link>
          </div>
        </div>
      )}

      {noSalaryWarning && !letterNotification && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-semibold text-gray-700">Appointment Letter Pending</p>
              <p className="text-sm text-gray-500">Your appointment letter will be generated automatically once HR completes your salary setup. You will be notified via email.</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Acknowledgement list modal */}
      {showAckList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="sticky top-0 flex justify-between items-center px-5 py-4 border-b border-gray-100 bg-white">
              <h2 className="font-bold text-gray-800">Policy Acknowledgements</h2>
              <button onClick={() => setShowAckList(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">Acknowledged ({acknowledged.length})</p>
                <div className="space-y-1">
                  {acknowledged.map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium text-gray-800">{u.name} <span className="text-gray-400 text-xs">({u.employeeProfile?.designation ?? u.email})</span></span>
                      <span className="text-green-600 text-xs">{format(new Date(u.employeeProfile!.policyAcknowledgedAt!), 'dd MMM yyyy')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">Not Yet Acknowledged ({notAcknowledged.length})</p>
                <div className="space-y-1">
                  {notAcknowledged.map(u => (
                    <div key={u.id} className="flex items-center bg-red-50 rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium text-gray-800">{u.name} <span className="text-gray-400 text-xs">({u.employeeProfile?.designation ?? u.email})</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

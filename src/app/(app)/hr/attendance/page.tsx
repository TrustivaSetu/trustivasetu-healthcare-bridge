'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { format, getDaysInMonth, startOfMonth, getDay, addDays, parseISO } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string
  userId: string
  date: string
  attendanceType: 'PRESENT' | 'LEAVE' | 'OUTSTATION'
  leaveType: 'PL' | 'CL' | 'MEDICAL' | 'UNPLANNED' | null
  workingType: 'FULL_DAY' | 'HALF_DAY'
  outstationCity: string | null
  timeIn: string | null
  latitude: number | null
  longitude: number | null
  locationName: string | null
  notes: string | null
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
}

interface Holiday { id: string; name: string; date: string }

// ── Color scheme ───────────────────────────────────────────────────────────────

type DayStatus = 'PRESENT_FULL' | 'PRESENT_HALF' | 'OUTSTATION' | 'LEAVE' | 'ABSENT' | 'WEEKEND' | 'HOLIDAY' | 'FUTURE'

function getDayStatus(
  rec: AttendanceRecord | undefined,
  isWeekend: boolean,
  isHoliday: boolean,
  isPast: boolean,
  isToday: boolean,
): DayStatus {
  if (isWeekend) return 'WEEKEND'
  if (isHoliday) return 'HOLIDAY'
  if (!isPast && !isToday) return 'FUTURE'
  if (!rec) return isPast || isToday ? 'ABSENT' : 'FUTURE'
  if (rec.attendanceType === 'PRESENT') return rec.workingType === 'HALF_DAY' ? 'PRESENT_HALF' : 'PRESENT_FULL'
  if (rec.attendanceType === 'OUTSTATION') return 'OUTSTATION'
  return 'LEAVE'
}

const STATUS_STYLE: Record<DayStatus, { bar: string; bg: string; label: string; labelColor: string }> = {
  PRESENT_FULL: { bar: 'bg-green-500',  bg: 'bg-green-50',  label: 'Present',   labelColor: 'text-green-700' },
  PRESENT_HALF: { bar: 'bg-yellow-400', bg: 'bg-yellow-50', label: 'Half Day',  labelColor: 'text-yellow-700' },
  OUTSTATION:   { bar: 'bg-orange-500', bg: 'bg-orange-50', label: 'Outstation',labelColor: 'text-orange-700' },
  LEAVE:        { bar: 'bg-blue-500',   bg: 'bg-blue-50',   label: 'Leave',     labelColor: 'text-blue-700' },
  ABSENT:       { bar: 'bg-red-400',    bg: 'bg-red-50',    label: 'Absent',    labelColor: 'text-red-600' },
  WEEKEND:      { bar: '',              bg: 'bg-gray-50',   label: 'Weekend',   labelColor: 'text-gray-400' },
  HOLIDAY:      { bar: 'bg-amber-400',  bg: 'bg-amber-50',  label: 'Holiday',   labelColor: 'text-amber-700' },
  FUTURE:       { bar: '',              bg: '',              label: '',          labelColor: '' },
}

const LEAVE_LABELS: Record<string, string> = {
  PL: 'Paid Leave', CL: 'Casual Leave', MEDICAL: 'Medical Leave', UNPLANNED: 'Unplanned Leave',
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { user: session } = useTabSession()
  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'

  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  const currentTime = format(now, 'HH:mm')

  const [viewDate, setViewDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  // Modal state
  const [showPunch, setShowPunch] = useState(false)
  const [showLeave, setShowLeave] = useState(false)

  // Punch form
  const [punch, setPunch] = useState({
    date: todayStr,
    timeIn: currentTime,
    workingType: 'FULL_DAY' as 'FULL_DAY' | 'HALF_DAY',
    isOutstation: false,
    outstationCity: '',
    latitude: null as number | null,
    longitude: null as number | null,
    locationName: '',
    notes: '',
  })
  const [locating, setLocating] = useState(false)
  const [submittingPunch, setSubmittingPunch] = useState(false)

  // Leave form
  const [leave, setLeave] = useState({
    leaveType: 'PL' as 'PL' | 'CL' | 'MEDICAL' | 'UNPLANNED',
    fromDate: todayStr,
    toDate: todayStr,
    reason: '',
  })
  const [submittingLeave, setSubmittingLeave] = useState(false)

  const monthKey = `${viewDate.year}-${String(viewDate.month).padStart(2, '0')}`

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [attRes, holRes] = await Promise.all([
      fetch(`/api/hr/attendance?month=${monthKey}`),
      fetch(`/api/hr/holidays?year=${viewDate.year}`),
    ])
    const [attData, holData] = await Promise.all([attRes.json(), holRes.json()])
    setRecords(attData.data ?? [])
    setHolidays(holData.data ?? [])
    setLoading(false)
  }, [monthKey, viewDate.year])

  useEffect(() => { fetchData() }, [fetchData])

  const holidayDates = new Set(holidays.map(h => h.date.split('T')[0]))
  const recordMap = new Map(records.map(r => [r.date.split('T')[0], r]))
  const todayRecord = recordMap.get(todayStr)

  // ── GPS ──────────────────────────────────────────────────────────────────────

  function captureGPS() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setPunch(p => ({ ...p, latitude, longitude }))
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          const d = await r.json()
          const city = d.address?.city || d.address?.town || d.address?.village || `${latitude.toFixed(3)},${longitude.toFixed(3)}`
          setPunch(p => ({ ...p, locationName: city }))
        } catch { /* ignore */ }
        setLocating(false)
      },
      () => { toast.error('Location access denied'); setLocating(false) }
    )
  }

  // ── Submit punch ─────────────────────────────────────────────────────────────

  async function submitPunch() {
    setSubmittingPunch(true)
    const payload = {
      date: punch.date,
      attendanceType: punch.isOutstation ? 'OUTSTATION' : 'PRESENT',
      leaveType: null,
      workingType: punch.isOutstation ? 'FULL_DAY' : punch.workingType,
      outstationCity: punch.isOutstation ? punch.outstationCity || null : null,
      timeIn: punch.timeIn || null,
      latitude: punch.latitude,
      longitude: punch.longitude,
      locationName: punch.locationName || null,
      notes: punch.notes || null,
    }
    const res = await fetch('/api/hr/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Attendance punched successfully!')
      setShowPunch(false)
      fetchData()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to punch attendance')
    }
    setSubmittingPunch(false)
  }

  // ── Submit leave ──────────────────────────────────────────────────────────────

  async function submitLeave() {
    setSubmittingLeave(true)
    const from = parseISO(leave.fromDate)
    const to = parseISO(leave.toDate)

    if (to < from) { toast.error('To date must be on or after From date'); setSubmittingLeave(false); return }

    // Collect working days in range (skip weekends + holidays)
    const dates: string[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const dow = d.getDay()
      if (dow === 0 || dow === 6) continue
      const ds = format(d, 'yyyy-MM-dd')
      if (holidayDates.has(ds)) continue
      dates.push(ds)
    }

    if (dates.length === 0) { toast.error('No working days in selected range'); setSubmittingLeave(false); return }

    const results = await Promise.all(dates.map(date =>
      fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          attendanceType: 'LEAVE',
          leaveType: leave.leaveType,
          workingType: 'FULL_DAY',
          notes: leave.reason || null,
        }),
      })
    ))

    const failed = results.filter(r => !r.ok).length
    if (failed === 0) {
      toast.success(`Leave applied for ${dates.length} day${dates.length > 1 ? 's' : ''}`)
      setShowLeave(false)
      fetchData()
    } else {
      toast.error(`${failed} day(s) failed — some may be locked after approval`)
    }
    setSubmittingLeave(false)
  }

  // ── Excel download ────────────────────────────────────────────────────────────

  async function downloadExcel() {
    setDownloading(true)
    const res = await fetch(`/api/hr/attendance/export?month=${monthKey}`)
    if (!res.ok) { toast.error('Failed to download'); setDownloading(false); return }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Attendance_${monthKey}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
    setDownloading(false)
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(new Date(viewDate.year, viewDate.month - 1))
  const firstDow = getDay(startOfMonth(new Date(viewDate.year, viewDate.month - 1)))
  const isCurrentMonth = now.getFullYear() === viewDate.year && now.getMonth() + 1 === viewDate.month
  const isFutureMonth = viewDate.year > now.getFullYear() || (viewDate.year === now.getFullYear() && viewDate.month > now.getMonth() + 1)

  function prevMonth() {
    setViewDate(v => { const d = new Date(v.year, v.month - 2); return { year: d.getFullYear(), month: d.getMonth() + 1 } })
  }
  function nextMonth() {
    setViewDate(v => { const d = new Date(v.year, v.month); return { year: d.getFullYear(), month: d.getMonth() + 1 } })
  }

  // ── Today status ──────────────────────────────────────────────────────────────

  function getTodayStatusLabel() {
    if (!todayRecord) return { label: 'Not Marked Yet', sub: 'Tap "Punch Attendance" to mark today', color: 'bg-gray-100 border-gray-200 text-gray-700', icon: '⏰' }
    if (todayRecord.approvalStatus === 'REJECTED') return { label: 'Rejected', sub: todayRecord.rejectionReason ?? 'Contact your manager', color: 'bg-red-50 border-red-200 text-red-700', icon: '✗' }
    if (todayRecord.attendanceType === 'PRESENT') {
      if (todayRecord.workingType === 'HALF_DAY') return { label: 'Present — Half Day', sub: `Checked in at ${todayRecord.timeIn ?? '—'}`, color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: '🌤' }
      return { label: 'Present — Full Day', sub: `Checked in at ${todayRecord.timeIn ?? '—'}`, color: 'bg-green-50 border-green-200 text-green-800', icon: '✓' }
    }
    if (todayRecord.attendanceType === 'OUTSTATION') return { label: `Outstation${todayRecord.outstationCity ? ` — ${todayRecord.outstationCity}` : ''}`, sub: 'Travel day marked', color: 'bg-orange-50 border-orange-200 text-orange-800', icon: '✈' }
    if (todayRecord.attendanceType === 'LEAVE') return { label: `On Leave — ${LEAVE_LABELS[todayRecord.leaveType ?? ''] ?? 'Leave'}`, sub: todayRecord.approvalStatus === 'APPROVED' ? 'Approved' : 'Pending approval', color: 'bg-blue-50 border-blue-200 text-blue-800', icon: '🏖' }
    return { label: 'Marked', sub: '', color: 'bg-gray-50 border-gray-200 text-gray-700', icon: '•' }
  }

  const todayStatus = getTodayStatusLabel()

  // ── Monthly summary ───────────────────────────────────────────────────────────

  const present   = records.filter(r => r.attendanceType === 'PRESENT' && r.workingType === 'FULL_DAY').length
  const half      = records.filter(r => r.attendanceType === 'PRESENT' && r.workingType === 'HALF_DAY').length
  const outsta    = records.filter(r => r.attendanceType === 'OUTSTATION').length
  const leaves    = records.filter(r => r.attendanceType === 'LEAVE').length
  const approved  = records.filter(r => r.approvalStatus === 'APPROVED').length
  const pending   = records.filter(r => r.approvalStatus === 'PENDING').length

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500">{format(now, 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={downloadExcel} disabled={downloading}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-60 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading ? 'Exporting...' : 'Export Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Today's status banner */}
      <div className={cn('flex items-center justify-between gap-4 border rounded-xl px-4 py-3', todayStatus.color)}>
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{todayStatus.icon}</span>
          <div>
            <p className="font-semibold text-sm">{todayStatus.label}</p>
            <p className="text-xs opacity-75">{todayStatus.sub}</p>
          </div>
        </div>
        {!todayRecord && (
          <button onClick={() => { setPunch(p => ({ ...p, date: todayStr, timeIn: format(new Date(), 'HH:mm') })); setShowPunch(true) }}
            className="flex-shrink-0 px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 transition">
            Punch Now
          </button>
        )}
        {todayRecord && todayRecord.approvalStatus === 'PENDING' && (
          <span className="flex-shrink-0 text-xs font-medium px-2 py-1 bg-amber-100 text-amber-700 rounded-full">Awaiting Approval</span>
        )}
        {todayRecord && todayRecord.approvalStatus === 'APPROVED' && (
          <span className="flex-shrink-0 text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">Approved</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setPunch(p => ({ ...p, date: todayStr, timeIn: format(new Date(), 'HH:mm'), isOutstation: false, outstationCity: '', locationName: '', latitude: null, longitude: null, notes: '' })); setShowPunch(true) }}
          className="flex items-center justify-center gap-2 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl transition shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Punch Attendance
        </button>
        <button
          onClick={() => { setLeave(l => ({ ...l, fromDate: todayStr, toDate: todayStr, reason: '' })); setShowLeave(true) }}
          className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Apply Leave
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-800">
          {format(new Date(viewDate.year, viewDate.month - 1), 'MMMM yyyy')}
        </span>
        <button onClick={nextMonth} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {([
          ['PRESENT_FULL', 'Present'], ['PRESENT_HALF', 'Half Day'], ['OUTSTATION', 'Outstation'],
          ['LEAVE', 'Leave'], ['ABSENT', 'Absent'], ['HOLIDAY', 'Holiday'], ['WEEKEND', 'Weekend'],
        ] as [DayStatus, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn('w-2.5 h-2.5 rounded-sm', STATUS_STYLE[key].bar || 'bg-gray-200')} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before month start */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e${i}`} className="h-[72px] border-b border-r border-gray-100 bg-gray-50/50" />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${viewDate.year}-${String(viewDate.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dow = (firstDow + day - 1) % 7
              const isWeekend = dow === 0 || dow === 6
              const isHoliday = holidayDates.has(dateStr)
              const rec = recordMap.get(dateStr)
              const isToday = isCurrentMonth && day === now.getDate()
              const isPast = isFutureMonth ? false : isCurrentMonth ? day < now.getDate() : true
              const isFuture = isFutureMonth || (isCurrentMonth && day > now.getDate())
              const holiday = holidays.find(h => h.date.split('T')[0] === dateStr)
              const status = getDayStatus(rec, isWeekend, isHoliday, isPast, isToday)
              const style = STATUS_STYLE[status]
              const isClickable = !isWeekend && !isFuture

              return (
                <button
                  key={day}
                  disabled={!isClickable}
                  onClick={() => {
                    if (!isClickable) return
                    if (rec?.approvalStatus === 'APPROVED' && !isAdmin) {
                      toast.error('Locked — approved by manager'); return
                    }
                    // Pre-fill punch form with this day
                    setPunch(p => ({
                      ...p,
                      date: dateStr,
                      timeIn: rec?.timeIn ?? '09:00',
                      workingType: rec?.workingType ?? 'FULL_DAY',
                      isOutstation: rec?.attendanceType === 'OUTSTATION',
                      outstationCity: rec?.outstationCity ?? '',
                      locationName: rec?.locationName ?? '',
                      latitude: rec?.latitude ?? null,
                      longitude: rec?.longitude ?? null,
                      notes: rec?.notes ?? '',
                    }))
                    setShowPunch(true)
                  }}
                  className={cn(
                    'h-[72px] border-b border-r border-gray-100 p-1.5 flex flex-col items-start text-left transition-all',
                    style.bg,
                    isClickable && 'hover:brightness-95 cursor-pointer',
                    !isClickable && 'cursor-default',
                    isToday && 'ring-2 ring-inset ring-brand-500',
                  )}
                >
                  {/* Date number */}
                  <span className={cn(
                    'text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full leading-none',
                    isToday ? 'bg-brand-600 text-white' : style.labelColor || 'text-gray-500',
                  )}>
                    {day}
                  </span>

                  {/* Color bar */}
                  {style.bar && <div className={cn('mt-1 w-full h-1 rounded-full', style.bar)} />}

                  {/* Label */}
                  <span className={cn('text-[9px] font-semibold leading-tight mt-0.5 truncate w-full', style.labelColor)}>
                    {isHoliday && holiday ? holiday.name :
                     status === 'OUTSTATION' && rec?.outstationCity ? rec.outstationCity :
                     status === 'LEAVE' ? (LEAVE_LABELS[rec?.leaveType ?? ''] ?? 'Leave') :
                     status !== 'FUTURE' && status !== 'WEEKEND' ? style.label : ''}
                  </span>

                  {/* Approval badge */}
                  {rec && !isWeekend && (
                    <span className={cn('text-[8px] font-bold leading-none',
                      rec.approvalStatus === 'APPROVED' ? 'text-green-600' :
                      rec.approvalStatus === 'REJECTED' ? 'text-red-600' : 'text-amber-500'
                    )}>
                      {rec.approvalStatus === 'APPROVED' ? '✓ Approved' :
                       rec.approvalStatus === 'REJECTED' ? '✗ Rejected' : '• Pending'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Monthly summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Monthly Summary</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'Present', value: present,  color: 'bg-green-50 text-green-700' },
            { label: 'Half Day', value: half,    color: 'bg-yellow-50 text-yellow-700' },
            { label: 'Outstation', value: outsta,color: 'bg-orange-50 text-orange-700' },
            { label: 'Leave', value: leaves,     color: 'bg-blue-50 text-blue-700' },
            { label: 'Approved', value: approved,color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Pending', value: pending,  color: 'bg-amber-50 text-amber-700' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl p-3 text-center', s.color)}>
              <p className="text-xl font-bold leading-none">{s.value}</p>
              <p className="text-[11px] font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Punch Attendance Modal ───────────────────────────────────────────── */}
      {showPunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPunch(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Punch Attendance</h2>
                <p className="text-xs text-gray-500 mt-0.5">Mark your presence for a day</p>
              </div>
              <button onClick={() => setShowPunch(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition text-lg">✕</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
                <input type="date" value={punch.date}
                  max={todayStr}
                  onChange={e => setPunch(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Time */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Day Started At</label>
                <input type="time" value={punch.timeIn}
                  onChange={e => setPunch(p => ({ ...p, timeIn: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Full / Half Day */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Working</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['FULL_DAY', 'HALF_DAY'] as const).map(w => (
                    <button key={w} type="button"
                      disabled={punch.isOutstation}
                      onClick={() => setPunch(p => ({ ...p, workingType: w }))}
                      className={cn('py-2.5 text-sm font-semibold rounded-xl border-2 transition',
                        punch.workingType === w && !punch.isOutstation
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                        punch.isOutstation && 'opacity-40 cursor-not-allowed',
                      )}>
                      {w === 'FULL_DAY' ? '☀ Full Day' : '🌤 Half Day'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Outstation toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Outstation / Travel</p>
                  <p className="text-xs text-gray-400">Working from outside office</p>
                </div>
                <button type="button"
                  onClick={() => setPunch(p => ({ ...p, isOutstation: !p.isOutstation, workingType: 'FULL_DAY' }))}
                  className={cn('relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                    punch.isOutstation ? 'bg-orange-500' : 'bg-gray-200'
                  )}>
                  <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    punch.isOutstation && 'translate-x-5'
                  )} />
                </button>
              </div>

              {punch.isOutstation && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">City / Destination *</label>
                  <input value={punch.outstationCity}
                    onChange={e => setPunch(p => ({ ...p, outstationCity: e.target.value }))}
                    placeholder="e.g. Mumbai, Delhi"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              )}

              {/* GPS Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location</label>
                <button type="button" onClick={captureGPS} disabled={locating}
                  className={cn('w-full px-3 py-2.5 border-2 border-dashed rounded-lg text-sm transition flex items-center gap-2 justify-center',
                    punch.locationName ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300',
                    locating && 'opacity-60 cursor-not-allowed',
                  )}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {locating ? 'Getting location...' : punch.locationName ? `📍 ${punch.locationName}` : 'Capture GPS Location'}
                </button>
                {punch.locationName && (
                  <button type="button" onClick={() => setPunch(p => ({ ...p, locationName: '', latitude: null, longitude: null }))}
                    className="text-xs text-gray-400 hover:text-gray-600 mt-1">Clear location</button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optional)</label>
                <textarea value={punch.notes} onChange={e => setPunch(p => ({ ...p, notes: e.target.value }))} rows={2}
                  placeholder="Any additional info..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={submitPunch} disabled={submittingPunch || (punch.isOutstation && !punch.outstationCity)}
                className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                {submittingPunch ? 'Submitting...' : 'Submit Attendance'}
              </button>
              <button onClick={() => setShowPunch(false)}
                className="px-4 py-3 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Apply Leave Modal ────────────────────────────────────────────────── */}
      {showLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowLeave(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Apply Leave</h2>
                <p className="text-xs text-gray-500 mt-0.5">Send leave request to your manager</p>
              </div>
              <button onClick={() => setShowLeave(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition text-lg">✕</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Leave type */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['PL', 'Paid Leave'], ['CL', 'Casual Leave'], ['MEDICAL', 'Medical Leave'], ['UNPLANNED', 'Unplanned']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setLeave(l => ({ ...l, leaveType: val }))}
                      className={cn('py-2.5 px-3 text-xs font-semibold rounded-xl border-2 transition text-left',
                        leave.leaveType === val
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      )}>
                      {val === 'PL' && '🏖 '}{val === 'CL' && '🏠 '}{val === 'MEDICAL' && '🏥 '}{val === 'UNPLANNED' && '⚡ '}{label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {leave.leaveType === 'PL' && 'Planned paid leave — deducted from PL balance (12/year)'}
                  {leave.leaveType === 'CL' && 'Casual leave — deducted from CL balance (6/year)'}
                  {leave.leaveType === 'MEDICAL' && 'Medical leave — deducted from medical balance (6/year)'}
                  {leave.leaveType === 'UNPLANNED' && 'Unpaid leave — will be deducted from salary'}
                </p>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">From Date</label>
                  <input type="date" value={leave.fromDate}
                    onChange={e => setLeave(l => ({ ...l, fromDate: e.target.value, toDate: e.target.value >= l.toDate ? e.target.value : l.toDate }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">To Date</label>
                  <input type="date" value={leave.toDate} min={leave.fromDate}
                    onChange={e => setLeave(l => ({ ...l, toDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reason</label>
                <textarea value={leave.reason} onChange={e => setLeave(l => ({ ...l, reason: e.target.value }))} rows={3}
                  placeholder="Brief reason for leave..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                <strong>Note:</strong> Weekends and holidays are automatically excluded. Your manager will receive an email to approve or reject this request.
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={submitLeave} disabled={submittingLeave}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                {submittingLeave ? 'Submitting...' : 'Submit Leave Request'}
              </button>
              <button onClick={() => setShowLeave(false)}
                className="px-4 py-3 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

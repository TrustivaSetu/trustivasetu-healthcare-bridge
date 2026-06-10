'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchLosDb, saveLosDb } from '@/lib/los/client-api'
import { nextId } from '@/lib/los/ids'
import { buildLosEnquiryId, transitionLead } from '@/lib/los/status-engine'
import { syncLeadToLms } from '@/lib/los/sync-to-lms'
import type {
  AssociateTarget,
  AttendanceRecord,
  CollectionRecord,
  EmiQuote,
  Enquiry,
  Hospital,
  Lead,
  LeadFormData,
  LeadStatus,
  LosComment,
  LosDatabase,
  LosUser,
  NachRecord,
  Visit,
} from '@/lib/los/types'

type SessionUser = { email: string; role: string; region: string }

type LosContextValue = {
  db: LosDatabase
  loading: boolean
  session: SessionUser | null
  hospitals: string[]
  syncToast: { type: 'ok' | 'err'; message: string } | null
  syncing: boolean
  refresh: () => Promise<void>
  persist: (next: LosDatabase) => Promise<void>
  notify: (type: 'ok' | 'err', message: string) => void
  createLead: (form: LeadFormData, by: string, extra?: Partial<Lead>) => Promise<Lead>
  updateLead: (lead: Lead, sync?: boolean) => Promise<void>
  setLeadStatus: (leadId: string, status: LeadStatus, by: string, note?: string) => Promise<void>
  createEnquiry: (e: Omit<Enquiry, 'id' | 'createdAt'>) => Promise<Enquiry>
  updateEnquiry: (e: Enquiry) => Promise<void>
  createUser: (u: Omit<LosUser, 'id' | 'createdAt'>) => Promise<LosUser>
  upsertHospital: (h: Omit<Hospital, 'id' | 'createdAt'> & { id?: string }) => Promise<Hospital>
  createVisit: (v: Omit<Visit, 'id' | 'createdAt'>) => Promise<Visit>
  saveAttendance: (a: Omit<AttendanceRecord, 'id'>) => Promise<void>
  saveTarget: (t: Omit<AssociateTarget, 'id' | 'achievedLeads' | 'status'>) => Promise<void>
  saveEmiQuote: (q: Omit<EmiQuote, 'id' | 'createdAt' | 'monthlyEmi' | 'totalPayable' | 'netDisbursal'> & {
    monthlyEmi: number
    totalPayable: number
    netDisbursal: number
  }) => Promise<EmiQuote>
  addComment: (c: Omit<LosComment, 'id' | 'createdAt'>) => Promise<void>
  addNach: (n: Omit<NachRecord, 'id'>) => Promise<void>
  addCollection: (c: Omit<CollectionRecord, 'id' | 'createdAt'>) => Promise<void>
  allocateLead: (leadId: string, assignee: string) => Promise<void>
}

const LosContext = createContext<LosContextValue | null>(null)

export function LosProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<LosDatabase | null>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionUser | null>(null)
  const [syncToast, setSyncToast] = useState<{ type: 'ok' | 'err'; message: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  const notify = useCallback((type: 'ok' | 'err', message: string) => {
    setSyncToast({ type, message })
    setTimeout(() => setSyncToast(null), 6000)
  }, [])

  const refresh = useCallback(async () => {
    const data = await fetchLosDb()
    setDb(data)
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('trustiva-user')
    if (raw) {
      try {
        setSession(JSON.parse(raw) as SessionUser)
      } catch {
        /* ignore */
      }
    }
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const persist = useCallback(async (next: LosDatabase) => {
    setDb(next)
    await saveLosDb(next)
  }, [])

  const hospitals = useMemo(
    () => (db?.hospitals ?? []).map((h) => h.name),
    [db]
  )

  const createLead = useCallback(
    async (form: LeadFormData, by: string, extra?: Partial<Lead>) => {
      if (!db) throw new Error('DB not loaded')
      const losEnquiryId = buildLosEnquiryId(form.mobileNumber, form.patientName)
      const estimate = Number(form.medicalEstimate || form.financingRequired || 0)
      const lead: Lead = {
        id: nextId('LEAD', db.leads.map((l) => l.id)),
        losEnquiryId,
        applicantName: form.patientName,
        mobileNumber: form.mobileNumber,
        email: form.email,
        hospitalName: form.hospitalName,
        associateName: by,
        estimateAmount: estimate,
        eligibility: estimate > 50000 ? 'ELIGIBLE' : 'REVIEW',
        autoApproval: false,
        status: extra?.status ?? 'ENQUIRY_CREATED',
        allocationStatus: 'UNASSIGNED',
        form,
        auditLog: [{ at: new Date().toISOString(), action: 'CREATED', by }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...extra,
      }
      const next = { ...db, leads: [...db.leads, lead] }
      await persist(next)
      if (extra?.status === 'OTP_VERIFIED' || lead.status === 'OTP_VERIFIED') {
        setSyncing(true)
        try {
          await syncLeadToLms(lead)
          notify('ok', 'Lead synced to LMS')
        } catch (e) {
          notify('err', e instanceof Error ? e.message : 'LMS sync failed')
        } finally {
          setSyncing(false)
        }
      }
      return lead
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, persist]
  )

  const updateLead = useCallback(
    async (lead: Lead, sync = true) => {
      if (!db) return
      const next = {
        ...db,
        leads: db.leads.map((l) => (l.id === lead.id ? { ...lead, updatedAt: new Date().toISOString() } : l)),
      }
      await persist(next)
      if (sync) {
        setSyncing(true)
        try {
          await syncLeadToLms(lead)
          notify('ok', 'Lead synced to LMS')
        } catch (e) {
          notify('err', e instanceof Error ? e.message : 'LMS sync failed')
        } finally {
          setSyncing(false)
        }
      }
    },
    [db, persist, notify]
  )

  const setLeadStatus = useCallback(
    async (leadId: string, status: LeadStatus, by: string, note?: string) => {
      if (!db) return
      const lead = db.leads.find((l) => l.id === leadId)
      if (!lead) return
      const updated = transitionLead(lead, status, by, note)
      await updateLead(updated, true)
    },
    [db, updateLead]
  )

  const createEnquiry = useCallback(
    async (e: Omit<Enquiry, 'id' | 'createdAt'>) => {
      if (!db) throw new Error('DB not loaded')
      const enquiry: Enquiry = {
        ...e,
        id: nextId('ENQ', db.enquiries.map((x) => x.id)),
        createdAt: new Date().toISOString(),
      }
      await persist({ ...db, enquiries: [...db.enquiries, enquiry] })
      return enquiry
    },
    [db, persist]
  )

  const updateEnquiry = useCallback(
    async (e: Enquiry) => {
      if (!db) return
      await persist({
        ...db,
        enquiries: db.enquiries.map((x) => (x.id === e.id ? e : x)),
      })
    },
    [db, persist]
  )

  const createUser = useCallback(
    async (u: Omit<LosUser, 'id' | 'createdAt'>) => {
      if (!db) throw new Error('DB not loaded')
      const user: LosUser = {
        ...u,
        id: nextId('USR', db.users.map((x) => x.id)),
        createdAt: new Date().toISOString(),
      }
      await persist({ ...db, users: [...db.users, user] })
      return user
    },
    [db, persist]
  )

  const upsertHospital = useCallback(
    async (h: Omit<Hospital, 'id' | 'createdAt'> & { id?: string }) => {
      if (!db) throw new Error('DB not loaded')
      const existing = h.id ? db.hospitals.find((x) => x.id === h.id) : undefined
      const hospital: Hospital = existing
        ? { ...existing, ...h }
        : {
            ...h,
            id: nextId('HSP', db.hospitals.map((x) => x.id)),
            createdAt: new Date().toISOString(),
          }
      const hospitals = existing
        ? db.hospitals.map((x) => (x.id === hospital.id ? hospital : x))
        : [...db.hospitals, hospital]
      await persist({ ...db, hospitals })
      return hospital
    },
    [db, persist]
  )

  const createVisit = useCallback(
    async (v: Omit<Visit, 'id' | 'createdAt'>) => {
      if (!db) throw new Error('DB not loaded')
      const visit: Visit = {
        ...v,
        id: nextId('VIS', db.visits.map((x) => x.id)),
        createdAt: new Date().toISOString(),
      }
      await persist({ ...db, visits: [...db.visits, visit] })
      return visit
    },
    [db, persist]
  )

  const saveAttendance = useCallback(
    async (a: Omit<AttendanceRecord, 'id'>) => {
      if (!db) return
      const rec: AttendanceRecord = { ...a, id: nextId('ATT', db.attendance.map((x) => x.id)) }
      await persist({ ...db, attendance: [...db.attendance, rec] })
    },
    [db, persist]
  )

  const saveTarget = useCallback(
    async (t: Omit<AssociateTarget, 'id' | 'achievedLeads' | 'status'>) => {
      if (!db) return
      const rec: AssociateTarget = {
        ...t,
        id: nextId('TGT', db.targets.map((x) => x.id)),
        achievedLeads: 0,
        status: 'PENDING',
      }
      await persist({ ...db, targets: [...db.targets, rec] })
    },
    [db, persist]
  )

  const saveEmiQuote = useCallback(
    async (
      q: Omit<EmiQuote, 'id' | 'createdAt' | 'monthlyEmi' | 'totalPayable' | 'netDisbursal'> & {
        monthlyEmi: number
        totalPayable: number
        netDisbursal: number
      }
    ) => {
      if (!db) throw new Error('DB not loaded')
      const quote: EmiQuote = {
        ...q,
        id: nextId('EMI', db.emiQuotes.map((x) => x.id)),
        createdAt: new Date().toISOString(),
      }
      await persist({ ...db, emiQuotes: [...db.emiQuotes, quote] })
      return quote
    },
    [db, persist]
  )

  const addComment = useCallback(
    async (c: Omit<LosComment, 'id' | 'createdAt'>) => {
      if (!db) return
      const comment: LosComment = {
        ...c,
        id: nextId('CMT', db.comments.map((x) => x.id)),
        createdAt: new Date().toISOString(),
      }
      await persist({ ...db, comments: [...db.comments, comment] })
    },
    [db, persist]
  )

  const addNach = useCallback(
    async (n: Omit<NachRecord, 'id'>) => {
      if (!db) return
      const rec: NachRecord = { ...n, id: nextId('NACH', db.nach.map((x) => x.id)) }
      await persist({ ...db, nach: [...db.nach, rec] })
    },
    [db, persist]
  )

  const addCollection = useCallback(
    async (c: Omit<CollectionRecord, 'id' | 'createdAt'>) => {
      if (!db) return
      const rec: CollectionRecord = {
        ...c,
        id: nextId('COL', db.collections.map((x) => x.id)),
        createdAt: new Date().toISOString(),
      }
      await persist({ ...db, collections: [...db.collections, rec] })
    },
    [db, persist]
  )

  const allocateLead = useCallback(
    async (leadId: string, assignee: string) => {
      if (!db) return
      const lead = db.leads.find((l) => l.id === leadId)
      if (!lead) return
      await updateLead(
        {
          ...lead,
          assignedTo: assignee,
          allocationStatus: 'ASSIGNED',
          auditLog: [
            ...lead.auditLog,
            {
              at: new Date().toISOString(),
              action: 'ASSIGNED',
              by: session?.email ?? 'system',
              note: assignee,
            },
          ],
        },
        false
      )
    },
    [db, session, updateLead]
  )

  const value: LosContextValue = {
    db: db!,
    loading,
    session,
    hospitals,
    syncToast,
    syncing,
    refresh,
    persist,
    notify,
    createLead,
    updateLead,
    setLeadStatus,
    createEnquiry,
    updateEnquiry,
    createUser,
    upsertHospital,
    createVisit,
    saveAttendance,
    saveTarget,
    saveEmiQuote,
    addComment,
    addNach,
    addCollection,
    allocateLead,
  }

  if (loading || !db) {
    return (
      <div className="min-h-screen bg-[#07111f] flex items-center justify-center text-white">
        Loading Trustiva LOS…
      </div>
    )
  }

  return <LosContext.Provider value={value}>{children}</LosContext.Provider>
}

export function useLos() {
  const ctx = useContext(LosContext)
  if (!ctx) throw new Error('useLos must be used within LosProvider')
  return ctx
}

import { db } from '@/lib/db'
import { buildClinicFilter } from '@/lib/permissions'

/**
 * Returns true if the user may access the lead with the given id, applying the
 * same clinic/region scoping used by the leads list + leads/[id] endpoints.
 * Returns false when the lead does not exist OR is outside the caller's scope —
 * callers should respond 404 in both cases to avoid leaking lead-id existence.
 *
 * Use this to guard lead sub-resource routes (agreements, tasks, etc.) which
 * operate by leadId and would otherwise be IDOR-able.
 */
export async function canAccessLeadById(
  leadId: string,
  role: string,
  regionIds: string[],
  clinicIds: string[]
): Promise<boolean> {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { clinicId: true } })
  if (!lead) return false
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true
  const filter = buildClinicFilter(role, regionIds, clinicIds)
  const count = await db.clinic.count({ where: { id: lead.clinicId, ...filter } })
  return count > 0
}

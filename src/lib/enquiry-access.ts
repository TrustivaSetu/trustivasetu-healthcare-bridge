import { db } from '@/lib/db'

/** Assignment fields shared by PatientEnquiry and ProviderEnquiry. */
export type EnquiryScope = {
  assignedRmId: string | null
  assignedManagerId: string | null
  assignedRegion: string | null
}

/**
 * Returns true if the user may view/modify this enquiry. Mirrors EXACTLY the
 * region/assignment predicate used by the enquiry list endpoints so that
 * by-id mutations (PATCH / assign / convert) cannot bypass scoping:
 *
 *  - SUPER_ADMIN / ADMIN: all enquiries
 *  - REGIONAL_MANAGER: assigned to them as manager, OR in one of their regions
 *    and not yet claimed by a manager
 *  - TEAM_MEMBER: assigned to them as RM, OR in one of their regions and not
 *    yet claimed by an RM
 *  - everyone else (e.g. CLINIC_USER): no access
 *
 * Out-of-scope access should be answered with 404 (not 403) to avoid leaking
 * enquiry-id existence.
 */
export async function canAccessEnquiry(
  enquiry: EnquiryScope,
  role: string,
  userId: string
): Promise<boolean> {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true
  if (role !== 'REGIONAL_MANAGER' && role !== 'TEAM_MEMBER') return false

  const userRegions = await db.userRegion.findMany({
    where: { userId },
    include: { region: true },
  })
  const myRegionNames = userRegions.map((ur) => ur.region.name)

  const inMyRegion =
    enquiry.assignedRegion != null && myRegionNames.includes(enquiry.assignedRegion)

  if (role === 'REGIONAL_MANAGER') {
    if (enquiry.assignedManagerId === userId) return true
    return enquiry.assignedManagerId === null && inMyRegion
  }

  // TEAM_MEMBER
  if (enquiry.assignedRmId === userId) return true
  return enquiry.assignedRmId === null && inMyRegion
}

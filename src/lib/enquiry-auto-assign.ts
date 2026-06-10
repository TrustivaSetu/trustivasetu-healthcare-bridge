import { db } from '@/lib/db'

export async function autoAssignEnquiry(
  city?: string | null,
  pinCode?: string | null,
  state?: string | null
): Promise<{ assignedRegion: string; assignedRmId: string | null; assignedManagerId: string | null } | null> {
  if (!city && !pinCode && !state) return null
  const mappings = await db.regionMapping.findMany()
  for (const mapping of mappings) {
    if (pinCode && mapping.pinCodes.includes(pinCode)) {
      return { assignedRegion: mapping.regionName, assignedRmId: mapping.assignedRmId, assignedManagerId: mapping.assignedManagerId }
    }
    if (city && mapping.cities.some(c => c.toLowerCase() === city.toLowerCase())) {
      return { assignedRegion: mapping.regionName, assignedRmId: mapping.assignedRmId, assignedManagerId: mapping.assignedManagerId }
    }
    if (state && mapping.states.some(s => s.toLowerCase() === state.toLowerCase())) {
      return { assignedRegion: mapping.regionName, assignedRmId: mapping.assignedRmId, assignedManagerId: mapping.assignedManagerId }
    }
  }
  return null
}

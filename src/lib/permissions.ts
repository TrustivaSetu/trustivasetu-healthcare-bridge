const PERMISSIONS = {
  USER_CREATE: ['SUPER_ADMIN', 'ADMIN'],
  USER_READ: ['SUPER_ADMIN', 'ADMIN'],
  USER_UPDATE: ['SUPER_ADMIN', 'ADMIN'],
  USER_DELETE: ['SUPER_ADMIN'],
  REGION_MANAGE: ['SUPER_ADMIN', 'ADMIN'],
  CLINIC_CREATE: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'],
  CLINIC_READ: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'],
  CLINIC_UPDATE: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'],
  CLINIC_DELETE: ['SUPER_ADMIN', 'ADMIN'],
  LEAD_CREATE: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'],
  LEAD_READ: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'],
  LEAD_UPDATE: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'],
  LEAD_DELETE: ['SUPER_ADMIN', 'ADMIN'],
  LEAD_UPDATE_STATUS: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'],
  REPORT_VIEW: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'],
  REPORT_EXPORT: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'],
  DASHBOARD_VIEW: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'],
  TARGET_MANAGE: ['SUPER_ADMIN', 'ADMIN'],
  LENDER_MANAGE: ['SUPER_ADMIN', 'ADMIN'],
  AUDIT_LOG_VIEW: ['SUPER_ADMIN', 'ADMIN'],
} as const

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(role: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role)
}

export function isAdmin(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

export function canAccessRegion(role: string, userRegionIds: string[], regionId: string): boolean {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true
  return userRegionIds.includes(regionId)
}

export function canAccessClinic(
  role: string,
  userRegionIds: string[],
  userClinicIds: string[],
  clinicRegionId: string,
  clinicId: string
): boolean {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true
  if (role === 'REGIONAL_MANAGER') return userRegionIds.includes(clinicRegionId)
  return userClinicIds.includes(clinicId)
}

export function buildClinicFilter(role: string, regionIds: string[], clinicIds: string[]): Record<string, unknown> {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return {}
  if (role === 'REGIONAL_MANAGER') return { regionId: { in: regionIds } }
  return { id: { in: clinicIds } }
}

export function isClinicUser(role: string): boolean {
  return role === 'CLINIC_USER'
}

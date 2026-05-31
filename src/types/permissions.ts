export const MODULE_KEYS = [
  'DASHBOARD',
  'LEADS',
  'CLINICS',
  'REPORTS',
  'LENDERS',
  'NOTIFICATIONS',
  'USERS',
] as const

export const ACTION_KEYS = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'EXPORT',
  'APPROVE',
] as const

export const MANAGED_ROLES = ['REGIONAL_MANAGER', 'TEAM_MEMBER'] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]
export type ActionKey = (typeof ACTION_KEYS)[number]
export type ManagedRole = (typeof MANAGED_ROLES)[number]

export const MODULE_LABELS: Record<ModuleKey, string> = {
  DASHBOARD: 'Dashboard',
  LEADS: 'Leads',
  CLINICS: 'Clinic Onboarding',
  REPORTS: 'Reports',
  LENDERS: 'Lenders',
  NOTIFICATIONS: 'Notifications',
  USERS: 'Settings / Users',
}

export const ACTION_LABELS: Record<ActionKey, string> = {
  VIEW: 'View',
  CREATE: 'Create',
  EDIT: 'Edit',
  DELETE: 'Delete',
  EXPORT: 'Export',
  APPROVE: 'Approve/Reject',
}

export const ROLE_LABELS: Record<ManagedRole, string> = {
  REGIONAL_MANAGER: 'Regional Manager',
  TEAM_MEMBER: 'Team Member',
}

/** Which actions are applicable per module. N/A actions show as disabled cells. */
export const MODULE_ACTIONS: Record<ModuleKey, ActionKey[]> = {
  DASHBOARD: ['VIEW'],
  LEADS: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE'],
  CLINICS: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'],
  REPORTS: ['VIEW', 'EXPORT'],
  LENDERS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  NOTIFICATIONS: ['VIEW'],
  USERS: ['VIEW', 'EDIT'],
}

/** Factory defaults – used as fallback when DB has no rows yet */
export const DEFAULT_PERMISSIONS: Record<ManagedRole, Record<ModuleKey, ActionKey[]>> = {
  REGIONAL_MANAGER: {
    DASHBOARD: ['VIEW'],
    LEADS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'APPROVE'],
    CLINICS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    REPORTS: ['VIEW', 'EXPORT'],
    LENDERS: ['VIEW'],
    NOTIFICATIONS: ['VIEW'],
    USERS: [],
  },
  TEAM_MEMBER: {
    DASHBOARD: ['VIEW'],
    LEADS: ['VIEW', 'CREATE'],
    CLINICS: ['VIEW', 'CREATE'],
    REPORTS: ['VIEW'],
    LENDERS: ['VIEW'],
    NOTIFICATIONS: ['VIEW'],
    USERS: [],
  },
}

export type RolePermissionMatrix = Record<ManagedRole, Record<ModuleKey, Record<ActionKey, boolean>>>

export const MODULE_KEYS = [
  // Core LMS
  'DASHBOARD',
  'LEADS',
  'CLINICS',
  'REPORTS',
  'LENDERS',
  'NOTIFICATIONS',
  // HR
  'HR_POLICIES',
  'ATTENDANCE',
  'EXPENSES',
  'SALARY',
  'DIRECTORY',
  'DOCUMENTS',
  'APPOINTMENT_LETTERS',
  'RECOGNITION',
  'HR_MODULE',
  // Admin
  'USERS',
  'PERMISSIONS',
  'REGIONS',
  'TARGETS',
  'AUDIT_LOGS',
  'WEBHOOKS',
] as const

export const ACTION_KEYS = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'EXPORT',
  'APPROVE',
] as const

// ADMIN is now configurable (Super Admin can restrict); SUPER_ADMIN always has full access
export const MANAGED_ROLES = ['ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]
export type ActionKey = (typeof ACTION_KEYS)[number]
export type ManagedRole = (typeof MANAGED_ROLES)[number]

export const MODULE_LABELS: Record<ModuleKey, string> = {
  DASHBOARD:            'Dashboard',
  LEADS:                'Leads',
  CLINICS:              'Clinics / Centres',
  REPORTS:              'Reports',
  LENDERS:              'Lenders',
  NOTIFICATIONS:        'Notifications',
  HR_POLICIES:          'HR Policies',
  ATTENDANCE:           'Attendance',
  EXPENSES:             'Expenses',
  SALARY:               'Salary Management',
  DIRECTORY:            'Employee Directory',
  DOCUMENTS:            'My Documents',
  APPOINTMENT_LETTERS:  'Appointment Letters',
  RECOGNITION:          'Recognition Wall',
  HR_MODULE:            'HR Dashboard',
  USERS:                'User Management',
  PERMISSIONS:          'Permissions',
  REGIONS:              'Regions',
  TARGETS:              'Targets',
  AUDIT_LOGS:           'Audit Logs',
  WEBHOOKS:             'Webhook Logs',
}

export const MODULE_GROUP: Record<ModuleKey, string> = {
  DASHBOARD:            'Core',
  LEADS:                'Core',
  CLINICS:              'Core',
  REPORTS:              'Core',
  LENDERS:              'Core',
  NOTIFICATIONS:        'Core',
  HR_POLICIES:          'HR',
  ATTENDANCE:           'HR',
  EXPENSES:             'HR',
  SALARY:               'HR',
  DIRECTORY:            'HR',
  DOCUMENTS:            'HR',
  APPOINTMENT_LETTERS:  'HR',
  RECOGNITION:          'HR',
  HR_MODULE:            'HR',
  USERS:                'Administration',
  PERMISSIONS:          'Administration',
  REGIONS:              'Administration',
  TARGETS:              'Administration',
  AUDIT_LOGS:           'Administration',
  WEBHOOKS:             'Administration',
}

export const ACTION_LABELS: Record<ActionKey, string> = {
  VIEW:    'View',
  CREATE:  'Create',
  EDIT:    'Edit',
  DELETE:  'Delete',
  EXPORT:  'Export / Download',
  APPROVE: 'Approve / Reject',
}

export const ROLE_LABELS: Record<ManagedRole, string> = {
  ADMIN:            'Admin',
  REGIONAL_MANAGER: 'Manager',
  TEAM_MEMBER:      'Team Member',
}

/** Which actions are applicable per module */
export const MODULE_ACTIONS: Record<ModuleKey, ActionKey[]> = {
  DASHBOARD:           ['VIEW', 'EXPORT'],
  LEADS:               ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE'],
  CLINICS:             ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'],
  REPORTS:             ['VIEW', 'EXPORT'],
  LENDERS:             ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  NOTIFICATIONS:       ['VIEW'],
  HR_POLICIES:         ['VIEW'],
  ATTENDANCE:          ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
  EXPENSES:            ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE'],
  SALARY:              ['VIEW', 'EDIT'],
  DIRECTORY:           ['VIEW'],
  DOCUMENTS:           ['VIEW', 'EXPORT'],
  APPOINTMENT_LETTERS: ['VIEW', 'EXPORT', 'APPROVE'],
  RECOGNITION:         ['VIEW', 'CREATE'],
  HR_MODULE:           ['VIEW', 'EDIT'],
  USERS:               ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  PERMISSIONS:         ['VIEW', 'EDIT'],
  REGIONS:             ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  TARGETS:             ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  AUDIT_LOGS:          ['VIEW', 'EXPORT'],
  WEBHOOKS:            ['VIEW'],
}

/** Default permissions — used when DB has no rows.
 *  ADMIN defaults to ALL ON.
 *  Adjust REGIONAL_MANAGER / TEAM_MEMBER per company policy. */
export const DEFAULT_PERMISSIONS: Record<ManagedRole, Record<ModuleKey, ActionKey[]>> = {
  ADMIN: {
    DASHBOARD:           ['VIEW', 'EXPORT'],
    LEADS:               ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE'],
    CLINICS:             ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'],
    REPORTS:             ['VIEW', 'EXPORT'],
    LENDERS:             ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    NOTIFICATIONS:       ['VIEW'],
    HR_POLICIES:         ['VIEW'],
    ATTENDANCE:          ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    EXPENSES:            ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE'],
    SALARY:              ['VIEW', 'EDIT'],
    DIRECTORY:           ['VIEW'],
    DOCUMENTS:           ['VIEW', 'EXPORT'],
    APPOINTMENT_LETTERS: ['VIEW', 'EXPORT', 'APPROVE'],
    RECOGNITION:         ['VIEW', 'CREATE'],
    HR_MODULE:           ['VIEW', 'EDIT'],
    USERS:               ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    PERMISSIONS:         ['VIEW', 'EDIT'],
    REGIONS:             ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    TARGETS:             ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    AUDIT_LOGS:          ['VIEW', 'EXPORT'],
    WEBHOOKS:            ['VIEW'],
  },
  REGIONAL_MANAGER: {
    DASHBOARD:           ['VIEW'],
    LEADS:               ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'APPROVE'],
    CLINICS:             ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    REPORTS:             ['VIEW', 'EXPORT'],
    LENDERS:             ['VIEW'],
    NOTIFICATIONS:       ['VIEW'],
    HR_POLICIES:         ['VIEW'],
    ATTENDANCE:          ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    EXPENSES:            ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'APPROVE'],
    SALARY:              [],
    DIRECTORY:           ['VIEW'],
    DOCUMENTS:           ['VIEW', 'EXPORT'],
    APPOINTMENT_LETTERS: ['VIEW', 'EXPORT'],
    RECOGNITION:         ['VIEW', 'CREATE'],
    HR_MODULE:           ['VIEW'],
    USERS:               [],
    PERMISSIONS:         [],
    REGIONS:             ['VIEW'],
    TARGETS:             ['VIEW'],
    AUDIT_LOGS:          [],
    WEBHOOKS:            [],
  },
  TEAM_MEMBER: {
    DASHBOARD:           ['VIEW'],
    LEADS:               ['VIEW', 'CREATE'],
    CLINICS:             ['VIEW', 'CREATE'],
    REPORTS:             ['VIEW'],
    LENDERS:             ['VIEW'],
    NOTIFICATIONS:       ['VIEW'],
    HR_POLICIES:         ['VIEW'],
    ATTENDANCE:          ['VIEW', 'CREATE', 'EDIT'],
    EXPENSES:            ['VIEW', 'CREATE', 'EDIT'],
    SALARY:              [],
    DIRECTORY:           ['VIEW'],
    DOCUMENTS:           ['VIEW', 'EXPORT'],
    APPOINTMENT_LETTERS: ['VIEW', 'EXPORT'],
    RECOGNITION:         ['VIEW', 'CREATE'],
    HR_MODULE:           ['VIEW'],
    USERS:               [],
    PERMISSIONS:         [],
    REGIONS:             [],
    TARGETS:             [],
    AUDIT_LOGS:          [],
    WEBHOOKS:            [],
  },
}

export type RolePermissionMatrix = Record<ManagedRole, Record<ModuleKey, Record<ActionKey, boolean>>>

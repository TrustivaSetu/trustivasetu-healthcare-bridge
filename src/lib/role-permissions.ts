import { db } from '@/lib/db'
import {
  MODULE_KEYS,
  ACTION_KEYS,
  MANAGED_ROLES,
  MODULE_ACTIONS,
  DEFAULT_PERMISSIONS,
  type ModuleKey,
  type ActionKey,
  type ManagedRole,
  type RolePermissionMatrix,
} from '@/types/permissions'

// Process-level cache (invalidated on save)
let cache: RolePermissionMatrix | null = null
let cacheAt = 0
const TTL = 30_000 // 30 s

export function invalidatePermissionCache() {
  cache = null
  cacheAt = 0
}

function buildDefault(): RolePermissionMatrix {
  const m = {} as RolePermissionMatrix
  for (const role of MANAGED_ROLES) {
    m[role] = {} as RolePermissionMatrix[ManagedRole]
    for (const mod of MODULE_KEYS) {
      m[role][mod] = {} as Record<ActionKey, boolean>
      for (const action of ACTION_KEYS) {
        const applicable = (MODULE_ACTIONS[mod] as readonly ActionKey[]).includes(action)
        m[role][mod][action] = applicable
          ? DEFAULT_PERMISSIONS[role][mod].includes(action)
          : false
      }
    }
  }
  return m
}

export async function getPermissionMatrix(): Promise<RolePermissionMatrix> {
  if (cache && Date.now() - cacheAt < TTL) return cache

  const matrix = buildDefault()

  try {
    const rows = await db.rolePermission.findMany()
    for (const row of rows) {
      const role = row.role as ManagedRole
      const mod = row.module as ModuleKey
      const action = row.action as ActionKey
      if (
        MANAGED_ROLES.includes(role) &&
        MODULE_KEYS.includes(mod) &&
        ACTION_KEYS.includes(action)
      ) {
        matrix[role][mod][action] = row.granted
      }
    }
  } catch {
    // DB unavailable – return defaults
  }

  cache = matrix
  cacheAt = Date.now()
  return matrix
}

export async function checkRolePermission(
  role: string,
  mod: ModuleKey,
  action: ActionKey
): Promise<boolean> {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true
  if (!MANAGED_ROLES.includes(role as ManagedRole)) return false
  const matrix = await getPermissionMatrix()
  return matrix[role as ManagedRole]?.[mod]?.[action] ?? false
}

/** Flat map of "MODULE_ACTION" → boolean for a given role (used by client API) */
export async function getRolePermissionFlat(
  role: string
): Promise<Record<string, boolean>> {
  const fullAccess = role === 'SUPER_ADMIN' || role === 'ADMIN'
  const result: Record<string, boolean> = {}
  for (const mod of MODULE_KEYS) {
    for (const action of ACTION_KEYS) {
      result[`${mod}_${action}`] = fullAccess
        ? true
        : !MANAGED_ROLES.includes(role as ManagedRole)
        ? false
        : false // filled below
    }
  }
  if (fullAccess) return result

  const matrix = await getPermissionMatrix()
  const r = role as ManagedRole
  if (MANAGED_ROLES.includes(r)) {
    for (const mod of MODULE_KEYS) {
      for (const action of ACTION_KEYS) {
        result[`${mod}_${action}`] = matrix[r][mod][action]
      }
    }
  }
  return result
}

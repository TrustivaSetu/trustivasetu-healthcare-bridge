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

let cache: RolePermissionMatrix | null = null
let cacheAt = 0
const TTL = 30_000

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
          ? (DEFAULT_PERMISSIONS[role][mod] as ActionKey[]).includes(action)
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
        (MODULE_KEYS as readonly string[]).includes(mod) &&
        (ACTION_KEYS as readonly string[]).includes(action)
      ) {
        matrix[role][mod][action] = row.granted
      }
    }
  } catch {
    // DB unavailable — use defaults
  }

  cache = matrix
  cacheAt = Date.now()
  return matrix
}

/**
 * SUPER_ADMIN always returns true.
 * All other roles — including ADMIN — are checked against the DB matrix.
 */
export async function checkRolePermission(
  role: string,
  mod: ModuleKey,
  action: ActionKey
): Promise<boolean> {
  if (role === 'SUPER_ADMIN') return true
  if (!MANAGED_ROLES.includes(role as ManagedRole)) return false
  const matrix = await getPermissionMatrix()
  return matrix[role as ManagedRole]?.[mod]?.[action] ?? false
}

/** Flat map MODULE_ACTION → boolean for client-side use */
export async function getRolePermissionFlat(role: string): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {}
  const allTrue = role === 'SUPER_ADMIN'

  for (const mod of MODULE_KEYS) {
    for (const action of ACTION_KEYS) {
      result[`${mod}_${action}`] = allTrue
    }
  }
  if (allTrue) return result

  if (!MANAGED_ROLES.includes(role as ManagedRole)) return result

  const matrix = await getPermissionMatrix()
  const r = role as ManagedRole
  for (const mod of MODULE_KEYS) {
    for (const action of ACTION_KEYS) {
      result[`${mod}_${action}`] = matrix[r][mod][action] ?? false
    }
  }
  return result
}

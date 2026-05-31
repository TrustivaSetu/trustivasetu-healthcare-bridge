import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  MANAGED_ROLES,
  MODULE_KEYS,
  ACTION_KEYS,
  type ManagedRole,
  type ModuleKey,
  type ActionKey,
} from '@/types/permissions'
import { getPermissionMatrix, invalidatePermissionCache } from '@/lib/role-permissions'

/** GET /api/permissions — returns the full RolePermissionMatrix */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const matrix = await getPermissionMatrix()
  return NextResponse.json({ matrix })
}

/** PUT /api/permissions — saves full matrix for a specific role */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { role, permissions } = body as {
    role: ManagedRole
    permissions: Record<ModuleKey, Record<ActionKey, boolean>>
  }

  if (!MANAGED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Upsert every applicable cell
  const ops: Promise<unknown>[] = []
  for (const mod of MODULE_KEYS) {
    for (const action of ACTION_KEYS) {
      const granted = permissions[mod]?.[action] ?? false
      ops.push(
        db.rolePermission.upsert({
          where: { role_module_action: { role, module: mod, action } },
          create: { role, module: mod, action, granted },
          update: { granted },
        })
      )
    }
  }

  await Promise.all(ops)
  invalidatePermissionCache()

  await db.auditLog.create({
    data: {
      userId: session.user.id as string,
      action: 'UPDATE',
      entity: 'RolePermission',
      details: `Updated permissions for role: ${role}`,
    },
  })

  return NextResponse.json({ ok: true })
}

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getRolePermissionFlat } from '@/lib/role-permissions'

/** GET /api/permissions/me — flat permission map for the current user's role */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const flat = await getRolePermissionFlat(session.user.role as string)
  return NextResponse.json({ permissions: flat, role: session.user.role })
}

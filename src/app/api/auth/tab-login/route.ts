import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { signTabToken, createTabSessionRecord } from '@/lib/tab-session'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        regionAssignments: true,
        clinicAssignments: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }
    if (!user.isActive) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as string,
      regionIds: user.regionAssignments.map(r => r.regionId),
      clinicIds: user.clinicAssignments.map(c => c.clinicId),
    }

    const token = await signTabToken(userPayload)
    await createTabSessionRecord(user.id, token)

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
      },
    })

    return NextResponse.json({ token, user: userPayload })
  } catch (err) {
    console.error('Tab login error:', err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

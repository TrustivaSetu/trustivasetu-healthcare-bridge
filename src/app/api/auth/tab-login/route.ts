import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { signTabToken, createTabSessionRecord } from '@/lib/tab-session'
import { checkLoginRateLimit, recordFailedLogin } from '@/lib/rate-limit'
import { getRequestMeta } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const rateLimit = await checkLoginRateLimit(normalizedEmail)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${Math.ceil((rateLimit.retryAfterSeconds ?? 900) / 60)} minutes.` },
        { status: 429 },
      )
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        regionAssignments: true,
        clinicAssignments: true,
      },
    })

    if (!user) {
      await recordFailedLogin(normalizedEmail)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }
    if (!user.isActive) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      await recordFailedLogin(normalizedEmail)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as string,
      regionIds: user.regionAssignments.map(r => r.regionId),
      clinicIds: user.clinicAssignments.map(c => c.clinicId),
      mustChangePassword: user.mustChangePassword,
    }

    const token = await signTabToken(userPayload)
    await createTabSessionRecord(user.id, token)

    const { ipAddress, userAgent } = getRequestMeta(req)
    await db.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress, userAgent },
    })

    return NextResponse.json({ token, user: userPayload })
  } catch (err) {
    console.error('Tab login error:', err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

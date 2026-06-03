import { SignJWT, jwtVerify } from 'jose'
import { db } from './db'

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60 // 8 hours

export interface TabUserPayload {
  id: string
  email: string
  name: string
  role: string
  regionIds: string[]
  clinicIds: string[]
  mustChangePassword?: boolean
}

export async function signTabToken(user: TabUserPayload): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_LIFETIME_SECONDS}s`)
    .sign(SECRET)
}

export async function verifyTabToken(token: string): Promise<TabUserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    const { id, email, name, role, regionIds, clinicIds, mustChangePassword } = payload as Record<string, unknown>
    if (typeof id !== 'string' || typeof role !== 'string') return null
    return {
      id: id as string,
      email: email as string,
      name: name as string,
      role: role as string,
      regionIds: Array.isArray(regionIds) ? (regionIds as string[]) : [],
      clinicIds: Array.isArray(clinicIds) ? (clinicIds as string[]) : [],
      mustChangePassword: mustChangePassword === true,
    }
  } catch {
    return null
  }
}

export async function createTabSessionRecord(userId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_SECONDS * 1000)
  await db.tabSession.create({ data: { token, userId, expiresAt } })
}

export async function deleteTabSessionRecord(token: string): Promise<void> {
  await db.tabSession.deleteMany({ where: { token } }).catch(() => {})
}

export async function isTabSessionActive(token: string): Promise<boolean> {
  const session = await db.tabSession.findUnique({
    where: { token },
    select: { expiresAt: true },
  })
  return !!session && session.expiresAt > new Date()
}

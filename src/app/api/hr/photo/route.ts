import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { put, del } from '@vercel/blob'

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const targetUserId = (formData.get('userId') as string) || session.user.id

  // Only admin can upload for others
  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  if (targetUserId !== session.user.id && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: 'Only JPG, PNG, WEBP allowed' }, { status: 400 })

  if (file.size > 2 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large — max 2MB' }, { status: 400 })

  // Delete old photo if exists
  const existing = await db.employeeProfile.findUnique({ where: { userId: targetUserId }, select: { photoUrl: true } })
  if (existing?.photoUrl) {
    try { await del(existing.photoUrl) } catch { /* ignore if already deleted */ }
  }

  const ext = file.type.split('/')[1]
  const path = `photos/${targetUserId}_${Date.now()}.${ext}`
  const blob = await put(path, file, { access: 'public', addRandomSuffix: false })

  await db.employeeProfile.upsert({
    where: { userId: targetUserId },
    create: { userId: targetUserId, photoUrl: blob.url },
    update: { photoUrl: blob.url },
  })

  return NextResponse.json({ photoUrl: blob.url })
}

export async function DELETE(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('userId') ?? session.user.id

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  if (targetUserId !== session.user.id && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const profile = await db.employeeProfile.findUnique({ where: { userId: targetUserId }, select: { photoUrl: true } })
  if (profile?.photoUrl) {
    try { await del(profile.photoUrl) } catch { /* ignore */ }
  }

  await db.employeeProfile.upsert({
    where: { userId: targetUserId },
    create: { userId: targetUserId, photoUrl: null },
    update: { photoUrl: null },
  })

  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.employeeProfile.findUnique({
    where: { userId: session.user.id },
    select: { photoUrl: true },
  })
  return NextResponse.json({ photoUrl: profile?.photoUrl ?? null })
}

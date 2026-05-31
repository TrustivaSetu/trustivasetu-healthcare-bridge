import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { put } from '@vercel/blob'

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'uploads'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // File size check — max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large — max 10MB' }, { status: 400 })
    }

    // Allowed types
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${folder}/${timestamp}_${safeName}`

    const blob = await put(path, file, {
      access: 'private',
      addRandomSuffix: false,
    })

    return NextResponse.json({
      url: blob.url,
      name: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (e: unknown) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
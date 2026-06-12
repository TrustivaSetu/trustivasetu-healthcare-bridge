import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tasks = await db.leadTask.findMany({
    where: { leadId: params.id },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ data: tasks })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, dueDate } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const task = await db.leadTask.create({
    data: {
      leadId: params.id,
      title: title.trim(),
      description: description?.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATE',
      entity: 'LeadTask',
      entityId: task.id,
      details: `Created task "${title}" on lead ${params.id.slice(-8).toUpperCase()}`,
    },
  })

  return NextResponse.json({ data: task }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId, status, title, description, dueDate } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  const existing = await db.leadTask.findFirst({ where: { id: taskId, leadId: params.id } })
  if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const task = await db.leadTask.update({
    where: { id: taskId },
    data: {
      ...(status && { status }),
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'LeadTask',
      entityId: taskId,
      details: status ? `Status changed to ${status}` : 'Task updated',
    },
  })

  return NextResponse.json({ data: task })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  const existing = await db.leadTask.findFirst({ where: { id: taskId, leadId: params.id } })
  if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  await db.leadTask.delete({ where: { id: taskId } })

  return NextResponse.json({ success: true })
}

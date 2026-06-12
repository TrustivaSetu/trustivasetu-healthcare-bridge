import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { autoAssignEnquiry } from '@/lib/enquiry-auto-assign'
import { sendEmail, enquiryNotificationHtml } from '@/lib/email'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      source = 'WEBSITE_FORM',
      clinicName,
      contactPerson,
      mobile,
      email,
      address,
      pinCode,
      city,
      state,
      region,
      treatmentTypes,
      notes,
    } = body

    const assignment = await autoAssignEnquiry(city, pinCode, state)

    const enquiry = await db.providerEnquiry.create({
      data: {
        source,
        clinicName,
        contactPerson,
        mobile,
        email,
        address,
        pinCode,
        city,
        state,
        region: region ?? assignment?.assignedRegion ?? null,
        treatmentTypes,
        notes,
        assignedRegion: assignment?.assignedRegion ?? region ?? null,
        assignedRmId: assignment?.assignedRmId ?? null,
        assignedManagerId: assignment?.assignedManagerId ?? null,
        status: 'NEW',
      },
    })

    // Fire-and-forget notifications to assigned RM and manager
    const lmsUrl = process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'
    const notifyIds = [enquiry.assignedRmId, enquiry.assignedManagerId].filter(Boolean) as string[]
    if (notifyIds.length > 0) {
      db.user.findMany({ where: { id: { in: notifyIds }, email: { not: undefined } }, select: { id: true, name: true, email: true } })
        .then(recipients => {
          recipients.forEach(r => {
            if (!r.email) return
            sendEmail({
              to: r.email,
              subject: `New Provider Enquiry Assigned — ${enquiry.clinicName ?? 'Unknown'}`,
              html: enquiryNotificationHtml({
                type: 'provider',
                recipientName: r.name,
                enquiryId: enquiry.id,
                applicantOrClinic: enquiry.clinicName ?? '',
                mobile: enquiry.mobile ?? '',
                region: enquiry.assignedRegion ?? '',
                source: enquiry.source,
                lmsUrl,
              }),
            }).catch(err => console.error('[enquiry-notify]', err))
          })
        })
        .catch(err => console.error('[enquiry-notify-fetch]', err))
    }

    return NextResponse.json({ id: enquiry.id, status: enquiry.status }, { status: 201, headers: CORS_HEADERS })
  } catch (e) {
    console.error('[POST /api/enquiries/provider]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, id: userId } = session.user
  if (role === 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const source = searchParams.get('source')
  const region = searchParams.get('region')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const showConverted = searchParams.get('showConverted') === '1'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20'), 100)

  try {
    let roleFilter: Record<string, unknown> = {}

    if (role === 'REGIONAL_MANAGER') {
      const userRegions = await db.userRegion.findMany({
        where: { userId },
        include: { region: true },
      })
      const myRegionNames = userRegions.map(ur => ur.region.name)
      roleFilter = {
        OR: [
          { assignedManagerId: userId },
          { assignedRegion: { in: myRegionNames }, assignedManagerId: null },
        ],
      }
    } else if (role === 'TEAM_MEMBER') {
      const userRegions = await db.userRegion.findMany({
        where: { userId },
        include: { region: true },
      })
      const myRegionNames = userRegions.map(ur => ur.region.name)
      roleFilter = {
        OR: [
          { assignedRmId: userId },
          { assignedRegion: { in: myRegionNames }, assignedRmId: null },
        ],
      }
    }

    const where: Record<string, unknown> = {}
    if (Object.keys(roleFilter).length > 0) Object.assign(where, roleFilter)

    const andConditions: Record<string, unknown>[] = []

    if (status) {
      andConditions.push({ status })
    } else if (!showConverted) {
      andConditions.push({ status: { not: 'CONVERTED' } })
    }

    if (search) {
      const searchOr = [
        { clinicName: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
      andConditions.push({ OR: searchOr })
    }

    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    if (source) where.source = source
    if (region) where.assignedRegion = { contains: region, mode: 'insensitive' }
    if (dateFrom) {
      where.createdAt = { ...(where.createdAt as object ?? {}), gte: new Date(dateFrom) }
    }
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      where.createdAt = { ...(where.createdAt as object ?? {}), lte: end }
    }

    const [total, enquiries] = await Promise.all([
      db.providerEnquiry.count({ where }),
      db.providerEnquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const rmIds = [...new Set(enquiries.map(e => e.assignedRmId).filter(Boolean))] as string[]
    const rmUsers = rmIds.length
      ? await db.user.findMany({ where: { id: { in: rmIds } }, select: { id: true, name: true } })
      : []
    const rmMap = Object.fromEntries(rmUsers.map(u => [u.id, u.name]))

    const data = enquiries.map(e => ({
      ...e,
      assignedRmName: e.assignedRmId ? rmMap[e.assignedRmId] ?? null : null,
    }))

    return NextResponse.json({ data, total, page, pageSize })
  } catch (e) {
    console.error('[GET /api/enquiries/provider]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

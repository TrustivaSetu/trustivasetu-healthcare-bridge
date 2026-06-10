import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { autoAssignEnquiry } from '@/lib/enquiry-auto-assign'

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
      applicantName,
      mobile,
      email,
      hospitalName,
      clinicId,
      treatmentName,
      loanAmount,
      panNumber,
      panVerified,
      aadharNumber,
      employmentType,
      monthlyIncome,
      companyName,
      currentHouseNo,
      currentStreet,
      currentLandmark,
      currentPinCode,
      currentCity,
      currentState,
      permanentSameAsCurrent,
      permanentPinCode,
      permanentCity,
      permanentState,
      notes,
    } = body

    const assignment = await autoAssignEnquiry(
      currentCity ?? body.city,
      currentPinCode ?? body.pinCode,
      currentState ?? body.state
    )

    const enquiry = await db.patientEnquiry.create({
      data: {
        source,
        applicantName,
        mobile,
        email,
        hospitalName,
        clinicId,
        treatmentName,
        loanAmount: loanAmount ? parseFloat(loanAmount) : null,
        panNumber,
        panVerified: panVerified ?? false,
        aadharNumber,
        employmentType,
        monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : null,
        companyName,
        currentHouseNo,
        currentStreet,
        currentLandmark,
        currentPinCode,
        currentCity,
        currentState,
        permanentSameAsCurrent: permanentSameAsCurrent ?? false,
        permanentPinCode,
        permanentCity,
        permanentState,
        notes,
        assignedRegion: assignment?.assignedRegion ?? null,
        assignedRmId: assignment?.assignedRmId ?? null,
        assignedManagerId: assignment?.assignedManagerId ?? null,
        status: 'NEW',
      },
    })

    return NextResponse.json({ id: enquiry.id, status: enquiry.status }, { status: 201, headers: CORS_HEADERS })
  } catch (e) {
    console.error('[POST /api/enquiries/patient]', e)
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
    // Build role-based where clause
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
          {
            assignedRegion: { in: myRegionNames },
            assignedManagerId: null,
          },
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
          {
            assignedRegion: { in: myRegionNames },
            assignedRmId: null,
          },
        ],
      }
    }

    // Build status filter
    const statusConditions: Record<string, unknown>[] = []
    if (status) {
      statusConditions.push({ status })
    } else if (!showConverted) {
      statusConditions.push({ status: { not: 'CONVERTED' } })
    }

    // Build search filter
    const searchFilter: Record<string, unknown>[] = []
    if (search) {
      searchFilter.push(
        { applicantName: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      )
    }

    const where: Record<string, unknown> = {}

    // Merge role filter
    if (Object.keys(roleFilter).length > 0) {
      Object.assign(where, roleFilter)
    }

    // Merge status conditions
    if (statusConditions.length > 0) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), ...statusConditions]
    }

    // Merge search
    if (searchFilter.length > 0) {
      const existing = Array.isArray(where.OR) ? where.OR : null
      if (existing) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          { OR: searchFilter },
        ]
      } else {
        where.OR = searchFilter
      }
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
      db.patientEnquiry.count({ where }),
      db.patientEnquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    // Fetch RM names for display
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
    console.error('[GET /api/enquiries/patient]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

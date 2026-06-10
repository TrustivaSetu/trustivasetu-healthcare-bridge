import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const existing = await db.providerEnquiry.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const {
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
      ifscCode,
      bankName,
      branchName,
      accountNumber,
      notes,
      status,
      assignedRegion,
      assignedRmId,
      assignedManagerId,
    } = body

    const updateData: Record<string, unknown> = {}
    if (clinicName !== undefined) updateData.clinicName = clinicName
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson
    if (mobile !== undefined) updateData.mobile = mobile
    if (email !== undefined) updateData.email = email
    if (address !== undefined) updateData.address = address
    if (pinCode !== undefined) updateData.pinCode = pinCode
    if (city !== undefined) updateData.city = city
    if (state !== undefined) updateData.state = state
    if (region !== undefined) updateData.region = region
    if (treatmentTypes !== undefined) updateData.treatmentTypes = treatmentTypes
    if (ifscCode !== undefined) updateData.ifscCode = ifscCode
    if (bankName !== undefined) updateData.bankName = bankName
    if (branchName !== undefined) updateData.branchName = branchName
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber
    if (notes !== undefined) updateData.notes = notes
    if (status !== undefined) updateData.status = status
    if (assignedRegion !== undefined) updateData.assignedRegion = assignedRegion
    if (assignedRmId !== undefined) updateData.assignedRmId = assignedRmId
    if (assignedManagerId !== undefined) updateData.assignedManagerId = assignedManagerId

    if (!updateData.status && existing.status === 'NEW') {
      updateData.status = 'IN_PROGRESS'
    }

    const updated = await db.providerEnquiry.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (e) {
    console.error('[PATCH /api/enquiries/provider/:id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

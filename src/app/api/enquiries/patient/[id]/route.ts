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
    const existing = await db.patientEnquiry.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const {
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
      status,
      assignedRegion,
      assignedRmId,
      assignedManagerId,
    } = body

    const updateData: Record<string, unknown> = {}
    if (applicantName !== undefined) updateData.applicantName = applicantName
    if (mobile !== undefined) updateData.mobile = mobile
    if (email !== undefined) updateData.email = email
    if (hospitalName !== undefined) updateData.hospitalName = hospitalName
    if (clinicId !== undefined) updateData.clinicId = clinicId
    if (treatmentName !== undefined) updateData.treatmentName = treatmentName
    if (loanAmount !== undefined) updateData.loanAmount = loanAmount ? parseFloat(loanAmount) : null
    if (panNumber !== undefined) updateData.panNumber = panNumber
    if (panVerified !== undefined) updateData.panVerified = panVerified
    if (aadharNumber !== undefined) updateData.aadharNumber = aadharNumber
    if (employmentType !== undefined) updateData.employmentType = employmentType
    if (monthlyIncome !== undefined) updateData.monthlyIncome = monthlyIncome ? parseFloat(monthlyIncome) : null
    if (companyName !== undefined) updateData.companyName = companyName
    if (currentHouseNo !== undefined) updateData.currentHouseNo = currentHouseNo
    if (currentStreet !== undefined) updateData.currentStreet = currentStreet
    if (currentLandmark !== undefined) updateData.currentLandmark = currentLandmark
    if (currentPinCode !== undefined) updateData.currentPinCode = currentPinCode
    if (currentCity !== undefined) updateData.currentCity = currentCity
    if (currentState !== undefined) updateData.currentState = currentState
    if (permanentSameAsCurrent !== undefined) updateData.permanentSameAsCurrent = permanentSameAsCurrent
    if (permanentPinCode !== undefined) updateData.permanentPinCode = permanentPinCode
    if (permanentCity !== undefined) updateData.permanentCity = permanentCity
    if (permanentState !== undefined) updateData.permanentState = permanentState
    if (notes !== undefined) updateData.notes = notes
    if (status !== undefined) updateData.status = status
    if (assignedRegion !== undefined) updateData.assignedRegion = assignedRegion
    if (assignedRmId !== undefined) updateData.assignedRmId = assignedRmId
    if (assignedManagerId !== undefined) updateData.assignedManagerId = assignedManagerId

    // Auto-progress status from NEW to IN_PROGRESS when edited
    if (!updateData.status && existing.status === 'NEW') {
      updateData.status = 'IN_PROGRESS'
    }

    const updated = await db.patientEnquiry.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (e) {
    console.error('[PATCH /api/enquiries/patient/:id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const enquiry = await db.patientEnquiry.findUnique({ where: { id } })
    if (!enquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (enquiry.status === 'CONVERTED') {
      return NextResponse.json({ error: 'Already converted' }, { status: 400 })
    }

    // Validate required fields
    const missing: string[] = []
    if (!enquiry.applicantName) missing.push('applicantName')
    if (!enquiry.mobile) missing.push('mobile')
    if (!enquiry.loanAmount) missing.push('loanAmount')
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Missing required fields', fields: missing }, { status: 400 })
    }

    // Resolve clinic
    let clinicId: string | null = enquiry.clinicId ?? null

    if (!clinicId && enquiry.hospitalName) {
      const clinic = await db.clinic.findFirst({
        where: { name: { equals: enquiry.hospitalName, mode: 'insensitive' }, isActive: true },
        select: { id: true },
      })
      clinicId = clinic?.id ?? null
    }

    if (!clinicId) {
      return NextResponse.json({ error: 'Set a clinic before converting' }, { status: 400 })
    }

    // Create lead
    const lead = await db.lead.create({
      data: {
        applicantName: enquiry.applicantName!,
        phone: enquiry.mobile,
        email: enquiry.email,
        amount: enquiry.loanAmount!,
        clinicId,
        treatmentName: enquiry.treatmentName,
        status: 'PENDING',
        createdById: session.user.id,
        metadata: {
          panNumber: enquiry.panNumber,
          panVerified: enquiry.panVerified,
          employmentType: enquiry.employmentType,
          monthlyIncome: enquiry.monthlyIncome,
          companyName: enquiry.companyName,
          assignedRmId: enquiry.assignedRmId,
          assignedManagerId: enquiry.assignedManagerId,
          currentAddress: {
            houseNo: enquiry.currentHouseNo,
            street: enquiry.currentStreet,
            landmark: enquiry.currentLandmark,
            pincode: enquiry.currentPinCode,
            city: enquiry.currentCity,
            state: enquiry.currentState,
          },
          permanentAddress: enquiry.permanentSameAsCurrent
            ? {
                houseNo: enquiry.currentHouseNo,
                street: enquiry.currentStreet,
                landmark: enquiry.currentLandmark,
                pincode: enquiry.currentPinCode,
                city: enquiry.currentCity,
                state: enquiry.currentState,
              }
            : {
                pincode: enquiry.permanentPinCode,
                city: enquiry.permanentCity,
                state: enquiry.permanentState,
              },
        },
      },
    })

    // Update enquiry status
    await db.patientEnquiry.update({
      where: { id },
      data: { status: 'CONVERTED', convertedLeadId: lead.id },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CONVERT',
        entity: 'PatientEnquiry',
        entityId: id,
        details: `Converted to lead ${lead.id}`,
      },
    })

    return NextResponse.json({ leadId: lead.id, message: 'Converted to lead' })
  } catch (e) {
    console.error('[POST /api/enquiries/patient/:id/convert]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

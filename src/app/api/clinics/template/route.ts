import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Template headers
  const headers = [
    'clinic_name*',
    'address*',
    'contact_person*',
    'contact_number*',
    'email',
    'pincode',
    'gst_number',
    'pan_number',
    'account_number',
    'ifsc_code',
    'bank_name',
    'business_potential_lakhs',
    'hospital_type',
    'alternate_phone',
  ]

  const instructions = [
    ['INSTRUCTIONS - PLEASE READ CAREFULLY'],
    [''],
    ['1. Fields marked with * are mandatory'],
    ['2. clinic_name: Unique name for each clinic/branch'],
    ['3. contact_number: 10 digit mobile number'],
    ['4. gst_number: 15 character GSTIN (same for all branches of same entity)'],
    ['5. pan_number: 10 character PAN'],
    ['6. ifsc_code: 11 character IFSC code'],
    ['7. business_potential_lakhs: Expected monthly loan disbursement in Lakhs'],
    ['8. hospital_type: Multi-Specialty Hospital / Dental Clinic / Eye Care Center / Hair Transplant Clinic / Fertility / IVF Center / Cosmetic Surgery Center / Orthopaedic Center / Other'],
    ['9. If bank details are same for all branches, fill same IFSC and account for all'],
    ['10. Delete these instruction rows before uploading'],
  ]

  const wb = XLSX.utils.book_new()

  // Instructions sheet
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions)
  wsInstructions['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

  // Data sheet — headers only, no sample data
  const wsData = XLSX.utils.aoa_to_sheet([headers])
  wsData['!cols'] = headers.map(() => ({ wch: 25 }))
  XLSX.utils.book_append_sheet(wb, wsData, 'Clinics Data')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="clinic-bulk-upload-template.xlsx"',
    },
  })
}
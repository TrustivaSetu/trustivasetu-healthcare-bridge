import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
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

  const sampleRow = [
    'Apollo Clinic - Sector 18',
    '123 Sector 18, Noida, UP',
    'Dr. Ramesh Sharma',
    '9876543210',
    'apollo.sec18@example.com',
    '201301',
    '09ABCDE1234F1Z5',
    'ABCDE1234F',
    '12345678901234',
    'HDFC0001234',
    'HDFC Bank - Noida Branch',
    '50',
    'Multi-Specialty Hospital',
    '9876543211',
  ]

  const sampleRow2 = [
    'Apollo Clinic - Sector 62',
    '456 Sector 62, Noida, UP',
    'Dr. Suresh Kumar',
    '9876543212',
    'apollo.sec62@example.com',
    '201309',
    '09ABCDE1234F1Z5',
    'ABCDE1234F',
    '12345678901234',
    'HDFC0001234',
    'HDFC Bank - Noida Branch',
    '40',
    'Multi-Specialty Hospital',
    '9876543213',
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

  // Data sheet
  const wsData = XLSX.utils.aoa_to_sheet([headers, sampleRow, sampleRow2])
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
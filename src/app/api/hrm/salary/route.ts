import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canGenerateSalarySlip, getVisibleEmployeeIds, writeHrmAudit } from "@/lib/hrmPermissions";

// ═══════════════════════════════════════════════
// Salary breakdown calculator
// As per Indian payroll norms
// ═══════════════════════════════════════════════
function calculateSalaryBreakdown(grossSalary: number, presentDays: number, workingDays: number) {
  const paidDays = workingDays > 0 ? presentDays : workingDays;
  const lopDays = Math.max(0, workingDays - presentDays);
  const lopDeduction = workingDays > 0 ? (grossSalary / workingDays) * lopDays : 0;
  const effectiveGross = grossSalary - lopDeduction;

  // Salary structure
  const basic = effectiveGross * 0.40;
  const hra = effectiveGross * 0.20;
  const conveyance = Math.min(1600, effectiveGross * 0.05);
  const medicalAllowance = Math.min(1250, effectiveGross * 0.04);
  const specialAllowance = effectiveGross - basic - hra - conveyance - medicalAllowance;

  // PF — 12% of basic (only if basic <= 15000 mandatory, else optional)
  const pfEmployee = Math.min(basic * 0.12, 1800);
  const pfEmployer = Math.min(basic * 0.12, 1800);

  // ESI — only if gross <= 21000
  const esiEmployee = effectiveGross <= 21000 ? effectiveGross * 0.0075 : 0;
  const esiEmployer = effectiveGross <= 21000 ? effectiveGross * 0.0325 : 0;

  // Professional Tax — Maharashtra/UP slab
  let professionalTax = 0;
  if (effectiveGross > 15000) professionalTax = 200;
  else if (effectiveGross > 10000) professionalTax = 150;
  else if (effectiveGross > 7500) professionalTax = 175;

  const totalDeductions = pfEmployee + esiEmployee + professionalTax;
  const netSalary = effectiveGross - totalDeductions;

  return {
    basicSalary: Math.round(basic),
    hra: Math.round(hra),
    conveyance: Math.round(conveyance),
    medicalAllowance: Math.round(medicalAllowance),
    specialAllowance: Math.round(specialAllowance),
    otherAllowances: 0,
    grossEarnings: Math.round(effectiveGross),
    pfEmployee: Math.round(pfEmployee),
    pfEmployer: Math.round(pfEmployer),
    esiEmployee: Math.round(esiEmployee),
    esiEmployer: Math.round(esiEmployer),
    professionalTax: Math.round(professionalTax),
    tds: 0,
    otherDeductions: 0,
    totalDeductions: Math.round(totalDeductions),
    netSalary: Math.round(netSalary),
    workingDays,
    presentDays,
    paidDays,
    lopDays,
  };
}

// ═══════════════════════════════════════════════
// GET /api/hrm/salary
// View salary slip
// ═══════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId") ?? session.user.id;
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const visibleIds = await getVisibleEmployeeIds(session.user.id);
  if (!visibleIds.includes(targetUserId)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const slip = await db.salarySlip.findUnique({
    where: { userId_year_month: { userId: targetUserId, year, month } },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          employeeProfile: { select: { designation: true, department: true, dateOfJoining: true } },
        },
      },
    },
  });

  return NextResponse.json({ slip });
}

// ═══════════════════════════════════════════════
// POST /api/hrm/salary
// Generate salary slip — only HR/SuperAdmin
// ═══════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canGenerate = await canGenerateSalarySlip(session.user.id);
  if (!canGenerate) {
    return NextResponse.json({ error: "Only HR or Super Admin can generate salary slips" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, month, year, tdsOverride, otherDeductions, otherAllowances } = body;

  // Get salary structure
  const salaryStructure = await db.salaryStructure.findUnique({ where: { userId } });
  if (!salaryStructure) {
    return NextResponse.json({ error: "Salary structure not found for this employee" }, { status: 404 });
  }

  // Get attendance for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const workingDays = endDate.getDate();

  const attendances = await db.attendance.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      attendanceType: "PRESENT",
    },
  });

  const presentDays = attendances.length;

  // Calculate breakdown
  const breakdown = calculateSalaryBreakdown(
    salaryStructure.grossSalary,
    presentDays,
    workingDays
  );

  // Apply overrides
  breakdown.tds = tdsOverride ?? salaryStructure.tds ?? 0;
  breakdown.otherDeductions = otherDeductions ?? 0;
  breakdown.otherAllowances = otherAllowances ?? 0;
  breakdown.grossEarnings += breakdown.otherAllowances;
  breakdown.totalDeductions += breakdown.tds + breakdown.otherDeductions;
  breakdown.netSalary = breakdown.grossEarnings - breakdown.totalDeductions;

  // Upsert salary slip
  const slip = await db.salarySlip.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, year, month, ...breakdown },
    update: { ...breakdown },
  });

  await writeHrmAudit({
    actorId: session.user.id,
    targetId: userId,
    action: "CREATE",
    entity: "SalarySlip",
    entityId: slip.id,
    newValue: { month, year, netSalary: breakdown.netSalary },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ slip });
}

// ═══════════════════════════════════════════════
// PATCH /api/hrm/salary
// Finalize salary slip — only HR/SuperAdmin
// ═══════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canGenerate = await canGenerateSalarySlip(session.user.id);
  if (!canGenerate) {
    return NextResponse.json({ error: "Only HR or Super Admin can finalize salary slips" }, { status: 403 });
  }

  const body = await req.json();
  const { slipId, paymentDate, paymentRef } = body;

  const slip = await db.salarySlip.update({
    where: { id: slipId },
    data: {
      isFinalized: true,
      finalizedAt: new Date(),
      finalizedById: session.user.id,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentRef,
    },
  });

  await writeHrmAudit({
    actorId: session.user.id,
    targetId: slip.userId,
    action: "UPDATE",
    entity: "SalarySlip",
    entityId: slip.id,
    newValue: { isFinalized: true, paymentDate, paymentRef },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ slip });
}
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessForm16, canGenerateSalarySlip, writeHrmAudit } from "@/lib/hrmPermissions";

// ═══════════════════════════════════════════════
// ITR Tax calculation — FY 2025-26
// New Regime (default) + Old Regime
// ═══════════════════════════════════════════════

function calculateTaxNewRegime(taxableIncome: number): number {
  if (taxableIncome <= 400000) return 0;
  if (taxableIncome <= 800000) return (taxableIncome - 400000) * 0.05;
  if (taxableIncome <= 1200000) return 20000 + (taxableIncome - 800000) * 0.10;
  if (taxableIncome <= 1600000) return 60000 + (taxableIncome - 1200000) * 0.15;
  if (taxableIncome <= 2000000) return 120000 + (taxableIncome - 1600000) * 0.20;
  if (taxableIncome <= 2400000) return 200000 + (taxableIncome - 2000000) * 0.25;
  return 300000 + (taxableIncome - 2400000) * 0.30;
}

function calculateTaxOldRegime(taxableIncome: number): number {
  if (taxableIncome <= 250000) return 0;
  if (taxableIncome <= 500000) return (taxableIncome - 250000) * 0.05;
  if (taxableIncome <= 1000000) return 12500 + (taxableIncome - 500000) * 0.20;
  return 112500 + (taxableIncome - 1000000) * 0.30;
}

function calculateSurcharge(tax: number, income: number): number {
  if (income <= 5000000) return 0;
  if (income <= 10000000) return tax * 0.10;
  if (income <= 20000000) return tax * 0.15;
  if (income <= 50000000) return tax * 0.25;
  return tax * 0.37;
}

// ═══════════════════════════════════════════════
// GET /api/hrm/form16
// View Form 16
// ═══════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId") ?? session.user.id;
  const financialYear = searchParams.get("fy") ?? "2025-26";

  const canAccess = await canAccessForm16(session.user.id, targetUserId);
  if (!canAccess) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const form16 = await db.form16.findUnique({
    where: { userId_financialYear: { userId: targetUserId, financialYear } },
    include: { user: { select: { name: true, email: true, employeeProfile: true } } },
  });

  await writeHrmAudit({
    actorId: session.user.id,
    targetId: targetUserId,
    action: "VIEW_SENSITIVE",
    entity: "Form16",
    entityId: form16?.id ?? "not-found",
    reason: "Form 16 viewed",
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ form16 });
}

// ═══════════════════════════════════════════════
// POST /api/hrm/form16/generate
// Generate Form 16 — only HR/SuperAdmin
// Auto-calculates from salary slips
// ═══════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canGenerate = await canGenerateSalarySlip(session.user.id);
  if (!canGenerate) {
    return NextResponse.json({ error: "Only HR or Super Admin can generate Form 16" }, { status: 403 });
  }

  const body = await req.json();
  const {
    userId,
    financialYear = "2025-26",
    assessmentYear = "2026-27",
    taxRegime = "NEW",
    employerTan,
    employerPan,
    employeePan,
    // Chapter VI-A deductions (employee declared)
    sec80C = 0,
    sec80CCD1B = 0,
    sec80D = 0,
    sec80G = 0,
    sec80E = 0,
    sec80TTA = 0,
    // HRA exemption
    hraExemption = 0,
    otherExemptions = 0,
  } = body;

  // Fetch all salary slips for the FY
  const [fyStartYear] = financialYear.split("-").map(Number);
  const salarySlips = await db.salarySlip.findMany({
    where: {
      userId,
      isFinalized: true,
      OR: [
        { year: fyStartYear, month: { gte: 4 } },   // Apr-Mar
        { year: fyStartYear + 1, month: { lte: 3 } },
      ],
    },
  });

  // Aggregate from salary slips
  const grossSalary = salarySlips.reduce((s: number, slip: typeof salarySlips[0]) => s + slip.grossEarnings, 0);
  const totalPfEmployee = salarySlips.reduce((s: number, slip: typeof salarySlips[0]) => s + slip.pfEmployee, 0);
  const totalEsiEmployee = salarySlips.reduce((s: number, slip: typeof salarySlips[0]) => s + slip.esiEmployee, 0);
  const totalProfTax = salarySlips.reduce((s: number, slip: typeof salarySlips[0]) => s + slip.professionalTax, 0);
  const totalTdsDeducted = salarySlips.reduce((s: number, slip: typeof salarySlips[0]) => s + slip.tds, 0);

  // Standard deduction FY 2025-26
  const standardDeduction = 75000;

  // Net salary after exemptions
  const netSalaryIncome = Math.max(
    0,
    grossSalary - hraExemption - otherExemptions - standardDeduction - totalProfTax
  );

  // Chapter VI-A (only in old regime)
  const totalDeductionsVI = taxRegime === "OLD"
    ? Math.min(sec80C, 150000) + Math.min(sec80CCD1B, 50000) + sec80D + sec80G + sec80E + Math.min(sec80TTA, 10000)
    : 0;

  // Taxable income
  const taxableIncome = Math.max(0, netSalaryIncome - totalDeductionsVI);

  // Tax calculation
  const taxOnIncome = taxRegime === "NEW"
    ? calculateTaxNewRegime(taxableIncome)
    : calculateTaxOldRegime(taxableIncome);

  const surcharge = calculateSurcharge(taxOnIncome, taxableIncome);
  const healthEducationCess = (taxOnIncome + surcharge) * 0.04;
  const totalTaxPayable = taxOnIncome + surcharge + healthEducationCess;
  const netTaxPayable = Math.max(0, totalTaxPayable - totalTdsDeducted);

  // Upsert Form 16
  const form16 = await db.form16.upsert({
    where: { userId_financialYear: { userId, financialYear } },
    create: {
      userId, financialYear, assessmentYear,
      employerTan, employerPan, employeePan,
      grossSalary, hraExemption, otherExemptions,
      standardDeduction, professionalTaxPaid: totalProfTax,
      netSalaryIncome,
      sec80C: Math.min(sec80C, 150000),
      sec80CCD1B: Math.min(sec80CCD1B, 50000),
      sec80D, sec80G, sec80E,
      sec80TTA: Math.min(sec80TTA, 10000),
      totalDeductionsVI,
      taxableIncome, taxRegime,
      taxOnIncome, surcharge,
      healthEducationCess,
      totalTaxPayable,
      totalTaxDeducted: totalTdsDeducted,
      totalTaxDeposited: totalTdsDeducted,
      netTaxPayable,
      isGenerated: true,
      generatedAt: new Date(),
      generatedById: session.user.id,
    },
    update: {
      grossSalary, hraExemption, otherExemptions,
      standardDeduction, professionalTaxPaid: totalProfTax,
      netSalaryIncome,
      sec80C: Math.min(sec80C, 150000),
      sec80CCD1B: Math.min(sec80CCD1B, 50000),
      sec80D, sec80G, sec80E,
      sec80TTA: Math.min(sec80TTA, 10000),
      totalDeductionsVI,
      taxableIncome, taxRegime,
      taxOnIncome, surcharge,
      healthEducationCess,
      totalTaxPayable,
      totalTaxDeducted: totalTdsDeducted,
      totalTaxDeposited: totalTdsDeducted,
      netTaxPayable,
      isGenerated: true,
      generatedAt: new Date(),
      generatedById: session.user.id,
    },
  });

  await writeHrmAudit({
    actorId: session.user.id,
    targetId: userId,
    action: "GENERATE",
    entity: "Form16",
    entityId: form16.id,
    newValue: { financialYear, taxableIncome, totalTaxPayable, netTaxPayable },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({
    form16,
    summary: {
      grossSalary,
      standardDeduction,
      taxableIncome,
      taxOnIncome,
      surcharge,
      healthEducationCess,
      totalTaxPayable,
      totalTdsDeducted,
      netTaxPayable,
      slipsUsed: salarySlips.length,
    },
  });
}
import { getRequestSession } from '@/lib/api-auth'
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getRequestSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Start of current ISO week (Monday)
  const dayOfWeek = now.getDay(); // 0=Sun ... 6=Sat
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday);

  const [
    totalLeads,
    approvedLeads,
    disbursedLeads,
    pendingLeads,
    rejectedLeads,
    onboardedClinics,
    totalClinics,
    currentMonthLeads,
    lastMonthLeads,
    approvedNotDisbursed,
    mtdDisbAgg,
    lmtdDisbAgg,
    thisWeekClinicsList,
    thisMonthClinicsList,
  ] = await Promise.all([
    db.lead.count(),
    db.lead.count({ where: { status: "APPROVED" } }),
    db.lead.count({ where: { status: "DISBURSED" } }),
    db.lead.count({ where: { status: "PENDING" } }),
    db.lead.count({ where: { status: "REJECTED" } }),
    db.clinic.count({ where: { isActive: true, onboardedAt: { gte: startOfMonth } } }),
    db.clinic.count({ where: { isActive: true } }),
    db.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.lead.count({ where: { createdAt: { gte: startOfLastMonth, lt: endOfLastMonth } } }),
    db.lead.count({ where: { status: "APPROVED" } }),
    db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { status: "DISBURSED", disbursalDate: { gte: startOfMonth } } }),
    db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { status: "DISBURSED", disbursalDate: { gte: startOfLastMonth, lt: endOfLastMonth } } }),
    db.clinic.findMany({
      where: { isActive: true, onboardedAt: { gte: startOfWeek } },
      select: { id: true, name: true, onboardedAt: true, isActive: true, region: { select: { name: true } } },
      orderBy: { onboardedAt: 'desc' },
    }),
    db.clinic.findMany({
      where: { isActive: true, onboardedAt: { gte: startOfMonth } },
      select: { id: true, name: true, onboardedAt: true, isActive: true, region: { select: { name: true } } },
      orderBy: { onboardedAt: 'desc' },
    }),
  ]);
  const mtdDisbursalValue = mtdDisbAgg._sum.disbursedAmount ?? 0;
  const lmtdDisbursalValue = lmtdDisbAgg._sum.disbursedAmount ?? 0;

  const approvalRate =
    totalLeads > 0
      ? Math.round(((approvedLeads + disbursedLeads) / totalLeads) * 100)
      : 0;

  // 6-month chart
  const months = getLast6Months();
  const chartData = await Promise.all(
    months.map(async ({ label, start, end }) => {
      const [leads, approved, disbursed] = await Promise.all([
        db.lead.count({ where: { createdAt: { gte: start, lt: end } } }),
        db.lead.count({ where: { status: "APPROVED", createdAt: { gte: start, lt: end } } }),
        db.lead.count({ where: { status: "DISBURSED", createdAt: { gte: start, lt: end } } }),
      ]);
      return { month: label, leads, approved, disbursed };
    })
  );

  // Region wise
  const regions = await db.region.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const regionWise = await Promise.all(
    regions.map(async (r) => {
      const [leads, approved, disbursed] = await Promise.all([
        db.lead.count({ where: { clinic: { regionId: r.id } } }),
        db.lead.count({ where: { status: "APPROVED", clinic: { regionId: r.id } } }),
        db.lead.count({ where: { status: "DISBURSED", clinic: { regionId: r.id } } }),
      ]);
      return { name: r.name, leads, approved, disbursed };
    })
  );

  // Lender wise
  const lenders = await db.lender.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const lenderWise = await Promise.all(
    lenders.map(async (l) => {
      const [leads, approved, disbursed] = await Promise.all([
        db.lead.count({ where: { lenderId: l.id } }),
        db.lead.count({ where: { lenderId: l.id, status: "APPROVED" } }),
        db.lead.count({ where: { lenderId: l.id, status: "DISBURSED" } }),
      ]);
      const rate =
        leads > 0 ? Math.round(((approved + disbursed) / leads) * 100) : 0;
      return { name: l.name, leads, approved, disbursed, approvalRate: rate };
    })
  );

  // RM wise
  const rms = await db.user.findMany({
    where: { role: "TEAM_MEMBER", isActive: true },
    select: { id: true, name: true },
    take: 20,
  });

  const rmWise = await Promise.all(
    rms.map(async (rm) => {
      const [leads, approved, disbursed] = await Promise.all([
        db.lead.count({ where: { createdById: rm.id } }),
        db.lead.count({ where: { createdById: rm.id, status: "APPROVED" } }),
        db.lead.count({ where: { createdById: rm.id, status: "DISBURSED" } }),
      ]);
      return { name: rm.name, leads, approved, disbursed };
    })
  );

  // Clinic onboarding
  const clinicOnboarding = await db.clinic.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      onboardedAt: true,
      region: { select: { name: true } },
      assignedRM: { select: { name: true } },
      _count: { select: { leads: true } },
    },
    orderBy: { onboardedAt: "desc" },
    take: 10,
  });

  const mapClinicList = (list: typeof thisWeekClinicsList) =>
    list.map(c => ({ id: c.id, name: c.name, onboardedAt: c.onboardedAt, status: c.isActive ? 'Active' : 'Inactive', region: c.region.name }))

  return NextResponse.json({
    kpi: {
      totalLeads,
      approvedLeads,
      disbursedLeads,
      pendingLeads,
      rejectedLeads,
      approvedNotDisbursed,
      approvalRate,
      onboardedClinics,
      totalClinics,
      currentMonthLeads,
      lastMonthLeads,
      mtdDisbursalValue,
      lmtdDisbursalValue,
      thisWeekClinics: thisWeekClinicsList.length,
      thisMonthClinics: thisMonthClinicsList.length,
    },
    thisWeekClinicsList: mapClinicList(thisWeekClinicsList),
    thisMonthClinicsList: mapClinicList(thisMonthClinicsList),
    chartData,
    regionWise,
    lenderWise,
    rmWise,
    clinicOnboarding: clinicOnboarding.map((c) => ({
      name: c.name,
      region: c.region.name,
      rm: c.assignedRM?.name ?? "—",
      onboardedAt: c.onboardedAt,
      totalLeads: c._count.leads,
    })),
  });
}

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    const start = new Date(d);
    const end = new Date(d);
    end.setMonth(end.getMonth() + 1);
    months.push({
      label: start.toLocaleString("default", { month: "short" }),
      start,
      end,
    });
  }
  return months;
}

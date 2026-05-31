import { getRequestSession } from '@/lib/api-auth'
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getRequestSession();
  if (!session || session.user.role !== "TEAM_MEMBER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  const clinicIds = (session.user.clinicIds as string[]) ?? [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalLeads, approvedLeads, disbursedLeads, pendingLeads, currentMonthLeads, lastMonthLeads, mtdDisbAgg, lmtdDisbAgg] =
    await Promise.all([
      db.lead.count({ where: { createdById: userId } }),
      db.lead.count({ where: { createdById: userId, status: "APPROVED" } }),
      db.lead.count({ where: { createdById: userId, status: "DISBURSED" } }),
      db.lead.count({ where: { createdById: userId, status: "PENDING" } }),
      db.lead.count({ where: { createdById: userId, createdAt: { gte: startOfMonth } } }),
      db.lead.count({ where: { createdById: userId, createdAt: { gte: startOfLastMonth, lt: endOfLastMonth } } }),
      db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { createdById: userId, status: "DISBURSED", disbursalDate: { gte: startOfMonth } } }),
      db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { createdById: userId, status: "DISBURSED", disbursalDate: { gte: startOfLastMonth, lt: endOfLastMonth } } }),
    ]);
  const mtdDisbursalValue = mtdDisbAgg._sum.disbursedAmount ?? 0;
  const lmtdDisbursalValue = lmtdDisbAgg._sum.disbursedAmount ?? 0;

  const approvalRate = totalLeads > 0
    ? Math.round(((approvedLeads + disbursedLeads) / totalLeads) * 100) : 0;

  const months = getLast6Months();
  const chartData = await Promise.all(
    months.map(async ({ label, start, end }) => {
      const [leads, approved, disbursed] = await Promise.all([
        db.lead.count({ where: { createdById: userId, createdAt: { gte: start, lt: end } } }),
        db.lead.count({ where: { createdById: userId, status: "APPROVED", createdAt: { gte: start, lt: end } } }),
        db.lead.count({ where: { createdById: userId, status: "DISBURSED", createdAt: { gte: start, lt: end } } }),
      ]);
      return { month: label, leads, approved, disbursed };
    })
  );

  const clinics = await db.clinic.findMany({
    where: { id: { in: clinicIds }, isActive: true },
    select: { id: true, name: true, externalId: true, region: { select: { name: true } } },
  });

  const clinicWise = await Promise.all(
    clinics.map(async (c) => {
      const [total, approved, disbursed, mtd, lmtd] = await Promise.all([
        db.lead.count({ where: { clinicId: c.id } }),
        db.lead.count({ where: { clinicId: c.id, status: "APPROVED" } }),
        db.lead.count({ where: { clinicId: c.id, status: "DISBURSED" } }),
        db.lead.count({ where: { clinicId: c.id, createdAt: { gte: startOfMonth } } }),
        db.lead.count({ where: { clinicId: c.id, createdAt: { gte: startOfLastMonth, lt: endOfLastMonth } } }),
      ]);
      const growth = lmtd === 0 ? (mtd > 0 ? 100 : 0) : Math.round(((mtd - lmtd) / lmtd) * 100);
      return { id: c.id, name: c.name, code: c.externalId ?? "—", region: c.region.name, total, approved, disbursed, mtd, lmtd, growth };
    })
  );

  const lenders = await db.lender.findMany({ where: { isActive: true }, select: { id: true, name: true } });

  const lenderWise = (await Promise.all(
    lenders.map(async (l) => {
      const [leads, approved, disbursed] = await Promise.all([
        db.lead.count({ where: { lenderId: l.id, createdById: userId } }),
        db.lead.count({ where: { lenderId: l.id, createdById: userId, status: "APPROVED" } }),
        db.lead.count({ where: { lenderId: l.id, createdById: userId, status: "DISBURSED" } }),
      ]);
      if (leads === 0) return null;
      return { name: l.name, leads, approved, disbursed, approvalRate: Math.round(((approved + disbursed) / leads) * 100) };
    })
  )).filter(Boolean);

  return NextResponse.json({
    kpi: { totalLeads, approvedLeads, disbursedLeads, pendingLeads, approvalRate, myClinics: clinicIds.length, currentMonthLeads, lastMonthLeads, mtdDisbursalValue, lmtdDisbursalValue },
    chartData, clinicWise, lenderWise,
  });
}

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    const start = new Date(d);
    const end = new Date(d);
    end.setMonth(end.getMonth() + 1);
    months.push({ label: start.toLocaleString("default", { month: "short" }), start, end });
  }
  return months;
}

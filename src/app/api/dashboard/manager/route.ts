import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "REGIONAL_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const regionIds = (session.user.regionIds as string[]) ?? [];

  if (regionIds.length === 0) {
    return NextResponse.json({
      regionName: "No Region Assigned",
      kpi: { totalLeads:0, approvedLeads:0, disbursedLeads:0, pendingLeads:0,
             rejectedLeads:0, approvalRate:0, totalClinics:0,
             currentMonthLeads:0, lastMonthLeads:0, approvedNotDisbursed:0 },
      chartData: [], rmWise: [], lenderWise: [], clinicWise: [],
    });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const regions = await db.region.findMany({
    where: { id: { in: regionIds } },
    select: { name: true },
  });
  const regionName = regions.map((r) => r.name).join(", ");

  const [
    totalLeads, approvedLeads, disbursedLeads, pendingLeads,
    rejectedLeads, totalClinics, currentMonthLeads, lastMonthLeads,
    mtdDisbAgg, lmtdDisbAgg,
  ] = await Promise.all([
    db.lead.count({ where: { clinic: { regionId: { in: regionIds } } } }),
    db.lead.count({ where: { status: "APPROVED", clinic: { regionId: { in: regionIds } } } }),
    db.lead.count({ where: { status: "DISBURSED", clinic: { regionId: { in: regionIds } } } }),
    db.lead.count({ where: { status: "PENDING", clinic: { regionId: { in: regionIds } } } }),
    db.lead.count({ where: { status: "REJECTED", clinic: { regionId: { in: regionIds } } } }),
    db.clinic.count({ where: { regionId: { in: regionIds }, isActive: true } }),
    db.lead.count({ where: { clinic: { regionId: { in: regionIds } }, createdAt: { gte: startOfMonth } } }),
    db.lead.count({ where: { clinic: { regionId: { in: regionIds } }, createdAt: { gte: startOfLastMonth, lt: endOfLastMonth } } }),
    db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { status: "DISBURSED", clinic: { regionId: { in: regionIds } }, disbursalDate: { gte: startOfMonth } } }),
    db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { status: "DISBURSED", clinic: { regionId: { in: regionIds } }, disbursalDate: { gte: startOfLastMonth, lt: endOfLastMonth } } }),
  ]);
  const mtdDisbursalValue = mtdDisbAgg._sum.disbursedAmount ?? 0;
  const lmtdDisbursalValue = lmtdDisbAgg._sum.disbursedAmount ?? 0;

  const approvedNotDisbursed = approvedLeads;
  const approvalRate = totalLeads > 0
    ? Math.round(((approvedLeads + disbursedLeads) / totalLeads) * 100) : 0;

  const months = getLast6Months();
  const chartData = await Promise.all(
    months.map(async ({ label, start, end }) => {
      const [leads, approved, disbursed] = await Promise.all([
        db.lead.count({ where: { clinic: { regionId: { in: regionIds } }, createdAt: { gte: start, lt: end } } }),
        db.lead.count({ where: { status: "APPROVED", clinic: { regionId: { in: regionIds } }, createdAt: { gte: start, lt: end } } }),
        db.lead.count({ where: { status: "DISBURSED", clinic: { regionId: { in: regionIds } }, createdAt: { gte: start, lt: end } } }),
      ]);
      return { month: label, leads, approved, disbursed };
    })
  );

  const rms = await db.userRegion.findMany({
    where: { regionId: { in: regionIds }, user: { role: "TEAM_MEMBER" } },
    select: { user: { select: { id: true, name: true } } },
  });

  const rmWise = await Promise.all(
    rms.map(async ({ user: rm }) => {
      const [leads, approved, disbursed, mtd] = await Promise.all([
        db.lead.count({ where: { createdById: rm.id } }),
        db.lead.count({ where: { createdById: rm.id, status: "APPROVED" } }),
        db.lead.count({ where: { createdById: rm.id, status: "DISBURSED" } }),
        db.lead.count({ where: { createdById: rm.id, createdAt: { gte: startOfMonth } } }),
      ]);
      const rate = leads > 0 ? Math.round(((approved + disbursed) / leads) * 100) : 0;
      return { name: rm.name, leads, approved, disbursed, mtd, approvalRate: rate };
    })
  );

  const lenders = await db.lender.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const lenderWise = (await Promise.all(
    lenders.map(async (l) => {
      const [leads, approved, disbursed] = await Promise.all([
        db.lead.count({ where: { lenderId: l.id, clinic: { regionId: { in: regionIds } } } }),
        db.lead.count({ where: { lenderId: l.id, status: "APPROVED", clinic: { regionId: { in: regionIds } } } }),
        db.lead.count({ where: { lenderId: l.id, status: "DISBURSED", clinic: { regionId: { in: regionIds } } } }),
      ]);
      if (leads === 0) return null;
      const rate = Math.round(((approved + disbursed) / leads) * 100);
      return { name: l.name, leads, approved, disbursed, approvalRate: rate };
    })
  )).filter(Boolean);

  const clinics = await db.clinic.findMany({
    where: { regionId: { in: regionIds }, isActive: true },
    select: { id: true, name: true, externalId: true, assignedRM: { select: { name: true } } },
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
      return { name: c.name, code: c.externalId ?? "—", rm: c.assignedRM?.name ?? "—", total, approved, disbursed, mtd, lmtd, growth };
    })
  );

  return NextResponse.json({ regionName, kpi: { totalLeads, approvedLeads, disbursedLeads, pendingLeads, rejectedLeads, approvedNotDisbursed, approvalRate, totalClinics, currentMonthLeads, lastMonthLeads, mtdDisbursalValue, lmtdDisbursalValue }, chartData, rmWise, lenderWise, clinicWise });
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
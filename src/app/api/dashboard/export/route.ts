import { getRequestSession } from '@/lib/api-auth'
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getRequestSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as string;
  const userId = session.user.id as string;

  let whereClause: Record<string, unknown> = {};

  if (role === "REGIONAL_MANAGER") {
    const regionIds = (session.user.regionIds as string[]) ?? [];
    whereClause = { clinic: { regionId: { in: regionIds } } };
  } else if (role === "TEAM_MEMBER") {
    whereClause = { createdById: userId };
  }

  const leads = await db.lead.findMany({
    where: whereClause,
    select: {
      applicantName: true, phone: true, email: true,
      amount: true, status: true, approvedAmount: true,
      disbursedAmount: true, applicationDate: true,
      approvalDate: true, disbursalDate: true,
      treatmentName: true, remarks: true,
      clinic: {
        select: {
          name: true, externalId: true,
          region: { select: { name: true } },
          assignedRM: { select: { name: true } },
        },
      },
      lender: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { applicationDate: "desc" },
  });

  const headers = [
    "Applicant Name","Phone","Email","Clinic Name","Clinic Code",
    "Region","Assigned RM","Lead Created By","Lender","Treatment",
    "Loan Amount","Status","Approved Amount","Disbursed Amount",
    "Application Date","Approval Date","Disbursal Date","Remarks",
  ];

  const rows = leads.map((l) => [
    l.applicantName, l.phone ?? "", l.email ?? "",
    l.clinic.name, l.clinic.externalId ?? "",
    l.clinic.region.name, l.clinic.assignedRM?.name ?? "—",
    l.createdBy?.name ?? "—", l.lender?.name ?? "—",
    l.treatmentName ?? "", l.amount, l.status,
    l.approvedAmount ?? "", l.disbursedAmount ?? "",
    l.applicationDate ? new Date(l.applicationDate).toLocaleDateString("en-IN") : "",
    l.approvalDate ? new Date(l.approvalDate).toLocaleDateString("en-IN") : "",
    l.disbursalDate ? new Date(l.disbursalDate).toLocaleDateString("en-IN") : "",
    l.remarks ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}

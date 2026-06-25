import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getHrmRole,
  getVisibleEmployeeIds,
  canEditExpense,
  canUnlockExpense,
  writeHrmAudit,
} from "@/lib/hrmPermissions";

// ═══════════════════════════════════════════════
// GET /api/hrm/expense
// Role-based expense fetch
// ═══════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const targetUserId = searchParams.get("userId") ?? session.user.id;

  const visibleIds = await getVisibleEmployeeIds(session.user.id);
  if (!visibleIds.includes(targetUserId)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const expenses = await db.expense.findMany({
    where: {
      userId: targetUserId,
      periodStart: { gte: startDate },
      periodEnd: { lte: endDate },
    },
    include: {
      items: true,
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Check if period is locked
  const lock = await db.expensePeriodLock.findUnique({
    where: { userId_year_month: { userId: targetUserId, year, month } },
  });

  // Auto-lock check
  const now = new Date();
  const lockDate = new Date(
    month === 12 ? year + 1 : year,
    month === 12 ? 0 : month,
    4, 23, 59, 59
  );
  const isAutoLocked = now > lockDate;

  return NextResponse.json({
    expenses,
    periodLocked: lock?.isLocked ?? false,
    autoLocked: isAutoLocked,
    canEdit: !lock?.isLocked && !isAutoLocked,
    lockDate: lockDate.toISOString(),
  });
}

// ═══════════════════════════════════════════════
// POST /api/hrm/expense
// Create expense — with period lock check
// ═══════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, periodStart, periodEnd, items, notes } = body;

  const start = new Date(periodStart);
  const year = start.getFullYear();
  const month = start.getMonth() + 1;

  const canEdit = await canEditExpense(session.user.id, session.user.id, year, month);
  if (!canEdit) {
    return NextResponse.json(
      {
        error: `Expense period locked. Editing allowed till 4th of next month. Contact HR to unlock.`,
      },
      { status: 400 }
    );
  }

  const totalAmount = (items ?? []).reduce(
    (sum: number, item: { amount: number }) => sum + item.amount, 0
  );

  const expense = await db.expense.create({
    data: {
      userId: session.user.id,
      title,
      periodStart: start,
      periodEnd: new Date(periodEnd),
      totalAmount,
      notes,
      status: "DRAFT",
      items: {
        create: (items ?? []).map((item: {
          date: string;
          category: string;
          description: string;
          amount: number;
          fromLocation?: string;
          toLocation?: string;
          distanceKm?: number;
          billUrl?: string;
          billName?: string;
          clientName?: string;
        }) => ({
          date: new Date(item.date),
          category: item.category,
          description: item.description,
          amount: item.amount,
          fromLocation: item.fromLocation,
          toLocation: item.toLocation,
          distanceKm: item.distanceKm,
          billUrl: item.billUrl,
          billName: item.billName,
          clientName: item.clientName,
        })),
      },
    },
    include: { items: true },
  });

  await writeHrmAudit({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Expense",
    entityId: expense.id,
    newValue: { title, totalAmount, month, year },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ expense });
}

// ═══════════════════════════════════════════════
// PATCH /api/hrm/expense
// Unlock expense period — only HR/SuperAdmin
// ═══════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canUnlock = await canUnlockExpense(session.user.id);
  if (!canUnlock) {
    return NextResponse.json(
      { error: "Only HR or Super Admin can unlock expense periods" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { userId, year, month, unlock, reason } = body;

  if (!userId || !year || !month || !reason) {
    return NextResponse.json(
      { error: "userId, year, month, reason required" },
      { status: 400 }
    );
  }

  const lock = await db.expensePeriodLock.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: {
      userId, year, month,
      isLocked: !unlock,
      lockedAt: unlock ? null : new Date(),
      unlockedById: unlock ? session.user.id : null,
      unlockedAt: unlock ? new Date() : null,
      unlockReason: unlock ? reason : null,
    },
    update: {
      isLocked: !unlock,
      lockedAt: unlock ? null : new Date(),
      unlockedById: unlock ? session.user.id : null,
      unlockedAt: unlock ? new Date() : null,
      unlockReason: unlock ? reason : null,
    },
  });

  await writeHrmAudit({
    actorId: session.user.id,
    targetId: userId,
    action: unlock ? "UNLOCK" : "LOCK",
    entity: "ExpensePeriodLock",
    entityId: lock.id,
    newValue: { year, month, isLocked: !unlock },
    reason,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ success: true, lock });
}
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getHrmRole,
  getVisibleEmployeeIds,
  canEditAttendance,
  writeHrmAudit,
} from "@/lib/hrmPermissions";

// ═══════════════════════════════════════════════
// GET /api/hrm/attendance
// Role-based attendance fetch
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

  // Permission check
  const visibleIds = await getVisibleEmployeeIds(session.user.id);
  if (!visibleIds.includes(targetUserId)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const attendances = await db.attendance.findMany({
    where: {
      userId: targetUserId,
      date: { gte: startDate, lte: endDate },
    },
    include: {
      lockRecord: true,
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ attendances });
}

// ═══════════════════════════════════════════════
// POST /api/hrm/attendance
// Punch in — auto locks after punch
// ═══════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    date,
    attendanceType = "PRESENT",
    workingType = "FULL_DAY",
    timeIn,
    latitude,
    longitude,
    locationName,
    notes,
    outstationCity,
    leaveType,
    targetUserId,
  } = body;

  const actorId = session.user.id;
  const userId = targetUserId ?? actorId;

  // Permission check
  const canEdit = await canEditAttendance(actorId, userId);
  if (!canEdit) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const attendanceDate = new Date(date);

  // Check if already exists
  const existing = await db.attendance.findUnique({
    where: { userId_date: { userId, date: attendanceDate } },
    include: { lockRecord: true },
  });

  if (existing?.lockRecord) {
    return NextResponse.json(
      { error: "Attendance is locked. Contact HR to unlock." },
      { status: 400 }
    );
  }

  let attendance;

  if (existing) {
    // Update
    attendance = await db.attendance.update({
      where: { userId_date: { userId, date: attendanceDate } },
      data: {
        attendanceType,
        workingType,
        timeIn,
        latitude,
        longitude,
        locationName,
        notes,
        outstationCity,
        leaveType,
      },
    });
  } else {
    // Create + auto lock
    attendance = await db.attendance.create({
      data: {
        userId,
        date: attendanceDate,
        attendanceType,
        workingType,
        timeIn: timeIn ?? new Date().toTimeString().slice(0, 5),
        latitude,
        longitude,
        locationName,
        notes,
        outstationCity,
        leaveType,
        approvalStatus: "PENDING",
      },
    });

    // Auto-lock after punch
    await db.attendanceLock.create({
      data: { attendanceId: attendance.id },
    });
  }

  // Audit log
  await writeHrmAudit({
    actorId,
    targetId: userId,
    action: existing ? "UPDATE" : "CREATE",
    entity: "Attendance",
    entityId: attendance.id,
    newValue: { date, attendanceType, workingType },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ attendance, locked: !existing });
}

// ═══════════════════════════════════════════════
// PATCH /api/hrm/attendance
// Unlock attendance — only HR/SuperAdmin
// ═══════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getHrmRole(session.user.id);
  if (role !== "SUPER_ADMIN" && role !== "HR") {
    return NextResponse.json(
      { error: "Only HR or Super Admin can unlock attendance" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { attendanceId, reason, newData } = body;

  if (!attendanceId || !reason) {
    return NextResponse.json(
      { error: "attendanceId and reason required" },
      { status: 400 }
    );
  }

  const existing = await db.attendance.findUnique({
    where: { id: attendanceId },
    include: { lockRecord: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Attendance not found" }, { status: 404 });
  }

  // Unlock + update
  await db.attendanceLock.update({
    where: { attendanceId },
    data: {
      unlockedById: session.user.id,
      unlockedAt: new Date(),
      unlockReason: reason,
    },
  });

  // Apply new data if provided
  let updated = existing;
  if (newData) {
    updated = await db.attendance.update({
      where: { id: attendanceId },
      data: newData,
    });
  }

  // Re-lock after edit
  await db.attendanceLock.update({
    where: { attendanceId },
    data: { lockedAt: new Date() },
  });

  // Audit log
  await writeHrmAudit({
    actorId: session.user.id,
    targetId: existing.userId,
    action: "UNLOCK",
    entity: "Attendance",
    entityId: attendanceId,
    oldValue: { attendanceType: existing.attendanceType },
    newValue: newData,
    reason,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ success: true, attendance: updated });
}
import { HrmRoleType } from "@prisma/client";
import { db } from "@/lib/db";

export type { HrmRoleType };

export async function getHrmRole(userId: string): Promise<HrmRoleType> {
  const hrmRole = await db.hrmRole.findUnique({
    where: { userId },
    select: { role: true },
  });
  return hrmRole?.role ?? ("EMPLOYEE" as HrmRoleType);
}

export async function canViewEmployee(actorId: string, targetId: string): Promise<boolean> {
  if (actorId === targetId) return true;
  const role = await getHrmRole(actorId);
  if (role === "SUPER_ADMIN" || role === "HR") return true;
  const assignment = await db.managerAssignment.findFirst({
    where: { managerId: actorId, employeeId: targetId, isActive: true },
  });
  return !!assignment;
}

export async function getVisibleEmployeeIds(actorId: string): Promise<string[]> {
  const role = await getHrmRole(actorId);
  if (role === "SUPER_ADMIN" || role === "HR") {
    const users = await db.user.findMany({ where: { isActive: true }, select: { id: true } });
    return users.map((u: { id: string }) => u.id);
  }
  if (role === "L1_MANAGER" || role === "L2_MANAGER") {
    const assignments = await db.managerAssignment.findMany({
      where: { managerId: actorId, isActive: true },
      select: { employeeId: true },
    });
    return [actorId, ...assignments.map((a: { employeeId: string }) => a.employeeId)];
  }
  return [actorId];
}

export async function canEditAttendance(actorId: string, targetId: string): Promise<boolean> {
  const role = await getHrmRole(actorId);
  if (role === "SUPER_ADMIN" || role === "HR") return true;
  return actorId === targetId;
}

export async function canUnlockAttendance(actorId: string): Promise<boolean> {
  const role = await getHrmRole(actorId);
  return role === "SUPER_ADMIN" || role === "HR";
}

export async function canEditExpense(
  actorId: string,
  targetId: string,
  expenseYear: number,
  expenseMonth: number
): Promise<boolean> {
  const role = await getHrmRole(actorId);
  if (role === "SUPER_ADMIN" || role === "HR") return true;
  if (actorId !== targetId) return false;
  const lock = await db.expensePeriodLock.findUnique({
    where: { userId_year_month: { userId: actorId, year: expenseYear, month: expenseMonth } },
  });
  if (lock?.isLocked) return false;
  const now = new Date();
  const lockDate = new Date(
    expenseMonth === 12 ? expenseYear + 1 : expenseYear,
    expenseMonth === 12 ? 0 : expenseMonth,
    4, 23, 59, 59
  );
  return now <= lockDate;
}

export async function canUnlockExpense(actorId: string): Promise<boolean> {
  const role = await getHrmRole(actorId);
  return role === "SUPER_ADMIN" || role === "HR";
}

export async function canApprove(actorId: string, targetId: string): Promise<boolean> {
  const role = await getHrmRole(actorId);
  if (role === "SUPER_ADMIN" || role === "HR") return true;
  if (role === "L1_MANAGER" || role === "L2_MANAGER") {
    const assignment = await db.managerAssignment.findFirst({
      where: { managerId: actorId, employeeId: targetId, isActive: true },
    });
    return !!assignment;
  }
  return false;
}

export async function canAccessForm16(actorId: string, targetId: string): Promise<boolean> {
  const role = await getHrmRole(actorId);
  if (role === "SUPER_ADMIN" || role === "HR") return true;
  return actorId === targetId;
}

export async function canGenerateSalarySlip(actorId: string): Promise<boolean> {
  const role = await getHrmRole(actorId);
  return role === "SUPER_ADMIN" || role === "HR";
}

export async function writeHrmAudit({
  actorId, targetId, action, entity, entityId, oldValue, newValue, reason, ipAddress, userAgent,
}: {
  actorId: string;
  targetId?: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: object;
  newValue?: object;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await db.hrmAuditLog.create({
    data: {
      actorId, targetId, action: action as never, entity, entityId,
      oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
      newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
      reason, ipAddress, userAgent,
    },
  });
}

export function isHigherOrEqualRole(actorRole: HrmRoleType, targetRole: HrmRoleType): boolean {
  const hierarchy: Record<string, number> = {
    SUPER_ADMIN: 5, HR: 4, L2_MANAGER: 3, L1_MANAGER: 2, EMPLOYEE: 1,
  };
  return hierarchy[actorRole] >= hierarchy[targetRole];
}
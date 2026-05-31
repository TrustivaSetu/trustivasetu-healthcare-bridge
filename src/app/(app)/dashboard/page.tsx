// src/app/(app)/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SuperAdminDashboard from "./SuperAdminDashboard";
import ManagerDashboard from "./ManagerDashboard";
import RMDashboard from "./RMDashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;

  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    return <SuperAdminDashboard />;
  }
  if (role === "REGIONAL_MANAGER") {
    return <ManagerDashboard />;
  }
  if (role === "TEAM_MEMBER") {
    return <RMDashboard />;
  }

  redirect("/login");
}
"use client";

import { useState, useEffect, useCallback } from "react";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  employeeProfile?: { designation?: string; department?: string };
}

interface AttendanceRecord {
  userId: string;
  attendanceType: string;
  lockRecord: object | null;
}

interface ExpenseRecord {
  userId: string;
  status: string;
  totalAmount: number;
}

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function HRDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [unlockModal, setUnlockModal] = useState<{ type: "attendance" | "expense"; id: string; userId?: string } | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, attRes] = await Promise.all([
        fetch("/api/users"),
        fetch(`/api/hrm/attendance?month=${month}&year=${year}`),
      ]);
      const empData = await empRes.json();
      const attData = await attRes.json();
      setEmployees(empData.users ?? []);
      setAttendance(attData.attendances ?? []);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  const todayPresent = attendance.filter(a => a.attendanceType === "PRESENT").length;
  const todayLocked = attendance.filter(a => a.lockRecord).length;

  async function handleUnlock() {
    if (!unlockModal || !unlockReason.trim()) return;
    setProcessing(true);
    try {
      if (unlockModal.type === "attendance") {
        await fetch("/api/hrm/attendance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendanceId: unlockModal.id, reason: unlockReason }),
        });
      } else {
        await fetch("/api/hrm/expense", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: unlockModal.userId, year, month, unlock: true, reason: unlockReason }),
        });
      }
      setUnlockModal(null);
      setUnlockReason("");
      fetchData();
    } finally {
      setProcessing(false);
    }
  }

  async function generateSalarySlip(userId: string) {
    await fetch("/api/hrm/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, month, year }),
    });
    alert("Salary slip generated!");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#07111f", color: "#f0f4f8", fontFamily: "Inter, sans-serif", padding: "28px 32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>HR Dashboard</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Company-wide attendance, expense & payroll management</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f4f8", padding: "8px 14px", fontSize: 13, height: 38 }}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f4f8", padding: "8px 14px", fontSize: 13, height: 38 }}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchData}
            style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #1e3a5f", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { icon: "👥", label: "Total Employees", value: employees.length, color: "#c9a84c" },
          { icon: "✅", label: "Present Today", value: todayPresent, color: "#10b981" },
          { icon: "🔒", label: "Locked Records", value: todayLocked, color: "#ef4444" },
          { icon: "📋", label: "Pending Approvals", value: attendance.filter(a => a.attendanceType === "PRESENT").length, color: "#f59e0b" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: "20px", display: "flex", alignItems: "flex-start", gap: 14, cursor: "default" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.25)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e3a5f")}>
            <div style={{ width: 42, height: 42, borderRadius: 8, background: "rgba(201,168,76,0.10)", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, color: stat.color, lineHeight: 1.2 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search employee by name or email..."
          style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f4f8", padding: "10px 16px", fontSize: 13, width: 360, outline: "none", height: 40 }}
        />
      </div>

      {/* Employee table */}
      <div style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 15, fontWeight: 600 }}>Employee Overview</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{filtered.length} employees</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#112240", borderBottom: "1px solid #1e3a5f" }}>
              {["Employee", "Designation", "Department", "This Month", "Expense", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading...</td></tr>
            ) : filtered.map(emp => {
              const empAtt = attendance.filter(a => a.userId === emp.id);
              const presentCount = empAtt.filter(a => a.attendanceType === "PRESENT").length;
              const hasLocked = empAtt.some(a => a.lockRecord);
              return (
                <tr key={emp.id} style={{ borderBottom: "1px solid #1e3a5f" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#162d4f")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(201,168,76,0.10)", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#c9a84c", flexShrink: 0 }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: "#f0f4f8" }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{emp.employeeProfile?.designation ?? "—"}</td>
                  <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{emp.employeeProfile?.department ?? "—"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                      {presentCount} days
                    </span>
                    {hasLocked && (
                      <span style={{ marginLeft: 6, padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                        🔒 Locked
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      onClick={() => setUnlockModal({ type: "expense", id: emp.id, userId: emp.id })}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.10)", color: "#f59e0b", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      🔓 Unlock Period
                    </button>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => generateSalarySlip(emp.id)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(201,168,76,0.25)", background: "rgba(201,168,76,0.10)", color: "#c9a84c", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        💰 Salary Slip
                      </button>
                      <a href={`/hrm/form16?userId=${emp.id}`}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #1e3a5f", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer", fontWeight: 600, textDecoration: "none" }}>
                        📋 Form 16
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Unlock Modal */}
      {unlockModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,17,31,0.85)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 16, padding: 32, width: 480, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <h3 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              🔓 Unlock {unlockModal.type === "attendance" ? "Attendance" : "Expense Period"}
            </h3>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
              This action will be logged in the HRM Audit trail (DPDP Act 2023 compliance).
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: 6 }}>Reason for unlock *</label>
              <textarea
                value={unlockReason}
                onChange={e => setUnlockReason(e.target.value)}
                placeholder="Enter reason for unlocking..."
                style={{ background: "#07111f", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f4f8", padding: "10px 14px", fontSize: 13, width: "100%", minHeight: 80, outline: "none", resize: "vertical", fontFamily: "Inter, sans-serif" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => { setUnlockModal(null); setUnlockReason(""); }}
                style={{ height: 38, padding: "0 20px", borderRadius: 8, border: "1px solid #1e3a5f", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleUnlock} disabled={!unlockReason.trim() || processing}
                style={{ height: 38, padding: "0 24px", borderRadius: 8, border: "none", background: unlockReason.trim() ? "#c9a84c" : "#a07c30", color: "#07111f", fontWeight: 600, cursor: unlockReason.trim() ? "pointer" : "not-allowed", fontSize: 13 }}>
                {processing ? "Processing..." : "Confirm Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p style={{ marginTop: 8, fontSize: 11, color: "#64748b", textAlign: "center" }}>
        All actions are logged • DPDP Act 2023 Compliant • TrustivaSetu LMS
      </p>
    </div>
  );
}
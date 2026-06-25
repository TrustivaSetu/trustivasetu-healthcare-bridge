"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface AttendanceRecord {
  id: string;
  date: string;
  attendanceType: string;
  workingType: string;
  timeIn: string | null;
  approvalStatus: string;
  lockRecord: { lockedAt: string; unlockedAt: string | null } | null;
  approvedBy: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-green-500/10 text-green-400 border-green-500/25",
  LEAVE: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  OUTSTATION: "bg-amber-500/10 text-amber-400 border-amber-500/25",
};

const APPROVAL_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
  APPROVED: "bg-green-500/10 text-green-400 border-green-500/25",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/25",
};

export default function AttendancePage() {
  const { data: session } = useSession();
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [now, setNow] = useState(new Date());
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hrm/attendance?month=${month}&year=${year}`);
      const data = await res.json();
      setAttendances(data.attendances ?? []);
    } catch {
      setMsg({ type: "error", text: "Failed to load attendance" });
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const todayRecord = attendances.find(
    (a) => new Date(a.date).toDateString() === new Date().toDateString()
  );

  async function handlePunch() {
    setPunching(true);
    setMsg(null);
    try {
      const res = await fetch("/api/hrm/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          attendanceType: "PRESENT",
          workingType: "FULL_DAY",
          timeIn: now.toTimeString().slice(0, 5),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.error });
      } else {
        setMsg({ type: "success", text: data.locked ? "Punched in successfully! Attendance locked." : "Updated." });
        fetchAttendance();
      }
    } catch {
      setMsg({ type: "error", text: "Something went wrong" });
    } finally {
      setPunching(false);
    }
  }

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div style={{ minHeight: "100vh", background: "#07111f", color: "#f0f4f8", fontFamily: "Inter, sans-serif", padding: "28px 32px" }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>My Attendance</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
          {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Alert */}
      {msg && (
        <div style={{
          padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13,
          background: msg.type === "success" ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
          border: `1px solid ${msg.type === "success" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
          color: msg.type === "success" ? "#10b981" : "#ef4444",
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

        {/* Punch card */}
        <div style={{
          background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 16,
          padding: 32, textAlign: "center", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,#c9a84c,transparent)" }} />
          <div style={{ fontSize: 44, fontWeight: 700, color: "#c9a84c", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}>
            {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </div>

          {todayRecord ? (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }} />
                <span style={{ color: "#10b981", fontWeight: 600, fontSize: 13 }}>
                  Punched in at {todayRecord.timeIn}
                </span>
              </div>
              {todayRecord.lockRecord && (
                <div style={{
                  padding: "10px 14px", borderRadius: 8, fontSize: 12,
                  background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444",
                }}>
                  🔒 Attendance locked — Contact HR to make changes
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              <div style={{ color: "#f59e0b", fontSize: 13, marginBottom: 16 }}>
                ⚠️ Not marked today
              </div>
              <button
                onClick={handlePunch}
                disabled={punching}
                style={{
                  height: 46, padding: "0 32px", borderRadius: 8, border: "none",
                  background: punching ? "#a07c30" : "#c9a84c", color: "#07111f",
                  fontWeight: 700, fontSize: 15, cursor: punching ? "not-allowed" : "pointer",
                  fontFamily: "Space Grotesk, sans-serif",
                }}
              >
                {punching ? "Punching..." : "🟢 Punch In"}
              </button>
            </div>
          )}
        </div>

        {/* Month stats */}
        <div style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 20, margin: "0 0 20px" }}>
            Month Summary
          </h3>
          {[
            { label: "Present", value: attendances.filter(a => a.attendanceType === "PRESENT").length, color: "#10b981" },
            { label: "Leave", value: attendances.filter(a => a.attendanceType === "LEAVE").length, color: "#3b82f6" },
            { label: "Outstation", value: attendances.filter(a => a.attendanceType === "OUTSTATION").length, color: "#f59e0b" },
            { label: "Locked", value: attendances.filter(a => a.lockRecord).length, color: "#ef4444" },
          ].map(stat => (
            <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e3a5f" }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>{stat.label}</span>
              <span style={{ color: stat.color, fontWeight: 700, fontSize: 18, fontFamily: "Space Grotesk, sans-serif" }}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Month selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f4f8", padding: "8px 14px", fontSize: 13, height: 38 }}
        >
          {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f4f8", padding: "8px 14px", fontSize: 13, height: 38 }}
        >
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          onClick={fetchAttendance}
          style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #1e3a5f", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Attendance table */}
      <div style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#112240", borderBottom: "1px solid #1e3a5f" }}>
              {["Date", "Day", "Type", "Working", "Time In", "Approval", "Lock"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading...</td></tr>
            ) : attendances.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No attendance records for this month</td></tr>
            ) : (
              attendances.map(att => (
                <tr key={att.id} style={{ borderBottom: "1px solid #1e3a5f" }}>
                  <td style={{ padding: "12px 16px", color: "#f0f4f8", fontWeight: 500 }}>
                    {new Date(att.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>
                    {new Date(att.date).toLocaleDateString("en-IN", { weekday: "short" })}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, border: "1px solid", ...Object.fromEntries(Object.entries(STATUS_COLORS[att.attendanceType] ?? "").map(([,v]) => v.split(" ").map(c => [c.split("-")[0], c])).flat()) }}>
                      {att.attendanceType}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{att.workingType}</td>
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{att.timeIn ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, border: "1px solid",
                      background: att.approvalStatus === "APPROVED" ? "rgba(16,185,129,0.10)" : att.approvalStatus === "REJECTED" ? "rgba(239,68,68,0.10)" : "rgba(245,158,11,0.10)",
                      color: att.approvalStatus === "APPROVED" ? "#10b981" : att.approvalStatus === "REJECTED" ? "#ef4444" : "#f59e0b",
                      borderColor: att.approvalStatus === "APPROVED" ? "rgba(16,185,129,0.25)" : att.approvalStatus === "REJECTED" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)",
                    }}>
                      {att.approvalStatus}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {att.lockRecord ? (
                      <span style={{ fontSize: 11, color: "#ef4444" }}>🔒 Locked</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#10b981" }}>✓ Open</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: "#64748b", textAlign: "center" }}>
        Attendance once punched is locked. Only HR / Super Admin can edit. • TrustivaSetu LMS
      </p>
    </div>
  );
}
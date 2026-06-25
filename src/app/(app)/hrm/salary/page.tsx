"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface SalarySlip {
  id: string;
  year: number;
  month: number;
  basicSalary: number;
  hra: number;
  conveyance: number;
  medicalAllowance: number;
  specialAllowance: number;
  otherAllowances: number;
  grossEarnings: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  workingDays: number;
  presentDays: number;
  lopDays: number;
  isFinalized: boolean;
  paymentDate: string | null;
  user?: { name: string; email: string; employeeProfile?: { designation?: string; department?: string } };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function SalaryPage() {
  const { data: session } = useSession();
  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSlip = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hrm/salary?month=${month}&year=${year}`);
      const data = await res.json();
      setSlip(data.slip ?? null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchSlip(); }, [fetchSlip]);

  async function handlePrint() {
    window.print();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#07111f", color: "#f0f4f8", fontFamily: "Inter, sans-serif", padding: "28px 32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>Salary Slip</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>View your monthly salary breakdown</p>
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
          <button onClick={fetchSlip}
            style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #1e3a5f", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            🔄
          </button>
          {slip && (
            <button onClick={handlePrint}
              style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "none", background: "#c9a84c", color: "#07111f", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              ⬇ Download
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13, background: msg.type === "success" ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)", border: `1px solid ${msg.type === "success" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`, color: msg.type === "success" ? "#10b981" : "#ef4444" }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>Loading...</div>
      ) : !slip ? (
        <div style={{ textAlign: "center", padding: 80, background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
          <div style={{ color: "#94a3b8", fontSize: 15 }}>No salary slip for {MONTHS[month - 1]} {year}</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>Contact HR to generate your salary slip</div>
        </div>
      ) : (
        <div style={{ maxWidth: 800, margin: "0 auto" }}>

          {/* Slip header */}
          <div style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: "16px 16px 0 0", padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,#c9a84c,transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 700, color: "#c9a84c" }}>TrustivaSetu</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Aarthsetu Technologies Private Limited</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>CIN: U66190UP2026PTC247393</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 16, fontWeight: 600, color: "#f0f4f8" }}>
                  Salary Slip — {MONTHS[slip.month - 1]} {slip.year}
                </div>
                {slip.isFinalized && (
                  <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)", marginTop: 8, display: "inline-block" }}>
                    ✓ Finalized
                  </span>
                )}
              </div>
            </div>

            {/* Employee info */}
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Employee Name", value: slip.user?.name ?? session?.user?.name ?? "—" },
                { label: "Designation", value: slip.user?.employeeProfile?.designation ?? "—" },
                { label: "Department", value: slip.user?.employeeProfile?.department ?? "—" },
                { label: "Pay Period", value: `${MONTHS[slip.month - 1]} ${slip.year}` },
                { label: "Working Days", value: String(slip.workingDays) },
                { label: "Present Days", value: String(slip.presentDays) },
                { label: "LOP Days", value: String(slip.lopDays) },
                { label: "Payment Date", value: slip.paymentDate ? new Date(slip.paymentDate).toLocaleDateString("en-IN") : "Pending" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(30,58,95,0.5)" }}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{row.label}</span>
                  <span style={{ color: "#f0f4f8", fontSize: 12, fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings + Deductions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#0d1f35", border: "1px solid #1e3a5f", borderTop: "none" }}>

            {/* Earnings */}
            <div style={{ padding: 24, borderRight: "1px solid #1e3a5f" }}>
              <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 13, fontWeight: 600, color: "#10b981", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Earnings
              </div>
              {[
                { label: "Basic Salary", value: slip.basicSalary },
                { label: "HRA", value: slip.hra },
                { label: "Conveyance", value: slip.conveyance },
                { label: "Medical Allowance", value: slip.medicalAllowance },
                { label: "Special Allowance", value: slip.specialAllowance },
                { label: "Other Allowances", value: slip.otherAllowances },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(30,58,95,0.5)", fontSize: 13 }}>
                  <span style={{ color: "#94a3b8" }}>{row.label}</span>
                  <span style={{ color: "#f0f4f8", fontWeight: 500 }}>{fmt(row.value)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", marginTop: 8, fontSize: 14, fontWeight: 700 }}>
                <span style={{ color: "#10b981" }}>Gross Earnings</span>
                <span style={{ color: "#10b981" }}>{fmt(slip.grossEarnings)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div style={{ padding: 24 }}>
              <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 13, fontWeight: 600, color: "#ef4444", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Deductions
              </div>
              {[
                { label: "PF (Employee 12%)", value: slip.pfEmployee },
                { label: "PF (Employer 12%)", value: slip.pfEmployer },
                { label: "ESI (Employee 0.75%)", value: slip.esiEmployee },
                { label: "ESI (Employer 3.25%)", value: slip.esiEmployer },
                { label: "Professional Tax", value: slip.professionalTax },
                { label: "TDS", value: slip.tds },
                { label: "Other Deductions", value: slip.otherDeductions },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(30,58,95,0.5)", fontSize: 13 }}>
                  <span style={{ color: "#94a3b8" }}>{row.label}</span>
                  <span style={{ color: row.value > 0 ? "#ef4444" : "#64748b", fontWeight: 500 }}>{fmt(row.value)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", marginTop: 8, fontSize: 14, fontWeight: 700 }}>
                <span style={{ color: "#ef4444" }}>Total Deductions</span>
                <span style={{ color: "#ef4444" }}>{fmt(slip.totalDeductions)}</span>
              </div>
            </div>
          </div>

          {/* Net salary */}
          <div style={{
            background: "#112240", border: "1px solid #1e3a5f", borderTop: "none",
            borderRadius: "0 0 16px 16px", padding: "20px 24px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ color: "#64748b", fontSize: 12 }}>Net Salary (Take Home)</div>
              <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 28, fontWeight: 700, color: "#c9a84c", marginTop: 4 }}>
                {fmt(slip.netSalary)}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
              <div>This is a computer generated slip</div>
              <div>No signature required</div>
              <div style={{ marginTop: 4, color: "#1e3a5f" }}>TrustivaSetu LMS • DPDP Act 2023 Compliant</div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
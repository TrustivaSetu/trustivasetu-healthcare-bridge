"use client";

import { useState, useEffect, useCallback } from "react";

interface Form16Data {
  id: string;
  financialYear: string;
  assessmentYear: string;
  grossSalary: number;
  hraExemption: number;
  otherExemptions: number;
  standardDeduction: number;
  professionalTaxPaid: number;
  netSalaryIncome: number;
  sec80C: number;
  sec80CCD1B: number;
  sec80D: number;
  sec80G: number;
  sec80E: number;
  sec80TTA: number;
  totalDeductionsVI: number;
  taxableIncome: number;
  taxRegime: string;
  taxOnIncome: number;
  surcharge: number;
  healthEducationCess: number;
  totalTaxPayable: number;
  totalTaxDeducted: number;
  netTaxPayable: number;
  isGenerated: boolean;
  generatedAt: string | null;
  employerTan: string | null;
  employerPan: string | null;
  employeePan: string | null;
  user?: { name: string; email: string };
}

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function Row({ label, value, highlight, deduction }: { label: string; value: number; highlight?: boolean; deduction?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", padding: "9px 0",
      borderBottom: "1px solid rgba(30,58,95,0.5)", fontSize: 13,
    }}>
      <span style={{ color: highlight ? "#f0f4f8" : "#94a3b8", fontWeight: highlight ? 600 : 400 }}>{label}</span>
      <span style={{ color: highlight ? "#c9a84c" : deduction ? "#ef4444" : "#f0f4f8", fontWeight: highlight ? 700 : 500 }}>
        {deduction && value > 0 ? "— " : ""}{fmt(value)}
      </span>
    </div>
  );
}

export default function Form16Page() {
  const [form16, setForm16] = useState<Form16Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [fy, setFy] = useState("2025-26");

  const fetchForm16 = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hrm/form16?fy=${fy}`);
      const data = await res.json();
      setForm16(data.form16 ?? null);
    } finally {
      setLoading(false);
    }
  }, [fy]);

  useEffect(() => { fetchForm16(); }, [fetchForm16]);

  return (
    <div style={{ minHeight: "100vh", background: "#07111f", color: "#f0f4f8", fontFamily: "Inter, sans-serif", padding: "28px 32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>Form 16</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>TDS Certificate — Income Tax Act 1961</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={fy} onChange={e => setFy(e.target.value)}
            style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f4f8", padding: "8px 14px", fontSize: 13, height: 38 }}>
            <option value="2023-24">FY 2023-24</option>
            <option value="2024-25">FY 2024-25</option>
            <option value="2025-26">FY 2025-26</option>
          </select>
          <button onClick={fetchForm16}
            style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #1e3a5f", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            🔄
          </button>
          {form16 && (
            <button onClick={() => window.print()}
              style={{ height: 38, padding: "0 20px", borderRadius: 8, border: "none", background: "#c9a84c", color: "#07111f", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              ⬇ Download PDF
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>Loading...</div>
      ) : !form16 ? (
        <div style={{ textAlign: "center", padding: 80, background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ color: "#94a3b8", fontSize: 15 }}>Form 16 not generated for FY {fy}</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>Contact HR to generate your Form 16</div>
        </div>
      ) : (
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Form 16 Header */}
          <div style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: "16px 16px 0 0", padding: 28, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,#c9a84c,transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>FORM 16</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Certificate under Section 203 of the Income Tax Act, 1961</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>for Tax Deducted at Source on Salary</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>Assessment Year</div>
                <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 700, color: "#f0f4f8" }}>{form16.assessmentYear}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>FY {form16.financialYear}</div>
              </div>
            </div>

            {/* Employer + Employee details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Employer Details</div>
                {[
                  { label: "Name", value: "Aarthsetu Technologies Pvt. Ltd." },
                  { label: "TAN", value: form16.employerTan ?? "Applied For" },
                  { label: "PAN", value: form16.employerPan ?? "ABFCA5854R" },
                  { label: "Address", value: "Moradabad, Uttar Pradesh - 244001" },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(30,58,95,0.5)", fontSize: 12 }}>
                    <span style={{ color: "#64748b", minWidth: 60 }}>{r.label}</span>
                    <span style={{ color: "#f0f4f8" }}>{r.value}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Employee Details</div>
                {[
                  { label: "Name", value: form16.user?.name ?? "—" },
                  { label: "PAN", value: form16.employeePan ?? "Not Provided" },
                  { label: "Email", value: form16.user?.email ?? "—" },
                  { label: "Regime", value: form16.taxRegime === "NEW" ? "New Tax Regime" : "Old Tax Regime" },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(30,58,95,0.5)", fontSize: 12 }}>
                    <span style={{ color: "#64748b", minWidth: 60 }}>{r.label}</span>
                    <span style={{ color: "#f0f4f8" }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Part B — Income computation */}
          <div style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderTop: "none", padding: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#c9a84c", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>
              Part B — Details of Salary Paid and Tax Deducted
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              {/* Income side */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Gross Salary & Exemptions</div>
                <Row label="Gross Salary u/s 17(1)" value={form16.grossSalary} />
                <Row label="HRA Exemption u/s 10(13A)" value={form16.hraExemption} deduction />
                <Row label="Other Exemptions u/s 10" value={form16.otherExemptions} deduction />
                <Row label="Standard Deduction u/s 16(ia)" value={form16.standardDeduction} deduction />
                <Row label="Professional Tax u/s 16(iii)" value={form16.professionalTaxPaid} deduction />
                <Row label="Net Salary Income" value={form16.netSalaryIncome} highlight />

                {form16.taxRegime === "OLD" && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", margin: "20px 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Chapter VI-A Deductions</div>
                    <Row label="80C (LIC/PF/ELSS)" value={form16.sec80C} deduction />
                    <Row label="80CCD(1B) NPS" value={form16.sec80CCD1B} deduction />
                    <Row label="80D (Mediclaim)" value={form16.sec80D} deduction />
                    <Row label="80G (Donations)" value={form16.sec80G} deduction />
                    <Row label="80E (Education Loan)" value={form16.sec80E} deduction />
                    <Row label="80TTA (Savings Interest)" value={form16.sec80TTA} deduction />
                    <Row label="Total VI-A Deductions" value={form16.totalDeductionsVI} highlight />
                  </>
                )}
              </div>

              {/* Tax side */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tax Computation</div>
                <Row label="Taxable Income" value={form16.taxableIncome} highlight />
                <Row label={`Tax on Income (${form16.taxRegime} Regime)`} value={form16.taxOnIncome} />
                <Row label="Surcharge" value={form16.surcharge} />
                <Row label="Health & Education Cess (4%)" value={form16.healthEducationCess} />
                <Row label="Total Tax Payable" value={form16.totalTaxPayable} highlight />
                <Row label="TDS Deducted" value={form16.totalTaxDeducted} deduction />

                {/* Net tax */}
                <div style={{ marginTop: 20, padding: 16, background: form16.netTaxPayable > 0 ? "rgba(239,68,68,0.10)" : "rgba(16,185,129,0.10)", border: `1px solid ${form16.netTaxPayable > 0 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Net Tax Payable / (Refund)</div>
                  <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 24, fontWeight: 700, marginTop: 4, color: form16.netTaxPayable > 0 ? "#ef4444" : "#10b981" }}>
                    {form16.netTaxPayable > 0 ? fmt(form16.netTaxPayable) : `Refund: ${fmt(Math.abs(form16.netTaxPayable))}`}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                    {form16.netTaxPayable > 0 ? "Additional tax to be paid while filing ITR" : "You may claim refund while filing ITR"}
                  </div>
                </div>

                {/* Tax regime info */}
                <div style={{ marginTop: 16, padding: 12, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.20)", borderRadius: 8, fontSize: 12, color: "#94a3b8" }}>
                  <strong style={{ color: "#c9a84c" }}>{form16.taxRegime} Tax Regime</strong>
                  {form16.taxRegime === "NEW"
                    ? " — Lower rates, no deductions. Standard deduction ₹75,000 applicable."
                    : " — Higher rates but deductions under 80C, 80D etc. applicable."}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: "#112240", border: "1px solid #1e3a5f", borderTop: "none", borderRadius: "0 0 16px 16px", padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#64748b" }}>
            <div>
              Generated: {form16.generatedAt ? new Date(form16.generatedAt).toLocaleDateString("en-IN") : "—"} •
              This is a system generated Form 16 • Subject to verification
            </div>
            <div>TrustivaSetu LMS • DPDP Act 2023 Compliant • ITR Norms FY {form16.financialYear}</div>
          </div>
        </div>
      )}
    </div>
  );
}
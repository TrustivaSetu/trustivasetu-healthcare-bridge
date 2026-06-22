"use client";
import { useState, useRef } from "react";

interface FileData {
  name: string;
  data: string;
  mediaType: string;
}

interface SubScores {
  compliance: number;
  financial: number;
  reputation: number;
  volume: number;
  emi_readiness: number;
  risk: number;
}

interface IVAResult {
  score: number;
  verdict: "ONBOARD" | "REVIEW" | "DECLINE";
  sub_scores: SubScores;
  strengths: string[];
  red_flags: string[];
  analysis: string;
  recommendation: string;
  sources_found: number;
}

interface FormState {
  clinicName: string;
  clinicType: string;
  clinicCity: string;
  clinicBranches: string;
  clinicWebsite: string;
  clinicCost: string;
  clinicContext: string;
}

export default function IVAScorePage() {
  const [step, setStep] = useState<"form" | "loading" | "result">("form");
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState<FormState>({
    clinicName: "", clinicType: "", clinicCity: "",
    clinicBranches: "", clinicWebsite: "", clinicCost: "", clinicContext: "",
  });
  const [result, setResult] = useState<IVAResult | null>(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles.filter((f) => !prev.find((p) => p.name === f.name))]);
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const toBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const analyse = async () => {
    if (!form.clinicName || !form.clinicType) {
      setError("Clinic name aur type zaroori hai.");
      return;
    }
    setError("");
    setStep("loading");

    const msgs = [
      "Documents pad raha hoon...",
      "Web search ho raha hai...",
      "Compliance check...",
      "Financial analysis...",
      "IVA Score compute ho raha hai..."
    ];
    let i = 0;
    setLoadingMsg(msgs[0]);
    const t = setInterval(() => {
      i++;
      if (i < msgs.length) setLoadingMsg(msgs[i]);
      else clearInterval(t);
    }, 2500);

    try {
      const fileData: FileData[] = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          data: await toBase64(f),
          mediaType: f.type || "application/octet-stream",
        }))
      );

      const res = await fetch("/api/iva-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, files: fileData }),
      });

      const json = await res.json();
      clearInterval(t);

      if (!json.success) throw new Error(json.error);
      setResult(json.data as IVAResult);
      setStep("result");
    } catch (err: unknown) {
      clearInterval(t);
      setError("Analysis fail hui: " + (err instanceof Error ? err.message : "Unknown error"));
      setStep("form");
    }
  };

  const reset = () => {
    setStep("form");
    setResult(null);
    setFiles([]);
    setForm({ clinicName: "", clinicType: "", clinicCity: "", clinicBranches: "", clinicWebsite: "", clinicCost: "", clinicContext: "" });
  };

  const scoreColor = (s: number) => s >= 75 ? "#22c98a" : s >= 50 ? "#f5a623" : "#ff4d6d";

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px", fontFamily: "Inter, sans-serif" }}>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px" }}>⚡ IVA Score Engine</h1>
        <p style={{ color: "#888", fontSize: 15, margin: 0 }}>Intelligent Vendor Assessment — clinic onboarding decision tool</p>
      </div>

      {/* FORM */}
      {step === "form" && (
        <div>
          {error && (
            <div style={{ background: "#fff0f0", border: "1px solid #ffcccc", borderRadius: 8, padding: "12px 16px", color: "#cc0000", marginBottom: 20, fontSize: 14 }}>
              {error}
            </div>
          )}

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20 }}>Clinic Details</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#444" }}>Clinic / Hospital Name *</label>
                <input
                  value={form.clinicName}
                  onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                  placeholder="e.g. Smile Dental Chain"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#444" }}>Clinic Type *</label>
                <select
                  value={form.clinicType}
                  onChange={(e) => setForm({ ...form, clinicType: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                >
                  <option value="">Select type...</option>
                  <option>IVF / Fertility Clinic</option>
                  <option>Hair Transplant Clinic</option>
                  <option>Dental Clinic</option>
                  <option>Cosmetology / Skin Clinic</option>
                  <option>Ophthalmology / Eye Clinic</option>
                  <option>Cosmetic Surgery Center</option>
                  <option>Multi-Specialty Hospital</option>
                  <option>Wellness Center</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#444" }}>City</label>
                <input
                  value={form.clinicCity}
                  onChange={(e) => setForm({ ...form, clinicCity: e.target.value })}
                  placeholder="e.g. Delhi, Mumbai"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#444" }}>No. of Branches</label>
                <input
                  type="number"
                  value={form.clinicBranches}
                  onChange={(e) => setForm({ ...form, clinicBranches: e.target.value })}
                  placeholder="e.g. 5"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#444" }}>Website (optional)</label>
                <input
                  value={form.clinicWebsite}
                  onChange={(e) => setForm({ ...form, clinicWebsite: e.target.value })}
                  placeholder="e.g. www.clinic.in"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#444" }}>Avg Procedure Cost (₹)</label>
                <input
                  type="number"
                  value={form.clinicCost}
                  onChange={(e) => setForm({ ...form, clinicCost: e.target.value })}
                  placeholder="e.g. 85000"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#444" }}>Additional Context</label>
              <textarea
                value={form.clinicContext}
                onChange={(e) => setForm({ ...form, clinicContext: e.target.value })}
                placeholder="Concerns, referral source, known issues..."
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, minHeight: 80, resize: "vertical", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* FILE UPLOAD */}
          <div style={{ background: "#fff", border: "2px dashed #d1d5db", borderRadius: 12, padding: 28, marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Documents Upload karo</h3>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>MCI/NMC Registration • GST • Financials • Any other docs (PDF, JPG, PNG)</p>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} style={{ display: "none" }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: "8px 20px", border: "1px solid #d1d5db", borderRadius: 8, background: "#f9fafb", cursor: "pointer", fontSize: 14 }}
            >
              Browse Files
            </button>
            {files.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, justifyContent: "center" }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#1d4ed8" }}>
                    📄 {f.name.length > 25 ? f.name.slice(0, 22) + "..." : f.name}
                    <button onClick={() => removeFile(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14, padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={analyse}
            style={{ width: "100%", padding: 16, background: "linear-gradient(135deg, #4f7cff, #7c5cfc)", border: "none", borderRadius: 12, color: "white", fontSize: 17, fontWeight: 700, cursor: "pointer" }}
          >
            ⚡ IVA Score Generate Karo
          </button>
        </div>
      )}

      {/* LOADING */}
      {step === "loading" && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Analysing...</h2>
          <p style={{ color: "#666", fontSize: 15 }}>{loadingMsg}</p>
        </div>
      )}

      {/* RESULTS */}
      {step === "result" && result && (
        <div>
          <div style={{ background: "#0a0f1e", borderRadius: 16, padding: 36, textAlign: "center", marginBottom: 20, color: "white" }}>
            <div style={{ fontSize: 13, color: "#8b9dc3", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>IVA Score</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{form.clinicName}</div>
            <div style={{ fontSize: 13, color: "#8b9dc3", marginBottom: 24 }}>{form.clinicType}</div>
            <div style={{ fontSize: 72, fontWeight: 800, color: scoreColor(result.score), lineHeight: 1 }}>{result.score}</div>
            <div style={{ fontSize: 16, color: "#8b9dc3", marginBottom: 20 }}>/100</div>
            <div style={{
              display: "inline-block", padding: "10px 28px", borderRadius: 100, fontSize: 15, fontWeight: 700,
              background: result.verdict === "ONBOARD" ? "rgba(34,201,138,0.15)" : result.verdict === "REVIEW" ? "rgba(245,166,35,0.15)" : "rgba(255,77,109,0.15)",
              color: scoreColor(result.score),
              border: `1px solid ${scoreColor(result.score)}`
            }}>
              {result.verdict === "ONBOARD" ? "✅ Onboard Karo" : result.verdict === "REVIEW" ? "⚠️ Review Karo" : "❌ Decline Karo"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {([
              { key: "compliance", label: "📋 Compliance", color: "#4f7cff" },
              { key: "financial", label: "💰 Financial", color: "#22c98a" },
              { key: "reputation", label: "⭐ Reputation", color: "#00d4ff" },
              { key: "volume", label: "🏥 Volume", color: "#f5a623" },
              { key: "emi_readiness", label: "💳 EMI Ready", color: "#7c5cfc" },
              { key: "risk", label: "⚠️ Risk", color: "#ff4d6d" },
            ] as { key: keyof SubScores; label: string; color: string }[]).map(({ key, label, color }) => (
              <div key={key} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color }}>{result.sub_scores[key]}/10</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>✅ Strengths</h3>
              {result.strengths.map((s: string, i: number) => (
                <div key={i} style={{ fontSize: 14, padding: "6px 0", borderBottom: "1px solid #f3f4f6", color: "#444" }}>✅ {s}</div>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>⚠️ Red Flags</h3>
              {result.red_flags.map((f: string, i: number) => (
                <div key={i} style={{ fontSize: 14, padding: "6px 0", borderBottom: "1px solid #f3f4f6", color: "#444" }}>⚠️ {f}</div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>🧠 AI Analysis</h3>
            {result.analysis.split("\n").filter((p: string) => p.trim()).map((p: string, i: number) => (
              <p key={i} style={{ fontSize: 14, color: "#555", lineHeight: 1.8, marginBottom: 10 }}>{p}</p>
            ))}
          </div>

          <div style={{
            borderRadius: 12, padding: 24, marginBottom: 20, border: "1px solid",
            background: result.verdict === "ONBOARD" ? "rgba(34,201,138,0.06)" : result.verdict === "REVIEW" ? "rgba(245,166,35,0.06)" : "rgba(255,77,109,0.06)",
            borderColor: result.verdict === "ONBOARD" ? "rgba(34,201,138,0.3)" : result.verdict === "REVIEW" ? "rgba(245,166,35,0.3)" : "rgba(255,77,109,0.3)"
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: scoreColor(result.score), marginBottom: 10 }}>
              {result.verdict === "ONBOARD" ? "✅ Recommendation: Onboard Karo" : result.verdict === "REVIEW" ? "⚠️ Recommendation: Review Karo" : "❌ Recommendation: Decline Karo"}
            </h3>
            <p style={{ fontSize: 14, color: "#555" }}>{result.recommendation}</p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={reset} style={{ flex: 1, padding: 13, border: "1px solid #d1d5db", borderRadius: 10, background: "#f9fafb", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
              🔄 Naya Assessment
            </button>
            <button onClick={() => window.print()} style={{ flex: 1, padding: 13, background: "linear-gradient(135deg, #4f7cff, #7c5cfc)", border: "none", borderRadius: 10, color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              📄 Report Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";
import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface RMData {
  kpi: { totalLeads: number; approvedLeads: number; disbursedLeads: number; pendingLeads: number; approvalRate: number; myClinics: number; currentMonthLeads: number; lastMonthLeads: number; mtdDisbursalValue: number; lmtdDisbursalValue: number; };
  chartData: { month: string; leads: number; approved: number; disbursed: number }[];
  clinicWise: { id: string; name: string; code: string; region: string; total: number; approved: number; disbursed: number; mtd: number; lmtd: number; growth: number }[];
  lenderWise: { name: string; leads: number; approved: number; disbursed: number; approvalRate: number }[];
}

type TabKey = "overview" | "clinic" | "lender";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "clinic", label: "My Clinics" },
  { key: "lender", label: "Lender Wise" },
];

export default function RMDashboard() {
  const [data, setData] = useState<RMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard/rm")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadExcel = async () => {
    const res = await fetch("/api/dashboard/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-leads-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const kpi = data?.kpi;
  const mom = kpi && kpi.lastMonthLeads > 0 ? Math.round(((kpi.currentMonthLeads - kpi.lastMonthLeads) / kpi.lastMonthLeads) * 100) : 0;

  return (
    <div className="p-4 space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-sm text-gray-500">Your leads & clinic performance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">🔄 Refresh</button>
          <button onClick={downloadExcel} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">⬇ Download Excel</button>
        </div>
      </div>

      {loading ? (
        <PerformanceSkeleton />
      ) : kpi ? (
        <PerformanceBoxes mtdLeads={kpi.currentMonthLeads} lmtdLeads={kpi.lastMonthLeads} mtdDisbursal={kpi.mtdDisbursalValue} lmtdDisbursal={kpi.lmtdDisbursalValue} />
      ) : null}

      {loading ? <Spinner /> : !kpi ? <div className="p-6 text-red-500">Failed to load data. Please refresh.</div> : (
      <>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="My Total Leads" value={kpi.totalLeads} color="blue" />
        <KPICard label="Approved" value={kpi.approvedLeads} color="green" />
        <KPICard label="Disbursed" value={kpi.disbursedLeads} color="purple" />
        <KPICard label="Pending" value={kpi.pendingLeads} color="yellow" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KPICard label="Approval Rate" value={kpi.approvalRate} suffix="%" color="teal" />
        <KPICard label="My Clinics" value={kpi.myClinics} color="indigo" />
        <KPICard label="MTD Leads" value={kpi.currentMonthLeads} color="blue" badge={mom !== 0 ? `${mom > 0 ? "▲" : "▼"} ${Math.abs(mom)}% vs LM` : undefined} badgeColor={mom >= 0 ? "green" : "red"} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold mb-3">6-Month My Lead Trend</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data!.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip /><Legend />
              <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="approved" stroke="#22c55e" strokeWidth={2} dot={false} name="Approved" />
              <Line type="monotone" dataKey="disbursed" stroke="#a855f7" strokeWidth={2} dot={false} name="Disbursed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === "clinic" && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold mb-3">My Channel Partner Performance</h2>
          {data!.clinicWise.length === 0 ? <Empty /> : (
            <Table headers={["Channel Partner","Code","Region","Total","Approved","Disbursed","MTD","LMTD","Growth"]}
              rows={data!.clinicWise.map((c) => [c.name, c.code, c.region, c.total, c.approved, c.disbursed, c.mtd, c.lmtd,
                <span key={c.id} className={c.growth >= 0 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
                  {c.growth >= 0 ? "▲" : "▼"} {Math.abs(c.growth)}%
                </span>])} />
          )}
        </div>
      )}

      {activeTab === "lender" && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold mb-3">Lender Wise (My Leads)</h2>
          {data!.lenderWise.length === 0 ? <Empty /> : (
            <Table headers={["Lender","Total","Approved","Disbursed","Approval Rate"]}
              rows={data!.lenderWise.map((l) => [l.name, l.leads, l.approved, l.disbursed, `${l.approvalRate}%`])} />
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}

function PerformanceBoxes({ mtdLeads, lmtdLeads, mtdDisbursal, lmtdDisbursal }: { mtdLeads: number; lmtdLeads: number; mtdDisbursal: number; lmtdDisbursal: number; }) {
  const leadsGrowth = lmtdLeads > 0 ? Math.round(((mtdLeads - lmtdLeads) / lmtdLeads) * 100) : mtdLeads > 0 ? 100 : 0;
  const fmtL = (v: number) => `₹${v.toFixed(2)}L`;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">Current Month Performance</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <PerfBox label="LMTD Leads" value={lmtdLeads.toLocaleString()} sub="Last Month" />
        <PerfBox label="MTD Leads" value={mtdLeads.toLocaleString()} sub="This Month" accent />
        <PerfBox label="LMTD Disbursal" value={fmtL(lmtdDisbursal)} sub="Last Month" />
        <PerfBox label="MTD Disbursal" value={fmtL(mtdDisbursal)} sub="This Month" accent />
        <div className={`rounded-xl p-3 text-center ${leadsGrowth >= 0 ? "bg-green-100 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <p className="text-xs font-medium text-gray-500 mb-1">Growth</p>
          <p className={`text-2xl font-bold ${leadsGrowth >= 0 ? "text-green-700" : "text-red-600"}`}>{leadsGrowth >= 0 ? "▲" : "▼"} {Math.abs(leadsGrowth)}%</p>
          <p className="text-xs text-gray-400 mt-0.5">MTD vs LMTD</p>
        </div>
      </div>
    </div>
  );
}
function PerfBox({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${accent ? "bg-emerald-600 text-white" : "bg-white border border-emerald-100"}`}>
      <p className={`text-xs font-medium mb-1 ${accent ? "text-emerald-100" : "text-gray-500"}`}>{label}</p>
      <p className={`text-xl font-bold ${accent ? "text-white" : "text-gray-800"}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${accent ? "text-emerald-200" : "text-gray-400"}`}>{sub}</p>
    </div>
  );
}
function PerformanceSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 animate-pulse">
      <div className="h-3 w-40 bg-gray-200 rounded mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="rounded-xl bg-gray-200 h-20" />)}</div>
    </div>
  );
}

function KPICard({ label, value, color, suffix = "", badge, badgeColor }: { label: string; value: number; color: string; suffix?: string; badge?: string; badgeColor?: string; }) {
  const colors: Record<string, string> = { blue: "bg-blue-50 text-blue-700 border-blue-200", green: "bg-green-50 text-green-700 border-green-200", purple: "bg-purple-50 text-purple-700 border-purple-200", yellow: "bg-yellow-50 text-yellow-700 border-yellow-200", teal: "bg-teal-50 text-teal-700 border-teal-200", indigo: "bg-indigo-50 text-indigo-700 border-indigo-200" };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.blue}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold mt-1">{value.toLocaleString()}{suffix}</p>
      {badge && <span className={`text-xs font-semibold mt-1 inline-block ${badgeColor === "green" ? "text-green-600" : "text-red-500"}`}>{badge}</span>}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm text-left">
        <thead><tr className="bg-gray-50 border-b">{headers.map((h) => <th key={h} className="px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i} className="border-b last:border-0 hover:bg-gray-50">{row.map((cell, j) => <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Spinner() { return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>; }
function Empty() { return <p className="text-gray-400 text-sm py-8 text-center">No data available.</p>; }
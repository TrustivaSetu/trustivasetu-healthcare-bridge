"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface ClinicListItem {
  id: string;
  name: string;
  onboardedAt: string;
  status: string;
  region: string;
}

interface DashboardData {
  kpi: {
    totalLeads: number;
    approvedLeads: number;
    disbursedLeads: number;
    pendingLeads: number;
    rejectedLeads: number;
    approvedNotDisbursed: number;
    approvalRate: number;
    onboardedClinics: number;
    totalClinics: number;
    currentMonthLeads: number;
    lastMonthLeads: number;
    mtdDisbursalValue: number;
    lmtdDisbursalValue: number;
    thisWeekClinics: number;
    thisMonthClinics: number;
  };
  chartData: { month: string; leads: number; approved: number; disbursed: number }[];
  regionWise: { name: string; leads: number; approved: number; disbursed: number }[];
  lenderWise: {
    name: string;
    leads: number;
    approved: number;
    disbursed: number;
    approvalRate: number;
  }[];
  rmWise: { name: string; leads: number; approved: number; disbursed: number }[];
  clinicOnboarding: {
    name: string;
    region: string;
    rm: string;
    onboardedAt: string;
    totalLeads: number;
  }[];
  thisWeekClinicsList: ClinicListItem[];
  thisMonthClinicsList: ClinicListItem[];
}

type TabKey = "overview" | "region" | "lender" | "rm" | "clinic";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "region", label: "Region Wise" },
  { key: "lender", label: "Lender Wise" },
  { key: "rm", label: "RM Wise" },
  { key: "clinic", label: "Clinic Onboarding" },
];

type ClinicModal = { title: string; list: ClinicListItem[] } | null;

export default function SuperAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [clinicModal, setClinicModal] = useState<ClinicModal>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard/super-admin")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const downloadExcel = async () => {
    const res = await fetch("/api/dashboard/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const kpi = data?.kpi;
  const mom = kpi && kpi.lastMonthLeads > 0
    ? Math.round(((kpi.currentMonthLeads - kpi.lastMonthLeads) / kpi.lastMonthLeads) * 100)
    : 0;

  return (
    <div className="p-4 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Super Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500">All regions — live data</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          >
            🔄 Refresh
          </button>
          <button
            onClick={downloadExcel}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            ⬇ Download Excel
          </button>
        </div>
      </div>

      {/* Current Month Performance Boxes */}
      {loading ? (
        <PerformanceSkeleton />
      ) : kpi ? (
        <PerformanceBoxes
          mtdLeads={kpi.currentMonthLeads}
          lmtdLeads={kpi.lastMonthLeads}
          mtdDisbursal={kpi.mtdDisbursalValue}
          lmtdDisbursal={kpi.lmtdDisbursalValue}
        />
      ) : null}

      {loading ? (
        <Spinner />
      ) : !kpi ? (
        <div className="p-6 text-red-500">Failed to load data. Please refresh.</div>
      ) : (
      <>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Total Leads" value={kpi.totalLeads} color="blue" />
        <KPICard label="Approved" value={kpi.approvedLeads} color="green" />
        <KPICard label="Disbursed" value={kpi.disbursedLeads} color="purple" />
        <KPICard label="Pending" value={kpi.pendingLeads} color="yellow" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KPICard label="Rejected" value={kpi.rejectedLeads} color="red" />
        <KPICard
          label="Approved ≠ Disbursed"
          value={kpi.approvedNotDisbursed}
          color="orange"
        />
        <KPICard
          label="Approval Rate"
          value={kpi.approvalRate}
          suffix="%"
          color="teal"
        />
      </div>

      {/* KPI Row 3 — Clinic counts + onboarding widgets */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard label="Total Clinics" value={kpi.totalClinics} color="blue" />
        <KPICard
          label="New Clinics (MTD)"
          value={kpi.onboardedClinics}
          color="green"
        />
      </div>

      {/* Onboarding widgets — This Week & This Month */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setClinicModal({ title: "Hospitals Onboarded This Week", list: data!.thisWeekClinicsList })}
          className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-left hover:bg-indigo-100 transition-colors"
        >
          <p className="text-xs font-medium text-indigo-600 opacity-80">This Week</p>
          <p className="text-3xl font-bold text-indigo-700 mt-1">{kpi.thisWeekClinics}</p>
          <p className="text-xs text-indigo-500 mt-1">hospitals onboarded ↗</p>
        </button>
        <button
          onClick={() => setClinicModal({ title: "Hospitals Onboarded This Month", list: data!.thisMonthClinicsList })}
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left hover:bg-emerald-100 transition-colors"
        >
          <p className="text-xs font-medium text-emerald-600 opacity-80">This Month</p>
          <p className="text-3xl font-bold text-emerald-700 mt-1">{kpi.thisMonthClinics}</p>
          <p className="text-xs text-emerald-500 mt-1">hospitals onboarded ↗</p>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold mb-3">6-Month Lead Trend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data!.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="leads"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Total"
              />
              <Line
                type="monotone"
                dataKey="approved"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name="Approved"
              />
              <Line
                type="monotone"
                dataKey="disbursed"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                name="Disbursed"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* TAB: REGION WISE */}
      {activeTab === "region" && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold mb-3">
            Region Wise Performance
          </h2>
          {data!.regionWise.length === 0 ? (
            <Empty />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data!.regionWise}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="leads"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    name="Total"
                  />
                  <Bar
                    dataKey="approved"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    name="Approved"
                  />
                  <Bar
                    dataKey="disbursed"
                    fill="#a855f7"
                    radius={[4, 4, 0, 0]}
                    name="Disbursed"
                  />
                </BarChart>
              </ResponsiveContainer>
              <Table
                headers={[
                  "Region",
                  "Total Leads",
                  "Approved",
                  "Disbursed",
                  "Approval Rate",
                ]}
                rows={data!.regionWise.map((r) => [
                  r.name,
                  r.leads,
                  r.approved,
                  r.disbursed,
                  `${
                    r.leads > 0
                      ? Math.round(
                          ((r.approved + r.disbursed) / r.leads) * 100
                        )
                      : 0
                  }%`,
                ])}
              />
            </>
          )}
        </div>
      )}

      {/* TAB: LENDER WISE */}
      {activeTab === "lender" && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold mb-3">
            Lender Wise Approval Rate
          </h2>
          {data!.lenderWise.length === 0 ? (
            <Empty />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data!.lenderWise}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="leads"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    name="Total"
                  />
                  <Bar
                    dataKey="approved"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    name="Approved"
                  />
                  <Bar
                    dataKey="disbursed"
                    fill="#a855f7"
                    radius={[4, 4, 0, 0]}
                    name="Disbursed"
                  />
                </BarChart>
              </ResponsiveContainer>
              <Table
                headers={[
                  "Lender",
                  "Total",
                  "Approved",
                  "Disbursed",
                  "Approval Rate",
                ]}
                rows={data!.lenderWise.map((l) => [
                  l.name,
                  l.leads,
                  l.approved,
                  l.disbursed,
                  `${l.approvalRate}%`,
                ])}
              />
            </>
          )}
        </div>
      )}

      {/* TAB: RM WISE */}
      {activeTab === "rm" && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold mb-3">RM Wise Performance</h2>
          {data!.rmWise.length === 0 ? (
            <Empty />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data!.rmWise}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="leads"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    name="Total"
                  />
                  <Bar
                    dataKey="approved"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    name="Approved"
                  />
                </BarChart>
              </ResponsiveContainer>
              <Table
                headers={[
                  "RM Name",
                  "Total Leads",
                  "Approved",
                  "Disbursed",
                  "Approval Rate",
                ]}
                rows={data!.rmWise.map((r) => [
                  r.name,
                  r.leads,
                  r.approved,
                  r.disbursed,
                  `${
                    r.leads > 0
                      ? Math.round(
                          ((r.approved + r.disbursed) / r.leads) * 100
                        )
                      : 0
                  }%`,
                ])}
              />
            </>
          )}
        </div>
      )}

      {/* TAB: CLINIC ONBOARDING */}
      {activeTab === "clinic" && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold mb-3">
            Recent Clinic Onboarding
          </h2>
          {data!.clinicOnboarding.length === 0 ? (
            <Empty />
          ) : (
            <Table
              headers={[
                "Clinic Name",
                "Region",
                "RM",
                "Onboarded On",
                "Total Leads",
              ]}
              rows={data!.clinicOnboarding.map((c) => [
                c.name,
                c.region,
                c.rm,
                new Date(c.onboardedAt).toLocaleDateString("en-IN"),
                c.totalLeads,
              ])}
            />
          )}
        </div>
      )}
      </>
      )}

      {clinicModal && (
        <ClinicListModal
          title={clinicModal.title}
          list={clinicModal.list}
          onClose={() => setClinicModal(null)}
        />
      )}
    </div>
  );
}

// ── Clinic List Modal ────────────────────────────────

function ClinicListModal({ title, list, onClose }: { title: string; list: ClinicListItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={ref}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        {list.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">No hospitals onboarded in this period.</p>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 font-semibold text-gray-600">#</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">Hospital Name</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">Region</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">Date Added</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{c.name}</td>
                    <td className="px-3 py-2 text-gray-600">{c.region}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {new Date(c.onboardedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pt-4 border-t mt-4">
          <p className="text-xs text-gray-400">{list.length} hospital{list.length !== 1 ? "s" : ""} found</p>
        </div>
      </div>
    </div>
  );
}

// ── Performance Boxes ─────────────────────────────────

function PerformanceBoxes({ mtdLeads, lmtdLeads, mtdDisbursal, lmtdDisbursal }: {
  mtdLeads: number; lmtdLeads: number; mtdDisbursal: number; lmtdDisbursal: number;
}) {
  const leadsGrowth = lmtdLeads > 0
    ? Math.round(((mtdLeads - lmtdLeads) / lmtdLeads) * 100)
    : mtdLeads > 0 ? 100 : 0;
  const fmtL = (v: number) => `₹${v.toFixed(2)}L`;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">
        Current Month Performance
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <PerfBox label="LMTD Leads" value={lmtdLeads.toLocaleString()} sub="Last Month" />
        <PerfBox label="MTD Leads" value={mtdLeads.toLocaleString()} sub="This Month" accent />
        <PerfBox label="LMTD Disbursal" value={fmtL(lmtdDisbursal)} sub="Last Month" />
        <PerfBox label="MTD Disbursal" value={fmtL(mtdDisbursal)} sub="This Month" accent />
        <div className={`rounded-xl p-3 text-center ${leadsGrowth >= 0 ? "bg-green-100 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <p className="text-xs font-medium text-gray-500 mb-1">Growth</p>
          <p className={`text-2xl font-bold ${leadsGrowth >= 0 ? "text-green-700" : "text-red-600"}`}>
            {leadsGrowth >= 0 ? "▲" : "▼"} {Math.abs(leadsGrowth)}%
          </p>
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-gray-200 h-20" />
        ))}
      </div>
    </div>
  );
}

// ── Reusable Components ────────────────────────────────

function KPICard({
  label,
  value,
  color,
  suffix = "",
  badge,
  badgeColor,
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
  badge?: string;
  badgeColor?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.blue}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold mt-1">
        {value.toLocaleString()}
        {suffix}
      </p>
      {badge && (
        <span
          className={`text-xs font-semibold mt-1 inline-block ${
            badgeColor === "green" ? "text-green-600" : "text-red-500"
          }`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-gray-50 border-b">
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 font-semibold text-gray-600 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );
}
function Empty() {
  return (
    <p className="text-gray-400 text-sm py-8 text-center">
      No data available.
    </p>
  );
}


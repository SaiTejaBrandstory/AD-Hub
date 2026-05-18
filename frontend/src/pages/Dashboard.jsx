import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import MetricCard from "../components/MetricCard";
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import { ArrowRight, Sparkle, Warning, Info } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const fmtMoney = (n) => `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtNum = (n) => (n || 0).toLocaleString("en-US");

const PLATFORM_COLORS = { meta_ads: "#0090FF", google_ads: "#30A46C", ga4: "#F5901A" };
const PLATFORM_LABELS = { meta_ads: "Meta Ads", google_ads: "Google Ads", ga4: "GA4" };

export default function Dashboard() {
  const { activeWorkspaceId } = useAuth();
  const [overview, setOverview] = useState(null);
  const [series, setSeries] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    (async () => {
      const [o, s, a] = await Promise.all([
        api.get("/analytics/overview", { params: { workspace_id: activeWorkspaceId } }),
        api.get("/analytics/timeseries", { params: { workspace_id: activeWorkspaceId, days: 30 } }),
        api.get("/alerts", { params: { workspace_id: activeWorkspaceId } }),
      ]);
      setOverview(o.data);
      setSeries(s.data);
      setAlerts(a.data.slice(0, 5));
    })();
  }, [activeWorkspaceId]);

  if (!overview) return <div className="text-ink-400 text-sm">Loading…</div>;

  const platformData = Object.entries(overview.platforms || {}).map(([k, v]) => ({
    name: PLATFORM_LABELS[k] || k,
    spend: v.spend,
    revenue: v.revenue,
    color: PLATFORM_COLORS[k],
  }));

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Spend" value={fmtMoney(overview.spend)} delta="+12.4%" testid="metric-spend" />
        <MetricCard label="Revenue" value={fmtMoney(overview.revenue)} delta="+18.7%" testid="metric-revenue" />
        <MetricCard label="ROAS" value={overview.roas.toFixed(2)} unit="×" delta="+5.2%" testid="metric-roas" />
        <MetricCard label="Conversions" value={fmtNum(overview.conversions)} delta="+8.1%" testid="metric-conversions" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Impressions" value={fmtNum(overview.impressions)} delta="+4.0%" />
        <MetricCard label="Clicks" value={fmtNum(overview.clicks)} delta="+6.3%" />
        <MetricCard label="CTR" value={overview.ctr.toFixed(2)} unit="%" delta="−0.2%" deltaType="down" />
        <MetricCard label="CPC" value={`$${overview.cpc.toFixed(2)}`} delta="−3.1%" deltaType="up" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spend vs Revenue */}
        <div className="lg:col-span-2 bg-white border border-ink-200 rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Performance</div>
              <h3 className="font-display font-bold text-lg mt-1">Spend vs Revenue · 30 days</h3>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-ink"></span><span className="text-ink-400">Spend</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-success"></span><span className="text-ink-400">Revenue</span></div>
            </div>
          </div>
          <div className="h-64" data-testid="performance-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A0A0B" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0A0A0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#30A46C" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#30A46C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEC" vertical={false} />
                <XAxis dataKey="date" stroke="#A0A0A5" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                <YAxis stroke="#A0A0A5" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #E2E2E6", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => `$${Math.round(v).toLocaleString()}`}
                />
                <Area type="monotone" dataKey="spend" stroke="#0A0A0B" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="revenue" stroke="#30A46C" fill="url(#g2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform mix */}
        <div className="bg-white border border-ink-200 rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Channel mix</div>
          <h3 className="font-display font-bold text-lg mt-1 mb-4">Spend by platform</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEC" vertical={false} />
                <XAxis dataKey="name" stroke="#A0A0A5" fontSize={10} />
                <YAxis stroke="#A0A0A5" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #E2E2E6", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => `$${Math.round(v).toLocaleString()}`}
                />
                <Bar dataKey="spend" radius={[6, 6, 0, 0]}>
                  {platformData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI insight + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Link to="/audit" className="lg:col-span-2 ai-card rounded-xl p-5 hover:shadow-md transition-all group" data-testid="ai-insight-cta">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-info text-white flex items-center justify-center shrink-0">
              <Sparkle size={18} weight="fill" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-info">AI Audit</div>
              <h3 className="font-display font-bold text-lg mt-1 text-ink">
                Get a Claude-powered audit of this brand's campaigns
              </h3>
              <p className="text-sm text-ink-400 mt-1">
                Identify underperformers, scaling opportunities, and creative fatigue across Meta and Google Ads in seconds.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink group-hover:gap-2.5 transition-all">
                Run audit <ArrowRight size={14} weight="bold" />
              </div>
            </div>
          </div>
        </Link>

        <div className="bg-white border border-ink-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Recent</div>
              <h3 className="font-display font-bold text-lg mt-0.5">Alerts</h3>
            </div>
            <Link to="/alerts" className="text-xs text-ink-400 hover:text-ink">View all →</Link>
          </div>
          <div className="space-y-2.5" data-testid="alerts-feed">
            {alerts.length === 0 && <div className="text-sm text-ink-400">All quiet.</div>}
            {alerts.map((a) => {
              const Icon = a.severity === "critical" ? Warning : a.severity === "warning" ? Warning : Info;
              const cls = a.severity === "critical" ? "text-danger bg-danger/10" : a.severity === "warning" ? "text-warning bg-warning/10" : "text-info bg-info/10";
              return (
                <div key={a.alert_id} className="flex gap-2.5 text-sm">
                  <div className={`w-7 h-7 rounded-md ${cls} flex items-center justify-center shrink-0`}>
                    <Icon size={14} weight="bold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate">{a.title}</div>
                    <div className="text-xs text-ink-400 truncate">{a.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

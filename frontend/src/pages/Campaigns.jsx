import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { Pause, Play, FunnelSimple, PencilSimple, X } from "@phosphor-icons/react";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";

const PLATFORM_LABELS = { meta_ads: "Meta", google_ads: "Google", ga4: "GA4" };
const PLATFORM_COLORS = {
  meta_ads: "bg-info/10 text-info border-info/30",
  google_ads: "bg-success/10 text-success border-success/30",
};
const STATUS_BADGE = {
  active: "bg-success/10 text-success border-success/30",
  paused: "bg-ink-100 text-ink-400 border-ink-200",
  ended: "bg-ink-100 text-ink-400 border-ink-200",
};

export default function Campaigns() {
  const { activeWorkspaceId } = useAuth();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState({ platform: "all", status: "all" });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  const load = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const params = { workspace_id: activeWorkspaceId };
    if (filter.platform !== "all") params.platform = filter.platform;
    if (filter.status !== "all") params.status_filter = filter.status;
    const { data } = await api.get("/campaigns", { params });
    setList(data);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeWorkspaceId, filter]);

  const toggle = async (c) => {
    const newStatus = c.status === "active" ? "paused" : "active";
    await api.patch(`/campaigns/${c.campaign_id}/status`, { status: newStatus });
    toast.success(`Campaign ${newStatus === "active" ? "resumed" : "paused"}`);
    load();
  };

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === list.length) setSelected(new Set());
    else setSelected(new Set(list.filter((c) => c.status !== "ended").map((c) => c.campaign_id)));
  };

  const bulkAction = async (status) => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      const { data } = await api.post("/campaigns/bulk-status", { campaign_ids: ids, status });
      toast.success(`${data.updated} campaign${data.updated !== 1 ? "s" : ""} ${status === "active" ? "resumed" : "paused"}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Bulk action failed");
    }
  };

  return (
    <div className="space-y-5" data-testid="campaigns-page">
      <div className="flex flex-wrap items-center gap-2">
        <FunnelSimple size={16} className="text-ink-400" />
        <FilterChip label="Platform" value={filter.platform}
          options={[["all", "All"], ["meta_ads", "Meta"], ["google_ads", "Google"]]}
          onChange={(v) => setFilter((f) => ({ ...f, platform: v }))} />
        <FilterChip label="Status" value={filter.status}
          options={[["all", "All"], ["active", "Active"], ["paused", "Paused"], ["ended", "Ended"]]}
          onChange={(v) => setFilter((f) => ({ ...f, status: v }))} />
        <div className="ml-auto text-xs font-num text-ink-400">{list.length} campaigns</div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-ink text-white rounded-xl px-4 py-2.5 animate-fade-in" data-testid="bulk-action-bar">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => bulkAction("paused")} className="text-xs px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-all inline-flex items-center gap-1.5" data-testid="bulk-pause-btn">
              <Pause size={12} weight="fill" /> Pause all
            </button>
            <button onClick={() => bulkAction("active")} className="text-xs px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-all inline-flex items-center gap-1.5" data-testid="bulk-resume-btn">
              <Play size={12} weight="fill" /> Resume all
            </button>
            <button onClick={() => setSelected(new Set())} className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 inline-flex items-center justify-center">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="border border-ink-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-200">
            <tr className="text-[10px] uppercase tracking-wider text-ink-400">
              <th className="pl-4 pr-2 py-2.5">
                <Checkbox
                  checked={list.length > 0 && selected.size === list.filter(c => c.status !== "ended").length}
                  onCheckedChange={toggleAll}
                  data-testid="select-all-checkbox"
                />
              </th>
              <Th>Campaign</Th>
              <Th>Platform</Th>
              <Th>Status</Th>
              <Th className="text-right">Budget</Th>
              <Th className="text-right">Spend</Th>
              <Th className="text-right">CTR</Th>
              <Th className="text-right">CPC</Th>
              <Th className="text-right">Conv.</Th>
              <Th className="text-right">ROAS</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody data-testid="campaigns-table">
            {loading ? (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-ink-400 text-sm">Loading…</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-ink-400 text-sm">No campaigns. Connect an ad account to get started.</td></tr>
            ) : list.map((c) => (
              <tr key={c.campaign_id} className="border-b border-ink-200 last:border-0 hover:bg-ink-50/60 transition-colors">
                <td className="pl-4 pr-2 py-3">
                  <Checkbox
                    checked={selected.has(c.campaign_id)}
                    onCheckedChange={() => toggleSelected(c.campaign_id)}
                    disabled={c.status === "ended"}
                    data-testid={`select-${c.campaign_id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link to={`/campaigns/${c.campaign_id}`} className="font-medium text-ink hover:underline">
                    {c.name}
                  </Link>
                  <div className="text-[11px] text-ink-400 mt-0.5">{c.objective}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${PLATFORM_COLORS[c.platform] || "bg-ink-100"}`}>
                    {PLATFORM_LABELS[c.platform]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${STATUS_BADGE[c.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.status === "active" ? "bg-success" : "bg-ink-300"}`} />
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-num text-ink-400">${c.daily_budget?.toFixed(0)}/d</td>
                <td className="px-4 py-3 text-right font-num">${c.spend.toFixed(0)}</td>
                <td className="px-4 py-3 text-right font-num">{c.ctr}%</td>
                <td className="px-4 py-3 text-right font-num">${c.cpc}</td>
                <td className="px-4 py-3 text-right font-num">{c.conversions}</td>
                <td className="px-4 py-3 text-right font-num font-semibold">
                  <span className={c.roas >= 2 ? "text-success" : c.roas < 1 ? "text-danger" : "text-ink"}>
                    {c.roas}×
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {c.status !== "ended" && (
                    <button
                      onClick={() => toggle(c)}
                      className="w-7 h-7 rounded-md border border-ink-200 hover:bg-ink hover:text-white transition-all inline-flex items-center justify-center"
                      data-testid={`toggle-${c.campaign_id}`}
                    >
                      {c.status === "active" ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-4 py-2.5 font-semibold text-left ${className}`}>{children}</th>;
}

function FilterChip({ label, value, options, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 bg-white border border-ink-200 rounded-lg p-0.5">
      <span className="text-[10px] uppercase tracking-wider text-ink-400 px-2">{label}</span>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} data-testid={`filter-${label.toLowerCase()}-${v}`}
          className={`text-xs px-2 py-1 rounded-md transition-all ${value === v ? "bg-ink text-white" : "text-ink-400 hover:text-ink"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

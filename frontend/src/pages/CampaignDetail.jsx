import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { ArrowLeft, Pause, Play, PencilSimple } from "@phosphor-icons/react";
import MetricCard from "../components/MetricCard";
import { toast } from "sonner";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/campaigns/${id}`);
    setC(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const toggle = async () => {
    const newStatus = c.status === "active" ? "paused" : "active";
    await api.patch(`/campaigns/${id}/status`, { status: newStatus });
    toast.success(`Campaign ${newStatus}`);
    load();
  };

  if (!c) return <div className="text-ink-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-6" data-testid="campaign-detail-page">
      <button onClick={() => navigate(-1)} className="text-xs text-ink-400 hover:text-ink inline-flex items-center gap-1">
        <ArrowLeft size={12} /> Back to campaigns
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-medium border ${c.status === "active" ? "bg-success/10 text-success border-success/30" : "bg-ink-100 text-ink-400 border-ink-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.status === "active" ? "bg-success" : "bg-ink-300"}`} />
              {c.status}
            </span>
            <span className="text-xs text-ink-400 uppercase tracking-wider">{c.platform.replace("_", " ")}</span>
          </div>
          <h2 className="font-display font-black text-3xl tracking-tight text-ink mt-2">{c.name}</h2>
          <p className="text-sm text-ink-400 mt-1">Objective: {c.objective} · Started {c.start_date}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="campaign-edit-btn"><PencilSimple size={14} className="mr-1.5" /> Edit</Button>
          <Button onClick={toggle} className="bg-ink text-white hover:bg-ink-500" data-testid="campaign-toggle-btn">
            {c.status === "active" ? <><Pause size={14} weight="fill" className="mr-1.5" /> Pause</> : <><Play size={14} weight="fill" className="mr-1.5" /> Resume</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Spend" value={`$${c.spend.toLocaleString()}`} testid="detail-spend" />
        <MetricCard label="Revenue" value={`$${c.revenue.toLocaleString()}`} />
        <MetricCard label="ROAS" value={c.roas.toFixed(2)} unit="×" />
        <MetricCard label="Conversions" value={c.conversions.toLocaleString()} />
        <MetricCard label="Impressions" value={c.impressions.toLocaleString()} />
        <MetricCard label="Clicks" value={c.clicks.toLocaleString()} />
        <MetricCard label="CTR" value={c.ctr.toFixed(2)} unit="%" />
        <MetricCard label="CPC" value={`$${c.cpc.toFixed(2)}`} />
      </div>

      <div className="bg-white border border-ink-200 rounded-xl p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Configuration</div>
        <h3 className="font-display font-bold text-lg mt-1 mb-4">Campaign settings</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row k="Daily budget" v={`$${c.daily_budget}`} />
          <Row k="Total spend" v={`$${c.spend}`} />
          <Row k="CPA" v={`$${c.cpa}`} />
          <Row k="External ID" v={c.campaign_id} />
        </dl>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between border-b border-ink-200 pb-2">
      <dt className="text-ink-400">{k}</dt>
      <dd className="font-num font-medium text-ink">{v}</dd>
    </div>
  );
}

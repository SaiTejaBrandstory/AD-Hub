import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, API } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import MetricCard from "../components/MetricCard";
import ChartRenderer from "../components/ChartRenderer";
import {
  ArrowLeft, Sparkle, PaperPlaneTilt, DownloadSimple, Warning, Info,
  CheckCircle, ChatCircle, User,
} from "@phosphor-icons/react";
import { toast } from "sonner";

const SEV = {
  critical: { Icon: Warning, cls: "text-danger bg-danger/10 border-danger/30" },
  warning: { Icon: Warning, cls: "text-warning bg-warning/10 border-warning/30" },
  info: { Icon: Info, cls: "text-info bg-info/10 border-info/30" },
};

const PLATFORM_LABELS = {
  meta_ads: "Meta Ads", google_ads: "Google Ads", ga4: "Google Analytics 4",
  twitter_ads: "Twitter / X Ads", linkedin_ads: "LinkedIn Ads", youtube_ads: "YouTube Ads",
  generic: "Generic",
};

const fmtMoney = (n) => `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtNum = (n) => (n || 0).toLocaleString("en-US");

export default function DatasetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [thread, setThread] = useState([]);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const chatEndRef = useRef(null);

  const load = async () => {
    try {
      const ds = await api.get(`/datasets/${id}`);
      setDataset(ds.data);
      const dash = await api.get(`/datasets/${id}/dashboard`);
      setDashboard(dash.data);
      const t = await api.get(`/datasets/${id}/chat`);
      setThread(t.data.messages || []);
    } catch (e) {
      toast.error("Failed to load dataset");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const send = async () => {
    if (!msg.trim() || sending) return;
    const text = msg.trim();
    setMsg("");
    setSending(true);
    setThread((t) => [...t, { role: "user", content: text, at: new Date().toISOString() }]);
    try {
      const { data } = await api.post(`/datasets/${id}/chat`, { message: text });
      setThread((t) => [...t, data.assistant_message]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Chat failed");
    } finally {
      setSending(false);
    }
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const resp = await api.post(`/datasets/${id}/pdf`, {}, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = (dataset?.filename || "dataset").replace(/\.\w+$/, "") + "_report.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("PDF generation failed");
    } finally {
      setDownloading(false);
    }
  };

  if (!dataset || !dashboard) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink rounded-full animate-spin" />
      </div>
    );
  }

  const k = dashboard.digest?.kpis || {};
  const charts = dashboard.charts || [];

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6" data-testid="dataset-detail-page">
      <div className="space-y-6 min-w-0">
        {/* Header */}
        <div>
          <button onClick={() => navigate("/datasets")} className="text-xs text-ink-400 hover:text-ink inline-flex items-center gap-1 mb-3">
            <ArrowLeft size={12} /> Back to datasets
          </button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-medium bg-info/10 text-info border border-info/30">
                  {PLATFORM_LABELS[dashboard.platform] || dashboard.platform}
                </span>
                <span className="text-[11px] text-ink-400 font-num">
                  ingested {new Date(dataset.created_at).toLocaleDateString()}
                </span>
                <span className="text-[11px] text-ink-400 font-num">
                  · {dataset.row_count?.toLocaleString() || "?"} rows
                </span>
              </div>
              <h1 className="font-display font-black text-2xl tracking-tight text-ink truncate max-w-2xl">
                {dataset.filename}
              </h1>
            </div>
            <Button onClick={downloadPdf} disabled={downloading}
                    className="bg-ink text-white hover:bg-ink-500"
                    data-testid="download-pdf-btn">
              <DownloadSimple size={14} className="mr-1.5" weight="bold" />
              {downloading ? "Building PDF…" : "Export PDF"}
            </Button>
          </div>
        </div>

        {/* AI verdict */}
        {dashboard.headline && (
          <div className="ai-card rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-info text-white flex items-center justify-center shrink-0">
                <Sparkle size={16} weight="fill" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.2em] text-info">AI Verdict</div>
                <p className="font-display font-bold text-lg mt-1 text-ink leading-snug" data-testid="ai-headline">
                  {dashboard.headline}
                </p>
              </div>
              {dashboard.score !== undefined && (
                <div className="text-right shrink-0">
                  <div className="font-num font-black text-3xl text-ink leading-none">{dashboard.score}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-400 mt-0.5">/ 100</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {"spend" in k && <MetricCard label="Spend" value={fmtMoney(k.spend)} />}
          {"revenue" in k && <MetricCard label="Revenue" value={fmtMoney(k.revenue)} />}
          {"roas" in k && <MetricCard label="ROAS" value={k.roas?.toFixed(2)} unit="×" />}
          {"conversions" in k && <MetricCard label="Conversions" value={fmtNum(k.conversions)} />}
          {"impressions" in k && <MetricCard label="Impressions" value={fmtNum(k.impressions)} />}
          {"clicks" in k && <MetricCard label="Clicks" value={fmtNum(k.clicks)} />}
          {"ctr" in k && <MetricCard label="CTR" value={k.ctr} unit="%" />}
          {"cpc" in k && <MetricCard label="CPC" value={`$${k.cpc}`} />}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {charts.map((c, i) => (
            <div key={i} className={`bg-white border border-ink-200 rounded-xl p-5 ${charts.length === 1 || (charts.length % 2 === 1 && i === charts.length - 1) ? "lg:col-span-2" : ""}`}
                 data-testid={`chart-${i}`}>
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">{c.type}</div>
                <h3 className="font-display font-bold text-base mt-0.5">{c.title}</h3>
                {c.subtitle && <p className="text-xs text-ink-400">{c.subtitle}</p>}
              </div>
              <div className="h-60">
                <ChartRenderer spec={c} digest={dashboard.digest} />
              </div>
            </div>
          ))}
        </div>

        {/* Insights */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">
            AI Insights · {dashboard.insights?.length || 0}
          </div>
          {(dashboard.insights || []).map((ins, i) => {
            const sev = SEV[ins.severity] || SEV.info;
            return (
              <div key={i} className="bg-white border border-ink-200 rounded-xl p-5 flex gap-4" data-testid={`insight-${i}`}>
                <div className={`w-9 h-9 rounded-lg ${sev.cls} flex items-center justify-center shrink-0 border`}>
                  <sev.Icon size={16} weight="fill" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h4 className="font-display font-bold text-ink">{ins.title}</h4>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${sev.cls}`}>
                      {ins.severity}
                    </span>
                  </div>
                  <p className="text-sm text-ink-400 mt-1.5">{ins.detail}</p>
                  <div className="mt-2.5 inline-flex items-start gap-1.5 px-3 py-2 rounded-lg bg-ink-50 border border-ink-200 text-sm text-ink">
                    <CheckCircle size={14} weight="fill" className="text-success shrink-0 mt-0.5" />
                    <span>{ins.action}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat panel */}
      <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] flex flex-col bg-white border border-ink-200 rounded-xl overflow-hidden" data-testid="chat-panel">
        <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-info text-white flex items-center justify-center">
            <ChatCircle size={14} weight="fill" />
          </div>
          <div>
            <div className="font-display font-bold text-sm text-ink">Talk to this dashboard</div>
            <div className="text-[10px] text-ink-400">Claude has your data</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {thread.length === 0 && (
            <div className="text-center py-8">
              <Sparkle size={20} className="text-ink-300 mx-auto mb-2" />
              <p className="text-xs text-ink-400 max-w-[220px] mx-auto">
                Ask anything about this dataset — performance trends, what to pause, where to scale.
              </p>
              <div className="mt-4 space-y-1.5">
                {[
                  "What's my biggest loser?",
                  "Where should I scale budget?",
                  "Why is CTR weak?",
                ].map((q) => (
                  <button key={q}
                          onClick={() => { setMsg(q); setTimeout(send, 50); }}
                          className="block w-full text-left text-xs px-3 py-1.5 rounded-md bg-ink-50 hover:bg-ink hover:text-white border border-ink-200 transition-all"
                          data-testid={`suggested-${q.slice(0,10)}`}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {thread.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`} data-testid={`msg-${i}`}>
              {m.role === "assistant" && (
                <div className="w-6 h-6 rounded-md bg-info text-white flex items-center justify-center shrink-0">
                  <Sparkle size={11} weight="fill" />
                </div>
              )}
              <div className={`text-sm leading-relaxed max-w-[280px] rounded-lg px-3 py-2 ${
                m.role === "user"
                  ? "bg-ink text-white"
                  : "bg-ink-50 text-ink border border-ink-200"
              }`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
              {m.role === "user" && (
                <div className="w-6 h-6 rounded-md bg-ink text-white flex items-center justify-center shrink-0">
                  <User size={11} weight="fill" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-md bg-info text-white flex items-center justify-center shrink-0">
                <Sparkle size={11} weight="fill" />
              </div>
              <div className="text-sm bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-pulse" style={{ animationDelay: "0.2s" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-ink-200">
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex gap-2"
          >
            <Input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Ask anything…"
              className="text-sm"
              disabled={sending}
              data-testid="chat-input"
            />
            <button
              type="submit"
              disabled={sending || !msg.trim()}
              className="w-9 h-9 shrink-0 rounded-md bg-ink text-white hover:bg-ink-500 disabled:opacity-40 inline-flex items-center justify-center transition-all"
              data-testid="chat-send"
            >
              <PaperPlaneTilt size={14} weight="fill" />
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

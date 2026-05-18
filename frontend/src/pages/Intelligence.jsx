import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import MetricCard from "../components/MetricCard";
import ChartRenderer from "../components/ChartRenderer";
import {
  Sparkle, UploadSimple, ArrowsClockwise, PaperPlaneTilt, User as UserIcon,
  Database, ChatCircle, Warning, Info, CheckCircle, ArrowRight, FileCsv,
  Clock, MapPin, MagnifyingGlass, FilmStrip, UsersThree, DeviceMobile, Star,
} from "@phosphor-icons/react";
import { toast } from "sonner";

const SECTION_ICONS = {
  temporal: Clock,
  geographic: MapPin,
  keyword: MagnifyingGlass,
  creative: FilmStrip,
  audience: UsersThree,
  device: DeviceMobile,
  quality: Star,
};

const SEV = {
  critical: { Icon: Warning, cls: "text-danger bg-danger/10 border-danger/30" },
  warning: { Icon: Warning, cls: "text-warning bg-warning/10 border-warning/30" },
  info: { Icon: Info, cls: "text-info bg-info/10 border-info/30" },
};

const fmtMoney = (n) => `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtNum = (n) => (n || 0).toLocaleString("en-US");

export default function Intelligence() {
  const { activeWorkspaceId, workspaces } = useAuth();
  const navigate = useNavigate();
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [thread, setThread] = useState([]);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const brand = workspaces.find((w) => w.workspace_id === activeWorkspaceId);

  const loadIntel = useCallback(async (force = false) => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/workspaces/${activeWorkspaceId}/intelligence`,
        { params: force ? { refresh: true } : {} }
      );
      setIntel(data);
    } catch (e) {
      toast.error("Failed to load intelligence");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeWorkspaceId]);

  const loadChat = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const { data } = await api.get(`/workspaces/${activeWorkspaceId}/chat`);
      setThread(data.messages || []);
    } catch {}
  }, [activeWorkspaceId]);

  useEffect(() => { loadIntel(); loadChat(); /* eslint-disable-next-line */ }, [activeWorkspaceId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const refresh = async () => {
    setRefreshing(true);
    await loadIntel(true);
    toast.success("Intelligence refreshed");
  };

  const upload = async (files) => {
    if (!files?.length || !activeWorkspaceId) return;
    setUploading(true);
    const uploaded = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append("workspace_id", activeWorkspaceId);
      fd.append("file", f);
      try {
        const { data } = await api.post("/datasets/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploaded.push(data);
        toast.success(`${f.name} uploaded`);
      } catch (e) {
        toast.error(`${f.name}: ${e.response?.data?.detail || "upload failed"}`);
      }
    }
    // analyze each
    for (const d of uploaded) {
      try {
        await api.post(`/datasets/${d.dataset_id}/analyze`);
      } catch (e) { /* keep going */ }
    }
    setUploading(false);
    await loadIntel(true);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    upload([...e.dataTransfer.files]);
  };

  const send = async () => {
    if (!msg.trim() || sending) return;
    const text = msg.trim();
    setMsg("");
    setSending(true);
    setThread((t) => [...t, { role: "user", content: text, at: new Date().toISOString() }]);
    try {
      const { data } = await api.post(`/workspaces/${activeWorkspaceId}/chat`, { message: text });
      setThread((t) => [...t, data.assistant_message]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Chat failed");
    } finally {
      setSending(false);
    }
  };

  if (loading && !intel) {
    return <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-ink-200 border-t-ink rounded-full animate-spin" />
    </div>;
  }

  const empty = !intel || intel.datasets_summary.length === 0;
  const k = intel?.kpis || {};

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6" data-testid="intelligence-page">
      <div className="space-y-6 min-w-0">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-info">Brand intelligence</div>
            <h1 className="font-display font-black text-3xl tracking-tight text-ink mt-1">
              {brand?.name || "Brand"} <span className="text-ink-300">·</span> <span className="text-ink-400 text-2xl">Living dashboard</span>
            </h1>
            <p className="text-sm text-ink-400 mt-1">
              {empty
                ? "Drop reports below to begin synthesizing brand performance."
                : `Synthesized across ${intel.datasets_summary.length} data lens${intel.datasets_summary.length !== 1 ? "es" : ""}.`}
            </p>
          </div>
          <Button onClick={refresh} disabled={refreshing || empty} variant="outline" data-testid="refresh-intel-btn">
            <ArrowsClockwise size={14} className={`mr-1.5 ${refreshing ? "animate-spin" : ""}`} weight="bold" />
            {refreshing ? "Re-synthesizing…" : "Re-synthesize"}
          </Button>
        </div>

        {/* Compact upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed py-5 px-6 cursor-pointer transition-all flex items-center gap-4 ${
            dragOver ? "border-ink bg-ink-50" : "border-ink-200 hover:border-ink-300 bg-white"
          }`}
          data-testid="upload-dropzone"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.xlsm,.txt"
            multiple
            className="hidden"
            onChange={(e) => upload([...e.target.files])}
          />
          <div className="w-10 h-10 rounded-lg bg-ink text-white flex items-center justify-center shrink-0">
            <UploadSimple size={18} weight="bold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-base text-ink">
              {uploading ? "Uploading & analyzing…" : "Drop more lenses to enrich"}
            </div>
            <div className="text-xs text-ink-400">
              CSV / XLSX from Meta, Google Ads, GA4, LinkedIn, X, YouTube. Each file becomes a new lens.
            </div>
          </div>
          <ArrowRight size={16} className="text-ink-400 shrink-0" />
        </div>

        {empty ? (
          <EmptyState onUploadClick={() => inputRef.current?.click()} />
        ) : (
          <>
            {/* Data sources rail */}
            {intel.datasets_summary.length > 0 && (
              <div className="bg-white border border-ink-200 rounded-xl p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Data sources · {intel.datasets_summary.length}</div>
                  <button onClick={() => navigate("/datasets")} className="text-[11px] text-ink-400 hover:text-ink">
                    Manage →
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5" data-testid="data-sources-rail">
                  {intel.datasets_summary.map((d) => (
                    <button
                      key={d.dataset_id}
                      onClick={() => navigate(`/datasets/${d.dataset_id}`)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ink-50 border border-ink-200 text-xs hover:bg-ink hover:text-white transition-all max-w-[260px]"
                      data-testid={`source-pill-${d.dataset_id}`}
                    >
                      <FileCsv size={11} weight="fill" />
                      <span className="truncate">{d.filename}</span>
                      {d.dimension && d.dimension !== "account_level" && (
                        <span className="text-[10px] opacity-60">· {d.dimension.replace("_", " ")}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Verdict */}
            {intel.headline && (
              <div className="ai-card rounded-xl p-5" data-testid="brand-verdict">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-info text-white flex items-center justify-center shrink-0">
                    <Sparkle size={18} weight="fill" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-info">Brand verdict</div>
                    <p className="font-display font-bold text-lg mt-1 text-ink leading-snug">
                      {intel.headline}
                    </p>
                    {intel.key_takeaways?.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {intel.key_takeaways.map((t, i) => (
                          <li key={i} className="flex gap-2 text-sm text-ink">
                            <span className="text-info shrink-0">•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {intel.score != null && (
                    <div className="text-right shrink-0">
                      <div className="font-num font-black text-3xl text-ink leading-none">{intel.score}</div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-400 mt-0.5">/ 100</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Headline KPIs */}
            {Object.keys(k).length > 0 && (
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Headline KPIs</div>
                    <div className="text-[11px] text-ink-300 font-num">
                      from <span className="text-ink-400">{intel.kpi_source_filename}</span>
                    </div>
                  </div>
                </div>
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
              </div>
            )}

            {/* Dynamic sections */}
            {(intel.sections || []).map((section) => (
              <Section key={section.dimension} section={section} navigate={navigate} />
            ))}
          </>
        )}
      </div>

      {/* Brand-wide chat */}
      <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] flex flex-col bg-white border border-ink-200 rounded-xl overflow-hidden" data-testid="brand-chat-panel">
        <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-info text-white flex items-center justify-center">
            <ChatCircle size={14} weight="fill" />
          </div>
          <div>
            <div className="font-display font-bold text-sm text-ink">Brand co-pilot</div>
            <div className="text-[10px] text-ink-400">Knows every lens</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {thread.length === 0 && (
            <div className="text-center py-8">
              <Sparkle size={20} className="text-ink-300 mx-auto mb-2" />
              <p className="text-xs text-ink-400 max-w-[240px] mx-auto">
                Cross-reference any insight. Try:
              </p>
              <div className="mt-3 space-y-1.5">
                {[
                  "Where am I bleeding budget?",
                  "Which hour-of-day gets best ROAS?",
                  "What search terms are wasting money?",
                  "Compare creative performance across geos",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setMsg(q); setTimeout(send, 50); }}
                    className="block w-full text-left text-xs px-3 py-1.5 rounded-md bg-ink-50 hover:bg-ink hover:text-white border border-ink-200 transition-all"
                    data-testid={`brand-suggested-${q.slice(0, 12)}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {thread.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="w-6 h-6 rounded-md bg-info text-white flex items-center justify-center shrink-0">
                  <Sparkle size={11} weight="fill" />
                </div>
              )}
              <div className={`text-sm leading-relaxed max-w-[280px] rounded-lg px-3 py-2 ${
                m.role === "user" ? "bg-ink text-white" : "bg-ink-50 text-ink border border-ink-200"
              }`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
              {m.role === "user" && (
                <div className="w-6 h-6 rounded-md bg-ink text-white flex items-center justify-center shrink-0">
                  <UserIcon size={11} weight="fill" />
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
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <Input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Ask anything about this brand…"
              className="text-sm"
              disabled={sending || empty}
              data-testid="brand-chat-input"
            />
            <button
              type="submit"
              disabled={sending || !msg.trim() || empty}
              className="w-9 h-9 shrink-0 rounded-md bg-ink text-white hover:bg-ink-500 disabled:opacity-40 inline-flex items-center justify-center transition-all"
              data-testid="brand-chat-send"
            >
              <PaperPlaneTilt size={14} weight="fill" />
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

function Section({ section, navigate }) {
  const Icon = SECTION_ICONS[section.dimension] || Database;
  return (
    <div className="bg-white border border-ink-200 rounded-xl p-5" data-testid={`section-${section.dimension}`}>
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-ink-100 text-ink flex items-center justify-center shrink-0">
            <Icon size={14} weight="fill" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">{section.dimension}</div>
            <h3 className="font-display font-bold text-lg text-ink">{section.title}</h3>
          </div>
        </div>
        <div className="text-[11px] text-ink-300 hidden sm:flex flex-wrap justify-end gap-1.5 max-w-xs">
          {section.sources.map((s) => (
            <button
              key={s.dataset_id}
              onClick={() => navigate(`/datasets/${s.dataset_id}`)}
              className="font-num truncate max-w-[160px] text-ink-400 hover:text-ink"
              title={s.filename}
            >
              {s.filename}
            </button>
          ))}
        </div>
      </div>

      {section.charts?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {section.charts.slice(0, 4).map((c, i) => {
            // Need the digest for chart data — fetch from sources? For brand-level,
            // we attach digest minimally. We'll render only if digest is embedded.
            // The brand intelligence inlines charts with dataset_id; render via the
            // ChartRenderer using whatever data the spec includes inline.
            return <ChartCard key={i} spec={c} />;
          })}
        </div>
      )}

      {section.insights?.length > 0 && (
        <div className="space-y-2">
          {section.insights.slice(0, 4).map((ins, i) => {
            const sev = SEV[ins.severity] || SEV.info;
            return (
              <div key={i} className="flex gap-2.5 items-start">
                <div className={`w-7 h-7 rounded-md ${sev.cls} flex items-center justify-center shrink-0 border`}>
                  <sev.Icon size={12} weight="fill" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-ink text-sm">{ins.title}</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold border ${sev.cls}`}>
                      {ins.severity}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">{ins.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChartCard({ spec }) {
  const [digest, setDigest] = useState(null);
  useEffect(() => {
    if (!spec.dataset_id) return;
    api.get(`/datasets/${spec.dataset_id}/dashboard`).then(({ data }) => {
      setDigest(data.digest);
    }).catch(() => {});
  }, [spec.dataset_id]);

  return (
    <div className="border border-ink-200 rounded-lg p-4">
      <div className="mb-2">
        <div className="text-[9px] uppercase tracking-[0.2em] text-ink-400">{spec.type}</div>
        <h4 className="font-display font-bold text-sm text-ink truncate">{spec.title}</h4>
        {spec.filename && <div className="text-[10px] text-ink-300 font-num truncate">{spec.filename}</div>}
      </div>
      <div className="h-44">
        {digest
          ? <ChartRenderer spec={spec} digest={digest} />
          : <div className="h-full flex items-center justify-center text-xs text-ink-400">Loading…</div>}
      </div>
    </div>
  );
}

function EmptyState({ onUploadClick }) {
  return (
    <div className="border border-dashed border-ink-200 rounded-xl p-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-ink-100 text-ink-400 mx-auto flex items-center justify-center">
        <Database size={20} />
      </div>
      <h3 className="font-display font-bold text-xl mt-4 text-ink">No lenses connected yet</h3>
      <p className="text-sm text-ink-400 mt-2 max-w-md mx-auto">
        Drop any campaign export — Meta Ads, Google Ads, GA4, Search Terms, Location, Quality Score, Video — and the brand dashboard will assemble itself.
      </p>
      <Button onClick={onUploadClick} className="mt-5 bg-ink text-white hover:bg-ink-500">
        <UploadSimple size={14} className="mr-1.5" weight="bold" /> Upload your first lens
      </Button>
    </div>
  );
}

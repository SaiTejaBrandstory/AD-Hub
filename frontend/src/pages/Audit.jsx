import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Sparkle, Warning, Info, CheckCircle, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";

const SEV = {
  critical: { Icon: Warning, cls: "text-danger bg-danger/10 border-danger/30", label: "Critical" },
  warning: { Icon: Warning, cls: "text-warning bg-warning/10 border-warning/30", label: "Warning" },
  info: { Icon: Info, cls: "text-info bg-info/10 border-info/30", label: "Info" },
};

export default function Audit() {
  const { activeWorkspaceId } = useAuth();
  const [audit, setAudit] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!activeWorkspaceId) return;
    setBusy(true);
    try {
      const { data } = await api.post("/ai/audit", { workspace_id: activeWorkspaceId });
      setAudit(data);
      toast.success("Audit complete");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Audit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="audit-page">
      <div className="ai-card rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 max-w-2xl">
            <div className="w-10 h-10 rounded-lg bg-info text-white flex items-center justify-center shrink-0">
              <Sparkle size={20} weight="fill" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-info">Claude Sonnet 4.5</div>
              <h2 className="font-display font-black text-2xl tracking-tight text-ink mt-1">
                AI campaign audit
              </h2>
              <p className="text-sm text-ink-400 mt-1 leading-relaxed">
                A senior paid-media strategist (powered by Claude) reviews every campaign in this brand and returns prioritized recommendations: pause underperformers, scale winners, fix creative fatigue, and reallocate budget.
              </p>
            </div>
          </div>
          <Button onClick={run} disabled={busy} className="bg-ink text-white hover:bg-ink-500 h-11" data-testid="run-audit-btn">
            {busy ? "Auditing…" : <>Run audit <ArrowRight size={14} className="ml-1.5" /></>}
          </Button>
        </div>
      </div>

      {!audit && !busy && (
        <div className="border border-dashed border-ink-200 rounded-xl p-10 text-center">
          <Sparkle size={28} className="mx-auto text-ink-300 mb-2" />
          <div className="text-sm text-ink-400">Run an audit to see recommendations here.</div>
        </div>
      )}

      {audit && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-ink-200 rounded-xl p-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Verdict</div>
              <p className="font-display font-bold text-xl mt-1 text-ink leading-snug" data-testid="audit-headline">
                {audit.headline}
              </p>
            </div>
            <div className="bg-white border border-ink-200 rounded-xl p-5 flex flex-col justify-center">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Overall score</div>
              <div className="font-num font-bold text-5xl text-ink mt-1" data-testid="audit-score">
                {audit.overall_score}
                <span className="text-lg text-ink-400">/100</span>
              </div>
            </div>
          </div>

          <div className="space-y-3" data-testid="audit-recommendations">
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Recommendations · {audit.recommendations.length}</div>
            {audit.recommendations.map((r, i) => {
              const sev = SEV[r.severity] || SEV.info;
              return (
                <div key={i} className="bg-white border border-ink-200 rounded-xl p-5 flex gap-4" data-testid={`rec-${i}`}>
                  <div className={`w-9 h-9 rounded-lg ${sev.cls} flex items-center justify-center shrink-0 border`}>
                    <sev.Icon size={16} weight="fill" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h4 className="font-display font-bold text-ink">{r.title}</h4>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${sev.cls}`}>
                        {sev.label}
                      </span>
                      <span className="text-xs text-ink-400 font-num truncate">{r.campaign}</span>
                    </div>
                    <p className="text-sm text-ink-400 mt-1.5"><span className="text-ink-500 font-medium">Issue:</span> {r.issue}</p>
                    <div className="mt-2 inline-flex items-start gap-1.5 px-3 py-2 rounded-lg bg-ink-50 border border-ink-200 text-sm text-ink">
                      <CheckCircle size={14} weight="fill" className="text-success shrink-0 mt-0.5" />
                      <span>{r.action}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

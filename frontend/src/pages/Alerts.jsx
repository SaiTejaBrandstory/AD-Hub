import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Warning, Info, Bell, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

const SEV = {
  critical: { Icon: Warning, cls: "text-danger bg-danger/10 border-danger/30" },
  warning: { Icon: Warning, cls: "text-warning bg-warning/10 border-warning/30" },
  info: { Icon: Info, cls: "text-info bg-info/10 border-info/30" },
};

export default function Alerts() {
  const { activeWorkspaceId } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    if (!activeWorkspaceId) return;
    const { data } = await api.get("/alerts", { params: { workspace_id: activeWorkspaceId } });
    setAlerts(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeWorkspaceId]);

  const scan = async () => {
    setScanning(true);
    try {
      const { data } = await api.post(`/alerts/scan?workspace_id=${activeWorkspaceId}`);
      if (data.new_alerts > 0) {
        toast.success(`${data.new_alerts} new anomal${data.new_alerts === 1 ? "y" : "ies"} detected`);
      } else {
        toast.success("No new anomalies — account is healthy");
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="alerts-page">
      <div className="flex flex-wrap items-center justify-between gap-3 ai-card rounded-xl p-5">
        <div className="flex items-start gap-3 max-w-2xl">
          <div className="w-10 h-10 rounded-lg bg-info text-white flex items-center justify-center shrink-0">
            <Sparkle size={18} weight="fill" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-info">Anomaly detection</div>
            <h2 className="font-display font-bold text-xl mt-0.5 text-ink">Scan for performance anomalies</h2>
            <p className="text-xs text-ink-400 mt-1">
              Runs threshold checks across every active campaign — flags ROAS drops, CPA spikes, CTR weakness, and budget pacing.
            </p>
          </div>
        </div>
        <Button onClick={scan} disabled={scanning} className="bg-ink text-white hover:bg-ink-500" data-testid="run-scan-btn">
          {scanning ? "Scanning…" : "Run scan"}
        </Button>
      </div>

      <div className="bg-white border border-ink-200 rounded-xl divide-y divide-ink-200">
        {alerts.length === 0 ? (
          <div className="p-10 text-center">
            <Bell size={28} className="mx-auto text-ink-300 mb-2" />
            <div className="text-sm text-ink-400">All quiet. No alerts.</div>
          </div>
        ) : alerts.map((a) => {
          const sev = SEV[a.severity] || SEV.info;
          return (
            <div key={a.alert_id} className="p-5 flex items-start gap-3 hover:bg-ink-50/60" data-testid={`alert-${a.alert_id}`}>
              <div className={`w-9 h-9 rounded-lg ${sev.cls} flex items-center justify-center shrink-0 border`}>
                <sev.Icon size={16} weight="fill" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-display font-bold text-ink">{a.title}</h4>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${sev.cls}`}>
                    {a.severity}
                  </span>
                </div>
                <p className="text-sm text-ink-400 mt-1">{a.message}</p>
                <div className="text-[11px] text-ink-300 font-num mt-2">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

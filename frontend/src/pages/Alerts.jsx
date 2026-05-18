import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Warning, Info, Bell } from "@phosphor-icons/react";

const SEV = {
  critical: { Icon: Warning, cls: "text-danger bg-danger/10 border-danger/30", dot: "bg-danger" },
  warning: { Icon: Warning, cls: "text-warning bg-warning/10 border-warning/30", dot: "bg-warning" },
  info: { Icon: Info, cls: "text-info bg-info/10 border-info/30", dot: "bg-info" },
};

export default function Alerts() {
  const { activeWorkspaceId } = useAuth();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    api.get("/alerts", { params: { workspace_id: activeWorkspaceId } })
      .then(({ data }) => setAlerts(data));
  }, [activeWorkspaceId]);

  return (
    <div className="space-y-4" data-testid="alerts-page">
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

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { MetaLogo, GoogleLogo, ChartBar, Plus, CheckCircle, XCircle, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const CONNECTORS = [
  {
    platform: "meta_ads",
    name: "Meta Ads",
    description: "Facebook & Instagram campaigns, ad sets, creatives, and audiences.",
    Icon: MetaLogo,
    color: "#0090FF",
  },
  {
    platform: "google_ads",
    name: "Google Ads",
    description: "Search, Performance Max, Display, Shopping, and YouTube campaigns.",
    Icon: GoogleLogo,
    color: "#30A46C",
  },
  {
    platform: "ga4",
    name: "Google Analytics 4",
    description: "Property-level conversions, audience, attribution, and funnel data.",
    Icon: ChartBar,
    color: "#F5901A",
  },
];

export default function Accounts() {
  const { activeWorkspaceId } = useAuth();
  const [accounts, setAccounts] = useState([]);

  const load = async () => {
    if (!activeWorkspaceId) return;
    const { data } = await api.get("/ad-accounts", { params: { workspace_id: activeWorkspaceId } });
    setAccounts(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeWorkspaceId]);

  const connect = async (platform) => {
    try {
      await api.post("/ad-accounts/connect", { workspace_id: activeWorkspaceId, platform });
      toast.success("Account connected");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to connect");
    }
  };

  const disconnect = async (accId) => {
    await api.delete(`/ad-accounts/${accId}`);
    toast.success("Disconnected");
    load();
  };

  const byPlatform = (p) => accounts.filter((a) => a.platform === p);

  return (
    <div className="space-y-6" data-testid="accounts-page">
      <div className="bg-info/5 border border-info/20 rounded-xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-info/10 text-info flex items-center justify-center shrink-0">
          <CheckCircle size={16} weight="fill" />
        </div>
        <div>
          <div className="font-semibold text-ink text-sm">OAuth scaffolding ready</div>
          <p className="text-xs text-ink-400 mt-0.5 max-w-2xl">
            This MVP simulates the connect flow with realistic data. Real OAuth credentials are added once Meta App Review and Google Ads Developer Token approvals come through — no code changes required to your dashboard.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CONNECTORS.map((c) => {
          const connected = byPlatform(c.platform).filter((a) => a.status === "connected");
          return (
            <div key={c.platform} className="bg-white border border-ink-200 rounded-xl p-5 flex flex-col" data-testid={`connector-${c.platform}`}>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${c.color}15`, color: c.color }}>
                  <c.Icon size={20} weight="fill" />
                </div>
                {connected.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-medium bg-success/10 text-success border border-success/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" /> {connected.length} linked
                  </span>
                )}
              </div>
              <h3 className="font-display font-bold text-lg mt-3 text-ink">{c.name}</h3>
              <p className="text-sm text-ink-400 mt-1 flex-1">{c.description}</p>
              <Button
                onClick={() => connect(c.platform)}
                className="mt-4 bg-ink text-white hover:bg-ink-500"
                data-testid={`connect-${c.platform}-btn`}
              >
                <Plus size={14} className="mr-1.5" /> Connect account
              </Button>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-ink-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Linked</div>
            <h3 className="font-display font-bold text-lg mt-0.5">Connected accounts</h3>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-200">
            <tr className="text-[10px] uppercase tracking-wider text-ink-400">
              <th className="px-5 py-2.5 text-left font-semibold">Name</th>
              <th className="px-5 py-2.5 text-left font-semibold">Platform</th>
              <th className="px-5 py-2.5 text-left font-semibold">External ID</th>
              <th className="px-5 py-2.5 text-left font-semibold">Status</th>
              <th className="px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-400">No accounts linked yet.</td></tr>
            ) : accounts.map((a) => (
              <tr key={a.account_id} className="border-b border-ink-200 last:border-0 hover:bg-ink-50/60">
                <td className="px-5 py-3 font-medium text-ink">{a.name}</td>
                <td className="px-5 py-3 text-ink-400">{a.platform.replace("_", " ")}</td>
                <td className="px-5 py-3 font-num text-ink-400">{a.external_id}</td>
                <td className="px-5 py-3">
                  {a.status === "connected" ? (
                    <span className="inline-flex items-center gap-1 text-success text-xs"><CheckCircle size={12} weight="fill" /> Connected</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-ink-400 text-xs"><XCircle size={12} weight="fill" /> {a.status}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {a.status === "connected" && (
                    <button
                      onClick={() => disconnect(a.account_id)}
                      className="text-xs text-ink-400 hover:text-danger inline-flex items-center gap-1"
                      data-testid={`disconnect-${a.account_id}`}
                    >
                      <Trash size={12} /> Disconnect
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

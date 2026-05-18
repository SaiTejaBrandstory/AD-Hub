import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { FileText, Plus, Envelope, Clock } from "@phosphor-icons/react";
import { toast } from "sonner";

const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

export default function Reports() {
  const { activeWorkspaceId } = useAuth();
  const [reports, setReports] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [recipients, setRecipients] = useState("");

  const load = async () => {
    if (!activeWorkspaceId) return;
    const { data } = await api.get("/reports", { params: { workspace_id: activeWorkspaceId } });
    setReports(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeWorkspaceId]);

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.post("/reports", {
        workspace_id: activeWorkspaceId,
        name,
        frequency,
        recipients: recipients.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setOpen(false); setName(""); setFrequency("weekly"); setRecipients("");
      toast.success("Report scheduled");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-5" data-testid="reports-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Automated</div>
          <h2 className="font-display font-bold text-xl mt-0.5">Scheduled reports</h2>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-ink text-white hover:bg-ink-500" data-testid="new-report-btn">
          <Plus size={14} className="mr-1.5" /> New report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 border border-dashed border-ink-200 rounded-xl p-10 text-center">
            <FileText size={28} className="mx-auto text-ink-300 mb-2" />
            <div className="text-sm text-ink-400">No scheduled reports yet.</div>
          </div>
        ) : reports.map((r) => (
          <div key={r.report_id} className="bg-white border border-ink-200 rounded-xl p-5" data-testid={`report-${r.report_id}`}>
            <div className="w-9 h-9 rounded-lg bg-ink-100 text-ink flex items-center justify-center mb-3">
              <FileText size={16} weight="fill" />
            </div>
            <h4 className="font-display font-bold text-ink">{r.name}</h4>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-ink-400">
                <Clock size={12} /> <span>{FREQ_LABEL[r.frequency]}</span>
              </div>
              <div className="flex items-start gap-2 text-ink-400">
                <Envelope size={12} className="mt-1 shrink-0" />
                <span className="break-all text-xs">{r.recipients.join(", ") || "No recipients"}</span>
              </div>
              {r.last_sent && (
                <div className="text-[11px] text-ink-300 font-num pt-1">
                  Last sent {new Date(r.last_sent).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Schedule a report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Report name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly performance" data-testid="report-name-input" />
            </Field>
            <Field label="Frequency">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm bg-white"
                data-testid="report-frequency-select"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>
            <Field label="Recipients (comma separated)">
              <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="client@brand.com, you@agency.com" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} data-testid="report-submit-btn">Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-ink-400">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

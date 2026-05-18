import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, ShieldStar, User } from "@phosphor-icons/react";
import { toast } from "sonner";

const ROLE_BADGE = {
  super_admin: "bg-ink text-white border-ink",
  manager: "bg-info/10 text-info border-info/30",
  client: "bg-ink-100 text-ink-400 border-ink-200",
};

export default function AdminUsers() {
  const { workspaces } = useAuth();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [wsId, setWsId] = useState("");
  const [role, setRole] = useState("manager");

  const load = async () => {
    const { data } = await api.get("/admin/users");
    setUsers(data);
  };
  useEffect(() => { load(); }, []);

  const assign = async () => {
    try {
      await api.post("/workspaces/members", { workspace_id: wsId, user_email: email, role });
      toast.success("Member assigned");
      setOpen(false); setEmail(""); setWsId(""); setRole("manager");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-5" data-testid="admin-users-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Super admin</div>
          <h2 className="font-display font-bold text-xl mt-0.5">User management</h2>
        </div>
        <Button onClick={() => { setOpen(true); setWsId(workspaces[0]?.workspace_id || ""); }} className="bg-ink text-white hover:bg-ink-500" data-testid="assign-member-btn">
          <Plus size={14} className="mr-1.5" /> Assign to brand
        </Button>
      </div>

      <div className="bg-white border border-ink-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-200">
            <tr className="text-[10px] uppercase tracking-wider text-ink-400">
              <th className="px-5 py-2.5 text-left font-semibold">User</th>
              <th className="px-5 py-2.5 text-left font-semibold">Email</th>
              <th className="px-5 py-2.5 text-left font-semibold">Role</th>
              <th className="px-5 py-2.5 text-left font-semibold">Provider</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-b border-ink-200 last:border-0 hover:bg-ink-50/60">
                <td className="px-5 py-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-ink-500 text-white flex items-center justify-center text-[11px] font-bold">
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="font-medium text-ink">{u.name}</span>
                </td>
                <td className="px-5 py-3 text-ink-400 font-num text-xs">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${ROLE_BADGE[u.role]}`}>
                    {u.role === "super_admin" ? <ShieldStar size={11} weight="fill" /> : <User size={11} weight="fill" />}
                    {u.role.replace("_", " ")}
                  </span>
                </td>
                <td className="px-5 py-3 text-ink-400 text-xs uppercase tracking-wider">{u.auth_provider}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Assign user to brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-400">User email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email.com" className="mt-1" data-testid="assign-email-input" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-400">Brand</label>
              <select
                value={wsId}
                onChange={(e) => setWsId(e.target.value)}
                className="w-full mt-1 border border-ink-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {workspaces.map((w) => <option key={w.workspace_id} value={w.workspace_id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-400">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full mt-1 border border-ink-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="manager">Manager (full access)</option>
                <option value="client">Client (view only)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={assign} data-testid="assign-submit-btn">Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

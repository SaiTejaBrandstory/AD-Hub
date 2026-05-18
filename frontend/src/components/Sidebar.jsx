import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Gauge, ChartLineUp, MegaphoneSimple, PlugsConnected, Sparkle,
  Bell, FileText, UsersThree, SignOut, CaretUpDown, Check, Plus,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Overview", icon: Gauge },
  { to: "/campaigns", label: "Campaigns", icon: MegaphoneSimple },
  { to: "/analytics", label: "Analytics", icon: ChartLineUp },
  { to: "/accounts", label: "Ad Accounts", icon: PlugsConnected },
  { to: "/audit", label: "AI Audit", icon: Sparkle },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/reports", label: "Reports", icon: FileText },
];

export default function Sidebar() {
  const { user, workspaces, activeWorkspaceId, switchWorkspace, logout, refreshWorkspaces } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const navigate = useNavigate();

  const active = workspaces.find((w) => w.workspace_id === activeWorkspaceId);

  const createWs = async () => {
    if (!name.trim()) return;
    try {
      const { data } = await api.post("/workspaces", { name, industry });
      await refreshWorkspaces();
      switchWorkspace(data.workspace_id);
      setOpen(false); setName(""); setIndustry("");
      toast.success("Brand created");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  return (
    <aside className="w-64 shrink-0 bg-ink-50 border-r border-ink-200 flex flex-col h-screen sticky top-0"
           data-testid="app-sidebar">
      {/* Brand mark */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-ink flex items-center justify-center">
            <div className="w-3 h-3 rounded-sm bg-white" />
          </div>
          <span className="font-display font-bold text-[17px] tracking-tight text-ink">AdHub</span>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild data-testid="workspace-switcher">
            <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 transition-all text-left">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-ink to-ink-500 flex items-center justify-center text-white text-xs font-bold">
                {active?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink truncate">
                  {active?.name || "Select brand"}
                </div>
                <div className="text-[11px] text-ink-400 truncate">
                  {active?.industry || "No brand selected"}
                </div>
              </div>
              <CaretUpDown size={14} className="text-ink-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-ink-400">
              Brands
            </DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.workspace_id}
                onClick={() => switchWorkspace(w.workspace_id)}
                data-testid={`workspace-option-${w.workspace_id}`}
                className="flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded bg-ink-100 flex items-center justify-center text-[10px] font-bold text-ink">
                  {w.name[0]}
                </div>
                <div className="flex-1 truncate">{w.name}</div>
                {w.workspace_id === activeWorkspaceId && <Check size={14} />}
              </DropdownMenuItem>
            ))}
            {user?.role !== "client" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setOpen(true)} data-testid="new-workspace-btn">
                  <Plus size={14} className="mr-2" /> New brand
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400 px-3 mb-1.5 mt-2">
          Workspace
        </div>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            data-testid={`nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <n.icon size={16} weight="regular" />
            {n.label}
          </NavLink>
        ))}

        {user?.role === "super_admin" && (
          <>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400 px-3 mb-1.5 mt-5">
              Admin
            </div>
            <NavLink
              to="/admin/users"
              data-testid="nav-admin-users"
              className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}
            >
              <UsersThree size={16} /> Users
            </NavLink>
          </>
        )}
      </nav>

      {/* User card */}
      <div className="border-t border-ink-200 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild data-testid="user-menu-trigger">
            <button className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white transition-all">
              <div className="w-8 h-8 rounded-full bg-ink-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                {user?.picture ? (
                  <img src={user.picture} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.name?.[0]?.toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[12px] font-semibold text-ink truncate">{user?.name}</div>
                <div className="text-[10px] text-ink-400 truncate uppercase tracking-wider">
                  {user?.role?.replace("_", " ")}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-ink-400">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => { await logout(); navigate("/login"); }}
              data-testid="logout-btn"
            >
              <SignOut size={14} className="mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New brand dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">New brand workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-400">Brand name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc."
                className="mt-1"
                data-testid="new-workspace-name"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-400">Industry</label>
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="DTC / Fashion / SaaS..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createWs} data-testid="new-workspace-submit">Create brand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

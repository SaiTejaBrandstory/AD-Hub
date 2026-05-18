import Sidebar from "./Sidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MagnifyingGlass, Bell } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const PAGE_TITLES = {
  "/dashboard": "Overview",
  "/campaigns": "Campaigns",
  "/analytics": "Analytics",
  "/accounts": "Ad Accounts",
  "/audit": "AI Audit",
  "/alerts": "Alerts",
  "/reports": "Reports",
  "/admin/users": "User Management",
};

export default function Layout() {
  const location = useLocation();
  const { workspaces, activeWorkspaceId } = useAuth();
  const active = workspaces.find((w) => w.workspace_id === activeWorkspaceId);
  const title = PAGE_TITLES[location.pathname] || PAGE_TITLES[Object.keys(PAGE_TITLES).find(k => location.pathname.startsWith(k))] || "AdHub";

  return (
    <div className="flex bg-white min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 glass-header h-14 flex items-center px-6 sm:px-8 justify-between"
                data-testid="app-header">
          <div className="flex items-center gap-3">
            <h1 className="font-display font-bold text-[20px] tracking-tight text-ink">{title}</h1>
            {active && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-ink-50 border border-ink-200 text-[11px] text-ink-400">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {active.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-50 border border-ink-200 text-ink-400 text-xs w-56">
              <MagnifyingGlass size={14} />
              <span>Search campaigns…</span>
              <kbd className="ml-auto font-num text-[10px] px-1.5 py-0.5 rounded bg-white border border-ink-200">⌘K</kbd>
            </div>
            <Link
              to="/alerts"
              className="w-9 h-9 rounded-lg border border-ink-200 bg-white hover:bg-ink-50 flex items-center justify-center transition-all"
              data-testid="header-alerts-btn"
            >
              <Bell size={16} />
            </Link>
          </div>
        </header>
        <div className="px-6 sm:px-8 py-6 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

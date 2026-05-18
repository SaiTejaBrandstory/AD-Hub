import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    localStorage.getItem("adhub_workspace") || null
  );

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      const ws = await api.get("/workspaces");
      setWorkspaces(ws.data);
      if (ws.data.length && !ws.data.find((w) => w.workspace_id === activeWorkspaceId)) {
        setActiveWorkspaceId(ws.data[0].workspace_id);
        localStorage.setItem("adhub_workspace", ws.data[0].workspace_id);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithPassword = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    const ws = await api.get("/workspaces");
    setWorkspaces(ws.data);
    if (ws.data.length) {
      setActiveWorkspaceId(ws.data[0].workspace_id);
      localStorage.setItem("adhub_workspace", ws.data[0].workspace_id);
    }
  };

  const register = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    setToken(data.token);
    setUser(data.user);
    const ws = await api.get("/workspaces");
    setWorkspaces(ws.data);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    localStorage.removeItem("adhub_workspace");
  };

  const switchWorkspace = (wid) => {
    setActiveWorkspaceId(wid);
    localStorage.setItem("adhub_workspace", wid);
  };

  const refreshWorkspaces = async () => {
    const ws = await api.get("/workspaces");
    setWorkspaces(ws.data);
    return ws.data;
  };

  const value = {
    user, setUser, loading, workspaces, setWorkspaces,
    activeWorkspaceId, switchWorkspace, refreshWorkspaces,
    loginWithPassword, register, logout, checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  const { checkAuth } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { navigate("/login"); return; }
    const sessionId = m[1];

    (async () => {
      try {
        await api.post("/auth/google/session", {}, {
          headers: { "X-Session-ID": sessionId },
        });
        await checkAuth();
        window.history.replaceState({}, document.title, "/dashboard");
        navigate("/dashboard");
      } catch (e) {
        console.error("OAuth callback failed", e);
        navigate("/login");
      }
    })();
  }, [navigate, checkAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-ink-200 border-t-ink rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-ink-400">Signing you in...</p>
      </div>
    </div>
  );
}

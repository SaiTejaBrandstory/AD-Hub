// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { GoogleLogo, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Login() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { loginWithPassword, register } = useAuth();
  const navigate = useNavigate();

  const handleGoogle = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await loginWithPassword(email, password);
      } else {
        await register(email, password, name);
      }
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (!err.response) {
        const apiUrl = process.env.REACT_APP_BACKEND_URL;
        if (!apiUrl) {
          toast.error(
            "API URL not set for production. In Vercel → Settings → Environment Variables, add REACT_APP_BACKEND_URL = your Render URL, then redeploy."
          );
        } else if (/localhost|127\.0\.0\.1/.test(apiUrl)) {
          toast.error(
            "Cannot reach the API. Start the backend on port 8000, then open the app at http://localhost:3000 (not 127.0.0.1)."
          );
        } else {
          toast.error(
            `Cannot reach the API at ${apiUrl}. Confirm Render is running, CORS_ORIGINS includes ${window.location.origin}, then redeploy both services.`
          );
        }
      } else {
        toast.error(
          typeof detail === "string" ? detail : Array.isArray(detail) ? detail[0]?.msg : "Authentication failed"
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (role) => {
    if (role === "admin") { setEmail("admin@adhub.com"); setPassword("admin123"); }
    if (role === "manager") { setEmail("manager@adhub.com"); setPassword("manager123"); }
    if (role === "client") { setEmail("client@northwind.com"); setPassword("client123"); }
    setMode("login");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left visual panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-ink text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }} />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-sm bg-ink" />
            </div>
            <span className="font-display font-bold text-lg">AdHub</span>
          </div>
        </div>
        <div className="relative space-y-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
            Agency Campaign Command
          </div>
          <h2 className="font-display font-black text-[44px] leading-[1.02] tracking-tight">
            Every brand.<br />
            Every channel.<br />
            <span className="text-white/50">One control room.</span>
          </h2>
          <p className="text-white/60 max-w-md leading-relaxed">
            Connect Meta Ads, Google Ads, and GA4 across all your clients.
            Audit, optimize, and report — without leaving the dashboard.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-sm pt-4">
            {[
              { k: "Brands", v: "Unlimited" },
              { k: "Channels", v: "3+" },
              { k: "AI audits", v: "Real-time" },
            ].map((s) => (
              <div key={s.k} className="border border-white/10 rounded-lg p-3">
                <div className="font-num text-lg font-bold">{s.v}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-[11px] text-white/40">
          © 2026 AdHub. Built for agencies who refuse to switch tabs.
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-ink flex items-center justify-center">
              <div className="w-3 h-3 rounded-sm bg-white" />
            </div>
            <span className="font-display font-bold text-lg">AdHub</span>
          </div>

          <div className="text-[10px] uppercase tracking-[0.25em] text-ink-400 mb-3">
            {mode === "login" ? "Welcome back" : "Get started"}
          </div>
          <h1 className="font-display font-black text-3xl tracking-tight text-ink mb-8">
            {mode === "login" ? "Sign in to AdHub" : "Create your account"}
          </h1>

          <Button
            variant="outline"
            className="w-full h-11 mb-4 font-medium border-ink-200 hover:bg-ink-50"
            onClick={handleGoogle}
            data-testid="google-login-btn"
          >
            <GoogleLogo size={18} weight="bold" className="mr-2" />
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-ink-200" />
            <span className="text-[10px] uppercase tracking-widest text-ink-400">or</span>
            <div className="flex-1 h-px bg-ink-200" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="text-xs text-ink-400 uppercase tracking-wider">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 h-11"
                  data-testid="signup-name-input"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-ink-400 uppercase tracking-wider">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 h-11"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <label className="text-xs text-ink-400 uppercase tracking-wider">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 h-11"
                data-testid="login-password-input"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full h-11 bg-ink text-white hover:bg-ink-500"
              data-testid="login-submit-button"
            >
              {busy ? "Please wait..." : (mode === "login" ? "Sign in" : "Create account")}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </form>

          <div className="mt-5 text-sm text-ink-400 text-center">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-ink font-medium hover:underline" data-testid="switch-to-signup">
                  Sign up
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-ink font-medium hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>

          <div className="mt-8 p-3.5 rounded-lg bg-ink-50 border border-ink-200">
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400 mb-2">Demo accounts</div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => fillDemo("admin")} className="text-[11px] px-2 py-1 rounded-md bg-white border border-ink-200 hover:bg-ink hover:text-white transition-all" data-testid="demo-admin-btn">
                Super Admin
              </button>
              <button onClick={() => fillDemo("manager")} className="text-[11px] px-2 py-1 rounded-md bg-white border border-ink-200 hover:bg-ink hover:text-white transition-all" data-testid="demo-manager-btn">
                Manager
              </button>
              <button onClick={() => fillDemo("client")} className="text-[11px] px-2 py-1 rounded-md bg-white border border-ink-200 hover:bg-ink hover:text-white transition-all" data-testid="demo-client-btn">
                Client
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

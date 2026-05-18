import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallback from "./components/AuthCallback";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Accounts from "./pages/Accounts";
import Audit from "./pages/Audit";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import Analytics from "./pages/Analytics";
import AdminUsers from "./pages/AdminUsers";
import Datasets from "./pages/Datasets";
import DatasetDetail from "./pages/DatasetDetail";
import Intelligence from "./pages/Intelligence";
import { Toaster } from "./components/ui/sonner";

function AppRouter() {
  const location = useLocation();
  // Synchronous detect of OAuth redirect (must run during render to win race with AuthProvider)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/datasets" element={<Datasets />} />
        <Route path="/datasets/:id" element={<DatasetDetail />} />
        <Route path="/admin/users" element={<AdminUsers />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

"""AdHub Backend API Tests - comprehensive coverage of auth, RBAC, CRUD, AI, analytics."""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / '.env')

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
if not BASE_URL:
    # fallback to frontend env
    fe_env = Path('/app/frontend/.env')
    for line in fe_env.read_text().splitlines():
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
            break

API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@adhub.com", "password": "admin123"}
MGR = {"email": "manager@adhub.com", "password": "manager123"}
CLIENT = {"email": "client@northwind.com", "password": "client123"}


# ---------- shared session state ----------
state = {}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ============ AUTH ============
class TestAuth:
    def test_login_admin(self):
        data = _login(ADMIN)
        assert "token" in data and data["user"]["email"] == ADMIN["email"]
        assert data["user"]["role"] == "super_admin"
        state["admin_token"] = data["token"]
        state["admin_user_id"] = data["user"]["user_id"]

    def test_login_manager(self):
        data = _login(MGR)
        assert data["user"]["role"] == "manager"
        state["mgr_token"] = data["token"]

    def test_login_client(self):
        data = _login(CLIENT)
        assert data["user"]["role"] == "client"
        state["client_token"] = data["token"]

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@adhub.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_admin(self):
        r = requests.get(f"{API}/auth/me", headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN["email"]
        assert body["role"] == "super_admin"

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_new_user(self):
        email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "pw12345", "name": "TEST User"
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["role"] == "manager"
        assert "token" in body
        state["new_user_email"] = email
        state["new_user_token"] = body["token"]

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": ADMIN["email"], "password": "x", "name": "x"
        })
        assert r.status_code == 400

    def test_logout(self):
        r = requests.post(f"{API}/auth/logout")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_google_session_missing_header(self):
        r = requests.post(f"{API}/auth/google/session")
        assert r.status_code == 400

    def test_google_session_bogus_header(self):
        r = requests.post(f"{API}/auth/google/session", headers={"X-Session-ID": "bogus_xyz"})
        assert r.status_code == 401


# ============ WORKSPACES ============
class TestWorkspaces:
    def test_admin_lists_3_workspaces(self):
        r = requests.get(f"{API}/workspaces", headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        ws = r.json()
        assert len(ws) >= 3
        names = {w["name"] for w in ws}
        assert {"Northwind Apparel", "Aurora Coffee Co.", "Helix Fitness"}.issubset(names)
        state["workspaces"] = ws
        for w in ws:
            if w["name"] == "Northwind Apparel":
                state["northwind_id"] = w["workspace_id"]
        state["any_ws_id"] = ws[0]["workspace_id"]

    def test_manager_lists_all_3(self):
        r = requests.get(f"{API}/workspaces", headers=_hdr(state["mgr_token"]))
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_client_sees_only_northwind(self):
        r = requests.get(f"{API}/workspaces", headers=_hdr(state["client_token"]))
        assert r.status_code == 200
        ws = r.json()
        assert len(ws) == 1
        assert ws[0]["name"] == "Northwind Apparel"

    def test_create_workspace(self):
        name = f"TEST Brand {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/workspaces", headers=_hdr(state["admin_token"]),
                          json={"name": name, "industry": "Test"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == name
        assert "workspace_id" in body
        state["created_ws_id"] = body["workspace_id"]

        # verify persistence via list
        r2 = requests.get(f"{API}/workspaces", headers=_hdr(state["admin_token"]))
        names = [w["name"] for w in r2.json()]
        assert name in names

    def test_client_cannot_create_workspace(self):
        r = requests.post(f"{API}/workspaces", headers=_hdr(state["client_token"]),
                          json={"name": "TEST denied"})
        assert r.status_code == 403

    def test_add_member_super_admin_only(self):
        # admin can add
        r = requests.post(f"{API}/workspaces/members", headers=_hdr(state["admin_token"]),
                          json={"workspace_id": state["created_ws_id"],
                                "user_email": state["new_user_email"], "role": "manager"})
        assert r.status_code == 200
        # manager cannot
        r2 = requests.post(f"{API}/workspaces/members", headers=_hdr(state["mgr_token"]),
                           json={"workspace_id": state["created_ws_id"],
                                 "user_email": state["new_user_email"], "role": "manager"})
        assert r2.status_code == 403


# ============ AD ACCOUNTS ============
class TestAdAccounts:
    def test_list_for_northwind(self):
        r = requests.get(f"{API}/ad-accounts",
                         params={"workspace_id": state["northwind_id"]},
                         headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        accs = r.json()
        plats = {a["platform"] for a in accs}
        assert {"meta_ads", "google_ads", "ga4"}.issubset(plats)

    def test_connect_account_mock_oauth(self):
        r = requests.post(f"{API}/ad-accounts/connect", headers=_hdr(state["admin_token"]),
                          json={"workspace_id": state["northwind_id"], "platform": "meta_ads"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["platform"] == "meta_ads"
        assert body["status"] == "connected"
        assert body["external_id"]
        state["new_account_id"] = body["account_id"]

    def test_client_cannot_connect_other_brand(self):
        # find a non-Northwind workspace
        other = next(w for w in state["workspaces"] if w["name"] != "Northwind Apparel")
        r = requests.post(f"{API}/ad-accounts/connect", headers=_hdr(state["client_token"]),
                          json={"workspace_id": other["workspace_id"], "platform": "google_ads"})
        assert r.status_code == 403

    def test_disconnect_account(self):
        r = requests.delete(f"{API}/ad-accounts/{state['new_account_id']}",
                            headers=_hdr(state["admin_token"]))
        assert r.status_code == 200


# ============ CAMPAIGNS ============
class TestCampaigns:
    def test_list_campaigns_for_workspace(self):
        r = requests.get(f"{API}/campaigns",
                         params={"workspace_id": state["northwind_id"]},
                         headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        camps = r.json()
        assert len(camps) >= 4
        state["campaigns"] = camps
        state["campaign_id"] = camps[0]["campaign_id"]
        for c in camps:
            assert "spend" in c and "roas" in c and "ctr" in c

    def test_filter_by_platform(self):
        r = requests.get(f"{API}/campaigns",
                         params={"workspace_id": state["northwind_id"], "platform": "meta_ads"},
                         headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        camps = r.json()
        assert all(c["platform"] == "meta_ads" for c in camps)

    def test_filter_by_status(self):
        r = requests.get(f"{API}/campaigns",
                         params={"workspace_id": state["northwind_id"], "status_filter": "active"},
                         headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        assert all(c["status"] == "active" for c in r.json())

    def test_get_single_campaign(self):
        r = requests.get(f"{API}/campaigns/{state['campaign_id']}",
                         headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        assert r.json()["campaign_id"] == state["campaign_id"]

    def test_toggle_campaign_status(self):
        cid = state["campaign_id"]
        # set paused
        r = requests.patch(f"{API}/campaigns/{cid}/status",
                           headers=_hdr(state["admin_token"]), json={"status": "paused"})
        assert r.status_code == 200
        # verify
        g = requests.get(f"{API}/campaigns/{cid}", headers=_hdr(state["admin_token"]))
        assert g.json()["status"] == "paused"
        # toggle back
        r2 = requests.patch(f"{API}/campaigns/{cid}/status",
                            headers=_hdr(state["admin_token"]), json={"status": "active"})
        assert r2.status_code == 200
        g2 = requests.get(f"{API}/campaigns/{cid}", headers=_hdr(state["admin_token"]))
        assert g2.json()["status"] == "active"

    def test_client_rbac_campaigns(self):
        # client cannot access non-Northwind workspace
        other = next(w for w in state["workspaces"] if w["name"] != "Northwind Apparel")
        r = requests.get(f"{API}/campaigns",
                         params={"workspace_id": other["workspace_id"]},
                         headers=_hdr(state["client_token"]))
        assert r.status_code == 403


# ============ ANALYTICS ============
class TestAnalytics:
    def test_overview(self):
        r = requests.get(f"{API}/analytics/overview",
                         params={"workspace_id": state["northwind_id"]},
                         headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        b = r.json()
        for k in ("spend", "revenue", "roas", "ctr", "cpc", "conversions", "active_campaigns", "platforms"):
            assert k in b

    def test_timeseries(self):
        r = requests.get(f"{API}/analytics/timeseries",
                         params={"workspace_id": state["northwind_id"], "days": 14},
                         headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        series = r.json()
        assert isinstance(series, list) and len(series) == 14
        assert all("date" in p and "spend" in p for p in series)


# ============ ALERTS ============
class TestAlerts:
    def test_list_alerts(self):
        r = requests.get(f"{API}/alerts",
                         params={"workspace_id": state["northwind_id"]},
                         headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        alerts = r.json()
        assert len(alerts) >= 1
        assert all("severity" in a for a in alerts)


# ============ REPORTS ============
class TestReports:
    def test_create_and_list_report(self):
        r = requests.post(f"{API}/reports", headers=_hdr(state["admin_token"]),
                          json={"workspace_id": state["northwind_id"],
                                "name": "TEST Weekly Report",
                                "frequency": "weekly",
                                "recipients": ["test@example.com"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == "TEST Weekly Report"
        rid = body["report_id"]

        # list
        r2 = requests.get(f"{API}/reports",
                          params={"workspace_id": state["northwind_id"]},
                          headers=_hdr(state["admin_token"]))
        assert r2.status_code == 200
        ids = [x["report_id"] for x in r2.json()]
        assert rid in ids


# ============ ADMIN ============
class TestAdmin:
    def test_list_users_super_admin(self):
        r = requests.get(f"{API}/admin/users", headers=_hdr(state["admin_token"]))
        assert r.status_code == 200
        users = r.json()
        emails = [u["email"] for u in users]
        assert "admin@adhub.com" in emails
        # passwords excluded
        for u in users:
            assert "password_hash" not in u

    def test_list_users_forbidden_for_manager(self):
        r = requests.get(f"{API}/admin/users", headers=_hdr(state["mgr_token"]))
        assert r.status_code == 403


# ============ AI AUDIT ============
class TestAIAudit:
    def test_audit_returns_json(self):
        r = requests.post(f"{API}/ai/audit", headers=_hdr(state["admin_token"]),
                          json={"workspace_id": state["northwind_id"]}, timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "overall_score" in body
        assert "headline" in body
        assert "recommendations" in body
        assert isinstance(body["recommendations"], list)
        assert len(body["recommendations"]) >= 1
        for rec in body["recommendations"]:
            assert "title" in rec and "severity" in rec

    def test_audit_no_access(self):
        # client trying audit on non-Northwind
        other = next(w for w in state["workspaces"] if w["name"] != "Northwind Apparel")
        r = requests.post(f"{API}/ai/audit", headers=_hdr(state["client_token"]),
                          json={"workspace_id": other["workspace_id"]}, timeout=30)
        assert r.status_code == 403

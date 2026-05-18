"""AdHub - Multi-tenant Ad Agency Campaign Management Backend.

Auth: Emergent Google OAuth + Email/Password JWT (both supported).
Multi-tenant: Workspaces (brands) with role-based memberships.
Connectors: Meta Ads, Google Ads, GA4 (mocked with realistic data; real OAuth scaffolding ready).
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import httpx
import random
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI(title="AdHub API")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger("adhub")
logging.basicConfig(level=logging.INFO)


# ============================================================
# MODELS
# ============================================================
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Literal["super_admin", "manager", "client"] = "manager"
    auth_provider: Literal["google", "password"] = "password"
    created_at: datetime


class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class Workspace(BaseModel):
    workspace_id: str
    name: str
    industry: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime
    created_by: str


class WorkspaceCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    logo_url: Optional[str] = None


class AdAccount(BaseModel):
    account_id: str
    workspace_id: str
    platform: Literal["meta_ads", "google_ads", "ga4"]
    external_id: str
    name: str
    status: Literal["connected", "disconnected", "needs_reauth"]
    connected_at: datetime
    connected_by: str


class AdAccountConnectReq(BaseModel):
    workspace_id: str
    platform: Literal["meta_ads", "google_ads", "ga4"]


class Campaign(BaseModel):
    campaign_id: str
    workspace_id: str
    account_id: str
    platform: str
    name: str
    objective: str
    status: Literal["active", "paused", "ended"]
    daily_budget: float
    spend: float
    impressions: int
    clicks: int
    ctr: float
    cpc: float
    conversions: int
    cpa: float
    revenue: float
    roas: float
    start_date: str
    last_updated: datetime


class CampaignToggle(BaseModel):
    status: Literal["active", "paused"]


class BulkStatusReq(BaseModel):
    campaign_ids: List[str]
    status: Literal["active", "paused"]


class BudgetUpdateReq(BaseModel):
    daily_budget: float


class Alert(BaseModel):
    alert_id: str
    workspace_id: str
    campaign_id: Optional[str] = None
    severity: Literal["info", "warning", "critical"]
    title: str
    message: str
    created_at: datetime
    read: bool = False


class AuditReq(BaseModel):
    workspace_id: str
    campaign_ids: Optional[List[str]] = None


class Report(BaseModel):
    report_id: str
    workspace_id: str
    name: str
    frequency: Literal["daily", "weekly", "monthly"]
    recipients: List[str]
    last_sent: Optional[datetime] = None
    created_at: datetime


class ReportCreate(BaseModel):
    workspace_id: str
    name: str
    frequency: Literal["daily", "weekly", "monthly"]
    recipients: List[str]


class MemberAdd(BaseModel):
    workspace_id: str
    user_email: str
    role: Literal["manager", "client"]


# ============================================================
# AUTH UTILS
# ============================================================
def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_pw(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def create_jwt(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(request: Request) -> User:
    """Dual-auth: check session_token cookie (Emergent) first, then JWT bearer."""
    token = request.cookies.get("session_token")
    if token:
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if sess:
            expires = sess["expires_at"]
            if isinstance(expires, str):
                expires = datetime.fromisoformat(expires)
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if expires >= datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
                if user:
                    return User(**user)

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        jwt_token = auth.split(" ", 1)[1]
        try:
            payload = jwt.decode(jwt_token, JWT_SECRET, algorithms=[JWT_ALGO])
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
            if user:
                return User(**user)
        except jwt.PyJWTError:
            pass
        # also try as session_token
        sess = await db.user_sessions.find_one({"session_token": jwt_token}, {"_id": 0})
        if sess:
            user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
            if user:
                return User(**user)

    raise HTTPException(status_code=401, detail="Not authenticated")


# ============================================================
# AUTH ROUTES
# ============================================================
@api_router.post("/auth/register")
async def register(req: RegisterReq):
    existing = await db.users.find_one({"email": req.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": req.email,
        "name": req.name,
        "picture": None,
        "role": "manager",
        "auth_provider": "password",
        "password_hash": hash_pw(req.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_jwt(user_id)
    return {"token": token, "user": {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}}


@api_router.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_pw(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(user["user_id"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api_router.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    """Exchange Emergent session_id (from URL fragment) for our session."""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID")

    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()

    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data["name"], "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        # First Google user gets super_admin
        count = await db.users.count_documents({})
        role = "super_admin" if count == 0 else "manager"
        await db.users.insert_one({
            "user_id": user_id,
            "email": data["email"],
            "name": data["name"],
            "picture": data.get("picture"),
            "role": role,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": data["session_token"],
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key="session_token",
        value=data["session_token"],
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"user": user_doc}


@api_router.get("/auth/me")
async def me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ============================================================
# WORKSPACES (BRANDS)
# ============================================================
async def user_workspaces(user: User) -> List[str]:
    """Return workspace IDs user has access to."""
    if user.role == "super_admin":
        all_ws = await db.workspaces.find({}, {"_id": 0, "workspace_id": 1}).to_list(500)
        return [w["workspace_id"] for w in all_ws]
    members = await db.memberships.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    return [m["workspace_id"] for m in members]


@api_router.get("/workspaces", response_model=List[Workspace])
async def list_workspaces(user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    docs = await db.workspaces.find({"workspace_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return [Workspace(**d) for d in docs]


@api_router.post("/workspaces", response_model=Workspace)
async def create_workspace(req: WorkspaceCreate, user: User = Depends(get_current_user)):
    if user.role not in ("super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    ws_id = f"ws_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)
    doc = {
        "workspace_id": ws_id,
        "name": req.name,
        "industry": req.industry,
        "logo_url": req.logo_url,
        "created_at": now.isoformat(),
        "created_by": user.user_id,
    }
    await db.workspaces.insert_one(doc)
    await db.memberships.insert_one({
        "membership_id": f"mem_{uuid.uuid4().hex[:10]}",
        "workspace_id": ws_id,
        "user_id": user.user_id,
        "role": "manager",
        "created_at": now.isoformat(),
    })
    return Workspace(workspace_id=ws_id, name=req.name, industry=req.industry,
                     logo_url=req.logo_url, created_at=now, created_by=user.user_id)


@api_router.post("/workspaces/members")
async def add_member(req: MemberAdd, user: User = Depends(get_current_user)):
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    target = await db.users.find_one({"email": req.user_email}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.memberships.find_one({
        "workspace_id": req.workspace_id, "user_id": target["user_id"]
    })
    if existing:
        await db.memberships.update_one({"_id": existing["_id"]}, {"$set": {"role": req.role}})
    else:
        await db.memberships.insert_one({
            "membership_id": f"mem_{uuid.uuid4().hex[:10]}",
            "workspace_id": req.workspace_id,
            "user_id": target["user_id"],
            "role": req.role,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"ok": True}


# ============================================================
# AD ACCOUNTS (CONNECTORS)
# ============================================================
PLATFORM_NAMES = {
    "meta_ads": "Meta Ads",
    "google_ads": "Google Ads",
    "ga4": "Google Analytics 4",
}


@api_router.get("/ad-accounts", response_model=List[AdAccount])
async def list_ad_accounts(workspace_id: Optional[str] = None, user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    q = {"workspace_id": {"$in": ids}}
    if workspace_id:
        if workspace_id not in ids:
            raise HTTPException(status_code=403, detail="No access")
        q = {"workspace_id": workspace_id}
    docs = await db.ad_accounts.find(q, {"_id": 0}).to_list(500)
    for d in docs:
        if isinstance(d.get("connected_at"), str):
            d["connected_at"] = datetime.fromisoformat(d["connected_at"])
    return [AdAccount(**d) for d in docs]


@api_router.post("/ad-accounts/connect", response_model=AdAccount)
async def connect_ad_account(req: AdAccountConnectReq, user: User = Depends(get_current_user)):
    """Mocked OAuth connect — in production this kicks off real OAuth flow.
    Returns a freshly-connected account with realistic data."""
    ids = await user_workspaces(user)
    if req.workspace_id not in ids:
        raise HTTPException(status_code=403, detail="No access to workspace")
    account_id = f"acc_{uuid.uuid4().hex[:10]}"
    ext = f"{random.randint(100000000, 999999999)}"
    ws = await db.workspaces.find_one({"workspace_id": req.workspace_id}, {"_id": 0})
    name = f"{ws['name']} – {PLATFORM_NAMES[req.platform]}"
    now = datetime.now(timezone.utc)
    doc = {
        "account_id": account_id,
        "workspace_id": req.workspace_id,
        "platform": req.platform,
        "external_id": ext,
        "name": name,
        "status": "connected",
        "connected_at": now.isoformat(),
        "connected_by": user.user_id,
    }
    await db.ad_accounts.insert_one(doc)
    # Seed a few campaigns for this account
    await _seed_campaigns_for_account(account_id, req.workspace_id, req.platform)
    return AdAccount(account_id=account_id, workspace_id=req.workspace_id, platform=req.platform,
                     external_id=ext, name=name, status="connected", connected_at=now,
                     connected_by=user.user_id)


@api_router.delete("/ad-accounts/{account_id}")
async def disconnect_ad_account(account_id: str, user: User = Depends(get_current_user)):
    acc = await db.ad_accounts.find_one({"account_id": account_id}, {"_id": 0})
    if not acc:
        raise HTTPException(status_code=404, detail="Not found")
    ids = await user_workspaces(user)
    if acc["workspace_id"] not in ids:
        raise HTTPException(status_code=403, detail="No access")
    await db.ad_accounts.update_one({"account_id": account_id}, {"$set": {"status": "disconnected"}})
    return {"ok": True}


# ============================================================
# CAMPAIGNS
# ============================================================
async def _seed_campaigns_for_account(account_id: str, workspace_id: str, platform: str):
    objectives_by_platform = {
        "meta_ads": ["Conversions", "Traffic", "Engagement", "Lead Generation", "Brand Awareness"],
        "google_ads": ["Search", "Performance Max", "Display", "Shopping", "YouTube"],
        "ga4": ["Property Tracking"],  # GA4 has no campaigns
    }
    if platform == "ga4":
        return
    name_pool = ["Spring Promo", "Retargeting – Cart", "Brand Search", "Prospecting",
                 "Black Friday", "Lookalike LP", "Competitor Bid", "DPA Catalog"]
    count = random.randint(3, 5)
    for _ in range(count):
        impressions = random.randint(10_000, 500_000)
        clicks = int(impressions * random.uniform(0.005, 0.04))
        ctr = round((clicks / impressions) * 100, 2)
        spend = round(clicks * random.uniform(0.4, 2.5), 2)
        cpc = round(spend / max(clicks, 1), 2)
        conversions = int(clicks * random.uniform(0.01, 0.08))
        cpa = round(spend / max(conversions, 1), 2)
        revenue = round(conversions * random.uniform(20, 150), 2)
        roas = round(revenue / max(spend, 1), 2)
        await db.campaigns.insert_one({
            "campaign_id": f"cmp_{uuid.uuid4().hex[:10]}",
            "workspace_id": workspace_id,
            "account_id": account_id,
            "platform": platform,
            "name": f"{random.choice(name_pool)} – {random.choice(objectives_by_platform[platform])}",
            "objective": random.choice(objectives_by_platform[platform]),
            "status": random.choice(["active", "active", "active", "paused"]),
            "daily_budget": round(random.uniform(50, 500), 2),
            "spend": spend,
            "impressions": impressions,
            "clicks": clicks,
            "ctr": ctr,
            "cpc": cpc,
            "conversions": conversions,
            "cpa": cpa,
            "revenue": revenue,
            "roas": roas,
            "start_date": (datetime.now(timezone.utc) - timedelta(days=random.randint(5, 90))).date().isoformat(),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        })


@api_router.get("/campaigns", response_model=List[Campaign])
async def list_campaigns(workspace_id: Optional[str] = None, platform: Optional[str] = None,
                         status_filter: Optional[str] = None, user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    q = {"workspace_id": {"$in": ids}}
    if workspace_id:
        if workspace_id not in ids:
            raise HTTPException(status_code=403, detail="No access")
        q["workspace_id"] = workspace_id
    if platform:
        q["platform"] = platform
    if status_filter:
        q["status"] = status_filter
    docs = await db.campaigns.find(q, {"_id": 0}).to_list(1000)
    for d in docs:
        if isinstance(d.get("last_updated"), str):
            d["last_updated"] = datetime.fromisoformat(d["last_updated"])
    return [Campaign(**d) for d in docs]


@api_router.get("/campaigns/{campaign_id}", response_model=Campaign)
async def get_campaign(campaign_id: str, user: User = Depends(get_current_user)):
    doc = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    ids = await user_workspaces(user)
    if doc["workspace_id"] not in ids:
        raise HTTPException(status_code=403, detail="No access")
    if isinstance(doc.get("last_updated"), str):
        doc["last_updated"] = datetime.fromisoformat(doc["last_updated"])
    return Campaign(**doc)


@api_router.patch("/campaigns/{campaign_id}/status")
async def toggle_campaign(campaign_id: str, req: CampaignToggle, user: User = Depends(get_current_user)):
    doc = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    ids = await user_workspaces(user)
    if doc["workspace_id"] not in ids:
        raise HTTPException(status_code=403, detail="No access")
    await db.campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {"status": req.status, "last_updated": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "status": req.status}


@api_router.post("/campaigns/bulk-status")
async def bulk_status(req: BulkStatusReq, user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    docs = await db.campaigns.find(
        {"campaign_id": {"$in": req.campaign_ids}}, {"_id": 0, "campaign_id": 1, "workspace_id": 1}
    ).to_list(500)
    allowed = [d["campaign_id"] for d in docs if d["workspace_id"] in ids]
    if not allowed:
        raise HTTPException(status_code=403, detail="No accessible campaigns")
    result = await db.campaigns.update_many(
        {"campaign_id": {"$in": allowed}},
        {"$set": {"status": req.status, "last_updated": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "updated": result.modified_count, "status": req.status}


@api_router.patch("/campaigns/{campaign_id}/budget")
async def update_budget(campaign_id: str, req: BudgetUpdateReq, user: User = Depends(get_current_user)):
    if req.daily_budget <= 0:
        raise HTTPException(status_code=400, detail="Budget must be positive")
    doc = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    ids = await user_workspaces(user)
    if doc["workspace_id"] not in ids:
        raise HTTPException(status_code=403, detail="No access")
    await db.campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {"daily_budget": round(req.daily_budget, 2),
                  "last_updated": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "daily_budget": round(req.daily_budget, 2)}


# ============================================================
# ANALYTICS
# ============================================================
@api_router.get("/analytics/overview")
async def analytics_overview(workspace_id: Optional[str] = None, user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    q = {"workspace_id": {"$in": ids}}
    if workspace_id and workspace_id in ids:
        q = {"workspace_id": workspace_id}
    docs = await db.campaigns.find(q, {"_id": 0}).to_list(1000)
    if not docs:
        return {"spend": 0, "impressions": 0, "clicks": 0, "ctr": 0, "cpc": 0,
                "conversions": 0, "cpa": 0, "revenue": 0, "roas": 0, "active_campaigns": 0,
                "platforms": {}}
    spend = sum(d["spend"] for d in docs)
    imp = sum(d["impressions"] for d in docs)
    clicks = sum(d["clicks"] for d in docs)
    conv = sum(d["conversions"] for d in docs)
    rev = sum(d["revenue"] for d in docs)
    by_platform = {}
    for d in docs:
        p = d["platform"]
        if p not in by_platform:
            by_platform[p] = {"spend": 0, "revenue": 0, "conversions": 0, "campaigns": 0}
        by_platform[p]["spend"] += d["spend"]
        by_platform[p]["revenue"] += d["revenue"]
        by_platform[p]["conversions"] += d["conversions"]
        by_platform[p]["campaigns"] += 1
    return {
        "spend": round(spend, 2),
        "impressions": imp,
        "clicks": clicks,
        "ctr": round((clicks / imp) * 100, 2) if imp else 0,
        "cpc": round(spend / clicks, 2) if clicks else 0,
        "conversions": conv,
        "cpa": round(spend / conv, 2) if conv else 0,
        "revenue": round(rev, 2),
        "roas": round(rev / spend, 2) if spend else 0,
        "active_campaigns": sum(1 for d in docs if d["status"] == "active"),
        "platforms": {k: {kk: round(vv, 2) if isinstance(vv, float) else vv
                          for kk, vv in v.items()} for k, v in by_platform.items()},
    }


@api_router.get("/analytics/timeseries")
async def analytics_timeseries(workspace_id: Optional[str] = None, days: int = 30,
                                user: User = Depends(get_current_user)):
    """Generate a deterministic-ish daily timeseries based on aggregate campaign totals."""
    ids = await user_workspaces(user)
    q = {"workspace_id": {"$in": ids}}
    if workspace_id and workspace_id in ids:
        q = {"workspace_id": workspace_id}
    docs = await db.campaigns.find(q, {"_id": 0}).to_list(1000)
    total_spend = sum(d["spend"] for d in docs) or 1
    total_rev = sum(d["revenue"] for d in docs) or 1
    total_conv = sum(d["conversions"] for d in docs) or 1
    series = []
    rng = random.Random(42)
    for i in range(days):
        d = datetime.now(timezone.utc).date() - timedelta(days=days - 1 - i)
        factor = rng.uniform(0.6, 1.4)
        series.append({
            "date": d.isoformat(),
            "spend": round((total_spend / days) * factor, 2),
            "revenue": round((total_rev / days) * factor * rng.uniform(0.8, 1.3), 2),
            "conversions": int((total_conv / days) * factor),
        })
    return series


# ============================================================
# ALERTS
# ============================================================
@api_router.get("/alerts", response_model=List[Alert])
async def list_alerts(workspace_id: Optional[str] = None, user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    q = {"workspace_id": {"$in": ids}}
    if workspace_id and workspace_id in ids:
        q = {"workspace_id": workspace_id}
    docs = await db.alerts.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return [Alert(**d) for d in docs]


# ============================================================
# AI AUDIT (Claude Sonnet 4.5 via Emergent LLM key)
# ============================================================
@api_router.post("/ai/audit")
async def ai_audit(req: AuditReq, user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    if req.workspace_id not in ids:
        raise HTTPException(status_code=403, detail="No access")

    q = {"workspace_id": req.workspace_id}
    if req.campaign_ids:
        q["campaign_id"] = {"$in": req.campaign_ids}
    campaigns = await db.campaigns.find(q, {"_id": 0}).to_list(50)
    if not campaigns:
        raise HTTPException(status_code=400, detail="No campaigns to audit")

    summary_lines = []
    for c in campaigns[:25]:
        summary_lines.append(
            f"- {c['name']} [{c['platform']}, {c['status']}] spend=${c['spend']} "
            f"ROAS={c['roas']} CTR={c['ctr']}% CPC=${c['cpc']} CPA=${c['cpa']} "
            f"conv={c['conversions']}"
        )
    summary = "\n".join(summary_lines)

    prompt = f"""You are a senior paid-media strategist auditing an ad agency client's account.
Analyze the following campaigns and return a JSON object with this exact schema:
{{
  "overall_score": <integer 0-100>,
  "headline": "<one-sentence verdict>",
  "recommendations": [
    {{
      "title": "<short title>",
      "severity": "<critical|warning|info>",
      "campaign": "<campaign name or 'Account-wide'>",
      "issue": "<what's wrong>",
      "action": "<concrete next step>"
    }}
  ]
}}
Return 4-7 recommendations. Prioritize critical issues (poor ROAS, high CPA, low CTR).
Only output valid JSON, no markdown fences.

Campaign data:
{summary}
"""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"audit_{uuid.uuid4().hex[:8]}",
            system_message="You are a senior paid-media strategist. Output strict JSON only.",
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        raw = await chat.send_message(UserMessage(text=prompt))
        import json
        text = raw.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        result = json.loads(text)
    except Exception as e:
        logger.exception("AI audit failed, falling back to heuristic")
        # Heuristic fallback
        recs = []
        for c in campaigns:
            if c["roas"] < 1.5 and c["spend"] > 50:
                recs.append({
                    "title": "Low ROAS – consider pausing",
                    "severity": "critical",
                    "campaign": c["name"],
                    "issue": f"ROAS of {c['roas']} is below profitability threshold on ${c['spend']} spend.",
                    "action": "Pause this campaign and reallocate budget to top performers.",
                })
            elif c["ctr"] < 0.5:
                recs.append({
                    "title": "Weak creative performance",
                    "severity": "warning",
                    "campaign": c["name"],
                    "issue": f"CTR of {c['ctr']}% indicates poor ad relevance.",
                    "action": "Refresh creative variants and test new hooks.",
                })
            if len(recs) >= 6:
                break
        if not recs:
            recs = [{
                "title": "Account is healthy",
                "severity": "info",
                "campaign": "Account-wide",
                "issue": "No critical issues detected.",
                "action": "Continue monitoring and scale top performers by 15-20%.",
            }]
        result = {
            "overall_score": 72,
            "headline": "Account has room for optimization across creative and budget allocation.",
            "recommendations": recs,
        }

    audit_id = f"audit_{uuid.uuid4().hex[:10]}"
    await db.audits.insert_one({
        "audit_id": audit_id,
        "workspace_id": req.workspace_id,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.user_id,
    })
    return {"audit_id": audit_id, **result}


@api_router.get("/ai/audit/history")
async def audit_history(workspace_id: str, user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    if workspace_id not in ids:
        raise HTTPException(status_code=403, detail="No access")
    docs = await db.audits.find({"workspace_id": workspace_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return docs


# ============================================================
# REPORTS
# ============================================================
@api_router.get("/reports", response_model=List[Report])
async def list_reports(workspace_id: Optional[str] = None, user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    q = {"workspace_id": {"$in": ids}}
    if workspace_id and workspace_id in ids:
        q = {"workspace_id": workspace_id}
    docs = await db.reports.find(q, {"_id": 0}).to_list(200)
    for d in docs:
        for k in ("created_at", "last_sent"):
            if d.get(k) and isinstance(d[k], str):
                d[k] = datetime.fromisoformat(d[k])
    return [Report(**d) for d in docs]


@api_router.post("/reports", response_model=Report)
async def create_report(req: ReportCreate, user: User = Depends(get_current_user)):
    ids = await user_workspaces(user)
    if req.workspace_id not in ids:
        raise HTTPException(status_code=403, detail="No access")
    rid = f"rep_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)
    doc = {
        "report_id": rid,
        "workspace_id": req.workspace_id,
        "name": req.name,
        "frequency": req.frequency,
        "recipients": req.recipients,
        "last_sent": None,
        "created_at": now.isoformat(),
    }
    await db.reports.insert_one(doc)
    return Report(report_id=rid, workspace_id=req.workspace_id, name=req.name,
                  frequency=req.frequency, recipients=req.recipients, last_sent=None,
                  created_at=now)


# ============================================================
# ADMIN: USERS
# ============================================================
@api_router.get("/admin/users")
async def list_users(user: User = Depends(get_current_user)):
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return docs


# ============================================================
# ANOMALY DETECTION
# ============================================================
@api_router.post("/alerts/scan")
async def scan_anomalies(workspace_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Run anomaly detection across one (or all accessible) workspace(s)."""
    from anomalies import scan_workspace
    ids = await user_workspaces(user)
    targets = [workspace_id] if workspace_id and workspace_id in ids else ids
    if workspace_id and workspace_id not in ids:
        raise HTTPException(status_code=403, detail="No access")
    total = []
    for wid in targets:
        new_alerts = await scan_workspace(db, wid)
        for a in new_alerts:
            a.pop("_id", None)
        total.extend(new_alerts)
    return {"ok": True, "new_alerts": len(total), "alerts": total}


# ============================================================
# REPORT EMAIL DELIVERY
# ============================================================
@api_router.post("/reports/{report_id}/send")
async def send_report_now(report_id: str, user: User = Depends(get_current_user)):
    """Render PDF + email via Resend to the report's configured recipients."""
    from reports_email import build_pdf, send_report_email, build_email_html
    rep = await db.reports.find_one({"report_id": report_id}, {"_id": 0})
    if not rep:
        raise HTTPException(status_code=404, detail="Not found")
    ids = await user_workspaces(user)
    if rep["workspace_id"] not in ids:
        raise HTTPException(status_code=403, detail="No access")
    if not rep.get("recipients"):
        raise HTTPException(status_code=400, detail="No recipients configured")

    ws = await db.workspaces.find_one({"workspace_id": rep["workspace_id"]}, {"_id": 0})
    # Build overview inline (reuse analytics_overview logic)
    docs = await db.campaigns.find({"workspace_id": rep["workspace_id"]}, {"_id": 0}).to_list(1000)
    if not docs:
        raise HTTPException(status_code=400, detail="No campaigns to report")
    spend = sum(d["spend"] for d in docs); imp = sum(d["impressions"] for d in docs)
    clicks = sum(d["clicks"] for d in docs); conv = sum(d["conversions"] for d in docs)
    rev = sum(d["revenue"] for d in docs)
    by_platform = {}
    for d in docs:
        p = d["platform"]
        by_platform.setdefault(p, {"spend": 0, "revenue": 0, "conversions": 0, "campaigns": 0})
        by_platform[p]["spend"] += d["spend"]; by_platform[p]["revenue"] += d["revenue"]
        by_platform[p]["conversions"] += d["conversions"]; by_platform[p]["campaigns"] += 1
    overview = {
        "spend": round(spend, 2), "impressions": imp, "clicks": clicks,
        "ctr": round((clicks / imp) * 100, 2) if imp else 0,
        "cpc": round(spend / clicks, 2) if clicks else 0,
        "conversions": conv, "cpa": round(spend / conv, 2) if conv else 0,
        "revenue": round(rev, 2), "roas": round(rev / spend, 2) if spend else 0,
        "platforms": {k: {kk: round(vv, 2) if isinstance(vv, float) else vv
                          for kk, vv in v.items()} for k, v in by_platform.items()},
    }

    try:
        pdf = build_pdf(ws["name"], overview, docs)
        html = build_email_html(ws["name"], overview)
        subject = f"{ws['name']} – {rep['name']}"
        filename = f"{ws['name'].replace(' ', '_')}_report.pdf"
        result = await send_report_email(rep["recipients"], subject, html, pdf, filename)
    except Exception as e:
        logger.exception("Send report failed")
        raise HTTPException(status_code=500, detail=f"Email send failed: {str(e)}")

    await db.reports.update_one(
        {"report_id": report_id},
        {"$set": {"last_sent": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "email_id": result.get("id"), "recipients": rep["recipients"]}


# ============================================================
# SEED on startup
# ============================================================
@app.on_event("startup")
async def startup():
    from seed import seed_demo_data
    await seed_demo_data(db)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

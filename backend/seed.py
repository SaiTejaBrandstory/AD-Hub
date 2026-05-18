"""Seed realistic demo data for AdHub MVP."""
import uuid
import random
import bcrypt
from datetime import datetime, timezone, timedelta


def _hash(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


async def seed_demo_data(db):
    if await db.users.count_documents({"email": "admin@adhub.com"}) > 0:
        return  # already seeded

    now = datetime.now(timezone.utc)

    # Super admin (email/password)
    admin_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": admin_id,
        "email": "admin@adhub.com",
        "name": "Agency Super Admin",
        "picture": None,
        "role": "super_admin",
        "auth_provider": "password",
        "password_hash": _hash("admin123"),
        "created_at": now.isoformat(),
    })

    # Manager
    mgr_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": mgr_id,
        "email": "manager@adhub.com",
        "name": "Maya Patel (Account Manager)",
        "picture": None,
        "role": "manager",
        "auth_provider": "password",
        "password_hash": _hash("manager123"),
        "created_at": now.isoformat(),
    })

    # Client
    client_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": client_id,
        "email": "client@northwind.com",
        "name": "Liam Chen (Client)",
        "picture": None,
        "role": "client",
        "auth_provider": "password",
        "password_hash": _hash("client123"),
        "created_at": now.isoformat(),
    })

    # 3 brand workspaces
    brands = [
        {"name": "Northwind Apparel", "industry": "Fashion & Apparel"},
        {"name": "Aurora Coffee Co.", "industry": "F&B / DTC"},
        {"name": "Helix Fitness", "industry": "Health & Fitness"},
    ]
    workspace_ids = []
    for b in brands:
        wid = f"ws_{uuid.uuid4().hex[:10]}"
        workspace_ids.append(wid)
        await db.workspaces.insert_one({
            "workspace_id": wid,
            "name": b["name"],
            "industry": b["industry"],
            "logo_url": None,
            "created_at": now.isoformat(),
            "created_by": admin_id,
        })
        # admin already implicit via super_admin role; add manager
        await db.memberships.insert_one({
            "membership_id": f"mem_{uuid.uuid4().hex[:10]}",
            "workspace_id": wid,
            "user_id": mgr_id,
            "role": "manager",
            "created_at": now.isoformat(),
        })

    # Client only sees Northwind
    await db.memberships.insert_one({
        "membership_id": f"mem_{uuid.uuid4().hex[:10]}",
        "workspace_id": workspace_ids[0],
        "user_id": client_id,
        "role": "client",
        "created_at": now.isoformat(),
    })

    # Connected ad accounts per brand (Meta + Google Ads + GA4)
    platforms = ["meta_ads", "google_ads", "ga4"]
    platform_names = {"meta_ads": "Meta Ads", "google_ads": "Google Ads", "ga4": "Google Analytics 4"}
    objectives = {
        "meta_ads": ["Conversions", "Traffic", "Engagement", "Lead Generation", "Brand Awareness"],
        "google_ads": ["Search", "Performance Max", "Display", "Shopping", "YouTube"],
    }
    campaign_names = ["Spring Promo", "Retargeting – Cart Abandoners", "Brand Search", "Prospecting LP",
                      "Black Friday Sale", "Lookalike – High LTV", "Competitor Conquest", "DPA Catalog",
                      "Cold Audience Test", "Email List Lookalike"]

    for wid, brand in zip(workspace_ids, brands):
        for plat in platforms:
            aid = f"acc_{uuid.uuid4().hex[:10]}"
            await db.ad_accounts.insert_one({
                "account_id": aid,
                "workspace_id": wid,
                "platform": plat,
                "external_id": str(random.randint(100000000, 999999999)),
                "name": f"{brand['name']} – {platform_names[plat]}",
                "status": "connected",
                "connected_at": now.isoformat(),
                "connected_by": admin_id,
            })
            if plat == "ga4":
                continue
            # 4-6 campaigns
            for _ in range(random.randint(4, 6)):
                impressions = random.randint(10_000, 800_000)
                clicks = int(impressions * random.uniform(0.005, 0.045))
                ctr = round((clicks / impressions) * 100, 2)
                spend = round(clicks * random.uniform(0.4, 2.8), 2)
                cpc = round(spend / max(clicks, 1), 2)
                conversions = int(clicks * random.uniform(0.005, 0.09))
                cpa = round(spend / max(conversions, 1), 2)
                revenue = round(conversions * random.uniform(25, 180), 2)
                roas = round(revenue / max(spend, 1), 2)
                await db.campaigns.insert_one({
                    "campaign_id": f"cmp_{uuid.uuid4().hex[:10]}",
                    "workspace_id": wid,
                    "account_id": aid,
                    "platform": plat,
                    "name": f"{random.choice(campaign_names)} – {random.choice(objectives[plat])}",
                    "objective": random.choice(objectives[plat]),
                    "status": random.choices(["active", "paused", "ended"], weights=[7, 2, 1])[0],
                    "daily_budget": round(random.uniform(50, 600), 2),
                    "spend": spend,
                    "impressions": impressions,
                    "clicks": clicks,
                    "ctr": ctr,
                    "cpc": cpc,
                    "conversions": conversions,
                    "cpa": cpa,
                    "revenue": revenue,
                    "roas": roas,
                    "start_date": (now - timedelta(days=random.randint(5, 90))).date().isoformat(),
                    "last_updated": now.isoformat(),
                })

    # Alerts
    alert_templates = [
        ("critical", "ROAS dropped below 1.0", "Campaign 'Black Friday Sale' ROAS fell to 0.7 in the last 24h."),
        ("warning", "CPC spike detected", "CPC increased 38% over last 3 days on Google Ads Search campaigns."),
        ("warning", "Daily budget exhausted early", "Meta campaign hit daily budget by 2pm — consider raising cap."),
        ("info", "New high-performer", "'Lookalike – High LTV' ROAS climbed to 4.2× — recommend scaling +20%."),
        ("info", "Audit completed", "Weekly AI audit generated 6 new recommendations."),
        ("critical", "Account disapproval risk", "Ad rejected for policy on Google Ads — review creative."),
    ]
    for wid in workspace_ids:
        sampled = random.sample(alert_templates, 4)
        for sev, title, msg in sampled:
            await db.alerts.insert_one({
                "alert_id": f"alrt_{uuid.uuid4().hex[:10]}",
                "workspace_id": wid,
                "campaign_id": None,
                "severity": sev,
                "title": title,
                "message": msg,
                "created_at": (now - timedelta(hours=random.randint(1, 72))).isoformat(),
                "read": False,
            })

    # A sample scheduled report per brand
    for wid, brand in zip(workspace_ids, brands):
        await db.reports.insert_one({
            "report_id": f"rep_{uuid.uuid4().hex[:10]}",
            "workspace_id": wid,
            "name": f"{brand['name']} – Weekly Performance",
            "frequency": "weekly",
            "recipients": ["client@northwind.com"],
            "last_sent": (now - timedelta(days=2)).isoformat(),
            "created_at": now.isoformat(),
        })

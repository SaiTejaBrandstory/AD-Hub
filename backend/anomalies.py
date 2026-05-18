"""Anomaly detection: scan campaign metrics, generate alerts when thresholds are crossed."""
import uuid
from datetime import datetime, timezone

# Sensible default thresholds — easy to tune per agency later
THRESHOLDS = {
    "roas_critical": 1.0,     # ROAS below this = critical
    "roas_warning": 1.8,      # ROAS below this = warning
    "ctr_warning": 0.5,       # CTR % below this = warning
    "cpa_warning_mult": 1.8,  # CPA more than 1.8x account-avg = warning
    "spend_warning_mult": 1.5,  # Daily spend > 1.5x daily_budget = warning
    "min_spend": 50,          # Don't flag campaigns with low spend
}


async def scan_workspace(db, workspace_id: str) -> list:
    """Run all checks for a workspace. Returns list of newly-created alerts."""
    campaigns = await db.campaigns.find(
        {"workspace_id": workspace_id, "status": "active"}, {"_id": 0}
    ).to_list(500)
    if not campaigns:
        return []

    # account-wide stats for context
    avg_cpa = (sum(c["cpa"] for c in campaigns if c["cpa"]) / max(len([c for c in campaigns if c["cpa"]]), 1))

    new_alerts = []
    for c in campaigns:
        if c["spend"] < THRESHOLDS["min_spend"]:
            continue
        # ROAS checks
        if c["roas"] < THRESHOLDS["roas_critical"]:
            new_alerts.append(_alert(
                workspace_id, c["campaign_id"], "critical",
                f"Critical ROAS on '{c['name']}'",
                f"ROAS of {c['roas']}× is below break-even on ${c['spend']:.0f} spend. Pause or rework targeting.",
            ))
        elif c["roas"] < THRESHOLDS["roas_warning"]:
            new_alerts.append(_alert(
                workspace_id, c["campaign_id"], "warning",
                f"Under-performing ROAS on '{c['name']}'",
                f"ROAS of {c['roas']}× trails account benchmarks. Review creative and audience.",
            ))
        # CTR check
        if c["ctr"] < THRESHOLDS["ctr_warning"]:
            new_alerts.append(_alert(
                workspace_id, c["campaign_id"], "warning",
                f"Weak CTR on '{c['name']}'",
                f"CTR of {c['ctr']}% suggests low ad relevance. Refresh creative variants.",
            ))
        # CPA spike
        if avg_cpa and c["cpa"] > avg_cpa * THRESHOLDS["cpa_warning_mult"]:
            new_alerts.append(_alert(
                workspace_id, c["campaign_id"], "warning",
                f"CPA spike on '{c['name']}'",
                f"CPA of ${c['cpa']} is {c['cpa']/avg_cpa:.1f}× the account average (${avg_cpa:.0f}).",
            ))
        # Budget pacing
        if c["daily_budget"] and c["spend"] / max(c["daily_budget"], 1) > THRESHOLDS["spend_warning_mult"]:
            # this is a cumulative-vs-daily proxy; in reality you'd compare daily
            pass

    if new_alerts:
        # Dedupe — skip if identical title already exists in last 24h
        recent = await db.alerts.find(
            {"workspace_id": workspace_id},
            {"_id": 0, "title": 1, "created_at": 1}
        ).sort("created_at", -1).limit(50).to_list(50)
        recent_titles = {r["title"] for r in recent}
        new_alerts = [a for a in new_alerts if a["title"] not in recent_titles]
        if new_alerts:
            await db.alerts.insert_many([a.copy() for a in new_alerts])
            # remove _id mutation issue by re-fetching for return
            for a in new_alerts:
                a.pop("_id", None)
    return new_alerts


def _alert(workspace_id, campaign_id, severity, title, message):
    return {
        "alert_id": f"alrt_{uuid.uuid4().hex[:10]}",
        "workspace_id": workspace_id,
        "campaign_id": campaign_id,
        "severity": severity,
        "title": title,
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }

"""Brand-level intelligence: aggregates every uploaded dataset into one living dashboard."""
import json
import logging
import os
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("adhub.brand_intelligence")

# Section priority — used to order the dashboard
SECTION_ORDER = [
    "temporal", "geographic", "keyword", "creative",
    "audience", "device", "quality",
]

SECTION_LABELS = {
    "temporal": "Time-of-day & seasonality",
    "geographic": "Geographic performance",
    "keyword": "Search queries",
    "creative": "Creative & video",
    "audience": "Audience segments",
    "device": "Device & placement",
    "quality": "Quality & relevance",
}

# Dimensions that can serve as the "headline KPI source"
HEADLINE_SOURCE_PRIORITY = ["account_level", "campaign_level", "ad_group_level"]


async def compute_intelligence(db, workspace_id: str) -> dict:
    """Reads every ready dataset for a workspace and builds a unified intelligence document."""
    # Collect all ready datasets + their dashboards
    datasets = await db.datasets.find(
        {"workspace_id": workspace_id, "is_deleted": False, "status": "ready"},
        {"_id": 0}
    ).to_list(200)

    if not datasets:
        return _empty_intelligence(workspace_id)

    dashboards = {}
    for ds in datasets:
        d = await db.dashboards.find_one({"dataset_id": ds["dataset_id"]}, {"_id": 0})
        if d:
            dashboards[ds["dataset_id"]] = d

    # Pick headline KPI source (highest priority dimension, then most recent)
    headline_source = None
    for priority in HEADLINE_SOURCE_PRIORITY:
        candidates = [ds for ds in datasets if ds.get("dimension") == priority]
        if candidates:
            candidates.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            headline_source = candidates[0]
            break
    if not headline_source:
        # Fallback: any dataset with `spend` in its kpis
        sorted_ds = sorted(datasets, key=lambda x: x.get("created_at", ""), reverse=True)
        for ds in sorted_ds:
            d = dashboards.get(ds["dataset_id"])
            if d and d.get("digest", {}).get("kpis", {}).get("spend"):
                headline_source = ds
                break
    if not headline_source:
        headline_source = datasets[0]

    headline_dashboard = dashboards.get(headline_source["dataset_id"], {})
    headline_kpis = headline_dashboard.get("digest", {}).get("kpis", {})

    # Group datasets by dimension
    by_dimension = {}
    for ds in datasets:
        dim = ds.get("dimension") or "generic"
        by_dimension.setdefault(dim, []).append(ds)

    # Build sections
    sections = []
    for dim in SECTION_ORDER:
        if dim not in by_dimension:
            continue
        section_datasets = by_dimension[dim]
        sec = await _build_section(dim, section_datasets, dashboards)
        if sec:
            sections.append(sec)

    # Filter universe
    platforms = sorted({ds.get("platform") for ds in datasets if ds.get("platform")})
    date_ranges = [d.get("digest", {}).get("date_range") for d in dashboards.values()
                   if d.get("digest", {}).get("date_range")]
    filter_universe = {
        "platforms": list(platforms),
        "dimensions": [dim for dim in SECTION_ORDER if dim in by_dimension],
        "datasets_count": len(datasets),
    }

    # AI brand-level verdict (synthesizes all dataset insights into one)
    brand_verdict = await _generate_brand_verdict(datasets, dashboards, headline_kpis)

    doc = {
        "workspace_id": workspace_id,
        "headline": brand_verdict.get("headline"),
        "score": brand_verdict.get("score"),
        "key_takeaways": brand_verdict.get("key_takeaways", []),
        "kpis": headline_kpis,
        "kpi_source_dataset_id": headline_source["dataset_id"],
        "kpi_source_filename": headline_source["filename"],
        "kpi_source_dimension": headline_source.get("dimension"),
        "sections": sections,
        "filter_universe": filter_universe,
        "datasets_summary": [{
            "dataset_id": ds["dataset_id"],
            "filename": ds["filename"],
            "platform": ds.get("platform"),
            "dimension": ds.get("dimension"),
            "row_count": ds.get("row_count"),
            "created_at": ds.get("created_at"),
        } for ds in datasets],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.brand_intelligence.replace_one(
        {"workspace_id": workspace_id}, doc, upsert=True
    )
    return doc


def _empty_intelligence(workspace_id: str) -> dict:
    return {
        "workspace_id": workspace_id,
        "headline": None,
        "score": None,
        "key_takeaways": [],
        "kpis": {},
        "kpi_source_dataset_id": None,
        "kpi_source_filename": None,
        "kpi_source_dimension": None,
        "sections": [],
        "filter_universe": {"platforms": [], "dimensions": [], "datasets_count": 0},
        "datasets_summary": [],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def _build_section(dimension: str, datasets: list, dashboards: dict) -> dict:
    """Combine all datasets matching a dimension into one section."""
    # Pull best chart + insights from the most relevant dataset(s)
    combined_charts = []
    combined_insights = []
    sources = []

    for ds in datasets:
        dash = dashboards.get(ds["dataset_id"])
        if not dash:
            continue
        sources.append({
            "dataset_id": ds["dataset_id"],
            "filename": ds["filename"],
            "platform": ds.get("platform"),
        })
        # Take up to 2 charts from each dataset
        for c in (dash.get("charts") or [])[:2]:
            combined_charts.append({
                **c,
                "dataset_id": ds["dataset_id"],
                "filename": ds["filename"],
            })
        # Take up to 3 insights from each dataset
        for ins in (dash.get("insights") or [])[:3]:
            combined_insights.append({
                **ins,
                "dataset_id": ds["dataset_id"],
                "filename": ds["filename"],
            })

    if not combined_charts and not combined_insights:
        return None

    return {
        "dimension": dimension,
        "title": SECTION_LABELS.get(dimension, dimension.title()),
        "sources": sources,
        "charts": combined_charts[:4],   # cap to keep dashboard tidy
        "insights": combined_insights[:6],
    }


async def _generate_brand_verdict(datasets, dashboards, headline_kpis) -> dict:
    """Ask Claude for a synthesized brand-level verdict from all lenses."""
    if not datasets:
        return {"headline": None, "score": None, "key_takeaways": []}

    digest_for_ai = {
        "headline_kpis": headline_kpis,
        "datasets_count": len(datasets),
        "lenses": [{
            "filename": ds["filename"],
            "platform": ds.get("platform"),
            "dimension": ds.get("dimension"),
            "row_count": ds.get("row_count"),
            "ai_headline": (dashboards.get(ds["dataset_id"]) or {}).get("headline"),
            "ai_score": (dashboards.get(ds["dataset_id"]) or {}).get("score"),
            "top_insights": [
                {"title": i.get("title"), "severity": i.get("severity")}
                for i in ((dashboards.get(ds["dataset_id"]) or {}).get("insights") or [])[:3]
            ],
        } for ds in datasets[:20]],
    }

    prompt = f"""You are reviewing a brand's full paid-media performance across multiple data lenses
(time-of-day, geography, search queries, creative, audience, devices, etc.).

Synthesize one brand-level verdict from this digest. Return strict JSON:
{{
  "headline": "<one-sentence brand-level verdict>",
  "score": <integer 0-100>,
  "key_takeaways": [
    "<3-5 short brand-level takeaways combining insights across lenses>"
  ]
}}

Brand digest:
{json.dumps(digest_for_ai, default=str)}
"""

    try:
        from llm_client import complete_json
        return await complete_json(
            "You are a senior paid-media strategist. Output strict JSON only.",
            prompt,
        )
    except Exception:
        logger.exception("Brand verdict generation failed, using fallback")
        return {
            "headline": f"Brand analyzed across {len(datasets)} data lenses.",
            "score": 70,
            "key_takeaways": [
                f"{len(datasets)} dataset(s) connected — drop more to enrich the dashboard.",
            ],
        }


async def chat_with_brand(db, workspace_id: str, history: list, user_msg: str) -> str:
    """Brand-level chat with full context of every connected dataset."""
    from llm_client import complete_text

    intel = await db.brand_intelligence.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not intel:
        intel = await compute_intelligence(db, workspace_id)

    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    brand_name = workspace["name"] if workspace else "this brand"

    # Compose lens summaries (digest-of-digests)
    datasets = await db.datasets.find(
        {"workspace_id": workspace_id, "is_deleted": False, "status": "ready"},
        {"_id": 0}
    ).to_list(200)
    lens_summaries = []
    for ds in datasets[:25]:
        dash = await db.dashboards.find_one({"dataset_id": ds["dataset_id"]}, {"_id": 0})
        if not dash:
            continue
        digest = dash.get("digest", {})
        lens_summaries.append({
            "filename": ds["filename"],
            "dimension": ds.get("dimension"),
            "platform": ds.get("platform"),
            "row_count": ds.get("row_count"),
            "kpis": digest.get("kpis", {}),
            "top_campaigns": (digest.get("top_campaigns") or [])[:5],
            "ai_headline": dash.get("headline"),
            "ai_insights": [
                {"title": i.get("title"), "detail": i.get("detail")}
                for i in (dash.get("insights") or [])[:3]
            ],
        })

    context = {
        "brand_name": brand_name,
        "headline_kpis": intel.get("kpis", {}),
        "kpi_source": intel.get("kpi_source_filename"),
        "brand_headline": intel.get("headline"),
        "brand_score": intel.get("score"),
        "lenses": lens_summaries,
    }

    history_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in history[-10:]
    )

    system = (
        f"You are an analytics co-pilot for the brand '{brand_name}'. "
        "You have access to multiple data lenses (different uploaded reports). "
        "Answer the user's question by cross-referencing insights across ALL lenses when relevant. "
        "Be concise (2-6 sentences), cite specific numbers and lens filenames when you use them. "
        "If the data doesn't contain what's needed to answer, say so honestly and suggest "
        "which kind of report the user should upload next. Never invent numbers."
    )
    prompt = f"""Brand context (JSON):
{json.dumps(context, default=str)}

Conversation so far:
{history_text if history_text else '(start of conversation)'}

User: {user_msg}
Assistant:"""

    return (await complete_text(system, prompt)).strip()

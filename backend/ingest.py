"""Dataset ingestion: parse CSV/XLSX, map columns, compute digest, generate AI dashboard."""
import io
import json
import logging
import os
import uuid
import pandas as pd
import numpy as np
from datetime import datetime, timezone

logger = logging.getLogger("adhub.ingest")

# ----- Platform templates (header signatures) -----
PLATFORM_TEMPLATES = {
    "meta_ads": {
        "name": "Meta Ads",
        "signatures": ["campaign name", "amount spent", "impressions", "cpc (cost per link click)",
                       "ctr (link click-through rate)", "purchases", "purchase roas"],
    },
    "google_ads": {
        "name": "Google Ads",
        "signatures": ["campaign", "cost", "impressions", "clicks", "ctr", "avg. cpc", "conversions"],
    },
    "ga4": {
        "name": "Google Analytics 4",
        "signatures": ["session source", "sessions", "engaged sessions", "engagement rate",
                       "conversions", "total revenue"],
    },
    "twitter_ads": {
        "name": "Twitter / X Ads",
        "signatures": ["campaign name", "spend", "impressions", "clicks", "engagement rate"],
    },
    "linkedin_ads": {
        "name": "LinkedIn Ads",
        "signatures": ["campaign name", "total spent", "impressions", "clicks",
                       "average ctr", "average cpm", "leads"],
    },
    "youtube_ads": {
        "name": "YouTube Ads",
        "signatures": ["campaign", "video views", "view rate", "cost", "impressions",
                       "average cpv", "conversions"],
    },
}


def detect_platform(headers: list) -> str:
    hl = [h.lower().strip() for h in headers]
    best = None
    best_score = 0
    for k, t in PLATFORM_TEMPLATES.items():
        score = sum(1 for sig in t["signatures"] if any(sig in h for h in hl))
        if score > best_score:
            best_score = score
            best = k
    return best if best_score >= 3 else "generic"


def parse_file(data: bytes, filename: str) -> pd.DataFrame:
    ext = filename.lower().rsplit(".", 1)[-1]
    buf = io.BytesIO(data)
    if ext in ("csv", "txt"):
        # Try utf-8 first, then latin-1
        for enc in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                buf.seek(0)
                return pd.read_csv(buf, encoding=enc, on_bad_lines="skip", low_memory=False)
            except UnicodeDecodeError:
                continue
        raise ValueError("Unable to decode CSV file")
    if ext in ("xlsx", "xlsm"):
        return pd.read_excel(buf, engine="openpyxl")
    if ext == "xls":
        return pd.read_excel(buf, engine="xlrd")
    raise ValueError(f"Unsupported file type: {ext}")


# ----- Column inference -----
COLUMN_HINTS = {
    "spend": ["spend", "cost", "amount spent", "total spent", "campaign cost"],
    "impressions": ["impressions", "impr", "impr."],
    "clicks": ["clicks", "link clicks", "all clicks"],
    "conversions": ["conversions", "purchases", "leads", "results", "all conversions"],
    "revenue": ["revenue", "purchases conversion value", "conv. value", "total revenue", "purchase value"],
    "ctr": ["ctr", "click-through rate", "click through rate"],
    "cpc": ["cpc", "cost per click", "avg cpc", "avg. cpc"],
    "cpm": ["cpm", "cost per 1,000 impressions", "average cpm"],
    "roas": ["roas", "return on ad spend", "purchase roas"],
    "date": ["date", "day", "reporting starts"],
    "campaign": ["campaign", "campaign name"],
    "platform": ["platform"],
}


def infer_columns(df: pd.DataFrame) -> dict:
    """Return mapping of canonical_field -> df column name."""
    cols = {c: c.lower().strip() for c in df.columns}
    mapping = {}
    for canon, hints in COLUMN_HINTS.items():
        for col, low in cols.items():
            if any(h == low or (len(h) > 3 and h in low) for h in hints):
                mapping[canon] = col
                break
    return mapping


def _safe_numeric(s: pd.Series) -> pd.Series:
    if s.dtype == object:
        # strip currency symbols and commas
        s = s.astype(str).str.replace(r"[\$,£€¥₹%]", "", regex=True).str.replace(",", "").str.strip()
        s = s.replace({"--": None, "-": None, "": None, "nan": None})
    return pd.to_numeric(s, errors="coerce")


def compute_digest(df: pd.DataFrame, mapping: dict) -> dict:
    """Compact summary of the dataset for AI + dashboard."""
    row_count = len(df)
    numeric_summary = {}
    totals = {}

    for canon, col in mapping.items():
        if canon in ("date", "campaign", "platform"):
            continue
        if col not in df.columns:
            continue
        num = _safe_numeric(df[col])
        if num.notna().sum() == 0:
            continue
        numeric_summary[canon] = {
            "sum": float(num.sum()),
            "mean": float(num.mean()),
            "max": float(num.max()),
            "min": float(num.min()),
            "median": float(num.median()),
        }
        if canon in ("spend", "impressions", "clicks", "conversions", "revenue"):
            totals[canon] = float(num.sum())

    # Derived KPIs
    kpis = {}
    if "spend" in totals: kpis["spend"] = round(totals["spend"], 2)
    if "revenue" in totals: kpis["revenue"] = round(totals["revenue"], 2)
    if "impressions" in totals: kpis["impressions"] = int(totals["impressions"])
    if "clicks" in totals: kpis["clicks"] = int(totals["clicks"])
    if "conversions" in totals: kpis["conversions"] = int(totals["conversions"])
    if "clicks" in totals and "impressions" in totals and totals["impressions"]:
        kpis["ctr"] = round((totals["clicks"] / totals["impressions"]) * 100, 2)
    if "spend" in totals and "clicks" in totals and totals["clicks"]:
        kpis["cpc"] = round(totals["spend"] / totals["clicks"], 2)
    if "revenue" in totals and "spend" in totals and totals["spend"]:
        kpis["roas"] = round(totals["revenue"] / totals["spend"], 2)
    if "spend" in totals and "conversions" in totals and totals["conversions"]:
        kpis["cpa"] = round(totals["spend"] / totals["conversions"], 2)

    # Top campaigns
    top_campaigns = []
    if "campaign" in mapping and "spend" in mapping:
        camp_col = mapping["campaign"]
        spend_col = mapping["spend"]
        tmp = df.copy()
        tmp[spend_col] = _safe_numeric(tmp[spend_col])
        if "revenue" in mapping: tmp["_rev"] = _safe_numeric(tmp[mapping["revenue"]])
        if "conversions" in mapping: tmp["_conv"] = _safe_numeric(tmp[mapping["conversions"]])
        agg = {spend_col: "sum"}
        if "_rev" in tmp.columns: agg["_rev"] = "sum"
        if "_conv" in tmp.columns: agg["_conv"] = "sum"
        grouped = tmp.groupby(camp_col, dropna=True).agg(agg).reset_index()
        grouped = grouped.sort_values(spend_col, ascending=False).head(10)
        for _, r in grouped.iterrows():
            entry = {"campaign": str(r[camp_col])[:80], "spend": round(float(r[spend_col]), 2)}
            if "_rev" in grouped.columns and pd.notna(r.get("_rev")):
                entry["revenue"] = round(float(r["_rev"]), 2)
                entry["roas"] = round(entry["revenue"] / max(entry["spend"], 1), 2)
            if "_conv" in grouped.columns and pd.notna(r.get("_conv")):
                entry["conversions"] = int(r["_conv"])
            top_campaigns.append(entry)

    # Time series (if date column exists)
    timeseries = []
    if "date" in mapping and "spend" in mapping:
        date_col = mapping["date"]
        try:
            tmp = df.copy()
            tmp["_dt"] = pd.to_datetime(tmp[date_col], errors="coerce")
            tmp = tmp.dropna(subset=["_dt"])
            tmp["_spend"] = _safe_numeric(tmp[mapping["spend"]])
            if "revenue" in mapping: tmp["_rev"] = _safe_numeric(tmp[mapping["revenue"]])
            if "conversions" in mapping: tmp["_conv"] = _safe_numeric(tmp[mapping["conversions"]])
            agg = {"_spend": "sum"}
            if "_rev" in tmp.columns: agg["_rev"] = "sum"
            if "_conv" in tmp.columns: agg["_conv"] = "sum"
            grouped = tmp.groupby(tmp["_dt"].dt.date).agg(agg).reset_index().sort_values("_dt")
            for _, r in grouped.iterrows():
                entry = {"date": r["_dt"].isoformat(), "spend": round(float(r["_spend"] or 0), 2)}
                if "_rev" in grouped.columns: entry["revenue"] = round(float(r.get("_rev") or 0), 2)
                if "_conv" in grouped.columns: entry["conversions"] = int(r.get("_conv") or 0)
                timeseries.append(entry)
        except Exception as e:
            logger.warning("Timeseries build failed: %s", e)

    # Sample rows for AI context
    sample = df.head(8).fillna("").astype(str).to_dict(orient="records")

    return {
        "row_count": row_count,
        "kpis": kpis,
        "numeric_summary": numeric_summary,
        "top_campaigns": top_campaigns,
        "timeseries": timeseries,
        "sample_rows": sample,
        "columns": list(df.columns),
        "mapping": mapping,
    }


# ----- AI Analysis (Claude) -----
def _system_message(platform: str) -> str:
    return f"""You are a senior paid-media analyst auditing an ad campaign data export from {platform}.
Always return strict JSON only — no markdown fences, no prose outside JSON.
"""


async def analyze_with_claude(platform: str, digest: dict) -> dict:
    """Returns: {headline, score, insights:[{title,severity,detail,action}], charts:[...] }"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    digest_compact = {
        "row_count": digest["row_count"],
        "kpis": digest["kpis"],
        "columns": digest["columns"],
        "mapping": digest["mapping"],
        "top_campaigns": digest["top_campaigns"][:6],
        "timeseries_summary": _summarize_ts(digest["timeseries"]),
        "sample_rows": digest["sample_rows"][:3],
    }

    prompt = f"""Analyze this dataset and return a JSON object with this exact schema:
{{
  "headline": "<one-sentence verdict on overall performance>",
  "score": <integer 0-100>,
  "insights": [
    {{
      "title": "<short>",
      "severity": "<critical|warning|info>",
      "detail": "<what the data shows>",
      "action": "<concrete next step>"
    }}
  ],
  "charts": [
    {{
      "type": "<area|bar|line|pie>",
      "title": "<chart title>",
      "subtitle": "<optional short subtitle>",
      "x": "<dimension key from timeseries or top_campaigns>",
      "y": ["<measure>"],
      "data_source": "<timeseries|top_campaigns>"
    }}
  ]
}}
Return 5-8 insights (prioritize critical findings) and 3-5 charts (a mix of trend + comparison).
Use only data_source values "timeseries" or "top_campaigns". Use these "y" keys when available:
- For timeseries: spend, revenue, conversions
- For top_campaigns: spend, revenue, roas, conversions

Dataset digest:
{json.dumps(digest_compact, default=str)}
"""

    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"ingest_{uuid.uuid4().hex[:8]}",
        system_message=_system_message(platform),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    raw = await chat.send_message(UserMessage(text=prompt))
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.exception("Could not parse AI response, returning fallback")
        return _fallback_analysis(digest)


def _summarize_ts(ts: list) -> dict:
    if not ts: return {}
    return {
        "first_date": ts[0]["date"],
        "last_date": ts[-1]["date"],
        "n_points": len(ts),
        "total_spend": round(sum(t.get("spend", 0) for t in ts), 2),
    }


def _fallback_analysis(digest: dict) -> dict:
    k = digest["kpis"]
    insights = []
    if k.get("roas") and k["roas"] < 1:
        insights.append({"title": "Account is unprofitable", "severity": "critical",
                         "detail": f"ROAS of {k['roas']}× is below break-even.",
                         "action": "Pause low-ROAS campaigns and reallocate budget."})
    if k.get("ctr") and k["ctr"] < 1:
        insights.append({"title": "Weak CTR overall", "severity": "warning",
                         "detail": f"CTR of {k['ctr']}% is below typical 1-2% baseline.",
                         "action": "Refresh creative variants and test new hooks."})
    if not insights:
        insights.append({"title": "Performance summary", "severity": "info",
                         "detail": "Dataset analyzed.", "action": "Continue monitoring."})
    charts = []
    if digest["timeseries"]:
        charts.append({"type": "area", "title": "Spend & Revenue trend",
                       "x": "date", "y": ["spend", "revenue"], "data_source": "timeseries"})
    if digest["top_campaigns"]:
        charts.append({"type": "bar", "title": "Top campaigns by spend",
                       "x": "campaign", "y": ["spend"], "data_source": "top_campaigns"})
    return {"headline": "Dataset analyzed.", "score": 70, "insights": insights, "charts": charts}


# ----- Chat (persistent thread per dataset) -----
async def chat_with_dataset(digest: dict, dashboard: dict, thread: list, user_msg: str) -> str:
    """Returns assistant reply. Caller saves thread."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    context = {
        "kpis": digest["kpis"],
        "top_campaigns": digest["top_campaigns"][:10],
        "timeseries_summary": _summarize_ts(digest["timeseries"]),
        "columns": digest["columns"],
        "ai_headline": dashboard.get("headline"),
        "ai_score": dashboard.get("score"),
        "ai_insights": dashboard.get("insights", [])[:8],
    }
    history = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in thread[-10:])
    system = (
        "You are an analytics co-pilot embedded inside a marketing dashboard. "
        "Answer the user's questions about THIS dataset using the digest below. "
        "Be concise (2-5 sentences), cite numbers when relevant, and use $ and % units. "
        "If a question cannot be answered from the digest, say so honestly and suggest what data would be needed. "
        "Never invent numbers."
    )
    prompt = f"""Dataset context (JSON):
{json.dumps(context, default=str)}

Conversation so far:
{history if history else '(start of conversation)'}

User: {user_msg}
Assistant:"""

    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"chat_{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    reply = await chat.send_message(UserMessage(text=prompt))
    return reply.strip()

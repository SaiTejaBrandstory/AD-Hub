# AdHub – Ad Agency Campaign Management & Analytics Platform

## Original Problem Statement
> "Im an Ad agency. can i build Meta and Adwords Camapign Management and analytics dashboard for my customers. Multi customers with mutli ad accounts connected and i have super admin access to control all teh brands and their campaigns across various campaigns in various platforms. I should be able to connect the respective accounts, authenticated from their channel, to manage access to view access to everything to our product. From there, we could analyse, audit, manage, change, monitor, and report the entire campaign structure"

## User Choices (Locked)
- **Integration approach**: Hybrid — real OAuth scaffolding + realistic mock data (real Meta App Review + Google Ads Developer Token still required before live data flows)
- **GA4 included** as third connector alongside Meta Ads and Google Ads
- **Auth**: Both — Emergent Google Login AND email/password JWT
- **Features**: ALL of multi-brand workspaces, OAuth connectors, cross-platform analytics, campaign table, pause/enable, AI audit, automated reports, alerts/anomaly detection, role management
- **Visual style**: Clean light enterprise (Stripe/Notion-style, Archetype 4 Swiss High-Contrast)

## User Personas
1. **Super Admin (Agency Owner)** – Full control of every brand, every campaign, every user
2. **Agency Manager** – Manages assigned brands' campaigns, runs audits, schedules reports
3. **Brand Client** – View-only access to their own brand's analytics

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async) + Emergent integrations (Claude Sonnet 4.5)
- **Frontend**: React 19 + Tailwind + Shadcn UI + Recharts + Phosphor icons
- **Fonts**: Cabinet Grotesk (headings), Satoshi (body), IBM Plex Mono (data)
- **Auth**: Dual — JWT bearer (password) + httpOnly session_token cookie (Google)

## What's Implemented (2026-05-18)
### Backend (`server.py`, `seed.py`, `anomalies.py`, `reports_email.py`)
- ✅ Email/password register + login (bcrypt + JWT 7-day)
- ✅ Emergent Google OAuth via `/api/auth/google/session` (X-Session-ID header)
- ✅ Dual-auth dependency resolves cookie OR bearer
- ✅ Workspaces (brands) CRUD with multi-tenant `memberships` table
- ✅ Ad accounts: list / connect (mock OAuth) / disconnect — Meta / Google Ads / GA4
- ✅ Campaigns: list with filters (platform, status), get by id, PATCH status (pause/resume)
- ✅ **Bulk pause/resume** via `POST /api/campaigns/bulk-status`
- ✅ **Campaign budget edit** via `PATCH /api/campaigns/{id}/budget`
- ✅ Analytics: overview (spend, revenue, ROAS, CTR, CPC, conversions, platform breakdown), timeseries (7/30/90 day daily series)
- ✅ Alerts feed (seeded critical/warning/info)
- ✅ **Anomaly detection scan** via `POST /api/alerts/scan` — flags ROAS, CTR, CPA, budget anomalies
- ✅ Reports: schedule + list
- ✅ **Send report email with PDF attachment** via `POST /api/reports/{id}/send` (Resend integration)
- ✅ AI audit via Claude Sonnet 4.5 (Emergent LLM key) with heuristic fallback
- ✅ Admin: list all users, assign members to brands
- ✅ Auto-seed on startup: 3 brands, 9 ad accounts, ~30 campaigns, 12 alerts, 3 reports, 3 demo users
- ✅ All 35 backend tests pass (testing agent verified)

### Frontend
- ✅ Split-screen Login page (Google + email/password + demo account quick-fill)
- ✅ Protected routes with AuthCallback race-condition fix
- ✅ Sidebar with workspace switcher dropdown, role-aware nav, user menu
- ✅ Glass-morphic sticky header with page title + brand chip + search + alerts bell
- ✅ Dashboard: 8 KPI tiles, Spend vs Revenue area chart, Platform mix bar chart, AI audit CTA, alerts feed
- ✅ Campaigns table with platform/status filters, ROAS color coding, **bulk-select checkboxes + bulk action bar**, pause/play toggle
- ✅ Campaign detail page with metrics + pause/resume + **Edit budget dialog**
- ✅ Accounts page: 3 connector cards + linked accounts table
- ✅ AI Audit page: Run audit, get scored recommendations from Claude
- ✅ Alerts page: full severity feed + **"Run scan" anomaly detection button**
- ✅ Reports page: list + schedule new + **"Send now" button per report** + Resend testing-mode notice
- ✅ Analytics page: multi-metric trend lines (7/30/90 day toggle)
- ✅ Admin Users page (super_admin only): user list + assign-to-brand dialog

### Integrations live
- ✅ Claude Sonnet 4.5 (Emergent LLM key) — AI audit + dataset analysis + chat
- ✅ Resend — transactional email + PDF attachments (testing mode: sends to verified addresses only)
- ✅ Emergent Object Storage — CSV/XLSX file uploads, per-workspace path isolation
- ✅ APScheduler — anomaly scan every 6 hours

### Data Ingest (BYO-data feature, no OAuth required)
- ✅ Drag-drop CSV/XLSX upload per brand workspace (each file = separate dataset)
- ✅ Auto platform detection: Meta Ads, Google Ads, GA4, Twitter/X, LinkedIn, YouTube + generic
- ✅ AI column mapping + KPI computation (spend, revenue, ROAS, CTR, CPC, conversions)
- ✅ Claude generates dashboard JSON: headline + score + 5-8 insights + 3-5 chart specs
- ✅ Renders to clean enterprise dashboard with Recharts (area, bar, line, pie)
- ✅ Persistent chat thread per dashboard (Claude has dataset digest in context)
- ✅ PDF export matching scheduled-reports style (KPI grid + chart + top campaigns + insights + AI verdict)
- ✅ Immutable snapshots — saved with ingest date

### Real OAuth scaffolding
See `/app/memory/oauth_application_guide.md` for the step-by-step Meta App Review + Google Ads Developer Token application process.

## Demo Accounts (seeded)
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@adhub.com | admin123 |
| Manager | manager@adhub.com | manager123 |
| Client | client@northwind.com | client123 |

## Prioritized Backlog (P0/P1/P2)
### P0 (real-data prerequisites)
- Submit Meta Developer App for `ads_management` / `business_management` review
- Apply for Google Ads API Developer Token (Standard access)
- Set up Google Cloud OAuth consent screen for GA4 (Analytics Data API)
- Wire real OAuth flows into `/api/ad-accounts/connect` once approvals land

### P1 (next enhancements)
- PDF report generation + email delivery (Resend integration)
- Anomaly detection cron (auto-create alerts when ROAS drops > threshold)
- Campaign edit UI (budget, bid strategy)
- Saved audit history view per workspace
- Bulk pause/resume actions on Campaigns table

### P2 (nice-to-haves)
- Slack/email alert webhook routing
- Audience overlap analyzer
- Creative library with thumbnails
- White-label branding per agency
- API access tokens for clients

## Next Action Items
1. Begin Meta App Review + Google Ads Developer Token application
2. Add Resend integration for PDF report email delivery
3. Schedule automated anomaly-detection job (every 6 hours)

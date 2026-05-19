# Sample data for AdHub

## Already in the app (auto-seeded on backend startup)

After login, these pages have demo data **without uploading anything**:

| Page | URL | What's included |
|------|-----|-----------------|
| Dashboard | `/dashboard` | KPIs, charts, alerts |
| Campaigns | `/campaigns` | ~30 campaigns across Meta / Google / GA4 |
| Analytics | `/analytics` | 7/30/90-day trends |
| Alerts | `/alerts` | Critical / warning / info alerts |
| Reports | `/reports` | Scheduled report samples |
| Accounts | `/accounts` | Mock connected ad accounts |
| Admin | `/admin/users` | Demo users (super admin only) |

Use the **workspace switcher** (sidebar) to switch brands: Northwind Apparel, Aurora Coffee Co., Helix Fitness.

## Datasets page (`/datasets`) — upload required

There is **no pre-loaded dataset** in MongoDB. This feature is BYO-data:

1. Open **Datasets** for a brand (pick workspace in sidebar).
2. Drag-drop a CSV/XLSX onto the upload zone, or use the file picker.
3. The app uploads, then runs **Analyze** (needs `EMERGENT_LLM_KEY` in `backend/.env` for cloud storage + AI).

### Try the included sample file

```text
sample-data/meta_ads_campaign_sample.csv
```

Upload it on `/datasets` for any workspace (e.g. Northwind Apparel).

> **Note:** Upload/analyze requires `EMERGENT_LLM_KEY` from the Emergent platform. Without it, uploads fail with a storage error. Dashboard, campaigns, and analytics work without that key.

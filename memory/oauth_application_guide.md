# Meta + Google Ads API – Application Guide for AdHub

Live data from Meta Ads and Google Ads requires platform approval. Both can be applied for **right now** while your dashboard is fully functional with seeded/mock data. Once approved, swap mock → live in a single backend function (`/api/ad-accounts/connect` → real OAuth) with no UI changes.

---

## 1) Meta (Facebook & Instagram Ads)

### What you need
- A Meta **Business Manager** account (https://business.facebook.com)
- A Meta **Developer Account** (https://developers.facebook.com)
- A **Business Verification** (Meta will verify your agency entity)
- A **Privacy Policy URL**, **Terms URL**, and **Data Deletion URL** on your website

### Step 1 — Create the App
1. Go to https://developers.facebook.com/apps → **Create App**
2. App type: **Business**
3. Add **Marketing API** product to the app
4. Add **Facebook Login for Business** product (this is the new flow for ads_management)

### Step 2 — Configure OAuth
- **Valid OAuth redirect URI**: `https://YOUR-DOMAIN.com/api/oauth/meta/callback`
- **Permissions to request** (in App Review):
  - `ads_management` — read & manage campaigns
  - `ads_read` — read insights data
  - `business_management` — list ad accounts under a Business Manager
  - `pages_read_engagement` (only if you need Page-level data)

### Step 3 — App Review (this is the wait)
Submit each permission individually with:
- **Use case**: "Agency campaign management dashboard"
- **Screen recording** showing the OAuth flow + how each permission is used
- **Test user credentials** for your dashboard (use the seeded admin@adhub.com)

Typical timeline: **5–15 business days** per permission. You can use them on your own ad accounts in **Dev Mode** immediately for testing.

### Step 4 — Business Verification
- Business Manager → **Security Center** → start verification
- Provide: business registration certificate, utility bill or bank statement
- Typical timeline: 3–7 business days

### Once approved
Add to `/app/backend/.env`:
```
META_APP_ID=…
META_APP_SECRET=…
META_REDIRECT_URI=https://YOUR-DOMAIN.com/api/oauth/meta/callback
```

---

## 2) Google Ads API (Search, Performance Max, etc.)

### What you need
- A **Google Ads Manager Account (MCC)** linked to your agency
- A **Google Cloud Project**
- A **Google Workspace** account or business Google account

### Step 1 — Apply for a Developer Token
1. Log in to your MCC at https://ads.google.com
2. **Tools & Settings → Setup → API Center**
3. Fill the application: company info, use case, integration plan
4. **Basic Access** (15k ops/day, sandbox-only) is granted in **1–2 days**
5. **Standard Access** (production) typically takes **2–4 weeks**

### Step 2 — Create the OAuth Client
1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth 2.0 Client ID**
2. Application type: **Web application**
3. **Authorized redirect URI**: `https://YOUR-DOMAIN.com/api/oauth/google/callback`
4. Add OAuth scopes:
   - `https://www.googleapis.com/auth/adwords` (Google Ads)
   - `https://www.googleapis.com/auth/analytics.readonly` (GA4)

### Step 3 — OAuth Consent Screen
- Set to **External**
- Add app name, logo, agency support email
- Add the same scopes as above
- Add your **homepage** and **privacy policy** URLs
- Submit for verification (Google reviews scope justifications — takes 4–8 weeks for production)

### Once approved
Add to `/app/backend/.env`:
```
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
GOOGLE_DEVELOPER_TOKEN=…
GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN.com/api/oauth/google/callback
```

---

## 3) GA4 (Google Analytics 4)

**Fastest of the three** — reuses the same Google OAuth client as Google Ads.

### Step 1 — Enable the API
1. Google Cloud Console → APIs & Services → Library → **Google Analytics Data API**
2. Click **Enable**

### Step 2 — OAuth scope
Already added in Step 2 above: `analytics.readonly`

### Step 3 — Done
Once your OAuth consent screen is verified, GA4 connects work for any user who grants `analytics.readonly`. No additional developer token needed.

---

## What I'll wire up once you have keys

When you paste the keys into `/app/backend/.env`, the connect button currently shows **mocked data**. To go live, I'll:

1. Replace the body of `POST /api/ad-accounts/connect` with the real OAuth init/redirect
2. Add `GET /api/oauth/{platform}/callback` handlers that exchange the auth code for an access token
3. Store tokens encrypted in `db.ad_account_tokens` (one collection, indexed by account_id)
4. Replace the seeded campaign reads in `GET /api/campaigns` with live calls to:
   - Meta Marketing API → `/{ad_account_id}/insights`
   - Google Ads API → `customers/{id}/googleAds:searchStream`
   - GA4 → `properties/{id}:runReport`

**No frontend changes are required**. The dashboard UI is platform-agnostic.

---

## Quick checklist

- [ ] Apply for Meta Marketing API + Business verification
- [ ] Apply for Google Ads Developer Token (Basic, then Standard)
- [ ] Create Google Cloud OAuth client + consent screen
- [ ] Buy/set up agency domain with privacy policy + terms URLs
- [ ] Forward approval emails to me so I can wire keys in

While you wait (1–4 weeks total), keep using the dashboard with mocked data + the **anomaly detection** and **emailed PDF reports** that are already live.

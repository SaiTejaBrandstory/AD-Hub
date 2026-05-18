# Auth Testing Playbook (AdHub)

## Auth modes
1. **Email/password JWT**: token returned by `/api/auth/login`, sent as `Authorization: Bearer <token>`. Stored in localStorage.
2. **Emergent Google OAuth**: session_token in httpOnly cookie via `/api/auth/google/session` after redirect from `auth.emergentagent.com`.

## Demo credentials (seeded automatically)
- Super Admin: `admin@adhub.com` / `admin123`
- Manager: `manager@adhub.com` / `manager123`
- Client: `client@northwind.com` / `client123`

## Quick curl test
```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@adhub.com","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s "$API/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -s "$API/api/workspaces" -H "Authorization: Bearer $TOKEN"
```

## Browser cookie test (Emergent path)
```python
await page.context.add_cookies([{
  "name": "session_token",
  "value": "<token>",
  "domain": "<your-app-domain>",
  "path": "/",
  "httpOnly": True,
  "secure": True,
  "sameSite": "None"
}])
```

## Success indicators
- `/api/auth/me` returns user with `user_id`, `role`, no `_id`
- Dashboard route loads without 401/redirect
- Workspace switcher populated; campaigns table shows data

## Failure indicators
- 401 on protected routes
- Redirect loop to /login
- "User not found"

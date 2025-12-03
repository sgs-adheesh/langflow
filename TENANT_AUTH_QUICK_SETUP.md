# Tenant Authentication - Quick Setup

## Problem Solved

Your main app uses different auth than Langflow. Now users don't need to log in twice.

## What Was Added

✅ **New Endpoint**: `POST /api/v1/tenant/login`  
✅ **Auto-User Creation**: Creates Langflow user for each tenant+user combo  
✅ **JWT Token Generation**: Returns Langflow access & refresh tokens  
✅ **Session Validation Hook**: For you to plug in your auth validation  

## Files Changed

```
✅ Created: src/backend/base/langflow/api/v1/tenant_login.py
✅ Updated: src/backend/base/langflow/api/v1/__init__.py
✅ Updated: src/backend/base/langflow/api/router.py
✅ Created: TENANT_AUTH_BRIDGE_GUIDE.md (full documentation)
```

## 3-Step Setup

### Step 1️⃣: Implement Your Session Validation

Edit `src/backend/base/langflow/api/v1/tenant_login.py`:

```python
async def validate_tenant_session(
    tenant_id: str,
    user_id: str,
    session_token: str,
) -> bool:
    """YOUR validation logic here"""
    try:
        # Call YOUR main app's API
        response = httpx.post(
            "https://your-app.com/api/validate-session",
            json={
                "tenant_id": tenant_id,
                "user_id": user_id,
                "session_token": session_token,
            },
            timeout=5.0,
        )
        return response.status_code == 200
    except:
        return False
```

### Step 2️⃣: From Your Frontend, Call the Endpoint

```javascript
// After user logs in to your app, call:
const response = await fetch('https://langflow.your-app.com/api/v1/tenant/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: 'your-tenant-id',        // From your app's session
    user_id: 'your-user-id',            // From your app's session  
    session_token: 'your-session-token' // From your app's auth
  }),
  credentials: 'include' // IMPORTANT: Send cookies
});

// JWT tokens are now in cookies, Langflow is authenticated!
// Open Langflow iframe/tab
window.location.href = 'https://langflow.your-app.com';
```

### Step 3️⃣: Add Data Isolation (Optional but Recommended)

Add `tenant_id` column to User & Flow models, then filter queries:

```python
# In your API endpoints
@app.get("/api/v1/flows")
async def get_flows(current_user: CurrentActiveUser, db: DbSession):
    # Filter by tenant_id (you need to store this on the User model)
    flows = await db.exec(
        select(Flow).where(Flow.user_id == current_user.id)
    )
    return flows
```

## How It Works

```
User logs into your app
         ↓
Your app generates session_token
         ↓
Frontend calls POST /api/v1/tenant/login
         ↓
Langflow validates token with YOUR backend
         ↓
Langflow creates User (if new) for this tenant
         ↓
Langflow returns JWT access_token + refresh_token
         ↓
Tokens set in cookies automatically
         ↓
User can access Langflow without login page! ✅
```

## Example Usage

### Scenario: iFrame Tab in Your App

```html
<!-- In your dashboard -->
<button onclick="openLangflowTab()">
  Open Workflows
</button>

<div id="langflow-container"></div>

<script>
async function openLangflowTab() {
  const tenantId = "acme-corp";  // From your session
  const userId = "user-123";     // From your session
  const sessionToken = "xyz123"; // From your session
  
  // Authenticate with Langflow
  const res = await fetch('https://langflow-server.com/api/v1/tenant/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      user_id: userId,
      session_token: sessionToken
    }),
    credentials: 'include'
  });
  
  if (res.ok) {
    // Langflow is now authenticated!
    const iframe = document.createElement('iframe');
    iframe.src = 'https://langflow-server.com';
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    document.getElementById('langflow-container').appendChild(iframe);
  }
}
</script>
```

## API Reference

### POST /api/v1/tenant/login

**Request:**
```json
{
  "tenant_id": "acme-corp",           // Your tenant ID
  "user_id": "user-123",              // Your user ID
  "session_token": "xyz123token",     // Your session token
  "username": "john@example.com"      // Optional
}
```

**Response (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1Q...",
  "refresh_token": "eyJ0eXAiOiJKV1Q...",
  "token_type": "bearer",
  "user_id": "user-123",
  "tenant_id": "acme-corp"
}
```

**Cookies Set:**
- `access_token_lf` - JWT access token (HttpOnly, Secure)
- `refresh_token_lf` - JWT refresh token (HttpOnly, Secure)
- `apikey_tkn_lflw` - API key (HttpOnly, Secure)

**Errors:**
- `401` - Invalid tenant session
- `500` - User creation failed

## Key Points

🔑 **No Username/Password Login**: Your auth system handles everything  
🔑 **Auto User Creation**: Langflow creates user on first login  
🔑 **Separate Sessions per Tenant**: Each tenant gets isolated session  
🔑 **JWT Tokens**: Standard JWT auth for Langflow APIs  
🔑 **Cookie-Based**: Tokens in HttpOnly cookies (secure)  

## Common Issues

| Issue | Fix |
|-------|-----|
| "Login page appears" | Add `credentials: 'include'` to fetch |
| "Invalid session token" | Implement `validate_tenant_session()` |
| iFrame CORS errors | Enable CORS in Langflow config |
| Cookies not set | Use HTTPS in production |

## Next Steps

1. Read `TENANT_AUTH_BRIDGE_GUIDE.md` for detailed docs
2. Implement `validate_tenant_session()` function
3. Call `/api/v1/tenant/login` from your frontend
4. Test with your app's auth system
5. Add tenant_id filtering to queries (optional)

## Deployment Checklist

- [ ] Implement session validation function
- [ ] Test with your auth system
- [ ] Enable HTTPS (required for secure cookies)
- [ ] Configure CORS properly
- [ ] Add rate limiting to tenant/login endpoint
- [ ] Add logging to audit authentication
- [ ] Test in staging environment
- [ ] Deploy to production

---

**Need help?** Check the detailed guide at `TENANT_AUTH_BRIDGE_GUIDE.md`

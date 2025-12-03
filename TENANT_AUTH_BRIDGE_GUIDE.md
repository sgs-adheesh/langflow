# Tenant-Based Authentication Bridge Guide

## Overview

You now have a **tenant login endpoint** that bridges your main application's authentication with Langflow. This allows users to authenticate once in your app and access Langflow without logging in again.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Your Main Application                        │
│  (with your own authentication & tenant management)              │
└──────────────────────────────────────────────────────────────────┘
                              │
                    User logs in with credentials
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Your App generates session token & tenant context               │
│  {                                                                │
│    "tenant_id": "acme-corp",                                     │
│    "user_id": "user-123",                                        │
│    "session_token": "abc123xyz"  ← your session validation       │
│  }                                                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  POST /api/v1/tenant/login                                       │
│  (validate session & create Langflow user)                       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Langflow returns JWT access_token + refresh_token               │
│  Set as cookies for Langflow UI                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│         Langflow UI (embedded in your app)                       │
│  - Already authenticated (JWT in cookies)                        │
│  - No login page needed                                          │
│  - Each tenant gets separate session                             │
└──────────────────────────────────────────────────────────────────┘
```

## Endpoint Details

### POST `/api/v1/tenant/login`

Accepts tenant context from your main app and returns Langflow JWT tokens.

**Request Body:**
```json
{
  "tenant_id": "acme-corp",           // Your app's tenant ID (required)
  "user_id": "user-123",              // Your app's user ID (required)
  "session_token": "xyz123",          // Token from your auth system (required)
  "username": "john.doe"              // Optional: custom Langflow username
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1Q...",
  "refresh_token": "eyJ0eXAiOiJKV1Q...",
  "token_type": "bearer",
  "user_id": "user-123",
  "tenant_id": "acme-corp"
}
```

**Response Headers:**
```
Set-Cookie: access_token_lf=...; HttpOnly; Secure; SameSite=...
Set-Cookie: refresh_token_lf=...; HttpOnly; Secure; SameSite=...
Set-Cookie: apikey_tkn_lflw=...; HttpOnly; Secure; SameSite=...
```

**Error Responses:**
- `401 Unauthorized` - Invalid tenant session token
- `500 Internal Server Error` - User creation failed

## Step-by-Step Integration

### Step 1: Implement Session Validation on Your Backend

Edit `src/backend/base/langflow/api/v1/tenant_login.py` and implement the `validate_tenant_session()` function:

```python
async def validate_tenant_session(
    tenant_id: str,
    user_id: str,
    session_token: str,
) -> bool:
    """
    Validate the session token from your main application.
    
    This is a CRITICAL security function - implement YOUR validation logic!
    """
    try:
        # Call YOUR main app's API to validate
        response = httpx.post(
            "https://your-app.com/api/validate-session",
            json={
                "tenant_id": tenant_id,
                "user_id": user_id,
                "session_token": session_token,
            },
            timeout=5.0,
        )
        
        # Your validation endpoint should return 200 if valid, anything else if invalid
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Session validation failed: {e}")
        return False
```

**What your validation endpoint should do:**
1. Check if `session_token` exists in your session store
2. Verify it hasn't expired
3. Confirm it belongs to `tenant_id` and `user_id`
4. Return `200 OK` if valid, `401 Unauthorized` if invalid

### Step 2: Frontend - Call Tenant Login from Your App

**Option A: In Your Tab/Route Component**

```typescript
// In your main app's component
import { useEffect, useState } from 'react';
import axios from 'axios';

export function WorkflowTab() {
  const { tenantId, userId } = useAuth(); // From your app's auth
  const [langflowReady, setLangflowReady] = useState(false);
  
  useEffect(() => {
    const getSessionToken = async () => {
      try {
        // 1. Get session token from YOUR app's API
        const response = await axios.post('/api/create-session', {
          tenant_id: tenantId,
          user_id: userId,
        });
        const sessionToken = response.data.session_token;
        
        // 2. Call Langflow's tenant login endpoint
        const langflowResponse = await axios.post(
          'https://langflow.your-app.com/api/v1/tenant/login',
          {
            tenant_id: tenantId,
            user_id: userId,
            session_token: sessionToken,
          },
          {
            withCredentials: true, // Important: send cookies
          }
        );
        
        // 3. JWT tokens are now in cookies, Langflow is authenticated
        setLangflowReady(true);
        
      } catch (error) {
        console.error('Failed to authenticate with Langflow:', error);
      }
    };
    
    getSessionToken();
  }, [tenantId, userId]);
  
  if (!langflowReady) {
    return <div>Loading Langflow...</div>;
  }
  
  // Langflow is now authenticated, show the iframe
  return (
    <iframe
      src="https://langflow.your-app.com"
      style={{ width: '100%', height: '100vh' }}
    />
  );
}
```

**Option B: Server-Side Token Generation (More Secure)**

```typescript
// In your main app's API route
app.post('/api/get-langflow-token', async (req, res) => {
  const user = req.user; // From your session
  const tenantId = req.body.tenant_id;
  
  // Verify user belongs to this tenant
  if (!isUserInTenant(user, tenantId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Generate a short-lived session token for this request
  const sessionToken = generateSessionToken(user.id, tenantId, { expiresIn: '5m' });
  
  // Call Langflow's tenant login from server-side (secure)
  const langflowResponse = await fetch('https://langflow.your-app.com/api/v1/tenant/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      user_id: user.id,
      session_token: sessionToken,
    }),
  });
  
  if (!langflowResponse.ok) {
    return res.status(401).json({ error: 'Langflow auth failed' });
  }
  
  const tokens = await langflowResponse.json();
  
  // Set cookies on client response (Langflow will read them)
  res.cookie('access_token_lf', tokens.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
  
  return res.json({ success: true });
});

// Frontend
fetch('/api/get-langflow-token?tenant_id=' + tenantId, {
  method: 'POST',
  credentials: 'include', // Send cookies
}).then(() => {
  // Now redirect to Langflow
  window.location.href = 'https://langflow.your-app.com';
});
```

### Step 3: Data Isolation (Backend)

Add middleware to filter queries by tenant:

```python
# In your Langflow setup, add this middleware

from fastapi import Request, HTTPException

@app.middleware("http")
async def tenant_isolation_middleware(request: Request, call_next):
    """
    Isolate data by tenant.
    
    You need to:
    1. Extract tenant_id from the Langflow user (stored during tenant login)
    2. Filter all database queries by this tenant_id
    3. Prevent cross-tenant access
    """
    # For now, Langflow creates separate User objects per tenant
    # In the future, you may want to add a tenant_id column to your models
    
    response = await call_next(request)
    return response
```

For a more robust implementation, add `tenant_id` to your Langflow models:

```python
# In your User model or Flow model
from sqlalchemy import String

class User(Base):
    # ... existing fields ...
    tenant_id: str = Field(default=None, index=True)  # Add this
    
    # When querying users
    stmt = select(User).where(
        User.username == username,
        User.tenant_id == request.state.tenant_id  # Filter by tenant
    )

class Flow(Base):
    # ... existing fields ...
    tenant_id: str = Field(default=None, index=True)  # Add this
```

## Usage Examples

### Example 1: iframe Embed

```html
<!-- In your main app's dashboard page -->
<div style="width: 100%; height: calc(100vh - 60px);">
  <div id="langflow-container"></div>
</div>

<script>
const tenantId = "acme-corp";
const userId = "user-123";

// 1. Get session token from your backend
fetch('/api/create-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenant_id: tenantId, user_id: userId }),
  credentials: 'include',
}).then(r => r.json())
  .then(data => {
    // 2. Authenticate with Langflow
    return fetch('https://langflow.your-app.com/api/v1/tenant/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        user_id: userId,
        session_token: data.session_token,
      }),
      credentials: 'include',
    });
  })
  .then(() => {
    // 3. Load Langflow
    document.getElementById('langflow-container').innerHTML =
      '<iframe src="https://langflow.your-app.com" style="width:100%; height:100%; border:none;"></iframe>';
  });
</script>
```

### Example 2: React Hook

```typescript
import { useEffect, useState } from 'react';

export const useLangflowAuth = (tenantId: string, userId: string) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const authenticateWithLangflow = async () => {
      try {
        // Step 1: Get session token
        const sessionRes = await fetch('/api/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: tenantId, user_id: userId }),
          credentials: 'include',
        });
        
        if (!sessionRes.ok) throw new Error('Failed to create session');
        
        const { session_token } = await sessionRes.json();
        
        // Step 2: Authenticate with Langflow
        const langRes = await fetch(
          'https://langflow.your-app.com/api/v1/tenant/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: tenantId,
              user_id: userId,
              session_token,
            }),
            credentials: 'include',
          }
        );
        
        if (!langRes.ok) throw new Error('Langflow authentication failed');
        
        setIsAuthenticated(true);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsAuthenticated(false);
      }
    };
    
    authenticateWithLangflow();
  }, [tenantId, userId]);
  
  return { isAuthenticated, error };
};

// Usage
export function WorkflowsDashboard() {
  const { tenantId, userId } = useAuth();
  const { isAuthenticated, error } = useLangflowAuth(tenantId, userId);
  
  if (error) return <div>Error: {error}</div>;
  if (!isAuthenticated) return <div>Loading...</div>;
  
  return (
    <iframe
      src="https://langflow.your-app.com"
      style={{ width: '100%', height: '100vh' }}
    />
  );
}
```

## Security Checklist

- [ ] **Session Validation**: Implement `validate_tenant_session()` with YOUR backend
- [ ] **Token Expiration**: Session tokens should have short expiration (5-15 minutes)
- [ ] **HTTPS Only**: Always use HTTPS in production
- [ ] **CORS Configuration**: Set proper CORS headers in Langflow
- [ ] **Data Isolation**: Add `tenant_id` filtering to all queries
- [ ] **Audit Logging**: Log all tenant login attempts
- [ ] **Rate Limiting**: Add rate limiting to `/api/v1/tenant/login` endpoint
- [ ] **Input Validation**: Validate `tenant_id` and `user_id` format

## Troubleshooting

### Login page appears instead of dashboard
**Cause**: Cookies not being set properly
**Solution**: 
- Ensure `withCredentials: true` in fetch/axios requests
- Check CORS allows credentials
- Verify cookies have correct domain/path

### "Invalid tenant session token" error
**Cause**: Your validation endpoint is rejecting the token
**Solution**:
- Check your `validate_tenant_session()` implementation
- Verify session token was created correctly
- Check token hasn't expired
- Enable logging in validation function

### Flows/data not visible after login
**Cause**: Data isolation not implemented
**Solution**:
- Add `tenant_id` column to User and Flow models
- Add filtering middleware (see Step 3)
- Verify queries filter by `tenant_id`

### iFrame not loading
**Cause**: CORS or cookie issues
**Solution**:
- Check browser console for CORS errors
- Enable Langflow CORS for your domain
- Verify cookies are being sent with requests

## Next Steps

1. **Implement Session Validation** - Edit `tenant_login.py` with YOUR validation
2. **Add Tenant Isolation** - Add `tenant_id` to User/Flow models
3. **Test Integration** - Test with your app's auth system
4. **Deploy** - Follow your standard deployment process
5. **Monitor** - Watch logs for authentication issues

## Support

For issues with this integration, check:
1. Langflow logs: `src/backend/base/langflow/logs`
2. Browser console for CORS errors
3. Network tab for failed requests
4. Validation function logs


# Tenant-Based Integration Guide

This guide explains how to embed Langflow into your main application with tenant-based session management (no built-in authentication).

## Architecture

```
Your Main App (with auth)
    ↓
    ├─ Tenant A Session
    │   └─ Langflow UI (uses Tenant A token)
    │       └─ Langflow Backend API (validates Tenant A)
    │
    ├─ Tenant B Session
    │   └─ Langflow UI (uses Tenant B token)
    │       └─ Langflow Backend API (validates Tenant B)
```

## How It Works

1. **Your Main App** (with authentication) logs in the user
2. **Your Main App** generates a session token for the tenant
3. **Your Main App** opens/embeds Langflow with tenant context
4. **Langflow** reads tenant context from query params or window object
5. **Langflow** adds tenant headers to all backend API calls
6. **Langflow Backend** validates tenant headers and isolates data

## Implementation Steps

### Step 1: Parent App Setup

In your main application, when opening Langflow:

```javascript
// Option A: URL-based (iFrame or direct link)
const tenantId = "tenant-123";
const sessionToken = "xyz123token";
const userId = "user-456";

const langflowUrl = `https://langflow-instance.com?tenantId=${tenantId}&sessionToken=${sessionToken}&userId=${userId}`;

// Open in iFrame
document.getElementById('langflow-container').innerHTML = 
  `<iframe src="${langflowUrl}" style="width: 100%; height: 100%;"></iframe>`;

// Or redirect
window.location.href = langflowUrl;
```

```javascript
// Option B: Window object-based (more secure for iFrame)
const iframe = document.getElementById('langflow-iframe');

iframe.onload = () => {
  iframe.contentWindow.__TENANT_CONTEXT__ = {
    tenantId: "tenant-123",
    sessionToken: "xyz123token",
    userId: "user-456"
  };
};

iframe.src = "https://langflow-instance.com";
```

### Step 2: Langflow Frontend (Already Configured)

The following files have been created/updated:

#### `src/controllers/API/tenant-api.ts` (New)
- Manages tenant context
- Provides `getTenantHeaders()` method for API requests
- Supports 3 methods of tenant initialization:
  1. Query parameters: `?tenantId=xxx&sessionToken=yyy&userId=zzz`
  2. Window object: `window.__TENANT_CONTEXT__`
  3. Custom PostMessage (future implementation)

#### `src/controllers/API/api.tsx` (Updated)
- All API requests now include tenant headers
- Headers added: `X-Tenant-ID`, `X-Session-Token`, `X-User-ID`

#### `src/hooks/use-tenant-initialization.ts` (New)
- Hook that initializes tenant context on app load
- Enables auto-login when tenant context is detected
- Falls back to normal auth if no tenant context

#### `src/App.tsx` (Updated)
- Calls `useTenantInitialization()` on mount

### Step 3: Backend Validation

Your Langflow backend API should validate tenant headers:

```python
# FastAPI/Flask example
from fastapi import Request, HTTPException

@app.middleware("http")
async def validate_tenant(request: Request, call_next):
    # Get tenant headers
    tenant_id = request.headers.get("X-Tenant-ID")
    session_token = request.headers.get("X-Session-Token")
    user_id = request.headers.get("X-User-ID")
    
    # For auto-login, tenant headers are optional
    # For embedded mode, validate them
    if tenant_id and session_token:
        # Verify session token is valid for this tenant
        user = verify_tenant_session(tenant_id, session_token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid tenant session")
        
        # Store tenant context for use in endpoints
        request.state.tenant_id = tenant_id
        request.state.user_id = user_id
    
    response = await call_next(request)
    return response

# In your endpoints, filter by tenant
@app.get("/api/v1/flows")
async def get_flows(request: Request):
    tenant_id = request.state.tenant_id
    # Query flows only for this tenant
    flows = db.query(Flow).filter(Flow.tenant_id == tenant_id).all()
    return flows
```

## Usage Modes

### Mode 1: Embedded as New SPA (Recommended)

```
Your App:  https://your-app.com/
           ├─ /dashboard
           ├─ /workflows (separate route - opens Langflow)
           └─ /admin

URL: https://your-app.com/workflows?tenantId=tenant-123&sessionToken=token123&userId=user456
     └─ Loads Langflow as full-page SPA
```

**Parent App Code:**
```javascript
function openWorkflowEditor(tenantId, sessionToken, userId) {
  window.location.href = `/workflows?tenantId=${tenantId}&sessionToken=${sessionToken}&userId=${userId}`;
}
```

### Mode 2: Embedded in iFrame

```
Your App: https://your-app.com/dashboard
          └─ <iframe src="https://langflow.yourdom.com?tenantId=...">
```

**Parent App Code:**
```javascript
function embedLangflow(containerId, tenantId, sessionToken, userId) {
  const url = `https://langflow.yourdomain.com?tenantId=${tenantId}&sessionToken=${sessionToken}&userId=${userId}`;
  const container = document.getElementById(containerId);
  container.innerHTML = `<iframe src="${url}" style="width: 100%; height: 100%; border: none;"></iframe>`;
}
```

### Mode 3: Embedded as React Component

```javascript
// Future: Langflow as npm package
import LangflowEditor from '@langflow/editor';

export function MyDashboard({ tenantId, sessionToken, userId }) {
  return (
    <LangflowEditor
      tenantId={tenantId}
      sessionToken={sessionToken}
      userId={userId}
    />
  );
}
```

## API Flow

```
User opens Langflow
    ↓
App.tsx loads
    ↓
useTenantInitialization() runs
    ↓
tenantAPIClient.initializeTenantContext() reads:
    ├─ Query params (?tenantId=xxx)
    ├─ Window object (window.__TENANT_CONTEXT__)
    └─ Stores tenant context in memory (no localStorage)
    ↓
User makes API call (fetch, axios, etc.)
    ↓
API Interceptor (api.tsx) adds headers:
    ├─ X-Tenant-ID: tenant-123
    ├─ X-Session-Token: xyz123token
    └─ X-User-ID: user-456
    ↓
Request sent to backend
    ↓
Backend validates headers
    └─ If valid: process request with tenant context
    └─ If invalid: return 401
```

## Data Isolation Checklist

- [ ] **Frontend**: Tenant context stored in memory (not localStorage)
- [ ] **Frontend**: Each API request includes tenant headers
- [ ] **Backend**: Validates tenant headers on every request
- [ ] **Backend**: Filters all queries by `tenant_id`
- [ ] **Backend**: Prevents cross-tenant access in endpoints
- [ ] **Backend**: Logs tenant ID for audit trail
- [ ] **Database**: Rows have `tenant_id` column
- [ ] **Database**: Indexes on `(tenant_id, resource_id)` for performance

## Security Considerations

1. **HTTPS Only**: Always use HTTPS in production
2. **Session Token**: Should be:
   - Generated by your main app
   - Time-limited (e.g., 24 hours)
   - Validated on backend before each request
   - Revoked when user logs out
3. **CORS**: Configure CORS headers correctly:
   ```python
   from fastapi.middleware.cors import CORSMiddleware
   
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["https://your-main-app.com"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```
4. **iFrame Sandbox**: If using iFrame, set proper sandbox attributes:
   ```html
   <iframe sandbox="allow-same-origin allow-scripts allow-forms" 
           src="...">
   </iframe>
   ```

## Testing Multi-Tenant Setup

### Manual Test

```bash
# Tenant A
curl "http://localhost:3000/?tenantId=tenant-a&sessionToken=token-a&userId=user-a"

# Tenant B
curl "http://localhost:3000/?tenantId=tenant-b&sessionToken=token-b&userId=user-b"

# Check that flows, variables, etc. are isolated
```

### Browser Console Test

```javascript
// Check if tenant context is initialized
console.log(tenantAPIClient.getTenantContext());

// Output should be:
// { tenantId: "tenant-123", sessionToken: "xyz123", userId: "user-456" }

// Check headers on API call
tenantAPIClient.getTenantHeaders();
// Output should be:
// { 
//   "X-Tenant-ID": "tenant-123",
//   "X-Session-Token": "xyz123",
//   "X-User-ID": "user-456"
// }
```

## Troubleshooting

### Issue: Langflow shows login page
**Solution**: 
- Check if tenant context is being passed correctly
- Run `console.log(tenantAPIClient.getTenantContext())` in browser
- Verify query parameters are in URL

### Issue: API calls return 401/403
**Solution**:
- Check backend is validating tenant headers
- Check session token is valid on backend
- Verify X-Tenant-ID header is being sent
- Run network inspector to see request headers

### Issue: Data from different tenants is mixed
**Solution**:
- Verify backend is filtering by `tenant_id` in all queries
- Check database has `tenant_id` column on all relevant tables
- Add tenant_id to all WHERE clauses

## Files Changed

- ✅ `src/controllers/API/tenant-api.ts` - NEW
- ✅ `src/controllers/API/api.tsx` - UPDATED
- ✅ `src/hooks/use-tenant-initialization.ts` - NEW
- ✅ `src/App.tsx` - UPDATED

## Next Steps

1. **Configure Backend**: Add tenant validation to your Langflow backend
2. **Test Locally**: Test with query parameters first
3. **Test Multi-Tenant**: Verify data isolation works
4. **Deploy**: Deploy to production with proper security
5. **Monitor**: Monitor logs for cross-tenant access attempts

## Support

For issues or questions:
1. Check browser console for errors
2. Check network tab for request/response headers
3. Check server logs for validation errors
4. Review this guide for configuration steps

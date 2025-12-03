# Tenant Integration - Quick Start

## TL;DR

Langflow now supports **multi-tenant sessions** without built-in authentication. Your main app provides tenant context, Langflow uses it.

## Quick Setup

### 1. Your Main App (Parent)

```javascript
// Pass tenant info when opening Langflow
const tenantId = "tenant-123";
const sessionToken = "abc123xyz";
const userId = "user-456";

// As URL parameter
window.location = `https://langflow.yourapp.com/?tenantId=${tenantId}&sessionToken=${sessionToken}&userId=${userId}`;

// OR in iFrame with window object (more secure)
const iframe = document.getElementById('langflow-iframe');
iframe.onload = () => {
  iframe.contentWindow.__TENANT_CONTEXT__ = { tenantId, sessionToken, userId };
};
iframe.src = "https://langflow.yourapp.com";
```

### 2. Langflow Frontend (Already Done ✅)

- ✅ Reads tenant context from URL or window object
- ✅ Adds tenant headers to all API calls: `X-Tenant-ID`, `X-Session-Token`, `X-User-ID`
- ✅ No localStorage (memory-only storage for session isolation)

### 3. Your Langflow Backend

Add tenant validation:

```python
# Middleware to validate tenant on every request
@app.middleware("http")
async def validate_tenant(request: Request, call_next):
    tenant_id = request.headers.get("X-Tenant-ID")
    session_token = request.headers.get("X-Session-Token")
    
    if tenant_id and session_token:
        user = verify_tenant_session(tenant_id, session_token)
        if not user:
            raise HTTPException(status_code=401)
        request.state.tenant_id = tenant_id
    
    return await call_next(request)

# Filter all queries by tenant
@app.get("/api/v1/flows")
async def get_flows(request: Request):
    return db.query(Flow).filter(
        Flow.tenant_id == request.state.tenant_id
    ).all()
```

## Two Integration Modes

### Mode A: New SPA Route
```
your-app.com/workflows?tenantId=X&sessionToken=Y&userId=Z
└─ Full Langflow UI loads here
```

### Mode B: iFrame Embed
```
your-app.com/dashboard
└─ <iframe src="langflow-server.com">
   └─ Langflow UI embedded here
```

## Test It

```bash
# 1. Start Langflow
npm run dev

# 2. Open in browser with tenant params
http://localhost:5173?tenantId=test-tenant&sessionToken=test-token&userId=test-user

# 3. Check console
console.log(tenantAPIClient.getTenantContext());
// Should output: { tenantId: "test-tenant", ... }

# 4. Create a flow, check headers in Network tab
# Should see: X-Tenant-ID: test-tenant
```

## Key Files

| File | Purpose |
|------|---------|
| `src/controllers/API/tenant-api.ts` | Manages tenant context |
| `src/hooks/use-tenant-initialization.ts` | Initializes on app load |
| `src/controllers/API/api.tsx` | Adds headers to requests |
| `src/App.tsx` | Calls initialization |

## Common Issues

| Issue | Fix |
|-------|-----|
| Login page appears | Pass tenantId in URL |
| API returns 401 | Check backend validates headers |
| Data mixed across tenants | Backend must filter by tenant_id |
| Headers not sent | Check tenantAPIClient initialization |

## Data Flow

```
1. User opens: langflow.com?tenantId=A&sessionToken=X&userId=Y
2. App initializes tenantAPIClient with context
3. User creates flow
4. API request + headers: X-Tenant-ID: A
5. Backend validates, filters by tenant A
6. Only tenant A's data returned
```

## Security

✅ **Do This:**
- Pass session token from parent app (validated by you)
- Use HTTPS in production
- Validate on backend EVERY request
- Filter all queries by tenant_id

❌ **Don't Do This:**
- Don't trust tenant ID from frontend alone
- Don't skip backend validation
- Don't mix tenant data in queries

## Questions?

Check `TENANT_INTEGRATION_GUIDE.md` for full details.

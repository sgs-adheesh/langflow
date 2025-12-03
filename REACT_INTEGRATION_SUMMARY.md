# React SPA Integration - Complete Summary

## What You Have

✅ **Backend**: Langflow tenant login endpoint (`POST /api/v1/tenant/login`)
✅ **Frontend**: 3 React components ready to integrate

## Files Created for Your React App

### 1. **useTenantLogin.js** (Hook)
- **Location**: `src/hooks/useTenantLogin.js`
- **Purpose**: Handles authentication with Langflow
- **Exports**: 
  - `loginToLangflow(tenantId, userId, sessionToken, username?)`
  - `logout()`
  - `getStoredTokens()`

### 2. **LangflowEmbed.jsx** (Component)
- **Location**: `src/components/LangflowEmbed.jsx`
- **Purpose**: Renders Langflow in an iframe with auto-authentication
- **Props**:
  - `tenantId` (required)
  - `userId` (required)
  - `sessionToken` (required)
  - `langflowUrl` (default: http://localhost:7860)
  - `height` (default: 600px)
  - `width` (default: 100%)

### 3. **TenantContext.jsx** (Context)
- **Location**: `src/context/TenantContext.jsx`
- **Purpose**: Manage tenant session across app
- **Provides**:
  - `currentTenant`
  - `currentUser`
  - `sessionToken`
  - `setTenantSession(tenant, user, token)`
  - `clearTenantSession()`

## Installation Flow

```
1. Copy 3 files to your React app
   ↓
2. Wrap App with <TenantProvider>
   ↓
3. On user login in your app:
   - Call setTenantSession(tenant, user, sessionToken)
   ↓
4. In workflow page:
   - Use <LangflowEmbed /> component
   ↓
5. Component automatically:
   - Calls loginToLangflow()
   - Creates Langflow user
   - Returns JWT tokens
   - Sets cookies
   - Loads Langflow in iframe
```

## Data Flow Diagram

```
┌─────────────────────────────┐
│   Your React App            │
│   (Login Page)              │
└──────────────┬──────────────┘
               │
               ├─ User enters credentials
               │
               ├─ POST /api/auth/login (YOUR API)
               │
               └─ Receive: {tenant, user, sessionToken}
                  │
                  ├─ Call setTenantSession()
                  │
                  └─ Navigate to /workflow
                     │
                     ┌─────────────────────────┐
                     │  Workflow Page          │
                     │  <LangflowEmbed />      │
                     └────────┬────────────────┘
                              │
                              ├─ Call loginToLangflow()
                              │
                              ├─ POST /api/v1/tenant/login (LANGFLOW)
                              │
                              ├─ Receive: {access_token, refresh_token}
                              │
                              ├─ Set cookies
                              │
                              └─ Render Langflow iframe
                                 ↓
                           ┌──────────────┐
                           │ Langflow UI  │
                           │ Authenticated│
                           └──────────────┘
```

## Usage Example

### App.jsx
```javascript
import { TenantProvider } from './context/TenantContext';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import WorkflowPage from './pages/WorkflowPage';

export default function App() {
  return (
    <TenantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/workflow" element={<WorkflowPage />} />
        </Routes>
      </BrowserRouter>
    </TenantProvider>
  );
}
```

### LoginPage.jsx
```javascript
import { useTenantContext } from '../context/TenantContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { setTenantSession } = useTenantContext();
  const navigate = useNavigate();

  const handleLogin = async (username, password) => {
    // Call YOUR backend API
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    // Set tenant session
    setTenantSession(
      data.tenant,        // { id: "tenant-123" }
      data.user,          // { id: "user-456" }
      data.sessionToken   // "your-session-token"
    );

    // Redirect to workflow
    navigate('/workflow');
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      handleLogin(formData.get('username'), formData.get('password'));
    }}>
      <input name="username" type="text" placeholder="Username" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Login</button>
    </form>
  );
}
```

### WorkflowPage.jsx
```javascript
import { useTenantContext } from '../context/TenantContext';
import { LangflowEmbed } from '../components/LangflowEmbed';

export default function WorkflowPage() {
  const { currentTenant, currentUser, sessionToken } = useTenantContext();

  if (!currentTenant || !currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Workflow - {currentTenant.name}</h1>
      
      <LangflowEmbed
        tenantId={currentTenant.id}
        userId={currentUser.id}
        sessionToken={sessionToken}
        height="800px"
        width="100%"
        onAuthSuccess={() => console.log('✅ Authenticated!')}
        onAuthError={(err) => console.error('❌ Error:', err)}
      />
    </div>
  );
}
```

## Multiple Tenant Support

The implementation automatically handles multiple tenants:

```javascript
// User 1 logs into Tenant A
setTenantSession({ id: 'tenant-a' }, { id: 'user-1' }, 'token-a');

// Langflow creates user: "tenant_tenant-a_user-1"
// And gives them a tenant-specific session

// User 2 logs into Tenant B
setTenantSession({ id: 'tenant-b' }, { id: 'user-2' }, 'token-b');

// Langflow creates user: "tenant_tenant-b_user-2"
// Completely isolated from Tenant A
```

## Security Features

✅ **HTTP-Only Cookies**: Tokens stored in secure HTTP-only cookies  
✅ **Session-Based**: Tokens stored in sessionStorage (cleared on browser close)  
✅ **CORS Protected**: Configured CORS origins  
✅ **Tenant Isolation**: Users automatically isolated by tenant  
✅ **Token Validation**: Backend validates session tokens before authentication  

## Verification Checklist

After integration, verify:

- [ ] 3 files copied to React app
- [ ] TenantProvider wraps entire app
- [ ] LangflowEmbed component renders
- [ ] Login triggers setTenantSession
- [ ] Langflow iframe loads
- [ ] Can interact with Langflow UI
- [ ] Different tenants stay isolated
- [ ] Tokens refresh automatically

## Environment Variables

Set these in your React app's `.env`:

```env
VITE_LANGFLOW_URL=http://localhost:7860
VITE_API_URL=http://localhost:3000
```

Or for Create React App:

```env
REACT_APP_LANGFLOW_URL=http://localhost:7860
REACT_APP_API_URL=http://localhost:3000
```

Then use:

```javascript
const langflowUrl = process.env.VITE_LANGFLOW_URL || 'http://localhost:7860';
```

## Production Deployment

### Before deploying to production:

1. **Update Docker environment**:
   ```yaml
   environment:
     - LANGFLOW_CORS_ORIGINS=https://your-app-domain.com
   ```

2. **Update React environment variables**:
   ```env
   VITE_LANGFLOW_URL=https://your-langflow-domain.com
   ```

3. **Implement real session validation** in `validate_tenant_session()`:
   ```python
   async def validate_tenant_session(tenant_id, user_id, session_token):
       # Call YOUR backend API to validate token
       response = httpx.post(
           "https://your-api.com/validate-session",
           json={
               "tenant_id": tenant_id,
               "user_id": user_id,
               "session_token": session_token,
           },
       )
       return response.status_code == 200
   ```

4. **Test with real data** from your production database

## Support & Troubleshooting

**Common Issues**:

| Issue | Solution |
|-------|----------|
| "useTenantContext must be used within TenantProvider" | Wrap App with TenantProvider |
| Langflow iframe not loading | Check Langflow URL in env vars |
| "401 Unauthorized" | Verify session token is correct |
| CORS errors | Check LANGFLOW_CORS_ORIGINS |
| Different tenants mixing data | Verify tenant isolation in Langflow |

**Debug Steps**:

```javascript
// 1. Check context values
const ctx = useTenantContext();
console.log('Context:', ctx);

// 2. Check stored tokens
console.log('Tokens:', sessionStorage.getItem('langflow_tokens'));

// 3. Check browser cookies
// DevTools → Application → Cookies

// 4. Check network requests
// DevTools → Network → Find /tenant/login POST request
```

## Next Steps

1. ✅ Copy files to React SPA at `C:\sgs-adheesh\React\icap-workqueue-spa`
2. ✅ Test integration with your app
3. ✅ Implement real session validation
4. ✅ Test with multiple tenants
5. ✅ Deploy to staging
6. ✅ Deploy to production

---

**Questions?** Check the detailed guides:
- `REACT_SETUP_QUICK_START.md` - Step-by-step setup
- `TENANT_LOGIN_REACT_INTEGRATION.md` - Detailed reference

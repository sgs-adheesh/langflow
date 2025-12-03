# React SPA - Langflow Tenant Login Quick Setup

## 3-Step Integration

### Step 1: Copy Files to Your React App

Copy these 3 files to your React SPA at `C:\sgs-adheesh\React\icap-workqueue-spa`:

**File 1**: `useTenantLogin.js`  
**Path**: `src/hooks/useTenantLogin.js`

**File 2**: `LangflowEmbed.jsx`  
**Path**: `src/components/LangflowEmbed.jsx`

**File 3**: `TenantContext.jsx`  
**Path**: `src/context/TenantContext.jsx`

### Step 2: Wrap Your App with TenantProvider

In your `src/App.jsx` or `src/main.jsx`:

```javascript
// ... existing imports ...
import { TenantProvider } from './context/TenantContext';

function App() {
  return (
    <TenantProvider>
      {/* Your existing routes and components */}
    </TenantProvider>
  );
}

export default App;
```

### Step 3: Use LangflowEmbed in Your Page

In the page where you want to embed Langflow (e.g., `src/pages/WorkflowPage.jsx`):

```javascript
import { useTenantContext } from '../context/TenantContext';
import { LangflowEmbed } from '../components/LangflowEmbed';

export function WorkflowPage() {
  const { currentTenant, currentUser, sessionToken } = useTenantContext();

  if (!currentTenant || !currentUser) {
    return <div>Please select a tenant and user first</div>;
  }

  return (
    <div className="workflow-page">
      <h1>Workflow Builder - {currentTenant.name}</h1>
      
      <LangflowEmbed
        tenantId={currentTenant.id}
        userId={currentUser.id}
        sessionToken={sessionToken}
        langflowUrl="http://localhost:7860"
        height="800px"
        width="100%"
        onAuthSuccess={() => console.log('Authenticated with Langflow')}
        onAuthError={(err) => console.error('Auth failed:', err)}
      />
    </div>
  );
}
```

## Setting Tenant Session on Login

After user logs in to your app, set the tenant session:

```javascript
import { useTenantContext } from '../context/TenantContext';

export function LoginPage() {
  const { setTenantSession } = useTenantContext();

  const handleLogin = async (username, password) => {
    // 1. Call YOUR login API
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    // 2. Set tenant session with user data and session token
    setTenantSession(
      data.tenant,        // { id: "tenant-123", name: "Acme Corp" }
      data.user,          // { id: "user-456", name: "John Doe" }
      data.sessionToken   // Your app's session token
    );

    // 3. Navigate to workflow page
    navigate('/workflow');
  };

  return (
    // ... login form ...
  );
}
```

## Configuration

### For Different Langflow URL

Set environment variable in `.env`:

```env
VITE_LANGFLOW_URL=http://localhost:7860
REACT_APP_LANGFLOW_URL=http://localhost:7860  # For Create React App
```

Then use:

```javascript
const langflowUrl = process.env.VITE_LANGFLOW_URL || 'http://localhost:7860';

<LangflowEmbed
  tenantId={currentTenant.id}
  userId={currentUser.id}
  sessionToken={sessionToken}
  langflowUrl={langflowUrl}
/>
```

## Styling

### Customize LangflowEmbed Style

Pass custom height/width:

```javascript
<LangflowEmbed
  // ... other props ...
  height="900px"
  width="100%"
/>
```

Or with CSS:

```css
.workflow-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.langflow-embed {
  flex: 1;
  overflow: hidden;
}
```

```javascript
<div className="workflow-container">
  <h1>My Workflow</h1>
  <div className="langflow-embed">
    <LangflowEmbed
      tenantId={currentTenant.id}
      userId={currentUser.id}
      sessionToken={sessionToken}
    />
  </div>
</div>
```

## Testing

### Test in Browser Console

```javascript
// Get tenant context
const { currentTenant, currentUser, sessionToken } = useTenantContext();

// Check if values are set
console.log('Tenant:', currentTenant);
console.log('User:', currentUser);
console.log('Token:', sessionToken);

// Check stored tokens
const storedTokens = JSON.parse(sessionStorage.getItem('langflow_tokens'));
console.log('Langflow tokens:', storedTokens);
```

### Test Network Requests

In DevTools Network tab:
1. Look for POST request to `/api/v1/tenant/login`
2. Check Response for JWT tokens
3. Check Response Headers for `Set-Cookie`

## Troubleshooting

### Issue: "Cannot find module 'useTenantLogin'"

**Solution**: Verify file is at `src/hooks/useTenantLogin.js`

### Issue: "useTenantContext must be used within TenantProvider"

**Solution**: Ensure `<TenantProvider>` wraps your entire app

### Issue: Langflow iframe not loading

**Solution**: 
1. Check Langflow is running: `docker ps`
2. Check CORS: Browser console for CORS errors
3. Check URL in LangflowEmbed component

### Issue: "401 Unauthorized" from Langflow

**Solution**: Session token is not being set properly. Check:
1. `sessionToken` is passed to LangflowEmbed
2. Session token is from your app's login response
3. Langflow backend's `validate_tenant_session()` returns True

## Next Steps

1. ✅ Copy 3 files to your React app
2. ✅ Wrap app with TenantProvider
3. ✅ Use LangflowEmbed in your page
4. ✅ Set tenant session on user login
5. ✅ Test with different tenants
6. ✅ Deploy to production

## Production Checklist

- [ ] Update LANGFLOW_CORS_ORIGINS in Docker
- [ ] Use production Langflow URL
- [ ] Implement session token validation on your backend
- [ ] Test with real tenant data
- [ ] Monitor Langflow logs for errors
- [ ] Set up error logging/monitoring

## Support

For issues, check:
1. Docker logs: `docker logs docker_example-langflow-1`
2. Browser console: Check for errors
3. Network tab: Check tenant/login request
4. Tenant session context: Use browser console to inspect

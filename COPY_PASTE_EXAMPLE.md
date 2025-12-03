# Copy-Paste Ready Example

## Minimal Example (Copy & Paste Ready)

### Step 1: Copy These 3 Files

**File 1: `src/hooks/useTenantLogin.js`**  
(See `useTenantLogin.js` in this folder)

**File 2: `src/components/LangflowEmbed.jsx`**  
(See `LangflowEmbed.jsx` in this folder)

**File 3: `src/context/TenantContext.jsx`**  
(See `TenantContext.jsx` in this folder)

### Step 2: Update Your App.jsx

Replace the entire file content with this:

```javascript
import { TenantProvider } from './context/TenantContext';
import LoginPage from './pages/LoginPage';
import WorkflowPage from './pages/WorkflowPage';
import { useState } from 'react';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <TenantProvider>
      <div className="app">
        {!isLoggedIn ? (
          <LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />
        ) : (
          <WorkflowPage onLogout={() => setIsLoggedIn(false)} />
        )}
      </div>
    </TenantProvider>
  );
}
```

### Step 3: Create LoginPage.jsx

Create file `src/pages/LoginPage.jsx`:

```javascript
import { useTenantContext } from '../context/TenantContext';
import { useState } from 'react';

export default function LoginPage({ onLoginSuccess }) {
  const { setTenantSession } = useTenantContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const username = e.target.username.value;
      const password = e.target.password.value;

      // Call YOUR backend login API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();

      // Set tenant session for Langflow
      setTenantSession(
        { id: data.tenantId, name: data.tenantName },  // Tenant info
        { id: data.userId, name: data.userName },       // User info
        data.sessionToken                               // Session token
      );

      // Redirect to workflow
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <form onSubmit={handleLogin} style={{
        padding: '40px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '300px',
      }}>
        <h2 style={{ textAlign: 'center' }}>Login</h2>

        {error && (
          <div style={{
            padding: '10px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '15px',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Username
          </label>
          <input
            type="text"
            name="username"
            required
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

### Step 4: Create WorkflowPage.jsx

Create file `src/pages/WorkflowPage.jsx`:

```javascript
import { useTenantContext } from '../context/TenantContext';
import { LangflowEmbed } from '../components/LangflowEmbed';

export default function WorkflowPage({ onLogout }) {
  const { currentTenant, currentUser, sessionToken, clearTenantSession } = useTenantContext();

  const handleLogout = () => {
    clearTenantSession();
    onLogout();
  };

  if (!currentTenant || !currentUser || !sessionToken) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading tenant session...</h2>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        backgroundColor: '#2196F3',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0' }}>Workflow Builder</h1>
          <p style={{ margin: '0', fontSize: '14px' }}>
            Tenant: {currentTenant.name || currentTenant.id} | 
            User: {currentUser.name || currentUser.id}
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            backgroundColor: 'white',
            color: '#2196F3',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Logout
        </button>
      </div>

      {/* Langflow Embed */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <LangflowEmbed
          tenantId={currentTenant.id}
          userId={currentUser.id}
          sessionToken={sessionToken}
          langflowUrl="http://localhost:7860"
          height="100%"
          width="100%"
          onAuthSuccess={() => {
            console.log('✅ Successfully authenticated with Langflow');
          }}
          onAuthError={(error) => {
            console.error('❌ Failed to authenticate with Langflow:', error);
          }}
        />
      </div>
    </div>
  );
}
```

### Step 5: Update Your Backend API Response

Your login endpoint should return:

```json
{
  "tenantId": "tenant-123",
  "tenantName": "Acme Corp",
  "userId": "user-456",
  "userName": "John Doe",
  "sessionToken": "your-session-token-here",
  "accessToken": "your-jwt-token",
  ...other fields...
}
```

## That's It! 🎉

You now have:
- ✅ Login page with tenant selection
- ✅ Workflow page with embedded Langflow
- ✅ Automatic authentication
- ✅ Tenant isolation
- ✅ Logout functionality

## Testing

1. Start your React app: `npm start`
2. Login with test credentials
3. Langflow UI should load automatically
4. You should be able to interact with Langflow workflows

## Customization

### Change Langflow URL

In `WorkflowPage.jsx`:

```javascript
<LangflowEmbed
  langflowUrl="http://your-langflow-domain.com"
  // ... rest of props
/>
```

Or use environment variable:

```javascript
const langflowUrl = process.env.REACT_APP_LANGFLOW_URL || 'http://localhost:7860';

<LangflowEmbed
  langflowUrl={langflowUrl}
  // ... rest of props
/>
```

### Change Styling

Update styles in LoginPage or WorkflowPage to match your app's design.

### Add Additional Features

- Add tenant selector on workflow page
- Add user profile menu
- Add refresh token handling
- Add error boundaries
- Add loading skeletons

## Troubleshooting

### Langflow not loading?
1. Check Docker is running: `docker ps`
2. Check URL is correct
3. Check browser console for errors
4. Check Network tab in DevTools

### Login not working?
1. Check your API endpoint is correct
2. Check response format matches expected JSON
3. Check session token is being sent

### Tenant isolation not working?
1. Check `tenantId` is unique per tenant
2. Check `userId` is unique per user
3. Check backend validation is working

## Next Steps

1. ✅ Copy files and create pages
2. ✅ Update login API endpoint
3. ✅ Test with your data
4. ✅ Customize styling
5. ✅ Deploy to staging
6. ✅ Deploy to production

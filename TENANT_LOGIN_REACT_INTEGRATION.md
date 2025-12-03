# Tenant Login Integration for React SPA

This guide helps you integrate the Langflow tenant authentication into your React application.

## Overview

Your React app will:
1. Authenticate users in your app
2. Call the `/api/v1/tenant/login` endpoint
3. Receive Langflow JWT tokens
4. Automatically log users into Langflow
5. Load Langflow UI in an iframe or embedded component

## Installation Steps

### Step 1: Copy the Tenant Login Hook

Create a file at: `src/hooks/useTenantLogin.js`

```javascript
import { useCallback, useState } from 'react';

/**
 * Hook to handle tenant-based login to Langflow
 */
export const useTenantLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokens, setTokens] = useState(null);

  const loginToLangflow = useCallback(async (tenantId, userId, sessionToken, username = null) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:7860/api/v1/tenant/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: sends cookies
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: userId,
          session_token: sessionToken,
          username: username,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to login to Langflow');
      }

      const data = await response.json();
      setTokens(data);
      
      // Store tokens in localStorage for future use
      localStorage.setItem('langflow_tokens', JSON.stringify(data));
      
      return data;
    } catch (err) {
      const errorMsg = err.message || 'Unknown error occurred';
      setError(errorMsg);
      console.error('Langflow login error:', errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loginToLangflow,
    tokens,
    loading,
    error,
  };
};
```

### Step 2: Create Langflow Embedded Component

Create a file at: `src/components/LangflowEmbed.jsx`

```javascript
import React, { useEffect, useRef, useState } from 'react';
import { useTenantLogin } from '../hooks/useTenantLogin';

/**
 * Component to embed Langflow in an iframe
 * Automatically handles tenant-based authentication
 */
export const LangflowEmbed = ({ 
  tenantId, 
  userId, 
  sessionToken, 
  langflowUrl = 'http://localhost:7860',
  height = '600px',
  width = '100%',
}) => {
  const iframeRef = useRef(null);
  const { loginToLangflow, loading, error, tokens } = useTenantLogin();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Authenticate with Langflow when component mounts or when props change
    const authenticate = async () => {
      try {
        await loginToLangflow(tenantId, userId, sessionToken);
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Failed to authenticate with Langflow:', err);
        setIsAuthenticated(false);
      }
    };

    if (tenantId && userId && sessionToken) {
      authenticate();
    }
  }, [tenantId, userId, sessionToken, loginToLangflow]);

  if (loading) {
    return <div>Authenticating with Langflow...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!isAuthenticated) {
    return <div>Failed to authenticate with Langflow</div>;
  }

  return (
    <iframe
      ref={iframeRef}
      src={langflowUrl}
      style={{
        width: width,
        height: height,
        border: 'none',
        borderRadius: '8px',
      }}
      title="Langflow"
      allow="camera;microphone"
    />
  );
};
```

### Step 3: Use in Your Page Component

In your page where you want to embed Langflow (e.g., `src/pages/WorkflowPage.jsx`):

```javascript
import React from 'react';
import { LangflowEmbed } from '../components/LangflowEmbed';
import { useAuth } from '../hooks/useAuth'; // Your existing auth hook

export const WorkflowPage = () => {
  const { user, tenant } = useAuth(); // Get current user & tenant from your app

  return (
    <div className="workflow-page">
      <h1>Workflow Builder</h1>
      
      <LangflowEmbed
        tenantId={tenant.id}           // Your tenant ID
        userId={user.id}               // Your user ID
        sessionToken={user.sessionToken} // Token from your app's login
        langflowUrl="http://localhost:7860"
        height="800px"
        width="100%"
      />
    </div>
  );
};
```

## Configuration

### CORS Configuration (if using different domains)

In your `.env` file, set:

```env
REACT_APP_LANGFLOW_URL=http://localhost:7860
REACT_APP_API_URL=http://localhost:3000
```

Then use:

```javascript
const langflowUrl = process.env.REACT_APP_LANGFLOW_URL || 'http://localhost:7860';
```

### Production Setup

For production, update your Langflow Docker environment:

```bash
LANGFLOW_CORS_ORIGINS=https://your-app-domain.com
```

## Session Management

### Store Tenant Context

Create a context for managing tenant session: `src/context/TenantContext.js`

```javascript
import React, { createContext, useContext, useState } from 'react';

const TenantContext = createContext();

export const TenantProvider = ({ children }) => {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);

  const setTenantSession = (tenant, user, token) => {
    setCurrentTenant(tenant);
    setCurrentUser(user);
    setSessionToken(token);
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        currentUser,
        sessionToken,
        setTenantSession,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenantContext = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within TenantProvider');
  }
  return context;
};
```

### Use in App

In your `src/App.jsx`:

```javascript
import { TenantProvider } from './context/TenantContext';

function App() {
  return (
    <TenantProvider>
      {/* Your app routes */}
    </TenantProvider>
  );
}
```

## Testing

### 1. Test with curl (from your backend)

```bash
curl -X POST http://localhost:7860/api/v1/tenant/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-123",
    "user_id": "user-456",
    "session_token": "your-session-token",
    "username": "john.doe"
  }'
```

### 2. Test in Browser Console

```javascript
const response = await fetch('http://localhost:7860/api/v1/tenant/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    tenant_id: 'test-tenant',
    user_id: 'test-user',
    session_token: 'test-token',
  }),
});

const data = await response.json();
console.log('Langflow tokens:', data);
```

## Troubleshooting

### Issue: "Method Not Allowed" (405)

**Solution**: Ensure Langflow is running and the endpoint is registered:
```bash
docker-compose logs langflow | grep "tenant"
```

### Issue: CORS Errors

**Solution**: Add CORS configuration to Langflow Docker:

```yaml
services:
  langflow:
    environment:
      - LANGFLOW_CORS_ORIGINS=*
```

Or for production:
```yaml
      - LANGFLOW_CORS_ORIGINS=https://your-domain.com
```

### Issue: Cookies Not Being Set

**Solution**: Ensure `credentials: 'include'` is in your fetch options.

### Issue: User Not Created in Langflow

**Solution**: The `validate_tenant_session()` function must return `True`. Update it in `tenant_login.py`:

```python
async def validate_tenant_session(
    tenant_id: str,
    user_id: str,
    session_token: str,
) -> bool:
    """Validate session from your main app"""
    try:
        # Call YOUR app's validation API
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
    except Exception:
        return False
```

## Security Best Practices

1. **Never expose session tokens in logs**
2. **Use HTTPS in production**
3. **Validate session tokens on your backend before sending to Langflow**
4. **Use HTTP-only cookies for token storage**
5. **Implement token expiration and refresh logic**

## Next Steps

1. Copy the hooks and components to your React app
2. Update the Langflow URL to match your deployment
3. Implement proper session validation on your backend
4. Test with your actual tenant and user data
5. Deploy and monitor for errors

Need help? Check the Docker logs:
```bash
docker logs docker_example-langflow-1
```

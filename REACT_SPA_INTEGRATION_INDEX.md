# React SPA Langflow Integration - Complete Files Index

## 📦 What You're Getting

Complete React integration for Langflow tenant authentication with multi-tenant support.

## 📁 Files in This Folder

### Frontend Components (Ready to Copy)

1. **`useTenantLogin.js`** ⭐
   - React hook for Langflow authentication
   - Location: `src/hooks/useTenantLogin.js`
   - Functions: `loginToLangflow()`, `logout()`, `getStoredTokens()`

2. **`LangflowEmbed.jsx`** ⭐
   - React component to embed Langflow in iframe
   - Location: `src/components/LangflowEmbed.jsx`
   - Props: `tenantId`, `userId`, `sessionToken`, `langflowUrl`

3. **`TenantContext.jsx`** ⭐
   - React context for tenant session management
   - Location: `src/context/TenantContext.jsx`
   - Provider component + custom hook

### Documentation & Guides

4. **`COPY_PASTE_EXAMPLE.md`** 🔥 **START HERE**
   - Complete working example
   - Copy-paste ready code
   - LoginPage + WorkflowPage implementation
   - Best for quick integration

5. **`REACT_SETUP_QUICK_START.md`**
   - 3-step setup guide
   - Configuration options
   - Testing instructions
   - Troubleshooting

6. **`TENANT_LOGIN_REACT_INTEGRATION.md`**
   - Detailed reference documentation
   - Architecture explanation
   - Security best practices
   - Advanced features

7. **`REACT_INTEGRATION_SUMMARY.md`**
   - Overview of all components
   - Data flow diagram
   - Example usage
   - Deployment checklist

### Backend Documentation

8. **`TENANT_AUTH_BRIDGE_GUIDE.md`**
   - How the backend endpoint works
   - Architecture overview
   - Security explanation

9. **`HOW_TO_TEST.md`**
   - Testing procedures
   - curl examples
   - Browser console testing

10. **`TESTING_TENANT_AUTH.md`**
    - Comprehensive testing guide
    - All test scenarios
    - Troubleshooting

## 🚀 Quick Start (5 Minutes)

### 1. Copy 3 Files to Your React App

```
Copy these files to your React SPA:
- useTenantLogin.js        → src/hooks/useTenantLogin.js
- LangflowEmbed.jsx        → src/components/LangflowEmbed.jsx
- TenantContext.jsx        → src/context/TenantContext.jsx
```

### 2. Update App.jsx

Wrap your app with `<TenantProvider>`:

```javascript
import { TenantProvider } from './context/TenantContext';

export default function App() {
  return (
    <TenantProvider>
      {/* Your routes */}
    </TenantProvider>
  );
}
```

### 3. Use in Your Page

```javascript
import { LangflowEmbed } from '../components/LangflowEmbed';

<LangflowEmbed
  tenantId="tenant-123"
  userId="user-456"
  sessionToken="your-token"
/>
```

## 📖 Which Guide to Read?

| Goal | Read This |
|------|-----------|
| **Get it working ASAP** | `COPY_PASTE_EXAMPLE.md` |
| **Understand integration** | `REACT_SETUP_QUICK_START.md` |
| **Deep dive details** | `TENANT_LOGIN_REACT_INTEGRATION.md` |
| **Architecture overview** | `REACT_INTEGRATION_SUMMARY.md` |
| **Backend explanation** | `TENANT_AUTH_BRIDGE_GUIDE.md` |

## 🔧 What Each Component Does

### useTenantLogin Hook
```javascript
const { loginToLangflow, tokens, loading, error } = useTenantLogin();

// Call this to authenticate with Langflow
await loginToLangflow(tenantId, userId, sessionToken);
```

**Features:**
- Calls `/api/v1/tenant/login` endpoint
- Handles JWT token storage
- Manages loading/error states
- Stores tokens in sessionStorage + localStorage

### LangflowEmbed Component
```javascript
<LangflowEmbed
  tenantId={tenant.id}
  userId={user.id}
  sessionToken={token}
  onAuthSuccess={() => console.log('Ready!')}
/>
```

**Features:**
- Automatically authenticates user
- Renders Langflow in iframe
- Shows loading state
- Error handling
- Customizable styling

### TenantContext
```javascript
const { currentTenant, currentUser, sessionToken, setTenantSession } = useTenantContext();

// After user logs in to your app
setTenantSession(tenant, user, sessionToken);
```

**Features:**
- Store tenant session across app
- Persist session in sessionStorage
- Restore session on page reload
- Clear session on logout

## 🎯 Data Flow

```
User Login
    ↓
Your App's Login API
    ↓
setTenantSession(tenant, user, token)
    ↓
<LangflowEmbed />
    ↓
Calls loginToLangflow()
    ↓
POST /api/v1/tenant/login
    ↓
Returns JWT tokens
    ↓
Loads Langflow iframe
    ↓
User can access Langflow
```

## 🔐 Multi-Tenant Support

Each tenant gets isolated:

```javascript
// Tenant A - User 1
setTenantSession(
  { id: 'tenant-a' },
  { id: 'user-1' },
  'token-a'
);
// Langflow user: "tenant_tenant-a_user-1"

// Tenant B - User 1 (same user, different tenant)
setTenantSession(
  { id: 'tenant-b' },
  { id: 'user-1' },
  'token-b'
);
// Langflow user: "tenant_tenant-b_user-1"

// Both isolated, no data mixing
```

## 📋 Integration Checklist

- [ ] Copy 3 React files to your app
- [ ] Wrap App with TenantProvider
- [ ] Create LoginPage component
- [ ] Create WorkflowPage component
- [ ] Update login API endpoint
- [ ] Test with sample data
- [ ] Verify Langflow loads
- [ ] Test tenant isolation
- [ ] Deploy to staging
- [ ] Deploy to production

## ⚙️ Environment Variables

Set in your `.env` file:

```env
# For Vite
VITE_LANGFLOW_URL=http://localhost:7860
VITE_API_URL=http://localhost:3000

# For Create React App
REACT_APP_LANGFLOW_URL=http://localhost:7860
REACT_APP_API_URL=http://localhost:3000
```

## 🔧 Configuration

### Change Langflow URL

```javascript
<LangflowEmbed
  langflowUrl={process.env.REACT_APP_LANGFLOW_URL}
  // ...
/>
```

### Change Styling

All components use inline styles. Customize in:
- `LangflowEmbed.jsx` - Modify iframe container styles
- `COPY_PASTE_EXAMPLE.md` - LoginPage/WorkflowPage styles

### Add Features

Examples of what you can add:
- Tenant selector dropdown
- User profile menu
- Logout confirmation
- Token refresh handling
- Error logging
- Analytics tracking

## 🐛 Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| "Cannot find module" | Check file paths are correct |
| "useTenantContext must be used within TenantProvider" | Wrap App with TenantProvider |
| Langflow iframe blank | Check Langflow URL, check CORS settings |
| "401 Unauthorized" | Verify session token is correct |
| Different tenants mixed | Check tenantId uniqueness |

### Debug Steps

```javascript
// 1. Check context
const ctx = useTenantContext();
console.log(ctx);

// 2. Check stored tokens
console.log(sessionStorage.getItem('langflow_tokens'));

// 3. Check cookies
// DevTools → Application → Cookies

// 4. Check network
// DevTools → Network → POST /api/v1/tenant/login
```

## 📞 Support

### Check Logs

```bash
# Langflow logs
docker logs docker_example-langflow-1

# Your app console
# Browser DevTools → Console tab

# Network requests
# Browser DevTools → Network tab
```

### Check Documentation

- Detailed setup: `REACT_SETUP_QUICK_START.md`
- Complete reference: `TENANT_LOGIN_REACT_INTEGRATION.md`
- Working example: `COPY_PASTE_EXAMPLE.md`

## 🚢 Deployment

### Before Production

1. ✅ Update Langflow Docker CORS:
   ```yaml
   LANGFLOW_CORS_ORIGINS=https://your-domain.com
   ```

2. ✅ Update React env vars to production URLs

3. ✅ Implement real session validation in backend

4. ✅ Test with real tenant data

5. ✅ Set up error monitoring

### Production Checklist

- [ ] CORS origins configured
- [ ] HTTPS enabled
- [ ] Session validation implemented
- [ ] Token expiration configured
- [ ] Error logging enabled
- [ ] Performance monitoring enabled
- [ ] Security headers configured
- [ ] Tested with production data

## 📊 Architecture Summary

```
React App
├── Context (TenantContext)
│   └── Manages tenant session
├── Pages
│   ├── LoginPage
│   │   └── Calls your backend API
│   └── WorkflowPage
│       └── Uses LangflowEmbed
├── Components
│   └── LangflowEmbed
│       ├── Uses useTenantLogin hook
│       └── Renders iframe
└── Hooks
    └── useTenantLogin
        └── Calls /api/v1/tenant/login
            ↓
        Langflow
        └── Creates tenant user
```

## 🎓 Learning Resources

- React Hooks: https://react.dev/reference/react
- Context API: https://react.dev/reference/react/useContext
- Iframe communication: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- JWT tokens: https://jwt.io/

## 📝 Notes

- All components use React 16.8+ (hooks support)
- Compatible with Vite, Create React App, and Next.js
- No external dependencies (only React)
- CSS is inline (customize as needed)
- Token storage in both sessionStorage and localStorage

## ✅ Ready to Start?

1. Read: `COPY_PASTE_EXAMPLE.md`
2. Copy 3 files to your React app
3. Create LoginPage and WorkflowPage
4. Test with your backend
5. Deploy!

---

**Last Updated**: November 28, 2025  
**Langflow Version**: Latest (Docker)  
**React Support**: 16.8+

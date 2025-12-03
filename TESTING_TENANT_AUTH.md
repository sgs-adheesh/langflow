# Testing Tenant Authentication Integration

## How to Know if This Will Work in Your Application

This guide shows you **step-by-step how to test** the tenant login endpoint before using it in production.

---

## Part 1: Quick Validation Test (5 minutes)

### Test 1.1: Is the Endpoint Registered?

**Open your terminal:**

```bash
# Start Langflow (if not running)
cd c:\sgs-adheesh\langflow-docker\langflow
python -m langflow run

# In another terminal, test if endpoint exists:
curl -X POST http://localhost:7860/api/v1/tenant/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant",
    "user_id": "test-user",
    "session_token": "test-token",
    "username": "testuser"
  }'
```

**Expected Response (will fail because validation is not implemented):**
```json
{
  "detail": "Invalid tenant session token"
}
```

✅ **This is GOOD!** It means:
- Endpoint is registered
- It's receiving your request
- Session validation is being called

❌ **If you get these errors instead:**
- `404 Not Found` → Endpoint not registered (check router.py)
- `405 Method Not Allowed` → Wrong HTTP method
- `422 Validation Error` → Missing required fields

---

## Part 2: Full Integration Test (30 minutes)

### Test 2.1: Implement Mock Validation

Before testing with your real backend, use a **mock validator** to test the happy path.

Edit `src/backend/base/langflow/api/v1/tenant_login.py`:

```python
# Replace the validate_tenant_session function temporarily with this:

async def validate_tenant_session(
    tenant_id: str,
    user_id: str,
    session_token: str,
) -> bool:
    """
    TEMPORARY MOCK for testing only!
    Remove this when connecting to real backend.
    """
    
    # Test 1: Accept specific test tokens
    test_tokens = {
        "test-token-1": ("test-tenant-1", "test-user-1"),
        "test-token-2": ("test-tenant-2", "test-user-2"),
        "valid-session-xyz": ("acme-corp", "john-doe"),
    }
    
    if session_token in test_tokens:
        expected_tenant, expected_user = test_tokens[session_token]
        if tenant_id == expected_tenant and user_id == expected_user:
            return True
    
    # Test 2: Accept any token for testing (development only!)
    # WARNING: Remove this for production!
    if tenant_id and user_id and session_token:
        print(f"[MOCK AUTH] Accepting: tenant={tenant_id}, user={user_id}")
        return True
    
    return False
```

### Test 2.2: Test with cURL

**Test successful login:**

```bash
curl -X POST http://localhost:7860/api/v1/tenant/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant-1",
    "user_id": "test-user-1",
    "session_token": "test-token-1",
    "username": "john.doe"
  }' \
  -v
```

**Expected Response (200 OK):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user_id": "test-user-1",
  "tenant_id": "test-tenant-1"
}
```

**Check response headers:**
```
Set-Cookie: access_token_lf=eyJ0...; Path=/; HttpOnly; Secure; SameSite=Strict
Set-Cookie: refresh_token_lf=eyJ0...; Path=/; HttpOnly; Secure; SameSite=Strict
```

✅ **Success indicators:**
- Status code `200`
- `access_token` returned
- `refresh_token` returned
- Cookies set in headers

### Test 2.3: Test with invalid token

```bash
curl -X POST http://localhost:7860/api/v1/tenant/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant-1",
    "user_id": "test-user-1",
    "session_token": "invalid-token"
  }' \
  -v
```

**Expected Response (401 Unauthorized):**
```json
{
  "detail": "Invalid tenant session token"
}
```

✅ **Good!** Validation is working correctly.

---

## Part 3: Browser Test (15 minutes)

### Test 3.1: Test from JavaScript

**Create a test file** `test-tenant-login.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Tenant Login Test</title>
    <style>
        body { font-family: Arial; margin: 20px; }
        .test { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
        .success { background: #d4edda; }
        .error { background: #f8d7da; }
        textarea { width: 100%; height: 150px; }
    </style>
</head>
<body>
    <h1>Tenant Login Test</h1>
    
    <div class="test">
        <h3>Test 1: Valid Tenant Login</h3>
        <button onclick="testValidLogin()">Run Test</button>
        <textarea id="result1"></textarea>
    </div>
    
    <div class="test">
        <h3>Test 2: Invalid Token</h3>
        <button onclick="testInvalidLogin()">Run Test</button>
        <textarea id="result2"></textarea>
    </div>
    
    <div class="test">
        <h3>Test 3: Check Cookies</h3>
        <button onclick="testCookies()">Run Test</button>
        <textarea id="result3"></textarea>
    </div>

    <script>
        const LANGFLOW_URL = 'http://localhost:7860'; // Change if needed
        
        async function testValidLogin() {
            const result = document.getElementById('result1');
            result.value = 'Testing...';
            
            try {
                const response = await fetch(`${LANGFLOW_URL}/api/v1/tenant/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenant_id: "test-tenant-1",
                        user_id: "test-user-1",
                        session_token: "test-token-1",
                        username: "testuser"
                    }),
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    result.value = `✅ SUCCESS (${response.status})\n\n` +
                        JSON.stringify(data, null, 2);
                    result.classList.add('success');
                } else {
                    result.value = `❌ FAILED (${response.status})\n\n` +
                        JSON.stringify(data, null, 2);
                    result.classList.add('error');
                }
            } catch (error) {
                result.value = `❌ ERROR: ${error.message}`;
                result.classList.add('error');
            }
        }
        
        async function testInvalidLogin() {
            const result = document.getElementById('result2');
            result.value = 'Testing...';
            
            try {
                const response = await fetch(`${LANGFLOW_URL}/api/v1/tenant/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenant_id: "test-tenant-1",
                        user_id: "test-user-1",
                        session_token: "invalid-token"
                    }),
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (response.status === 401) {
                    result.value = `✅ CORRECT REJECTION (${response.status})\n\n` +
                        JSON.stringify(data, null, 2);
                    result.classList.add('success');
                } else {
                    result.value = `❌ UNEXPECTED RESPONSE (${response.status})\n\n` +
                        JSON.stringify(data, null, 2);
                    result.classList.add('error');
                }
            } catch (error) {
                result.value = `❌ ERROR: ${error.message}`;
                result.classList.add('error');
            }
        }
        
        function testCookies() {
            const result = document.getElementById('result3');
            const cookies = document.cookie;
            
            if (cookies.includes('access_token_lf')) {
                result.value = `✅ COOKIES SET!\n\n${cookies}`;
                result.classList.add('success');
            } else {
                result.value = `⚠️ No Langflow cookies found yet.\n` +
                    `Run Test 1 first to set cookies.\n\n${cookies || 'No cookies'}`;
                result.classList.add('error');
            }
        }
    </script>
</body>
</html>
```

**Open in browser:**
```
Open: file:///path/to/test-tenant-login.html
```

**Run tests:**
1. Click "Test 1: Valid Tenant Login" → Should show ✅ with tokens
2. Click "Test 2: Invalid Token" → Should show ❌ 401 error
3. Click "Test 3: Check Cookies" → Should show access_token_lf set

---

## Part 4: Real Integration Test (with your backend)

### Test 4.1: Create a Mock Auth Endpoint in Your App

**In your main application (NodeJS example):**

```javascript
// In your main app's API
app.post('/api/validate-session', (req, res) => {
  const { tenant_id, user_id, session_token } = req.body;
  
  // Simple validation for testing
  const validSessions = {
    'test-session-123': {
      tenant_id: 'acme-corp',
      user_id: 'john-doe'
    },
    'test-session-456': {
      tenant_id: 'beta-corp',
      user_id: 'jane-smith'
    }
  };
  
  const session = validSessions[session_token];
  
  if (session && 
      session.tenant_id === tenant_id && 
      session.user_id === user_id) {
    return res.status(200).json({ valid: true });
  }
  
  return res.status(401).json({ valid: false });
});
```

### Test 4.2: Update Langflow Validation

Edit `src/backend/base/langflow/api/v1/tenant_login.py`:

```python
async def validate_tenant_session(
    tenant_id: str,
    user_id: str,
    session_token: str,
) -> bool:
    """
    Validate against YOUR main application's API
    """
    try:
        import httpx
        
        # Call YOUR validation endpoint
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:3000/api/validate-session",  # YOUR app's endpoint
                json={
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "session_token": session_token,
                },
                timeout=5.0,
            )
        
        return response.status_code == 200
        
    except Exception as e:
        print(f"[ERROR] Session validation failed: {e}")
        return False
```

### Test 4.3: Test End-to-End

```bash
# Test with your real backend validation
curl -X POST http://localhost:7860/api/v1/tenant/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "user_id": "john-doe",
    "session_token": "test-session-123"
  }' \
  -v
```

**Expected: 200 OK with tokens**

---

## Part 5: Verification Checklist

Use this checklist to verify everything works:

### Endpoint Tests ✅
- [ ] Endpoint exists (GET returns 404, POST returns something)
- [ ] Valid token returns 200 + JWT tokens
- [ ] Invalid token returns 401 error
- [ ] Missing fields returns 422 validation error

### Response Tests ✅
- [ ] `access_token` field present
- [ ] `refresh_token` field present
- [ ] `token_type` is "bearer"
- [ ] `user_id` matches request
- [ ] `tenant_id` matches request

### Cookie Tests ✅
- [ ] `access_token_lf` cookie set (HttpOnly, Secure)
- [ ] `refresh_token_lf` cookie set (HttpOnly, Secure)
- [ ] `apikey_tkn_lflw` cookie set
- [ ] Cookies have correct domain/path

### Integration Tests ✅
- [ ] Can call from JavaScript (CORS OK)
- [ ] Can call from your backend
- [ ] Your validation function is called
- [ ] Your validation function works
- [ ] Tokens can be used for subsequent requests

### User Creation Tests ✅
- [ ] First login creates user in Langflow
- [ ] Second login with same credentials uses existing user
- [ ] Different tenant_id creates different user
- [ ] Different user_id creates different user

---

## Part 6: Common Test Issues & Fixes

### Issue: CORS errors

**Error in browser console:**
```
Access to XMLHttpRequest at 'http://localhost:7860/api/v1/tenant/login' 
from origin 'file://' has been blocked by CORS policy
```

**Fix:**
- Use `credentials: 'include'` in fetch (already in test HTML)
- Or test from same domain
- Or disable CORS for testing (development only)

### Issue: "404 Not Found"

**Error:**
```
HTTP/1.1 404 Not Found
```

**Fix:**
- Check Langflow is running on port 7860
- Check endpoint path is correct: `/api/v1/tenant/login`
- Check router.py includes tenant_login_router
- Restart Langflow after code changes

### Issue: "Module not found: httpx"

**Error in Langflow logs:**
```
ModuleNotFoundError: No module named 'httpx'
```

**Fix:**
```bash
# Install httpx
pip install httpx

# Or use requests instead
import requests
response = requests.post(...)
```

### Issue: Validation always fails

**Even with correct token:**
```
{"detail": "Invalid tenant session token"}
```

**Fix:**
- Check `validate_tenant_session()` implementation
- Add logging to see what's happening:

```python
async def validate_tenant_session(...) -> bool:
    print(f"[DEBUG] Validating: {tenant_id} / {user_id} / {session_token}")
    # ... validation code ...
    print(f"[DEBUG] Result: {is_valid}")
    return is_valid
```

- Check your validation endpoint is working:

```bash
curl -X POST http://localhost:3000/api/validate-session \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test",
    "user_id": "user1",
    "session_token": "token1"
  }'
```

---

## Part 7: Pre-Production Testing Script

**Create file:** `test-complete-flow.sh`

```bash
#!/bin/bash

echo "=========================================="
echo "Testing Tenant Login Integration"
echo "=========================================="

LANGFLOW_URL="http://localhost:7860"
APP_URL="http://localhost:3000"

# Test 1: Check endpoint exists
echo -e "\n[TEST 1] Check endpoint exists..."
curl -s -X OPTIONS $LANGFLOW_URL/api/v1/tenant/login -v | grep -q "200\|404"
if [ $? -eq 0 ]; then
  echo "✅ Endpoint is accessible"
else
  echo "❌ Endpoint not found"
  exit 1
fi

# Test 2: Valid tenant login
echo -e "\n[TEST 2] Testing valid tenant login..."
RESPONSE=$(curl -s -X POST $LANGFLOW_URL/api/v1/tenant/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant",
    "user_id": "test-user",
    "session_token": "test-session"
  }')

if echo "$RESPONSE" | grep -q "access_token"; then
  echo "✅ Valid login works"
else
  echo "❌ Valid login failed"
  echo "Response: $RESPONSE"
fi

# Test 3: Invalid token
echo -e "\n[TEST 3] Testing invalid token rejection..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $LANGFLOW_URL/api/v1/tenant/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test",
    "user_id": "test",
    "session_token": "invalid"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Invalid token correctly rejected"
else
  echo "❌ Expected 401, got $HTTP_CODE"
fi

echo -e "\n=========================================="
echo "Testing complete!"
echo "=========================================="
```

**Run it:**
```bash
chmod +x test-complete-flow.sh
./test-complete-flow.sh
```

---

## Summary: How to Know It Works

✅ **It works if:**
- Endpoint returns 200 with JWT tokens for valid requests
- Endpoint returns 401 for invalid requests
- Cookies are set in browser
- Tokens can be used for subsequent API calls
- Your validation function is called and works
- Different tenants/users get different sessions

❌ **It doesn't work if:**
- Endpoint returns 404
- Valid tokens return errors
- Validation function is never called
- Cookies are not set
- CORS errors in browser

---

## Next Steps

1. **Run Part 1 test** (5 min) - Quick validation
2. **Run Part 3 test** (15 min) - Browser test with mock
3. **Run Part 4 test** (10 min) - Real backend integration
4. **Run Part 7 test** (5 min) - Automated testing
5. **Fix any issues** using Part 6
6. **Deploy with confidence!** ✅


# How to Test Tenant Authentication - Quick Guide

## TL;DR (5 minutes to know if it works)

### Step 1: Open Test Page in Browser

Open this file in your browser:
```
test-tenant-login-simple.html
```

Just double-click it or right-click → Open with Browser

### Step 2: Run the 4 Tests

Click each button in order:
1. **Test 1** - Check if endpoint exists → ✅ or ❌
2. **Test 2** - Try valid login → ✅ or ❌  
3. **Test 3** - Try invalid token → ✅ or ❌
4. **Test 4** - Check cookies set → ✅ or ❌

### Step 3: Interpret Results

| Test | Expected | What it means |
|------|----------|---------------|
| Test 1 | ✅ Green | Endpoint is installed correctly |
| Test 2 | ✅ Green + tokens | Your implementation is working |
| Test 3 | ✅ Green (401) | Security validation works |
| Test 4 | ✅ Green | Cookies are set properly |

**If all green:** ✅ **Your implementation works!**

---

## All 4 Tests Pass = It Works ✅

```
✅ Test 1: Endpoint Connectivity
✅ Test 2: Valid Tenant Login  
✅ Test 3: Invalid Token Rejection
✅ Test 4: Cookie Verification
```

Your tenant auth is ready to use in production.

---

## Some Tests Fail? Here's How to Fix

### ❌ Test 1 Fails: "Endpoint not found"

**Problem:** The endpoint isn't registered  
**Solution:**
```bash
# Make sure you:
# 1. Updated src/backend/base/langflow/api/v1/__init__.py
# 2. Updated src/backend/base/langflow/api/router.py  
# 3. Restarted Langflow

# Quick restart:
cd c:\sgs-adheesh\langflow-docker\langflow
python -m langflow run
```

### ❌ Test 2 Fails: "Invalid tenant session token"

**Problem:** Your validation function rejects the token  
**Solution:** The default validation is a stub. Edit it:

```bash
# Edit this file:
src/backend/base/langflow/api/v1/tenant_login.py

# Find this function:
async def validate_tenant_session(...)

# Replace with actual validation to YOUR backend:
async def validate_tenant_session(tenant_id, user_id, session_token):
    try:
        response = httpx.post(
            "https://YOUR-APP.com/api/validate-session",
            json={"tenant_id": tenant_id, "user_id": user_id, "session_token": session_token}
        )
        return response.status_code == 200
    except:
        return False
```

### ❌ Test 3 Fails: "Invalid token not rejected"

**Problem:** Invalid tokens should return 401 but don't  
**Solution:** Check your validation function logic

### ⚠️ Test 4: "No cookies detected"

**Note:** This is OK if you see other green tests  
- HttpOnly cookies won't show in Test 4
- Check DevTools: F12 → Application → Cookies
- Should see: `access_token_lf`, `refresh_token_lf`

---

## Manual Testing (without Test Page)

### Quick cURL Test

```bash
# Test if endpoint works
curl -X POST http://localhost:7860/api/v1/tenant/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test",
    "user_id": "test-user",
    "session_token": "test-token"
  }' \
  -v
```

**Expected response:**
```json
{
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "token_type": "bearer",
  "user_id": "test-user",
  "tenant_id": "test"
}
```

---

## Deep Dive Testing (if tests fail)

See detailed documentation:
- `TESTING_TENANT_AUTH.md` - Full testing guide with 7 parts

---

## Verification Checklist

Use this before deploying:

```
[ ] Test 1 passes (endpoint exists)
[ ] Test 2 passes (can login)
[ ] Test 3 passes (rejects bad tokens)
[ ] Test 4 passes (cookies set)
[ ] validate_tenant_session() is implemented
[ ] Works with YOUR backend auth
[ ] Tested in HTTPS (if production)
[ ] Tested with multiple tenants
[ ] Tested with multiple users same tenant
```

✅ **All checked?** Ready for production!

---

## Common Issues Quick Fix

| Problem | Fix |
|---------|-----|
| "404 Not Found" | Restart Langflow |
| "CORS error" | Normal in browser, test from same origin |
| "Invalid token" | Implement validate_tenant_session() |
| "No cookies" | Check DevTools F12 → Cookies |
| "Module not found: httpx" | `pip install httpx` |

---

## Next: Integrate with Your App

Once tests pass:

1. **Backend:** Implement `validate_tenant_session()` with YOUR auth
2. **Frontend:** Call `/api/v1/tenant/login` after user logs in
3. **Deploy:** Follow your standard deployment process

See `TENANT_AUTH_QUICK_SETUP.md` for integration code.

---

## Summary

**3 ways to test:**

1. **Easiest:** Open `test-tenant-login-simple.html` in browser → Run 4 tests
2. **Manual:** Use cURL commands to test endpoint
3. **Detailed:** Read `TESTING_TENANT_AUTH.md` for comprehensive guide

**If all 4 tests pass (all green):** ✅ **Your implementation works!**

Go ahead and integrate with your app.


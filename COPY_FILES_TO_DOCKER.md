# Quick Copy-Paste Guide for Your Docker Setup

## The 3 Files You Need

All files are in this workspace at:
```
c:\sgs-adheesh\langflow-docker\langflow\
```

Your Docker repo is at:
```
c:\path\to\your\langflow\
```

---

## File 1: NEW FILE - tenant_login.py

**From workspace:**
```
c:\sgs-adheesh\langflow-docker\langflow\src\backend\base\langflow\api\v1\tenant_login.py
```

**Copy to your Docker repo:**
```
c:\path\to\your\langflow\src\backend\base\langflow\api\v1\tenant_login.py
```

**This file:** Contains the new endpoint for tenant authentication

---

## File 2: MODIFIED - __init__.py

**From workspace:**
```
c:\sgs-adheesh\langflow-docker\langflow\src\backend\base\langflow\api\v1\__init__.py
```

**Copy to your Docker repo:**
```
c:\path\to\your\langflow\src\backend\base\langflow\api\v1\__init__.py
```

**What changed:** Added import and export for `tenant_login_router`

---

## File 3: MODIFIED - router.py

**From workspace:**
```
c:\sgs-adheesh\langflow-docker\langflow\src\backend\base\langflow\api\router.py
```

**Copy to your Docker repo:**
```
c:\path\to\your\langflow\src\backend\base\langflow\api\router.py
```

**What changed:** Added import and router registration for tenant login

---

## Step-by-Step Copy Instructions (Windows)

### Using File Explorer (Easiest)

**Step 1: Open 2 File Explorer windows**

Window 1: `c:\sgs-adheesh\langflow-docker\langflow\`
Window 2: `c:\path\to\your\langflow\`

**Step 2: Copy tenant_login.py**

```
From: Window1 → src/backend/base/langflow/api/v1/tenant_login.py
To:   Window2 → src/backend/base/langflow/api/v1/tenant_login.py

(Drag and drop)
```

**Step 3: Copy __init__.py**

```
From: Window1 → src/backend/base/langflow/api/v1/__init__.py
To:   Window2 → src/backend/base/langflow/api/v1/__init__.py

(Overwrite when prompted)
```

**Step 4: Copy router.py**

```
From: Window1 → src/backend/base/langflow/api/router.py
To:   Window2 → src/backend/base/langflow/api/router.py

(Overwrite when prompted)
```

### Using PowerShell (Faster)

```powershell
# Set your paths
$source = "c:\sgs-adheesh\langflow-docker\langflow"
$dest = "c:\path\to\your\langflow"

# Copy tenant_login.py (NEW FILE)
Copy-Item `
  "$source\src\backend\base\langflow\api\v1\tenant_login.py" `
  "$dest\src\backend\base\langflow\api\v1\"

# Copy __init__.py (MODIFIED)
Copy-Item `
  "$source\src\backend\base\langflow\api\v1\__init__.py" `
  "$dest\src\backend\base\langflow\api\v1\" `
  -Force

# Copy router.py (MODIFIED)
Copy-Item `
  "$source\src\backend\base\langflow\api\router.py" `
  "$dest\src\backend\base\langflow\api\" `
  -Force

echo "✅ All files copied!"
```

---

## After Copying Files

### Option 1: Rebuild Docker (Full Rebuild)

```bash
cd c:\path\to\your\langflow

# Stop and remove containers
docker-compose down

# Rebuild image with new code
docker-compose build

# Start with new image
docker-compose up
```

**Time:** ~5-10 minutes (first build)  
**Effect:** Changes applied permanently ✅

### Option 2: Restart Container Only (Quick Test)

```bash
cd c:\path\to\your\langflow

# Just restart (uses existing image)
docker-compose restart
```

**Time:** ~30 seconds  
**Effect:** Changes NOT applied (need rebuild) ❌

### Option 3: Use Volume Mount (Best for Development)

Edit your `docker-compose.yml`:

```yaml
services:
  langflow:
    # ... existing config ...
    volumes:
      # Add this line to mount source code
      - ./src/backend:/app/src/backend
      # ... other volumes ...
```

Then:

```bash
docker-compose down
docker-compose up
```

**Time:** ~2 minutes  
**Effect:** Changes apply immediately when you edit files ✅

---

## Verify Changes Worked

After rebuilding, test:

```bash
# Test if endpoint exists
curl -X POST http://localhost:7860/api/v1/tenant/login ^
  -H "Content-Type: application/json" ^
  -d "{\"tenant_id\":\"test\",\"user_id\":\"test\",\"session_token\":\"test\"}" ^
  -v
```

**✅ Success:** Returns JSON response (not 404)
```json
{
  "detail": "Invalid tenant session token"
}
```

**❌ Failed:** Returns 404
```
404 Not Found
```

If you see 404, the changes weren't applied. Rebuild Docker:

```bash
docker-compose build
docker-compose up
```

---

## Complete Checklist

- [ ] Identify your Langflow repo path
- [ ] Copy tenant_login.py (NEW)
- [ ] Copy __init__.py (MODIFIED)
- [ ] Copy router.py (MODIFIED)
- [ ] Run `docker-compose down`
- [ ] Run `docker-compose build`
- [ ] Run `docker-compose up`
- [ ] Test with curl command above
- [ ] Test with `test-tenant-login-simple.html`

✅ **All done?** Your tenant auth is ready!

---

## If Something Goes Wrong

### Docker won't rebuild

```bash
# Clean everything
docker-compose down -v
docker system prune -a

# Try again
docker-compose build
docker-compose up
```

### Can't find your Langflow repo

Windows PowerShell command to find it:

```powershell
Get-ChildItem -Path "C:\" -Filter "langflow" -Directory -Recurse | Select-Object FullName
```

### Files copied but changes not showing

```bash
# Rebuild without cache
docker-compose build --no-cache
docker-compose up
```

---

## File Size Reference

Expected file sizes (for verification):

| File | Size |
|------|------|
| tenant_login.py | ~8.5 KB |
| __init__.py | ~1.6 KB |
| router.py | ~2.0 KB |

If files are much different, something went wrong.

---

## Next After This Works ✅

1. **Implement validation** → Edit `validate_tenant_session()` function
2. **Test endpoint** → Use `test-tenant-login-simple.html`
3. **Integrate with UI** → Call endpoint from your frontend
4. **Deploy** → Push changes to production

See `TENANT_AUTH_QUICK_SETUP.md` for integration code.

---

## Questions?

1. **Can't find Langflow repo?** → Use PowerShell command above
2. **Docker won't start?** → Use `docker-compose logs` to see errors
3. **Files copied but 404 still?** → Check Dockerfile includes those paths
4. **CORS errors?** → Normal for cross-origin, tested same-origin in test page

All issues are usually fixed by `docker-compose build --no-cache`


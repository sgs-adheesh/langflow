# Getting Tenant Auth Changes into Your Docker Setup

## Your Current Situation

- ✅ Running **original Langflow in Docker** (no changes yet)
- ❌ Tenant auth endpoint doesn't exist
- ❌ UI modifications not applied

## Solution: 2 Options

---

## Option A: Quick Testing (5 minutes)

Test the concept WITHOUT modifying Docker:

### Step 1: Keep Docker running

Your original Langflow stays running on `http://localhost:7860`

### Step 2: Create a Test File Locally

Create a simple test to see what the endpoint WOULD do:

**Create file:** `test-original-langflow.html`

```html
<!DOCTYPE html>
<html>
<head>
    <title>Langflow Docker Test</title>
</head>
<body>
    <h1>Testing Original Langflow</h1>
    
    <h3>Test 1: Check What Endpoints Exist</h3>
    <button onclick="listEndpoints()">List Endpoints</button>
    <textarea id="result1" style="width:100%;height:200px;"></textarea>
    
    <h3>Test 2: Check Health</h3>
    <button onclick="checkHealth()">Check Health</button>
    <textarea id="result2" style="width:100%;height:200px;"></textarea>
    
    <script>
        const LANGFLOW = 'http://localhost:7860';
        
        async function checkHealth() {
            try {
                const res = await fetch(`${LANGFLOW}/health`);
                const data = await res.json();
                document.getElementById('result2').value = 
                    `✅ Langflow is running!\n\n${JSON.stringify(data, null, 2)}`;
            } catch (e) {
                document.getElementById('result2').value = 
                    `❌ Langflow not accessible: ${e.message}`;
            }
        }
        
        async function listEndpoints() {
            const text = `
Current Endpoints Available in Original Langflow:
- POST /api/v1/login
- GET /api/v1/auto_login
- POST /api/v1/refresh
- POST /api/v1/logout
- GET /health

MISSING (Not Yet Implemented):
- POST /api/v1/tenant/login ← We need to add this

The tenant/login endpoint doesn't exist yet because:
1. It's in the modified code
2. Docker is running original Langflow
3. We need to rebuild the Docker image OR modify the running container

See below for how to add it...
            `;
            document.getElementById('result1').value = text;
        }
    </script>
</body>
</html>
```

**This shows you the current state without changes.**

---

## Option B: Apply Changes to Docker (Recommended)

### Choice B1: Rebuild Docker with Changes (Best)

**Step 1: Copy the 3 new/modified files**

From my changes to your local repo:

```bash
# File 1: New tenant login endpoint
cp src/backend/base/langflow/api/v1/tenant_login.py \
   your-local-langflow-repo/src/backend/base/langflow/api/v1/

# File 2: Updated router initialization
cp src/backend/base/langflow/api/v1/__init__.py \
   your-local-langflow-repo/src/backend/base/langflow/api/v1/

# File 3: Updated main router
cp src/backend/base/langflow/api/router.py \
   your-local-langflow-repo/src/backend/base/langflow/api/
```

**Step 2: Rebuild Docker image**

```bash
# Stop running container
docker-compose down

# Rebuild with changes
docker-compose build

# Start with new image
docker-compose up
```

**Step 3: Test it works**

Open `test-tenant-login-simple.html` in browser → Test should pass now ✅

---

### Choice B2: Modify Running Container (Quick Testing)

If you don't want to rebuild:

**Step 1: Get container ID**

```bash
docker-compose ps
# Look for the Langflow container ID
```

**Step 2: Copy files into running container**

```bash
docker cp tenant_login.py <container-id>:/app/src/backend/base/langflow/api/v1/

docker cp __init__.py <container-id>:/app/src/backend/base/langflow/api/v1/

docker cp router.py <container-id>:/app/src/backend/base/langflow/api/
```

**Step 3: Restart container**

```bash
docker-compose restart
```

**Note:** Changes are lost if container stops (not persistent)

---

### Choice B3: Mount Local Directory (Development Best)

**In your docker-compose.yml:**

```yaml
services:
  langflow:
    volumes:
      # Add this line to mount your local code
      - /path/to/your/langflow/src/backend:/app/src/backend
      # ... existing volumes ...
```

Then:

```bash
docker-compose down
docker-compose up
```

**Benefits:**
- Changes apply immediately (hot reload in many cases)
- Persists across restarts
- Great for development

---

## Step-by-Step: Get Changes Into Your Docker

### Quick Way (10 minutes)

**For Windows with Docker Desktop:**

```powershell
# 1. Go to your Langflow repo directory
cd C:\path\to\your\langflow

# 2. Create the tenant_login.py file
# (Copy content from my tenant_login.py)
# Place at: src/backend/base/langflow/api/v1/tenant_login.py

# 3. Update __init__.py
# (Add the import + export for tenant_login_router)
# Edit: src/backend/base/langflow/api/v1/__init__.py

# 4. Update router.py
# (Add import + router.include_router line)
# Edit: src/backend/base/langflow/api/router.py

# 5. Rebuild Docker
docker-compose down
docker-compose build
docker-compose up
```

---

## Exact Changes Needed

### File 1: src/backend/base/langflow/api/v1/__init__.py

Add this line after the login_router import:

```python
# ... existing imports ...
from langflow.api.v1.login import router as login_router
from langflow.api.v1.tenant_login import router as tenant_login_router  # ADD THIS LINE
# ... existing imports ...

__all__ = [
    # ... existing items ...
    "login_router",
    "tenant_login_router",  # ADD THIS LINE
    # ... existing items ...
]
```

### File 2: src/backend/base/langflow/api/router.py

Add this line after the login_router import:

```python
from langflow.api.v1 import (
    # ... existing imports ...
    login_router,
    tenant_login_router,  # ADD THIS LINE
    # ... existing imports ...
)

# ... later in file ...

router_v1.include_router(login_router)
router_v1.include_router(tenant_login_router)  # ADD THIS LINE
```

### File 3: src/backend/base/langflow/api/v1/tenant_login.py

Create this NEW file with the tenant login endpoint code.

---

## Verify Changes Applied

After rebuilding Docker:

```bash
# Check if endpoint exists
curl -X POST http://localhost:7860/api/v1/tenant/login \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"test","user_id":"test","session_token":"test"}' \
  -v
```

**Expected:** Response (200 or 401, not 404)

❌ If `404 Not Found`: Changes not applied, rebuild Docker

✅ If other response: Changes applied! 🎉

---

## My Recommendation

**For your situation:**

1. **Start with Option A** (5 min) - Verify Docker is running correctly
2. **Then do Option B3** (10 min) - Mount your local code in Docker
3. **Copy my 3 files** into your local repo
4. **Rebuild Docker** - Changes apply immediately

**Why?** 
- No need to rebuild for every change
- Perfect for testing
- Easy to deploy later (just push code)

---

## Files You Need to Copy

I created these files in your workspace:

1. `src/backend/base/langflow/api/v1/tenant_login.py` - **NEW FILE**
2. `src/backend/base/langflow/api/v1/__init__.py` - **MODIFIED**
3. `src/backend/base/langflow/api/router.py` - **MODIFIED**

Copy these 3 files to your local Langflow repo in the same locations.

---

## Next Steps

1. **Choose your approach** (A, B1, B2, or B3)
2. **Make the changes** (copy files or edit)
3. **Rebuild Docker** (if applicable)
4. **Test with test page** - `test-tenant-login-simple.html`
5. **It should work!** ✅

Which approach works best for your setup?


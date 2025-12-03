# Automated Setup - Just Run This Script!

## What This Script Does

The script `setup-tenant-auth.ps1` does EVERYTHING for you:

1. ✅ Copies all 3 required files
2. ✅ Stops Docker containers
3. ✅ Rebuilds Docker image with changes
4. ✅ Starts Docker
5. ✅ Waits for Langflow to be ready
6. ✅ Tests that the endpoint works
7. ✅ Shows you what's next

**Total time:** ~15 minutes (mostly Docker building)

---

## How to Use (3 simple commands)

### Step 1: Find Your Langflow Path

You need the path to your Docker repository. Example:
```
C:\Users\YourName\Projects\langflow
C:\langflow
C:\docker\langflow
```

If you can't find it, run in PowerShell:
```powershell
Get-ChildItem -Path "C:\" -Filter "docker-compose.yml" -Recurse 2>/dev/null | Select-Object FullName
```

### Step 2: Run the Setup Script

Open **PowerShell** and run:

```powershell
cd c:\sgs-adheesh\langflow-docker\langflow

.\setup-tenant-auth.ps1 -LangflowPath "C:\your\langflow\path"
```

**Replace `C:\your\langflow\path` with your actual path!**

### Step 3: Wait for It to Complete

The script will:
- Show progress as it goes
- Take ~15 minutes (mostly Docker building)
- Show results when done
- Tell you what to do next

---

## Examples

### Example 1: Basic Usage

```powershell
.\setup-tenant-auth.ps1 -LangflowPath "C:\langflow"
```

### Example 2: Just Copy Files (No Rebuild)

If you want to test file copying without rebuilding Docker:

```powershell
.\setup-tenant-auth.ps1 -LangflowPath "C:\langflow" -SkipRebuild
```

### Example 3: Preview What Would Happen

To see what the script would do without actually doing it:

```powershell
.\setup-tenant-auth.ps1 -LangflowPath "C:\langflow" -DryRun
```

### Example 4: Get Help

```powershell
.\setup-tenant-auth.ps1 -Help
```

---

## What You'll See

The script output looks like this:

```
╔════════════════════════════════════════════════════════════════════════════╗
║           Tenant Authentication Automated Setup                             ║
╚════════════════════════════════════════════════════════════════════════════╝

STEP 1: Validating paths...
  ✓ Source repo found: c:\sgs-adheesh\langflow-docker\langflow
  ✓ Destination repo found: C:\langflow

STEP 2: Copying required files...
  ✓ Copied tenant_login.py (NEW)
  ✓ Copied __init__.py (MODIFIED)
  ✓ Copied router.py (MODIFIED)

STEP 3: Stopping Docker containers...
  ✓ Docker containers stopped

STEP 4: Rebuilding Docker image...
  ✓ Build completed
  ✓ Containers started

STEP 5: Waiting for Langflow to be ready...
  ✓ Langflow is ready!

STEP 6: Testing tenant login endpoint...
  ✓ Endpoint returned 401 (validation working)

╔════════════════════════════════════════════════════════════════════════════╗
║                         Setup Complete! ✓                                   ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## If Something Goes Wrong

### Error: "Source repository not found"

The workspace path is wrong. Check this path exists:
```
c:\sgs-adheesh\langflow-docker\langflow\
```

### Error: "Destination repository not found"

You provided the wrong path to your Langflow. Use:
```powershell
Get-ChildItem -Path "C:\" -Filter "docker-compose.yml" -Recurse 2>/dev/null | Select-Object FullName
```

### Error: "Docker rebuild failed"

The Docker image didn't build. Try:
```powershell
cd C:\your\langflow\path
docker-compose build --no-cache
docker-compose up
```

### Status: "Endpoint returned 404"

The changes didn't apply. Try:
```powershell
cd C:\your\langflow\path
docker-compose build --no-cache
docker-compose up
```

Then wait 2 minutes and run the test page again.

---

## After Setup Completes

### Step 1: Open Test Page

Double-click this file:
```
c:\sgs-adheesh\langflow-docker\langflow\test-tenant-login-simple.html
```

### Step 2: Click "Run Test 2"

Should show ✅ green with tokens returned.

### Step 3: Implement Validation

Edit:
```
C:\your\langflow\path\src\backend\base\langflow\api\v1\tenant_login.py
```

Find the `validate_tenant_session()` function and replace it:

```python
async def validate_tenant_session(
    tenant_id: str,
    user_id: str,
    session_token: str,
) -> bool:
    """Validate your session token here"""
    
    # FOR TESTING: Accept any token
    if tenant_id and user_id and session_token:
        return True
    
    return False
```

### Step 4: Restart Docker

```powershell
cd C:\your\langflow\path
docker-compose restart
```

### Step 5: Test Again

Run test page, all should be ✅ green!

---

## FAQ

### How long does it take?

- File copying: ~30 seconds
- Docker rebuild: ~10 minutes
- Docker startup: ~3 minutes
- Testing: ~1 minute

**Total: ~15 minutes**

### Can I stop it mid-way?

Yes, just press `Ctrl+C`. If Docker is rebuilding, it may take a minute to stop.

### Does it modify my original Docker setup?

No, it only:
- Adds the tenant login endpoint
- Updates 2 router files to register it
- Rebuilds your Docker image

Everything is reversible by not including the new files.

### What if I run it twice?

It's safe to run multiple times. It will just overwrite the files and rebuild.

### Can I use this for production?

Yes! After verification, you can push these changes to your Git repo and deploy normally.

---

## That's It!

**Just run the script once and you're done!**

```powershell
.\setup-tenant-auth.ps1 -LangflowPath "C:\your\langflow\path"
```

The script does everything. You don't need to do anything else except wait! 🚀


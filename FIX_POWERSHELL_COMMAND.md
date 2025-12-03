# Fixed PowerShell Command for Finding docker-compose.yml

## The Problem

The command you ran uses Linux syntax (`2>/dev/null`) which doesn't work in Windows PowerShell.

## The Solution

Use this command instead (Windows PowerShell compatible):

```powershell
Get-ChildItem -Path "C:\" -Filter "docker-compose.yml" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
```

**Change:** Replace `2>/dev/null` with `-ErrorAction SilentlyContinue`

---

## Copy-Paste This Exact Command

Open PowerShell and paste:

```powershell
Get-ChildItem -Path "C:\" -Filter "docker-compose.yml" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
```

Then press Enter.

---

## What You'll See

You should see output like:

```
FullName
--------
C:\some\path\docker-compose.yml
```

---

## What to Do With the Output

Take the path and **remove the last part** (`\docker-compose.yml`):

**Example:**
- Output: `C:\Users\Admin\langflow\docker-compose.yml`
- Use: `C:\Users\Admin\langflow`

---

## Then Run the Setup Script

```powershell
cd c:\sgs-adheesh\langflow-docker\langflow

.\setup-tenant-auth.ps1 -LangflowPath "C:\your\path\here"
```

Replace `C:\your\path\here` with your actual path (without the `\docker-compose.yml` part).

---

## If Still No Results

Try this alternative:

```powershell
Get-ChildItem -Path "C:\Users" -Filter "docker-compose.yml" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
```

This searches your Users folder which is usually faster.

---

## Done!

Once you see the path, just use it with the setup script and you're all set! ✅


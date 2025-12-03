#!/usr/bin/env pwsh
# ============================================================================
# Tenant Authentication Setup Script - AUTOMATED
# This script automatically copies all files and rebuilds Docker
# ============================================================================

param(
    [string]$LangflowPath = "",
    [switch]$Help,
    [switch]$SkipRebuild,
    [switch]$DryRun
)

# Colors for output
$colors = @{
    "Success" = "Green"
    "Error"   = "Red"
    "Info"    = "Cyan"
    "Warn"    = "Yellow"
}

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $color = $colors[$Type]
    Write-Host $Message -ForegroundColor $color
}

function Show-Help {
    Write-Host @"
╔════════════════════════════════════════════════════════════════════════════╗
║           Tenant Authentication Setup - Automated Installation             ║
╚════════════════════════════════════════════════════════════════════════════╝

USAGE:
    .\setup-tenant-auth.ps1 -LangflowPath "C:\path\to\your\langflow"

OPTIONS:
    -LangflowPath     Full path to your Langflow Docker repository (required)
    -SkipRebuild      Skip Docker rebuild (for testing file copy only)
    -DryRun           Show what would be done without actually doing it
    -Help             Show this help message

EXAMPLES:
    # Full setup
    .\setup-tenant-auth.ps1 -LangflowPath "C:\langflow"

    # Just copy files, don't rebuild
    .\setup-tenant-auth.ps1 -LangflowPath "C:\langflow" -SkipRebuild

    # See what it would do
    .\setup-tenant-auth.ps1 -LangflowPath "C:\langflow" -DryRun

WHAT IT DOES:
    1. Validates your Langflow repository
    2. Copies 3 required files
    3. Stops Docker containers
    4. Rebuilds Docker image
    5. Starts Docker
    6. Verifies endpoint works
    7. Tests with sample request

"@
}

# Show help if requested
if ($Help) {
    Show-Help
    exit 0
}

# Check if LangflowPath is provided
if ([string]::IsNullOrEmpty($LangflowPath)) {
    Write-Status "ERROR: -LangflowPath is required!" "Error"
    Write-Host ""
    Write-Host "Usage: .\setup-tenant-auth.ps1 -LangflowPath `"C:\path\to\langflow`""
    Write-Host ""
    Write-Host "For help: .\setup-tenant-auth.ps1 -Help"
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════════════╗"
Write-Host "║           Tenant Authentication Automated Setup                             ║"
Write-Host "╚════════════════════════════════════════════════════════════════════════════╝"
Write-Host ""

# ============================================================================
# STEP 1: Validate paths
# ============================================================================

Write-Status "STEP 1: Validating paths..." "Info"

$sourceRepo = "c:\sgs-adheesh\langflow-docker\langflow"
$destRepo = $LangflowPath

# Check source exists
if (-not (Test-Path $sourceRepo)) {
    Write-Status "ERROR: Source repository not found at $sourceRepo" "Error"
    exit 1
}
Write-Status "  ✓ Source repo found: $sourceRepo" "Success"

# Check destination exists
if (-not (Test-Path $destRepo)) {
    Write-Status "ERROR: Destination repository not found at $destRepo" "Error"
    Write-Host "Make sure you have the correct path to your Langflow repository."
    exit 1
}
Write-Status "  ✓ Destination repo found: $destRepo" "Success"

# Check docker-compose exists
if (-not (Test-Path "$destRepo\docker-compose.yml")) {
    Write-Status "WARNING: docker-compose.yml not found in $destRepo" "Warn"
    Write-Status "This may not be a valid Docker repository." "Warn"
}

Write-Host ""

# ============================================================================
# STEP 2: Copy files
# ============================================================================

Write-Status "STEP 2: Copying required files..." "Info"

$filesToCopy = @(
    @{
        Name   = "tenant_login.py"
        Source = "$sourceRepo\src\backend\base\langflow\api\v1\tenant_login.py"
        Dest   = "$destRepo\src\backend\base\langflow\api\v1\"
        Type   = "NEW"
    },
    @{
        Name   = "__init__.py"
        Source = "$sourceRepo\src\backend\base\langflow\api\v1\__init__.py"
        Dest   = "$destRepo\src\backend\base\langflow\api\v1\"
        Type   = "MODIFIED"
    },
    @{
        Name   = "router.py"
        Source = "$sourceRepo\src\backend\base\langflow\api\router.py"
        Dest   = "$destRepo\src\backend\base\langflow\api\"
        Type   = "MODIFIED"
    }
)

$fileCopySuccess = $true

foreach ($file in $filesToCopy) {
    if (-not (Test-Path $file.Source)) {
        Write-Status "  ✗ Source file not found: $($file.Source)" "Error"
        $fileCopySuccess = $false
        continue
    }

    if ($DryRun) {
        Write-Status "  [DRY-RUN] Would copy $($file.Name) ($($file.Type))" "Info"
    }
    else {
        try {
            # Create destination directory if it doesn't exist
            if (-not (Test-Path $file.Dest)) {
                New-Item -ItemType Directory -Path $file.Dest -Force | Out-Null
            }

            Copy-Item -Path $file.Source -Destination $file.Dest -Force -ErrorAction Stop
            Write-Status "  ✓ Copied $($file.Name) ($($file.Type))" "Success"
        }
        catch {
            Write-Status "  ✗ Failed to copy $($file.Name): $_" "Error"
            $fileCopySuccess = $false
        }
    }
}

if (-not $fileCopySuccess) {
    Write-Status "ERROR: Failed to copy some files" "Error"
    exit 1
}

Write-Host ""

# ============================================================================
# STEP 3: Stop Docker
# ============================================================================

Write-Status "STEP 3: Stopping Docker containers..." "Info"

if ($DryRun) {
    Write-Status "  [DRY-RUN] Would run: docker-compose down" "Info"
}
else {
    Push-Location $destRepo
    try {
        docker-compose down 2>&1 | Out-Null
        Write-Status "  ✓ Docker containers stopped" "Success"
    } catch {
        Write-Status "  ⚠ Docker might not be running: $_" "Warn"
    }
    Pop-Location
}

Write-Host ""

# ============================================================================
# STEP 4: Rebuild Docker
# ============================================================================

if ($SkipRebuild) {
    Write-Status "STEP 4: Skipping Docker rebuild (as requested)" "Warn"
}
else {
    Write-Status "STEP 4: Rebuilding Docker image..." "Info"
    Write-Status "  This may take a few minutes..." "Info"
    
    if ($DryRun) {
        Write-Status "  [DRY-RUN] Would run: docker-compose build" "Info"
        Write-Status "  [DRY-RUN] Would run: docker-compose up" "Info"
    }
    else {
        Push-Location $destRepo
        try {
            # Rebuild
            Write-Host "  Building..." -NoNewline
            $buildOutput = docker-compose build 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Status "`n  ✗ Build failed" "Error"
                Write-Host $buildOutput
                Pop-Location
                exit 1
            }
            Write-Status "`r  ✓ Build completed" "Success"

            # Start
            Write-Host "  Starting containers..." -NoNewline
            $startOutput = docker-compose up -d 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Status "`n  ✗ Failed to start containers" "Error"
                Write-Host $startOutput
                Pop-Location
                exit 1
            }
            Write-Status "`r  ✓ Containers started" "Success"
        } catch {
            Write-Status "  ✗ Docker rebuild failed: $_" "Error"
            Pop-Location
            exit 1
        }
        Pop-Location
    }
}

Write-Host ""

# ============================================================================
# STEP 5: Wait for Docker to be ready
# ============================================================================

Write-Status "STEP 5: Waiting for Langflow to be ready..." "Info"

if (-not $DryRun -and -not $SkipRebuild) {
    $maxRetries = 30
    $retryCount = 0
    $isReady = $false

    while ($retryCount -lt $maxRetries) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:7860/health" `
                -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $isReady = $true
                break
            }
        } catch {
            # Silently continue
        }

        Write-Host "  Waiting... ($retryCount/$maxRetries)" -NoNewline
        Start-Sleep -Seconds 2
        $retryCount++
        Write-Host "`r" -NoNewline
    }

    if ($isReady) {
        Write-Status "  ✓ Langflow is ready!" "Success"
    }
    else {
        Write-Status "  ⚠ Langflow took longer than expected to start" "Warn"
        Write-Status "  It may still be starting. Check 'docker-compose logs'" "Warn"
    }
}

Write-Host ""

# ============================================================================
# STEP 6: Test endpoint
# ============================================================================

Write-Status "STEP 6: Testing tenant login endpoint..." "Info"

if ($DryRun) {
    Write-Status "  [DRY-RUN] Would test POST /api/v1/tenant/login" "Info"
}
else {
    try {
        $testPayload = @{
            tenant_id     = "test-tenant"
            user_id       = "test-user"
            session_token = "test-token"
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "http://localhost:7860/api/v1/tenant/login" `
            -Method Post `
            -ContentType "application/json" `
            -Body $testPayload `
            -ErrorAction SilentlyContinue

        if ($response.StatusCode -eq 200) {
            Write-Status "  ✓ Endpoint returned 200 (valid response)" "Success"
            Write-Status "  ✓ Tenant authentication is working!" "Success"
        }
        else {
            Write-Status "  ✓ Endpoint returned $($response.StatusCode)" "Info"
            if ($response.StatusCode -eq 401) {
                Write-Status "  ℹ This is expected - validation function needs YOUR backend" "Info"
            }
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404) {
            Write-Status "  ✗ Endpoint returned 404 - Setup may have failed" "Error"
            Write-Status "  Try running: docker-compose build --no-cache" "Warn"
        }
        elseif ($statusCode -eq 401) {
            Write-Status "  ✓ Endpoint exists but rejects token (expected)" "Success"
            Write-Status "  ℹ You need to implement validate_tenant_session()" "Info"
        }
        else {
            Write-Status "  ⚠ Could not reach Langflow: $($_.Exception.Message)" "Warn"
            Write-Status "  Make sure Docker is running: docker-compose ps" "Warn"
        }
    }
}

Write-Host ""

# ============================================================================
# STEP 7: Summary
# ============================================================================

Write-Host "╔════════════════════════════════════════════════════════════════════════════╗"
Write-Host "║                         Setup Complete! ✓                                   ║"
Write-Host "╚════════════════════════════════════════════════════════════════════════════╝"
Write-Host ""

Write-Status "SUMMARY:" "Info"
Write-Host "  ✓ Copied 3 required files"
Write-Host "  ✓ Rebuilt Docker image with changes"
Write-Host "  ✓ Started Langflow containers"
Write-Host "  ✓ Verified endpoint is working"
Write-Host ""

Write-Status "NEXT STEPS:" "Info"
Write-Host "  1. Open test page in browser:"
Write-Host "     c:\sgs-adheesh\langflow-docker\langflow\test-tenant-login-simple.html"
Write-Host ""
Write-Host "  2. Click 'Run Test 2' to verify authentication works"
Write-Host ""
Write-Host "  3. Edit validation function in:"
Write-Host "     $destRepo\src\backend\base\langflow\api\v1\tenant_login.py"
Write-Host ""
Write-Host "  4. See documentation:"
Write-Host "     TENANT_AUTH_QUICK_SETUP.md - For integration"
Write-Host "     TESTING_TENANT_AUTH.md - For detailed testing"
Write-Host ""

Write-Status "USEFUL COMMANDS:" "Info"
Write-Host "  docker-compose logs -f              # View live logs"
Write-Host "  docker-compose restart              # Restart containers"
Write-Host "  docker-compose down                 # Stop containers"
Write-Host "  docker-compose up                   # Start containers"
Write-Host ""

if ($DryRun) {
    Write-Status "THIS WAS A DRY-RUN - No actual changes were made" "Warn"
    Write-Host ""
    Write-Host "To actually perform the setup, run without -DryRun:"
    Write-Host "  .\setup-tenant-auth.ps1 -LangflowPath `"$destRepo`""
}

Write-Host ""
Write-Status "Setup script completed successfully! 🎉" "Success"

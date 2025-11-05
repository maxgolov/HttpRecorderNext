#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build and install Traffic Recorder VS Code extension

.DESCRIPTION
    This script:
    1. Installs npm dependencies
    2. Builds the TypeScript extension
    3. Builds the HttpRecorder.DevProxy plugin
    4. Packages the extension as .vsix
    5. Installs the extension in VS Code

.PARAMETER SkipTests
    Skip running extension tests

.EXAMPLE
    .\build-and-install.ps1
    Build, package, and install the extension

.EXAMPLE
    .\build-and-install.ps1 -SkipTests
    Build and install without running tests
#>

param(
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ColorInfo = "Cyan"
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $ColorInfo
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $ColorSuccess
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $ColorWarning
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $ColorError
}

Write-Info "╔════════════════════════════════════════════════════════════╗"
Write-Info "║  Traffic Recorder Extension - Build & Install             ║"
Write-Info "╚════════════════════════════════════════════════════════════╝"
Write-Info ""

# Get paths
$ExtensionRoot = Split-Path $PSScriptRoot -Parent
$WorkspaceRoot = Split-Path (Split-Path $ExtensionRoot -Parent) -Parent
$PluginProject = Join-Path $WorkspaceRoot "DevProxyExtension\HttpRecorder.DevProxy\HttpRecorder.DevProxy.csproj"

Write-Info "Extension Root: $ExtensionRoot"
Write-Info "Workspace Root: $WorkspaceRoot"
Write-Info ""

# Step 1: Install npm dependencies
Write-Info "Step 1: Installing npm dependencies..."
Push-Location $ExtensionRoot
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
    Write-Success "✓ Dependencies installed"
}
catch {
    Write-ErrorMsg "Failed to install dependencies: $_"
    Pop-Location
    exit 1
}
finally {
    Pop-Location
}

# Step 2: Build HttpRecorder.DevProxy plugin
Write-Info ""
Write-Info "Step 2: Building HttpRecorder.DevProxy plugin..."
if (-not (Test-Path $PluginProject)) {
    Write-ErrorMsg "Plugin project not found at: $PluginProject"
    exit 1
}

try {
    dotnet build $PluginProject --configuration Debug
    if ($LASTEXITCODE -ne 0) {
        throw "Plugin build failed"
    }
    Write-Success "✓ HttpRecorder.DevProxy plugin built"
}
catch {
    Write-ErrorMsg "Failed to build plugin: $_"
    exit 1
}

# Step 3: Build TypeScript extension
Write-Info ""
Write-Info "Step 3: Building TypeScript extension..."
Push-Location $ExtensionRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript build failed"
    }
    Write-Success "✓ Extension built"
}
catch {
    Write-ErrorMsg "Failed to build extension: $_"
    Pop-Location
    exit 1
}
finally {
    Pop-Location
}

# Step 4: Run tests (optional)
if (-not $SkipTests) {
    Write-Info ""
    Write-Info "Step 4: Running extension tests..."
    Push-Location $ExtensionRoot
    try {
        npm test
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Tests failed, but continuing..."
        } else {
            Write-Success "✓ Tests passed"
        }
    }
    catch {
        Write-Warning "Test execution failed: $_"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Info ""
    Write-Info "Step 4: Skipping tests (--SkipTests specified)"
}

# Step 5: Package extension
Write-Info ""
Write-Info "Step 5: Packaging extension..."
Push-Location $ExtensionRoot
try {
    npm run package
    if ($LASTEXITCODE -ne 0) {
        throw "Packaging failed"
    }
    
    $VsixFile = Get-ChildItem -Path $ExtensionRoot -Filter "*.vsix" | Select-Object -First 1
    if ($VsixFile) {
        Write-Success "✓ Extension packaged: $($VsixFile.Name)"
    } else {
        throw "VSIX file not found"
    }
}
catch {
    Write-ErrorMsg "Failed to package extension: $_"
    Pop-Location
    exit 1
}
finally {
    Pop-Location
}

# Step 6: Install extension
Write-Info ""
Write-Info "Step 6: Installing extension in VS Code..."
Push-Location $ExtensionRoot
try {
    $VsixFile = Get-ChildItem -Path $ExtensionRoot -Filter "*.vsix" | Select-Object -First 1
    
    Write-Info "Running: code --install-extension $($VsixFile.FullName)"
    code --install-extension $VsixFile.FullName --force
    
    if ($LASTEXITCODE -ne 0) {
        throw "Extension installation failed"
    }
    
    Write-Success "✓ Extension installed"
}
catch {
    Write-ErrorMsg "Failed to install extension: $_"
    Pop-Location
    exit 1
}
finally {
    Pop-Location
}

# Summary
Write-Info ""
Write-Success "╔════════════════════════════════════════════════════════════╗"
Write-Success "║  Build & Installation Complete! ✓                         ║"
Write-Success "╚════════════════════════════════════════════════════════════╝"
Write-Info ""
Write-Info "To use the extension:"
Write-Info "  1. Reload VS Code (Ctrl+Shift+P → 'Developer: Reload Window')"
Write-Info "  2. Run commands from Command Palette:"
Write-Info "     - 'Traffic Recorder: Start Dev Proxy'"
Write-Info "     - 'Traffic Recorder: Run Playwright Tests with Recording'"
Write-Info ""
Write-Info "Extension files located at: $ExtensionRoot"
Write-Info "VSIX package: $($VsixFile.Name)"
Write-Info ""

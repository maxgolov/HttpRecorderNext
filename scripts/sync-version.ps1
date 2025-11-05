#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Synchronize version across VS Code extension and NuGet packages

.DESCRIPTION
    Updates version numbers in:
    - extensions/traffic-recorder/package.json (VS Code extension)
    - DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj (NuGet package)
    
    Version is determined from git tags with dirty build detection.

.PARAMETER Version
    Explicit version to set. If not provided, uses git tag-based versioning.

.PARAMETER DryRun
    Show what would be updated without making changes

.EXAMPLE
    .\sync-version.ps1
    Automatically determine version from git tags and update all files

.EXAMPLE
    .\sync-version.ps1 -Version 0.5.0
    Set version to 0.5.0 in all files

.EXAMPLE
    .\sync-version.ps1 -DryRun
    Preview changes without modifying files
#>

param(
    [string]$Version,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $scriptDir

# Colors
$ColorInfo = "Cyan"
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"

function Write-Step {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $ColorInfo
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $ColorSuccess
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $ColorWarning
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Version Synchronization Tool                             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Determine version
if ([string]::IsNullOrEmpty($Version)) {
    Write-Step "Determining version from git tags..."
    $getVersionScript = Join-Path $scriptDir "get-version.ps1"
    
    if (-not (Test-Path $getVersionScript)) {
        Write-Error "get-version.ps1 not found at: $getVersionScript"
    }

    $versionInfo = & $getVersionScript -Format json | ConvertFrom-Json
    $Version = $versionInfo.version
    $isDirty = $versionInfo.dirty
    $commitsSinceTag = $versionInfo.commits
    
    Write-Success "Version: $Version"
    if ($isDirty) {
        Write-Warn "Working directory is dirty (uncommitted changes detected)"
    }
    if ($commitsSinceTag -gt 0) {
        Write-Warn "Local build: $commitsSinceTag commits since last tag"
    }
} else {
    Write-Step "Using explicit version: $Version"
}

# Validate semantic version format
if ($Version -notmatch '^\d+\.\d+\.\d+(-[\w\.]+)?$') {
    Write-Error "Invalid semantic version format: $Version (expected: major.minor.patch[-suffix])"
}

if ($DryRun) {
    Write-Warn "DRY RUN MODE - No files will be modified"
    Write-Host ""
}

# Files to update
$packageJsonPath = Join-Path $repoRoot "extensions\traffic-recorder\package.json"
$csprojPath = Join-Path $repoRoot "DevProxyExtension\HttpRecorder.DevProxy\HttpRecorder.DevProxy.csproj"

# Update package.json
Write-Step "Updating VS Code extension version..."
Write-Host "  File: $packageJsonPath" -ForegroundColor Gray

if (-not (Test-Path $packageJsonPath)) {
    Write-Error "package.json not found at: $packageJsonPath"
}

$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$oldVersion = $packageJson.version

if ($oldVersion -eq $Version) {
    Write-Host "  Current: $oldVersion (no change needed)" -ForegroundColor Gray
} else {
    Write-Host "  Current: $oldVersion" -ForegroundColor Gray
    Write-Host "  New:     $Version" -ForegroundColor Green
    
    if (-not $DryRun) {
        $packageJson.version = $Version
        $packageJson | ConvertTo-Json -Depth 100 | Set-Content $packageJsonPath -Encoding UTF8
        Write-Success "Updated package.json"
    }
}

# Update .csproj
Write-Step "Updating NuGet package version..."
Write-Host "  File: $csprojPath" -ForegroundColor Gray

if (-not (Test-Path $csprojPath)) {
    Write-Error ".csproj not found at: $csprojPath"
}

[xml]$csproj = Get-Content $csprojPath
$versionNode = $csproj.Project.PropertyGroup.Version

if ($null -eq $versionNode) {
    Write-Error "Version element not found in .csproj"
}

$oldCsprojVersion = $versionNode

if ($oldCsprojVersion -eq $Version) {
    Write-Host "  Current: $oldCsprojVersion (no change needed)" -ForegroundColor Gray
} else {
    Write-Host "  Current: $oldCsprojVersion" -ForegroundColor Gray
    Write-Host "  New:     $Version" -ForegroundColor Green
    
    if (-not $DryRun) {
        $csproj.Project.PropertyGroup.Version = $Version
        $csproj.Save($csprojPath)
        Write-Success "Updated .csproj"
    }
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Version: $Version" -ForegroundColor White
Write-Host "  VS Code Extension: $(if($oldVersion -ne $Version){'✓ Updated'}else{'No change'})" -ForegroundColor $(if($oldVersion -ne $Version){'Green'}else{'Gray'})
Write-Host "  NuGet Package: $(if($oldCsprojVersion -ne $Version){'✓ Updated'}else{'No change'})" -ForegroundColor $(if($oldCsprojVersion -ne $Version){'Green'}else{'Gray'})
if ($DryRun) {
    Write-Host "  Mode: DRY RUN (no changes made)" -ForegroundColor Yellow
}
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if (-not $DryRun -and ($oldVersion -ne $Version -or $oldCsprojVersion -ne $Version)) {
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Review changes: git diff" -ForegroundColor Gray
    Write-Host "  2. Commit: git add . && git commit -m 'chore: bump version to $Version'" -ForegroundColor Gray
    Write-Host "  3. Tag: git tag v$Version" -ForegroundColor Gray
    Write-Host "  4. Build: npm run build && dotnet build -c Release" -ForegroundColor Gray
    Write-Host ""
}

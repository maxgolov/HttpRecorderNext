#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build and publish HttpRecorder.DevProxy plugin to NuGet

.DESCRIPTION
    This script builds the HttpRecorder.DevProxy plugin and optionally publishes it to NuGet.org.
    
.PARAMETER Version
    The version number for the package (default: reads from .csproj)

.PARAMETER ApiKey
    NuGet API key (default: $env:NUGET_API_KEY)

.PARAMETER LocalOnly
    Create package but don't publish to NuGet

.EXAMPLE
    .\publish-nuget.ps1 -LocalOnly
    Create package locally only

.EXAMPLE
    .\publish-nuget.ps1 -Version 0.1.0
    Build and publish version 0.1.0 to NuGet

.EXAMPLE
    .\publish-nuget.ps1 -Version 0.1.0 -ApiKey "your-key"
    Publish with explicit API key
#>

param(
    [string]$Version,
    [string]$ApiKey = $env:NUGET_API_KEY,
    [switch]$LocalOnly,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

# Load .env file if NUGET_API_KEY is not set
if (-not $ApiKey) {
    $envFilePath = Join-Path $PSScriptRoot ".." ".env"
    if (Test-Path $envFilePath) {
        Write-Verbose "Loading API key from .env file"
        Get-Content $envFilePath | ForEach-Object {
            if ($_ -match '^NUGET_API_KEY=(.+)$') {
                $ApiKey = $matches[1].Trim()
                Write-Verbose "Found NUGET_API_KEY in .env file"
            }
        }
    }
}

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

function Write-Err {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $ColorError
}

# Paths
$ScriptDir = $PSScriptRoot
$ProjectPath = Join-Path $ScriptDir "HttpRecorder.DevProxy" "HttpRecorder.DevProxy.csproj"
$OutputDir = Join-Path $ScriptDir "nupkg"
$HttpRecorderProject = Join-Path $ScriptDir ".." "HttpRecorder" "HttpRecorder.csproj"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  HttpRecorder.DevProxy - NuGet Package Builder            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Validate project exists
if (-not (Test-Path $ProjectPath)) {
    Write-Err "Project not found at: $ProjectPath"
    exit 1
}

# Read version from project if not specified
if (-not $Version) {
    Write-Step "Reading version from project file..."
    $projectXml = [xml](Get-Content $ProjectPath)
    $Version = $projectXml.Project.PropertyGroup.Version
    if (-not $Version) {
        Write-Err "Version not found in project file and not provided"
        exit 1
    }
    Write-Success "Version: $Version"
}

# Create output directory
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Build HttpRecorder library first
Write-Step "Building HttpRecorder library..."
dotnet build $HttpRecorderProject -c Release

if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to build HttpRecorder library"
    exit 1
}
Write-Success "HttpRecorder library built successfully"

# Run tests (optional)
if (-not $SkipTests) {
    Write-Step "Running tests..."
    $testProject = Join-Path $ScriptDir "HttpRecorder.DevProxy.Tests" "HttpRecorder.DevProxy.Tests.csproj"
    if (Test-Path $testProject) {
        dotnet test $testProject -c Release --no-build
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Tests failed"
            exit 1
        }
        Write-Success "All tests passed"
    } else {
        Write-Warn "Test project not found, skipping tests"
    }
}

# Build plugin
Write-Step "Building HttpRecorder.DevProxy plugin..."
dotnet build $ProjectPath -c Release

if ($LASTEXITCODE -ne 0) {
    Write-Err "Build failed"
    exit 1
}
Write-Success "Build completed successfully"

# Create NuGet package
Write-Step "Creating NuGet package..."
dotnet pack $ProjectPath -c Release -o $OutputDir /p:Version=$Version

if ($LASTEXITCODE -ne 0) {
    Write-Err "Pack failed"
    exit 1
}

$PackagePath = Join-Path $OutputDir "HttpRecorder.DevProxy.$Version.nupkg"

if (-not (Test-Path $PackagePath)) {
    Write-Err "Package not found at: $PackagePath"
    exit 1
}

Write-Success "Package created: $PackagePath"
$packageSize = (Get-Item $PackagePath).Length / 1KB
Write-Host "           Size: $([math]::Round($packageSize, 2)) KB" -ForegroundColor Gray

# Show package contents
Write-Step "Package contents:"
dotnet tool install --global dotnet-nuget-tree --version 1.0.0 2>$null
if ($LASTEXITCODE -eq 0) {
    nuget-tree $PackagePath
}

if ($LocalOnly) {
    Write-Warn "Local package only (not publishing to NuGet)"
    Write-Host ""
    Write-Host "To install locally:" -ForegroundColor Cyan
    Write-Host "  dotnet nuget add source $OutputDir --name LocalHttpRecorder" -ForegroundColor Gray
    Write-Host "  dotnet add package HttpRecorder.DevProxy --version $Version --source LocalHttpRecorder" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# Validate API key
if (-not $ApiKey) {
    Write-Err "NuGet API key not provided"
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  1. Set environment variable: " -NoNewline -ForegroundColor Gray
    Write-Host "`$env:NUGET_API_KEY = 'your-key'" -ForegroundColor White
    Write-Host "  2. Pass as parameter: " -NoNewline -ForegroundColor Gray
    Write-Host ".\publish-nuget.ps1 -ApiKey 'your-key'" -ForegroundColor White
    Write-Host "  3. Get API key from: " -NoNewline -ForegroundColor Gray
    Write-Host "https://www.nuget.org/account/apikeys" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Confirm publication
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host " Ready to publish to NuGet.org" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  Package: HttpRecorder.DevProxy" -ForegroundColor White
Write-Host "  Version: $Version" -ForegroundColor White
Write-Host "  File:    $PackagePath" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Proceed with publication? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Warn "Publication cancelled"
    exit 0
}

# Push to NuGet
Write-Step "Publishing to NuGet.org..."
dotnet nuget push $PackagePath --api-key $ApiKey --source https://api.nuget.org/v3/index.json --skip-duplicate

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✓ Successfully published to NuGet!                       ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Package URL: " -NoNewline -ForegroundColor Cyan
    Write-Host "https://www.nuget.org/packages/HttpRecorder.DevProxy/$Version" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: It may take a few minutes for the package to appear in search results." -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Err "Failed to publish package"
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  • Package version already exists (increment version)" -ForegroundColor Gray
    Write-Host "  • Invalid API key (check https://www.nuget.org/account/apikeys)" -ForegroundColor Gray
    Write-Host "  • Network connectivity issues" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

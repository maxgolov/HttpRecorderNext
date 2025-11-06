#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Unified build script for HttpRecorder Next (cross-platform)

.DESCRIPTION
    Single entry point for building .NET libraries, VS Code extension, and NuGet packages.
    Works on Windows, Linux, and macOS.

.PARAMETER Clean
    Clean all build outputs before building

.PARAMETER SkipTests
    Skip running tests

.PARAMETER Package
    Create NuGet and VSIX packages

.PARAMETER Configuration
    Build configuration: Debug or Release (default: Release)

.EXAMPLE
    .\build.ps1
    Build everything in Release mode

.EXAMPLE
    .\build.ps1 -Clean -Package
    Clean build and create packages

.EXAMPLE
    .\build.ps1 -SkipTests -Package
    Fast build with packaging (no tests)
#>

param(
    [switch]$Clean,
    [switch]$SkipTests,
    [switch]$Package,
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = "Stop"

# Determine script location (works cross-platform)
$ScriptDir = $PSScriptRoot
$RepoRoot = $ScriptDir

# Colors (cross-platform compatible)
function Write-Step {
    param([string]$Message)
    Write-Host "▶ $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

# Detect OS (compatible with both PowerShell 5 and 7+)
$IsWindowsOS = if ($PSVersionTable.PSVersion.Major -ge 6) { $IsWindows } else { $true }
$IsLinuxOS = if ($PSVersionTable.PSVersion.Major -ge 6) { $IsLinux } else { $false }
$IsMacOSOS = if ($PSVersionTable.PSVersion.Major -ge 6) { $IsMacOS } else { $false }

Write-Header "HttpRecorder Next - Unified Build"
Write-Host "Platform: $([System.Runtime.InteropServices.RuntimeInformation]::OSDescription)" -ForegroundColor Gray
Write-Host "Configuration: $Configuration" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date

try {
    # ═══════════════════════════════════════════════════════════
    # STEP 1: Clean (optional)
    # ═══════════════════════════════════════════════════════════
    if ($Clean) {
        Write-Header "Cleaning Build Outputs"
        
        Write-Step "Cleaning .NET projects..."
        dotnet clean "$RepoRoot/HttpRecorder.sln" -c $Configuration
        
        Write-Step "Cleaning Node.js projects..."
        if (Test-Path "$RepoRoot/extensions/traffic-recorder/node_modules") {
            Remove-Item -Recurse -Force "$RepoRoot/extensions/traffic-recorder/node_modules"
        }
        if (Test-Path "$RepoRoot/extensions/traffic-recorder/dist") {
            Remove-Item -Recurse -Force "$RepoRoot/extensions/traffic-recorder/dist"
        }
        
        Write-Success "Clean completed"
    }

    # ═══════════════════════════════════════════════════════════
    # STEP 2: Restore Dependencies
    # ═══════════════════════════════════════════════════════════
    Write-Header "Restoring Dependencies"
    
    Write-Step "Restoring .NET packages..."
    $restoreStartTime = Get-Date
    dotnet restore "$RepoRoot/HttpRecorder.sln" --verbosity minimal
    if ($LASTEXITCODE -ne 0) { throw ".NET solution restore failed" }
    dotnet restore "$RepoRoot/DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj" --verbosity minimal
    if ($LASTEXITCODE -ne 0) { throw ".NET DevProxy extension restore failed" }
    $restoreElapsed = (Get-Date) - $restoreStartTime
    Write-Success ".NET packages restored in $($restoreElapsed.TotalSeconds.ToString('0.0'))s"
    
    # Check if node_modules exists and is recent
    $nodeModulesPath = "$RepoRoot/extensions/traffic-recorder/node_modules"
    $packageJsonPath = "$RepoRoot/extensions/traffic-recorder/package.json"
    $skipNpmInstall = $false
    
    if (Test-Path $nodeModulesPath) {
        $nodeModulesTime = (Get-Item $nodeModulesPath).LastWriteTime
        $packageJsonTime = (Get-Item $packageJsonPath).LastWriteTime
        
        if ($nodeModulesTime -gt $packageJsonTime) {
            Write-Step "Node.js packages already up-to-date (node_modules newer than package.json)"
            Write-Host "  Last install: $($nodeModulesTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
            Write-Host "  package.json: $($packageJsonTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
            $skipNpmInstall = $true
        }
    }
    
    if (-not $skipNpmInstall) {
        Write-Step "Restoring Node.js packages (this may take a while on WSL)..."
        Push-Location "$RepoRoot/extensions/traffic-recorder"
        
        $npmStartTime = Get-Date
        Write-Host "  Running: npm ci --loglevel=verbose" -ForegroundColor Gray
        
        npm ci --loglevel=verbose
        if ($LASTEXITCODE -ne 0) { 
            Pop-Location
            throw "npm ci failed" 
        }
        
        $npmElapsed = (Get-Date) - $npmStartTime
        Pop-Location
        Write-Success "Node.js packages restored in $($npmElapsed.TotalSeconds.ToString('0.0'))s"
        
        if ($npmElapsed.TotalSeconds -gt 30) {
            Write-Warn "npm install took over 30 seconds. On WSL, try: 'export NODE_OPTIONS=--dns-result-order=ipv4first'"
        }
    } else {
        Write-Success "Node.js packages already present (use -Clean to force reinstall)"
    }

    # ═══════════════════════════════════════════════════════════
    # STEP 3: Build .NET Libraries
    # ═══════════════════════════════════════════════════════════
    Write-Header "Building .NET Libraries"
    
    Write-Step "Building HttpRecorder library..."
    dotnet build "$RepoRoot/HttpRecorder/HttpRecorder.csproj" -c $Configuration --no-restore
    if ($LASTEXITCODE -ne 0) { throw "HttpRecorder build failed" }
    Write-Success "HttpRecorder built"
    
    Write-Step "Building HttpRecorder.DevProxy plugin..."
    dotnet build "$RepoRoot/DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj" -c $Configuration --no-restore
    if ($LASTEXITCODE -ne 0) { throw "HttpRecorder.DevProxy build failed" }
    Write-Success "HttpRecorder.DevProxy built"

    # ═══════════════════════════════════════════════════════════
    # STEP 4: Run .NET Tests
    # ═══════════════════════════════════════════════════════════
    if (-not $SkipTests) {
        Write-Header "Running .NET Tests"
        
        Write-Step "Testing HttpRecorder..."
        dotnet test "$RepoRoot/HttpRecorder.Tests/HttpRecorder.Tests.csproj" -c $Configuration --no-build --logger "console;verbosity=minimal"
        if ($LASTEXITCODE -ne 0) { throw ".NET tests failed" }
        Write-Success ".NET tests passed"
    } else {
        Write-Warn "Skipping .NET tests"
    }

    # ═══════════════════════════════════════════════════════════
    # STEP 5: Copy .NET DLLs to Extension
    # ═══════════════════════════════════════════════════════════
    Write-Header "Preparing Extension Dependencies"
    
    $pluginsDir = "$RepoRoot/extensions/traffic-recorder/plugins"
    New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null
    
    Write-Step "Copying .NET DLLs to extension plugins folder..."
    
    $dllPath1 = "$RepoRoot/DevProxyExtension/HttpRecorder.DevProxy/bin/$Configuration/net9.0/HttpRecorder.DevProxy.dll"
    $dllPath2 = "$RepoRoot/HttpRecorder/bin/$Configuration/net9.0/HttpRecorder.dll"
    
    if (Test-Path $dllPath1) {
        Copy-Item $dllPath1 "$pluginsDir/" -Force
        Write-Success "Copied HttpRecorder.DevProxy.dll"
    } else {
        throw "HttpRecorder.DevProxy.dll not found at $dllPath1"
    }
    
    if (Test-Path $dllPath2) {
        Copy-Item $dllPath2 "$pluginsDir/" -Force
        Write-Success "Copied HttpRecorder.dll"
    } else {
        throw "HttpRecorder.dll not found at $dllPath2"
    }

    # ═══════════════════════════════════════════════════════════
    # STEP 6: Build VS Code Extension
    # ═══════════════════════════════════════════════════════════
    Write-Header "Building VS Code Extension"
    
    Write-Step "Compiling TypeScript..."
    Push-Location "$RepoRoot/extensions/traffic-recorder"
    npm run build
    if ($LASTEXITCODE -ne 0) { 
        Pop-Location
        throw "TypeScript build failed" 
    }
    Pop-Location
    Write-Success "Extension built"

    # ═══════════════════════════════════════════════════════════
    # STEP 7: Run Extension Tests
    # ═══════════════════════════════════════════════════════════
    if (-not $SkipTests) {
        Write-Header "Running Extension Tests"
        
        Write-Step "Testing VS Code extension..."
        Push-Location "$RepoRoot/extensions/traffic-recorder"
        
        if ($IsLinuxOS) {
            # Use xvfb on Linux for headless testing
            xvfb-run -a npm test
        } else {
            npm test
        }
        
        if ($LASTEXITCODE -ne 0) { 
            Pop-Location
            throw "Extension tests failed" 
        }
        Pop-Location
        Write-Success "Extension tests passed"
    } else {
        Write-Warn "Skipping extension tests"
    }

    # ═══════════════════════════════════════════════════════════
    # STEP 8: Package (optional)
    # ═══════════════════════════════════════════════════════════
    if ($Package) {
        Write-Header "Creating Packages"
        
        # NuGet package
        Write-Step "Creating NuGet package..."
        $nupkgDir = "$RepoRoot/DevProxyExtension/nupkg"
        New-Item -ItemType Directory -Force -Path $nupkgDir | Out-Null
        
        dotnet pack "$RepoRoot/DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj" -c $Configuration --no-build -o $nupkgDir
        if ($LASTEXITCODE -ne 0) { throw "NuGet pack failed" }
        
        $nupkg = Get-ChildItem -Path $nupkgDir -Filter "*.nupkg" | Select-Object -First 1
        if ($nupkg) {
            $size = [math]::Round($nupkg.Length / 1KB, 2)
            Write-Success "NuGet package created: $($nupkg.Name) ($size KB)"
        }
        
        # VSIX package
        Write-Step "Creating VSIX package..."
        Push-Location "$RepoRoot/extensions/traffic-recorder"
        npx @vscode/vsce package --out traffic-cop.vsix
        if ($LASTEXITCODE -ne 0) { 
            Pop-Location
            throw "VSIX package failed" 
        }
        
        $vsix = Get-ChildItem -Filter "*.vsix" | Select-Object -First 1
        if ($vsix) {
            $size = [math]::Round($vsix.Length / 1KB, 2)
            Write-Success "VSIX package created: $($vsix.Name) ($size KB)"
        }
        Pop-Location
    }

    # ═══════════════════════════════════════════════════════════
    # SUCCESS SUMMARY
    # ═══════════════════════════════════════════════════════════
    $elapsed = (Get-Date) - $startTime
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host " ✓ Build Completed Successfully!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "Build Time: $($elapsed.ToString('mm\:ss'))" -ForegroundColor White
    Write-Host "Configuration: $Configuration" -ForegroundColor White
    Write-Host ""
    
    if ($Package) {
        Write-Host "Artifacts:" -ForegroundColor Cyan
        Write-Host "  • NuGet: DevProxyExtension/nupkg/" -ForegroundColor White
        Write-Host "  • VSIX:  extensions/traffic-recorder/traffic-cop.vsix" -ForegroundColor White
        Write-Host ""
    }
    
    Write-Host "Next steps:" -ForegroundColor Yellow
    if (-not $Package) {
        Write-Host "  • Package: .\build.ps1 -Package" -ForegroundColor Gray
    }
    Write-Host "  • Test locally: code --install-extension extensions/traffic-recorder/traffic-cop.vsix" -ForegroundColor Gray
    Write-Host "  • Release: .\scripts\release.ps1" -ForegroundColor Gray
    Write-Host ""

} catch {
    $elapsed = (Get-Date) - $startTime
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host " ✗ Build Failed!" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Err $_.Exception.Message
    Write-Host ""
    Write-Host "Build Time: $($elapsed.ToString('mm\:ss'))" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

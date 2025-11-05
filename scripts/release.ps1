#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Create a new release with automated versioning

.DESCRIPTION
    Automates the release process:
    1. Validates working directory is clean (or allows dirty with -Force)
    2. Bumps version based on semver increment type
    3. Syncs version across all files
    4. Builds and tests everything
    5. Commits version changes
    6. Creates git tag
    7. Packages extension and NuGet
    8. Optionally publishes to NuGet and VS Code Marketplace

.PARAMETER Increment
    Version increment type: major, minor, or patch (default: patch)

.PARAMETER Version
    Explicit version to use instead of auto-increment

.PARAMETER Force
    Allow release from dirty working directory

.PARAMETER SkipTests
    Skip running tests

.PARAMETER Publish
    Publish to NuGet and VS Code Marketplace after building

.PARAMETER PublishNuGet
    Publish only to NuGet

.PARAMETER PublishVSCode
    Publish only to VS Code Marketplace

.EXAMPLE
    .\release.ps1 -Increment patch
    Create a patch release (0.4.0 -> 0.4.1)

.EXAMPLE
    .\release.ps1 -Increment minor
    Create a minor release (0.4.0 -> 0.5.0)

.EXAMPLE
    .\release.ps1 -Version 1.0.0
    Create version 1.0.0 release

.EXAMPLE
    .\release.ps1 -Increment patch -Publish
    Create patch release and publish to NuGet + VS Code Marketplace
#>

param(
    [ValidateSet('major', 'minor', 'patch')]
    [string]$Increment = 'patch',
    [string]$Version,
    [switch]$Force,
    [switch]$SkipTests,
    [switch]$Publish,
    [switch]$PublishNuGet,
    [switch]$PublishVSCode
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

function Write-Err {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $ColorError
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Release Automation Tool                                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Push-Location $repoRoot

try {
    # Step 1: Check working directory status
    Write-Step "Checking git status..."
    
    git diff --quiet HEAD 2>$null
    $isDirty = $LASTEXITCODE -ne 0
    
    if ($isDirty -and -not $Force) {
        Write-Err "Working directory has uncommitted changes"
        Write-Host ""
        Write-Host "Options:" -ForegroundColor Yellow
        Write-Host "  1. Commit your changes: git add . && git commit -m 'message'" -ForegroundColor Gray
        Write-Host "  2. Stash your changes: git stash" -ForegroundColor Gray
        Write-Host "  3. Force release anyway: .\release.ps1 -Force" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
    
    if ($isDirty) {
        Write-Warn "Working directory is dirty but proceeding with -Force"
    } else {
        Write-Success "Working directory is clean"
    }

    # Step 2: Determine new version
    if ([string]::IsNullOrEmpty($Version)) {
        Write-Step "Calculating new version..."
        
        $getVersionScript = Join-Path $scriptDir "get-version.ps1"
        $versionInfo = & $getVersionScript -Format json | ConvertFrom-Json
        
        $major = $versionInfo.major
        $minor = $versionInfo.minor
        $patch = $versionInfo.patch
        
        switch ($Increment) {
            'major' { 
                $major++
                $minor = 0
                $patch = 0
            }
            'minor' { 
                $minor++
                $patch = 0
            }
            'patch' { 
                $patch++
            }
        }
        
        $Version = "$major.$minor.$patch"
        Write-Success "New version: $Version ($Increment increment from $($versionInfo.baseVersion))"
    } else {
        Write-Step "Using explicit version: $Version"
    }

    # Step 3: Sync version across all files
    Write-Step "Synchronizing version across all files..."
    $syncVersionScript = Join-Path $scriptDir "sync-version.ps1"
    & $syncVersionScript -Version $Version
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Version sync failed"
        exit 1
    }

    # Step 4: Build everything
    Write-Step "Building HttpRecorder.DevProxy plugin..."
    dotnet build "$repoRoot\DevProxyExtension\HttpRecorder.DevProxy\HttpRecorder.DevProxy.csproj" -c Release
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Plugin build failed"
        exit 1
    }
    Write-Success "Plugin built successfully"

    Write-Step "Building VS Code extension..."
    Push-Location "$repoRoot\extensions\traffic-recorder"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Err "Extension build failed"
        exit 1
    }
    Pop-Location
    Write-Success "Extension built successfully"

    # Step 5: Run tests
    if (-not $SkipTests) {
        Write-Step "Running NuGet package tests..."
        dotnet test "$repoRoot\DevProxyExtension\HttpRecorder.DevProxy.Tests\HttpRecorder.DevProxy.Tests.csproj" -c Release --no-build
        
        if ($LASTEXITCODE -ne 0) {
            Write-Err "NuGet tests failed"
            exit 1
        }
        Write-Success "NuGet tests passed"

        Write-Step "Running VS Code extension tests..."
        Push-Location "$repoRoot\extensions\traffic-recorder"
        npm test
        if ($LASTEXITCODE -ne 0) {
            Pop-Location
            Write-Err "Extension tests failed"
            exit 1
        }
        Pop-Location
        Write-Success "Extension tests passed"
    } else {
        Write-Warn "Skipping tests (--SkipTests specified)"
    }

    # Step 6: Package everything
    Write-Step "Packaging NuGet..."
    dotnet pack "$repoRoot\DevProxyExtension\HttpRecorder.DevProxy\HttpRecorder.DevProxy.csproj" -c Release -o "$repoRoot\DevProxyExtension\nupkg"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "NuGet packaging failed"
        exit 1
    }
    Write-Success "NuGet packaged: HttpRecorder.DevProxy.$Version.nupkg"

    Write-Step "Packaging VS Code extension..."
    Push-Location "$repoRoot\extensions\traffic-recorder"
    npm run package
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Err "Extension packaging failed"
        exit 1
    }
    Pop-Location
    Write-Success "Extension packaged: traffic-recorder-$Version.vsix"

    # Step 7: Commit and tag
    Write-Step "Committing version changes..."
    git add "$repoRoot\extensions\traffic-recorder\package.json"
    git add "$repoRoot\DevProxyExtension\HttpRecorder.DevProxy\HttpRecorder.DevProxy.csproj"
    git commit -m "chore: bump version to $Version"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "No changes to commit (version already set?)"
    } else {
        Write-Success "Committed version changes"
    }

    Write-Step "Creating git tag v$Version..."
    git tag -a "v$Version" -m "Release v$Version"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to create git tag"
        exit 1
    }
    Write-Success "Created tag v$Version"

    # Step 8: Publish (optional)
    if ($Publish -or $PublishNuGet) {
        Write-Step "Publishing to NuGet..."
        & "$repoRoot\DevProxyExtension\publish-nuget.ps1" -Version $Version
        
        if ($LASTEXITCODE -ne 0) {
            Write-Err "NuGet publish failed"
            exit 1
        }
        Write-Success "Published to NuGet"
    }

    if ($Publish -or $PublishVSCode) {
        Write-Step "Publishing to VS Code Marketplace..."
        Push-Location "$repoRoot\extensions\traffic-recorder"
        vsce publish -p $env:VSCE_TOKEN
        if ($LASTEXITCODE -ne 0) {
            Pop-Location
            Write-Err "VS Code Marketplace publish failed"
            exit 1
        }
        Pop-Location
        Write-Success "Published to VS Code Marketplace"
    }

    # Success summary
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✓ Release v$Version completed successfully!" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Created:" -ForegroundColor Cyan
    Write-Host "  • Git tag: v$Version" -ForegroundColor White
    Write-Host "  • NuGet package: HttpRecorder.DevProxy.$Version.nupkg" -ForegroundColor White
    Write-Host "  • VS Code extension: traffic-recorder-$Version.vsix" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  • Push changes: git push && git push --tags" -ForegroundColor Gray
    if (-not $Publish -and -not $PublishNuGet) {
        Write-Host "  • Publish NuGet: .\DevProxyExtension\publish-nuget.ps1" -ForegroundColor Gray
    }
    if (-not $Publish -and -not $PublishVSCode) {
        Write-Host "  • Publish Extension: cd extensions\traffic-recorder && vsce publish" -ForegroundColor Gray
    }
    Write-Host ""

} catch {
    Write-Err "Release failed: $_"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

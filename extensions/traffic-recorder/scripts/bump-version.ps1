#!/usr/bin/env pwsh
# Bump version across all relevant files

param(
    [Parameter(Mandatory=$true)]
    [string]$NewVersion
)

# Validate semantic version format
if ($NewVersion -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "❌ Invalid version format. Use: MAJOR.MINOR.PATCH (e.g., 1.0.0)" -ForegroundColor Red
    exit 1
}

Write-Host "🔄 Bumping version to $NewVersion..." -ForegroundColor Cyan

# Get script directory and workspace root
$ScriptDir = Split-Path -Parent $PSCommandPath
$ExtensionRoot = Split-Path -Parent $ScriptDir
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $ExtensionRoot)

# Update package.json
$PackageJsonPath = Join-Path $ExtensionRoot "package.json"
if (Test-Path $PackageJsonPath) {
    Write-Host "  📝 Updating $PackageJsonPath" -ForegroundColor Gray
    $PackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
    $OldVersion = $PackageJson.version
    $PackageJson.version = $NewVersion
    $PackageJson | ConvertTo-Json -Depth 100 | Set-Content $PackageJsonPath
    Write-Host "  ✅ package.json: $OldVersion → $NewVersion" -ForegroundColor Green
}

# Update HttpRecorder.DevProxy.csproj
$CsprojPath = Join-Path $WorkspaceRoot "DevProxyExtension\HttpRecorder.DevProxy\HttpRecorder.DevProxy.csproj"
if (Test-Path $CsprojPath) {
    Write-Host "  📝 Updating $CsprojPath" -ForegroundColor Gray
    $Csproj = [xml](Get-Content $CsprojPath)
    
    $VersionNode = $Csproj.Project.PropertyGroup.Version
    if ($null -eq $VersionNode) {
        # Add Version node if it doesn't exist
        $PropertyGroup = $Csproj.Project.PropertyGroup
        if ($null -eq $PropertyGroup) {
            $PropertyGroup = $Csproj.CreateElement("PropertyGroup")
            $Csproj.Project.AppendChild($PropertyGroup) | Out-Null
        }
        $VersionElement = $Csproj.CreateElement("Version")
        $VersionElement.InnerText = $NewVersion
        $PropertyGroup.AppendChild($VersionElement) | Out-Null
    } else {
        $OldVersion = $VersionNode
        $Csproj.Project.PropertyGroup.Version = $NewVersion
    }
    
    $Csproj.Save($CsprojPath)
    Write-Host "  ✅ HttpRecorder.DevProxy.csproj: version set to $NewVersion" -ForegroundColor Green
}

# Update CHANGELOG.md
$ChangelogPath = Join-Path $WorkspaceRoot "CHANGELOG.md"
if (Test-Path $ChangelogPath) {
    Write-Host "  📝 Updating $ChangelogPath" -ForegroundColor Gray
    $Changelog = Get-Content $ChangelogPath -Raw
    $Date = Get-Date -Format "yyyy-MM-dd"
    
    # Add new version header after ## [Unreleased]
    $NewEntry = @"
## [$NewVersion] - $Date

### Added
- 

### Changed
- 

### Fixed
- 

"@
    
    if ($Changelog -match '## \[Unreleased\]') {
        $Changelog = $Changelog -replace '(## \[Unreleased\])', "`$1`n`n$NewEntry"
        Set-Content $ChangelogPath $Changelog
        Write-Host "  ✅ CHANGELOG.md: Added entry for $NewVersion" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  CHANGELOG.md: Could not find [Unreleased] section" -ForegroundColor Yellow
    }
}

# Create git tag
Write-Host ""
Write-Host "📦 Version bumped to $NewVersion" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Update CHANGELOG.md with changes" -ForegroundColor Gray
Write-Host "  2. Commit changes: git add -A && git commit -m 'chore: bump version to $NewVersion'" -ForegroundColor Gray
Write-Host "  3. Create tag: git tag -a v$NewVersion -m 'Release v$NewVersion'" -ForegroundColor Gray
Write-Host "  4. Push: git push && git push --tags" -ForegroundColor Gray
Write-Host "  5. Build and publish: pwsh scripts/build-and-install.ps1" -ForegroundColor Gray

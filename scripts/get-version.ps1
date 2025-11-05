#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Get semantic version from git tags with dirty build detection

.DESCRIPTION
    Determines the version number for builds:
    - Clean builds: Uses latest git tag (e.g., v0.4.0 -> 0.4.0)
    - Dirty builds: Appends -dirty suffix (e.g., 0.4.0-dirty)
    - No tags: Defaults to 0.1.0 (or 0.1.0-dirty if dirty)
    - Local builds: Increments patch version with commit count (e.g., 0.4.1-local.5)

.PARAMETER IncludePrefix
    Include 'v' prefix in output (e.g., v0.4.0 instead of 0.4.0)

.PARAMETER Format
    Output format: semver (default), json, or env

.EXAMPLE
    .\get-version.ps1
    Returns: 0.4.0 (clean) or 0.4.0-dirty (dirty)

.EXAMPLE
    .\get-version.ps1 -Format json
    Returns: {"version":"0.4.0","tag":"v0.4.0","dirty":false,"commits":0}
#>

param(
    [switch]$IncludePrefix,
    [ValidateSet('semver', 'json', 'env')]
    [string]$Format = 'semver'
)

$ErrorActionPreference = "Stop"

# Change to repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
    # Check if git is available
    $gitAvailable = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
    if (-not $gitAvailable) {
        Write-Error "Git is not available. Please install git."
    }

    # Check if we're in a git repository
    $isGitRepo = git rev-parse --git-dir 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Not in a git repository"
    }

    # Get the latest tag that matches semantic versioning pattern
    $latestTag = git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*" 2>$null
    
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($latestTag)) {
        # No tags found, use default version
        $latestTag = "v0.1.0"
        $baseVersion = "0.1.0"
    } else {
        # Remove 'v' prefix from tag to get base version
        $baseVersion = $latestTag -replace '^v', ''
    }

    # Parse semantic version
    if ($baseVersion -match '^(\d+)\.(\d+)\.(\d+)') {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        $patch = [int]$matches[3]
    } else {
        Write-Error "Invalid semantic version format: $baseVersion"
    }

    # Check if working directory is dirty
    git diff --quiet HEAD 2>$null
    $isDirty = $LASTEXITCODE -ne 0

    git diff --cached --quiet HEAD 2>$null
    $hasStagedChanges = $LASTEXITCODE -ne 0

    $isDirty = $isDirty -or $hasStagedChanges

    # Count commits since last tag
    $commitsSinceTag = 0
    if ($latestTag -ne "v0.1.0") {
        $commitCount = git rev-list "${latestTag}..HEAD" --count 2>$null
        if ($LASTEXITCODE -eq 0) {
            $commitsSinceTag = [int]$commitCount
        }
    }

    # Determine version suffix
    $suffix = ""
    $version = $baseVersion

    if ($commitsSinceTag -gt 0) {
        # Local build with commits since tag
        $patch++
        $version = "$major.$minor.$patch"
        $suffix = "-local.$commitsSinceTag"
    }

    if ($isDirty) {
        # Dirty build
        if ($suffix) {
            $suffix = "$suffix.dirty"
        } else {
            $suffix = "-dirty"
        }
    }

    $fullVersion = "$version$suffix"
    
    # Add prefix if requested
    if ($IncludePrefix) {
        $fullVersion = "v$fullVersion"
    }

    # Output based on format
    switch ($Format) {
        'json' {
            $output = @{
                version = "$version$suffix"
                baseVersion = $baseVersion
                tag = $latestTag
                major = $major
                minor = $minor
                patch = $patch
                suffix = $suffix
                dirty = $isDirty
                commits = $commitsSinceTag
            } | ConvertTo-Json -Compress
            Write-Output $output
        }
        'env' {
            Write-Output "VERSION=$version$suffix"
            Write-Output "VERSION_MAJOR=$major"
            Write-Output "VERSION_MINOR=$minor"
            Write-Output "VERSION_PATCH=$patch"
            Write-Output "VERSION_SUFFIX=$suffix"
            Write-Output "VERSION_TAG=$latestTag"
            Write-Output "IS_DIRTY=$($isDirty.ToString().ToLower())"
            Write-Output "COMMITS_SINCE_TAG=$commitsSinceTag"
        }
        default {
            Write-Output $fullVersion
        }
    }

} finally {
    Pop-Location
}

# Automated Versioning System

This directory contains scripts for automated version management across the HttpRecorder project, keeping the VS Code extension and NuGet package versions synchronized using git tags.

## Overview

The versioning system uses **git tags** as the single source of truth for version numbers. All version numbers are derived from git tags following semantic versioning (semver).

### Version Format

- **Clean builds**: `major.minor.patch` (e.g., `0.4.0`)
- **Dirty builds**: `major.minor.patch-dirty` (e.g., `0.4.0-dirty`)
- **Local builds**: `major.minor.patch+1-local.N` (e.g., `0.4.1-local.5`)
- **Dirty local builds**: `major.minor.patch+1-local.N.dirty` (e.g., `0.4.1-local.5.dirty`)

### Components Synchronized

1. **VS Code Extension** - `extensions/traffic-recorder/package.json`
2. **NuGet Package** - `DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj`

## Scripts

### `get-version.ps1`

Determines the current version based on git tags and working directory state.

**Usage:**
```powershell
# Get version as string
.\scripts\get-version.ps1
# Output: 0.4.0 (or 0.4.0-dirty if uncommitted changes)

# Get version with 'v' prefix
.\scripts\get-version.ps1 -IncludePrefix
# Output: v0.4.0

# Get version as JSON
.\scripts\get-version.ps1 -Format json
# Output: {"version":"0.4.0","tag":"v0.4.0","dirty":false,"commits":0,...}

# Get version as environment variables
.\scripts\get-version.ps1 -Format env
# Output:
# VERSION=0.4.0
# VERSION_MAJOR=0
# VERSION_MINOR=4
# VERSION_PATCH=0
# IS_DIRTY=false
```

**Version Detection Logic:**

1. **Latest Tag**: Finds the most recent git tag matching `v*.*.*` (e.g., `v0.4.0`)
2. **Commits Since Tag**: Counts commits since the tag
3. **Dirty Check**: Detects uncommitted or staged changes
4. **Version Calculation**:
   - If no commits since tag and clean: `0.4.0`
   - If no commits since tag and dirty: `0.4.0-dirty`
   - If N commits since tag and clean: `0.4.1-local.N`
   - If N commits since tag and dirty: `0.4.1-local.N.dirty`

### `sync-version.ps1`

Synchronizes version numbers across all project files.

**Usage:**
```powershell
# Auto-detect version from git tags and sync
.\scripts\sync-version.ps1

# Set explicit version
.\scripts\sync-version.ps1 -Version 0.5.0

# Preview changes without modifying files
.\scripts\sync-version.ps1 -DryRun
```

**What it Updates:**
- `extensions/traffic-recorder/package.json` → `"version": "0.4.0"`
- `DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj` → `<Version>0.4.0</Version>`

### `release.ps1`

Automates the complete release process.

**Usage:**
```powershell
# Create a patch release (0.4.0 -> 0.4.1)
.\scripts\release.ps1 -Increment patch

# Create a minor release (0.4.0 -> 0.5.0)
.\scripts\release.ps1 -Increment minor

# Create a major release (0.4.0 -> 1.0.0)
.\scripts\release.ps1 -Increment major

# Create specific version
.\scripts\release.ps1 -Version 1.0.0

# Create release and publish to NuGet + VS Code Marketplace
.\scripts\release.ps1 -Increment patch -Publish

# Create release and publish only to NuGet
.\scripts\release.ps1 -Increment patch -PublishNuGet

# Skip tests (faster, but risky)
.\scripts\release.ps1 -Increment patch -SkipTests

# Force release from dirty working directory
.\scripts\release.ps1 -Increment patch -Force
```

**Release Process:**

1. ✅ **Validate**: Check working directory is clean
2. 🔢 **Version**: Calculate new version number
3. 🔄 **Sync**: Update version in all files
4. 🔨 **Build**: Build plugin and extension
5. 🧪 **Test**: Run all tests
6. 📦 **Package**: Create NuGet package and VSIX
7. 💾 **Commit**: Commit version changes
8. 🏷️ **Tag**: Create git tag (e.g., `v0.4.1`)
9. 🚀 **Publish** (optional): Publish to NuGet and/or VS Code Marketplace

## Workflow Examples

### Development Workflow

```powershell
# Work on features
git commit -m "feat: add new feature"
git commit -m "fix: fix bug"

# Build with local version (e.g., 0.4.1-local.2)
.\scripts\sync-version.ps1
npm run build
dotnet build -c Release

# Version automatically shows 0.4.1-local.2-dirty if uncommitted changes
```

### Release Workflow

```powershell
# Ensure working directory is clean
git status

# Create patch release
.\scripts\release.ps1 -Increment patch

# Or create minor release
.\scripts\release.ps1 -Increment minor

# Push changes and tags
git push
git push --tags

# Publish manually if not using -Publish flag
cd DevProxyExtension
.\publish-nuget.ps1

cd ..\extensions\traffic-recorder
vsce publish
```

### Hotfix Workflow

```powershell
# Checkout the tag to hotfix
git checkout v0.4.0

# Create hotfix branch
git checkout -b hotfix/0.4.1

# Make fixes
git commit -m "fix: critical bug"

# Create patch release
.\scripts\release.ps1 -Increment patch

# Push hotfix
git push origin hotfix/0.4.1
git push --tags

# Merge back to main
git checkout master
git merge hotfix/0.4.1
```

## Version Suffix Rules

| Situation | Version | Suffix | Example |
|-----------|---------|--------|---------|
| Clean build at tag | `X.Y.Z` | None | `0.4.0` |
| Dirty build at tag | `X.Y.Z` | `-dirty` | `0.4.0-dirty` |
| Clean local build | `X.Y.Z+1` | `-local.N` | `0.4.1-local.5` |
| Dirty local build | `X.Y.Z+1` | `-local.N.dirty` | `0.4.1-local.5.dirty` |

Where:
- `X.Y.Z` = Latest tagged version
- `N` = Number of commits since tag
- Patch version increments for local builds

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Fetch all history for version detection

      - name: Get Version
        id: version
        shell: pwsh
        run: |
          $version = .\scripts\get-version.ps1
          echo "version=$version" >> $env:GITHUB_OUTPUT

      - name: Sync Versions
        shell: pwsh
        run: .\scripts\sync-version.ps1

      - name: Build and Test
        shell: pwsh
        run: |
          dotnet build -c Release
          dotnet test -c Release
          npm run build
          npm test

      - name: Package
        shell: pwsh
        run: |
          dotnet pack -c Release
          npm run package

      - name: Publish NuGet
        shell: pwsh
        env:
          NUGET_API_KEY: ${{ secrets.NUGET_API_KEY }}
        run: .\DevProxyExtension\publish-nuget.ps1

      - name: Publish VS Code Extension
        shell: pwsh
        env:
          VSCE_TOKEN: ${{ secrets.VSCE_TOKEN }}
        run: |
          cd extensions\traffic-recorder
          vsce publish
```

## Troubleshooting

### "No git tags found"

**Solution**: Create initial tag
```powershell
git tag v0.1.0
git push --tags
```

### "Working directory is dirty"

**Solution**: Commit or stash changes
```powershell
# Option 1: Commit changes
git add .
git commit -m "commit message"

# Option 2: Stash changes
git stash

# Option 3: Force release (not recommended)
.\scripts\release.ps1 -Force
```

### Version not updating in builds

**Solution**: Re-run sync-version
```powershell
.\scripts\sync-version.ps1
```

### Tag already exists

**Solution**: Delete and recreate tag
```powershell
# Delete local tag
git tag -d v0.4.0

# Delete remote tag (if pushed)
git push origin :refs/tags/v0.4.0

# Create new tag
.\scripts\release.ps1 -Increment patch
```

## Best Practices

1. **Always tag releases**: Use `release.ps1` to ensure consistency
2. **Clean working directory**: Commit changes before creating releases
3. **Semantic versioning**: Follow semver guidelines
   - Major: Breaking changes
   - Minor: New features (backward compatible)
   - Patch: Bug fixes
4. **Test before release**: Don't use `-SkipTests` in production
5. **Push tags**: Don't forget `git push --tags`

## Integration with Existing Build Scripts

The version scripts can be integrated into existing build processes:

**DevProxyExtension/publish-nuget.ps1**:
```powershell
# At the beginning:
$Version = & "$PSScriptRoot\..\scripts\get-version.ps1"
```

**extensions/traffic-recorder/package.json**:
```json
{
  "scripts": {
    "version:sync": "pwsh ../../scripts/sync-version.ps1",
    "prebuild": "npm run version:sync",
    "build": "tsc -p ./"
  }
}
```

## Manual Version Override

If you need to set a specific version without following the git tag logic:

```powershell
# Set explicit version
.\scripts\sync-version.ps1 -Version 2.0.0-beta.1

# Build with that version
npm run build
dotnet build -c Release
```

## Summary

- ✅ **Single source of truth**: Git tags
- ✅ **Automatic detection**: Dirty builds, local builds, releases
- ✅ **Synchronized**: VS Code extension and NuGet package
- ✅ **Semantic versioning**: major.minor.patch with suffixes
- ✅ **CI/CD ready**: Easy integration with automation

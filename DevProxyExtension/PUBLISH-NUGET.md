# Publishing HttpRecorder.DevProxy to NuGet

This guide explains how to publish the HttpRecorder.DevProxy plugin to NuGet.org.

## Prerequisites

1. **NuGet Account**
   - Sign up at https://www.nuget.org/users/account/LogOn
   - Create an API key at https://www.nuget.org/account/apikeys

2. **.NET SDK**
   - .NET 9.0 SDK installed
   - Verify: `dotnet --version`

3. **Project Dependencies**
   - HttpRecorder library must be published first
   - All tests should pass

## Quick Start

### 1. Build and Pack

```bash
# From DevProxyExtension directory
cd C:\build\maxgolov\HttpRecorder\DevProxyExtension

# Build the project
dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj -c Release

# Create NuGet package
dotnet pack HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj -c Release -o ./nupkg
```

This creates: `nupkg/HttpRecorder.DevProxy.0.1.0.nupkg`

### 2. Test Package Locally (Optional)

```bash
# Add local NuGet source
dotnet nuget add source C:\build\maxgolov\HttpRecorder\DevProxyExtension\nupkg --name LocalHttpRecorder

# Install in test project
dotnet add package HttpRecorder.DevProxy --version 0.1.0 --source LocalHttpRecorder

# Remove local source after testing
dotnet nuget remove source LocalHttpRecorder
```

### 3. Publish to NuGet.org

```bash
# Set your API key (do this once)
dotnet nuget push nupkg/HttpRecorder.DevProxy.0.1.0.nupkg --api-key YOUR_API_KEY --source https://api.nuget.org/v3/index.json
```

**Replace `YOUR_API_KEY`** with your actual NuGet API key from https://www.nuget.org/account/apikeys

## Using Environment Variable for API Key

For security, store your API key as an environment variable:

### Windows (PowerShell)
```powershell
# Set for current session
$env:NUGET_API_KEY = "your-api-key-here"

# Set permanently
[System.Environment]::SetEnvironmentVariable('NUGET_API_KEY', 'your-api-key-here', 'User')

# Use in push command
dotnet nuget push nupkg/HttpRecorder.DevProxy.0.1.0.nupkg --api-key $env:NUGET_API_KEY --source https://api.nuget.org/v3/index.json
```

### Linux/Mac (Bash)
```bash
# Set for current session
export NUGET_API_KEY="your-api-key-here"

# Set permanently (add to ~/.bashrc or ~/.zshrc)
echo 'export NUGET_API_KEY="your-api-key-here"' >> ~/.bashrc

# Use in push command
dotnet nuget push nupkg/HttpRecorder.DevProxy.0.1.0.nupkg --api-key $NUGET_API_KEY --source https://api.nuget.org/v3/index.json
```

## Complete Publishing Script

Create `publish-nuget.ps1`:

```powershell
#!/usr/bin/env pwsh
param(
    [string]$Version = "0.1.0",
    [string]$ApiKey = $env:NUGET_API_KEY,
    [switch]$LocalOnly
)

$ErrorActionPreference = "Stop"

$ProjectPath = "HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj"
$OutputDir = "./nupkg"

# Build
Write-Host "Building HttpRecorder.DevProxy v$Version..." -ForegroundColor Cyan
dotnet build $ProjectPath -c Release

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed"
    exit 1
}

# Pack
Write-Host "Creating NuGet package..." -ForegroundColor Cyan
dotnet pack $ProjectPath -c Release -o $OutputDir /p:Version=$Version

if ($LASTEXITCODE -ne 0) {
    Write-Error "Pack failed"
    exit 1
}

$PackagePath = "$OutputDir/HttpRecorder.DevProxy.$Version.nupkg"

if (-not (Test-Path $PackagePath)) {
    Write-Error "Package not found at $PackagePath"
    exit 1
}

Write-Host "✓ Package created: $PackagePath" -ForegroundColor Green

if ($LocalOnly) {
    Write-Host "Local package only (not publishing to NuGet)" -ForegroundColor Yellow
    exit 0
}

# Push to NuGet
if (-not $ApiKey) {
    Write-Error "NuGet API key not provided. Set NUGET_API_KEY environment variable or use -ApiKey parameter"
    exit 1
}

Write-Host "Publishing to NuGet.org..." -ForegroundColor Cyan
dotnet nuget push $PackagePath --api-key $ApiKey --source https://api.nuget.org/v3/index.json

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully published HttpRecorder.DevProxy v$Version to NuGet!" -ForegroundColor Green
    Write-Host "Package will be available at: https://www.nuget.org/packages/HttpRecorder.DevProxy/$Version" -ForegroundColor Cyan
} else {
    Write-Error "Failed to publish package"
    exit 1
}
```

Usage:
```bash
# Create package locally only
.\publish-nuget.ps1 -LocalOnly

# Publish with API key from environment
.\publish-nuget.ps1 -Version 0.1.0

# Publish with explicit API key
.\publish-nuget.ps1 -Version 0.1.0 -ApiKey "your-key"
```

## Updating the Extension Scripts

Once published to NuGet, update `extensions/traffic-recorder/scripts/start-devproxy.ps1`:

```powershell
# Instead of building from source, install from NuGet
function Install-HttpRecorderPlugin {
    $pluginDir = Join-Path $PSScriptRoot ".." "plugins"
    New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
    
    Write-Host "[INFO] Installing HttpRecorder.DevProxy plugin from NuGet..."
    
    # Install the NuGet package
    dotnet tool install --tool-path $pluginDir HttpRecorder.DevProxy
    
    # Or use nuget.exe
    # nuget install HttpRecorder.DevProxy -OutputDirectory $pluginDir
}
```

## Version Management

### Update Version

Edit `HttpRecorder.DevProxy.csproj`:

```xml
<PropertyGroup>
  <Version>0.2.0</Version>
  <PackageReleaseNotes>
    - Added new features
    - Fixed bugs
  </PackageReleaseNotes>
</PropertyGroup>
```

### SemVer Guidelines

- **Major (1.0.0)**: Breaking changes
- **Minor (0.1.0)**: New features (backward compatible)
- **Patch (0.1.1)**: Bug fixes

## Troubleshooting

### "Package already exists"
- NuGet doesn't allow replacing packages
- Increment version and republish
- Or delete package from NuGet (if < 72 hours)

### "Missing dependencies"
- Ensure HttpRecorder library is published to NuGet first
- Or include it in the package (not recommended)

### "Authentication failed"
- Verify API key is correct and not expired
- Check https://www.nuget.org/account/apikeys
- Ensure key has "Push" permission

### "Package validation failed"
- Check all required metadata is present
- Ensure README.md exists
- Verify license is specified

## Best Practices

1. **Test Locally First**
   - Always test with local NuGet source
   - Verify in a clean environment

2. **Version Every Release**
   - Never reuse version numbers
   - Follow semantic versioning

3. **Include Documentation**
   - Add comprehensive README.md
   - Include XML documentation comments

4. **Tag Git Releases**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

5. **Update CHANGELOG.md**
   - Document all changes
   - Link to GitHub releases

## CI/CD (GitHub Actions)

Create `.github/workflows/publish-nuget.yml`:

```yaml
name: Publish to NuGet

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '9.0.x'
      
      - name: Build
        run: dotnet build DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj -c Release
      
      - name: Pack
        run: dotnet pack DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj -c Release -o ./nupkg
      
      - name: Publish
        run: dotnet nuget push nupkg/*.nupkg --api-key ${{ secrets.NUGET_API_KEY }} --source https://api.nuget.org/v3/index.json
```

Store `NUGET_API_KEY` in GitHub repository secrets.

## References

- [NuGet Documentation](https://docs.microsoft.com/nuget/)
- [Creating NuGet Packages](https://docs.microsoft.com/nuget/create-packages/creating-a-package)
- [Publishing Packages](https://docs.microsoft.com/nuget/nuget-org/publish-a-package)
- [Package Metadata](https://docs.microsoft.com/nuget/reference/nuspec)

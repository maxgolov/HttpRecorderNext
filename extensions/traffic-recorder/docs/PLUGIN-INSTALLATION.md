# HttpRecorder.DevProxy Plugin Installation

This document explains how the Traffic Recorder extension installs and uses the HttpRecorder.DevProxy plugin.

## Overview

The extension uses a **smart installation strategy** that tries multiple approaches:

1. **Local Development Build** (for contributors)
2. **NuGet Package** (for end users)
3. **Manual Fallback** (with instructions)

## Installation Flow

When you start Dev Proxy via the extension, it automatically:

```
1. Check if Dev Proxy is installed → Install if needed
2. Check if plugin exists in ./plugins/ → Skip if present
3. Try local build at ../../DevProxyExtension/HttpRecorder.DevProxy/bin/Debug/
4. If not found, download from NuGet
5. Extract to ./plugins/ directory
6. Start Dev Proxy with plugin loaded
```

## For End Users

### First Run

When you first run "Start Dev Proxy":

1. Extension checks for Dev Proxy
   - If not found: Installs via winget (Windows)
   
2. Extension checks for plugin
   - Downloads from NuGet automatically
   - Extracts to `extensions/traffic-recorder/plugins/`
   
3. Dev Proxy starts with plugin loaded
   - Records traffic to `.http-recorder/`
   - Creates HAR files with timestamps

### Prerequisites

- **.NET 9.0 SDK** (for NuGet package restoration)
  - Download: https://dotnet.microsoft.com/download
  - Verify: `dotnet --version`

- **Dev Proxy** (installed automatically)
  - Windows: via winget
  - Mac: via homebrew
  - Linux: via install script

### Manual Installation

If automatic installation fails:

```bash
# Download plugin manually
cd extensions/traffic-recorder
mkdir plugins
cd plugins

# Option 1: Use dotnet tool
dotnet tool install HttpRecorder.DevProxy --tool-path .

# Option 2: Download from NuGet.org
# Visit: https://www.nuget.org/packages/HttpRecorder.DevProxy/
# Download .nupkg, extract, copy DLL files
```

## For Contributors/Developers

### Local Development

When developing the plugin locally, the extension **automatically uses your local build**:

```bash
# Build the plugin
cd DevProxyExtension
dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj

# Extension will find and use:
# DevProxyExtension/HttpRecorder.DevProxy/bin/Debug/net9.0/HttpRecorder.DevProxy.dll
```

No additional steps needed! The script checks for local builds first.

### Publishing to NuGet

To make the plugin available to end users:

```bash
cd DevProxyExtension

# Build and create package locally
.\publish-nuget.ps1 -LocalOnly

# Publish to NuGet (requires API key)
$env:NUGET_API_KEY = "your-api-key"
.\publish-nuget.ps1 -Version 0.1.0
```

See [PUBLISH-NUGET.md](../../../DevProxyExtension/PUBLISH-NUGET.md) for detailed instructions.

## Plugin Location

The plugin is installed to:
```
extensions/traffic-recorder/plugins/
├── HttpRecorder.DevProxy.dll
├── HttpRecorder.dll
└── (other dependencies)
```

This directory is referenced in `devproxyrc.json`:

```json
{
  "plugins": [
    {
      "name": "HttpRecorderPlugin",
      "enabled": true,
      "pluginPath": "./plugins/HttpRecorder.DevProxy.dll"
    }
  ]
}
```

## Troubleshooting

### "Plugin not found" Error

**Solution 1: Check .NET SDK**
```bash
dotnet --version
# Should show 9.0.x or higher
```

**Solution 2: Manual Build** (for developers)
```bash
cd ../../DevProxyExtension
dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj
```

**Solution 3: Check NuGet Package**
```bash
# Verify package exists
nuget list HttpRecorder.DevProxy
```

### "Failed to install from NuGet"

This usually means the package hasn't been published yet.

**For contributors:**
1. Build locally: `dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj`
2. Extension will auto-detect and use local build

**For end users:**
Wait for the package to be published, or build from source:
```bash
git clone https://github.com/maxgolov/HttpRecorder
cd HttpRecorder/DevProxyExtension
dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj
```

### Force Reinstall

To force reinstall the plugin:

```bash
# Delete plugins directory
rm -rf extensions/traffic-recorder/plugins

# Start Dev Proxy again - will reinstall
```

Or use PowerShell:
```powershell
Remove-Item -Path "extensions/traffic-recorder/plugins" -Recurse -Force
```

## Plugin Configuration

Edit `devproxyrc.json` to configure the plugin:

```json
{
  "plugins": [
    {
      "name": "HttpRecorderPlugin",
      "enabled": true,
      "pluginPath": "./plugins/HttpRecorder.DevProxy.dll",
      "configSection": "httpRecorder"
    }
  ],
  "httpRecorder": {
    "outputDirectory": "./.http-recorder",
    "fileNamePattern": "recording_{timestamp}.har",
    "includeHeaders": true,
    "includeBody": true
  }
}
```

## Development Workflow

### Making Changes

1. Edit plugin code in `DevProxyExtension/HttpRecorder.DevProxy/`
2. Build: `dotnet build`
3. Restart Dev Proxy from extension
4. Extension automatically uses new build

### Testing Changes

```bash
# Build
cd DevProxyExtension
dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj

# Run tests
dotnet test HttpRecorder.DevProxy.Tests/HttpRecorder.DevProxy.Tests.csproj

# Start extension with new build
# (VS Code will use local build automatically)
```

### Publishing Updates

1. Update version in `HttpRecorder.DevProxy.csproj`
2. Update CHANGELOG.md
3. Build and test
4. Publish: `.\publish-nuget.ps1 -Version x.y.z`
5. Users get update on next Dev Proxy start

## Architecture

```
Traffic Recorder Extension
    ↓
Install-HttpRecorderPlugin
    ↓
    ├─→ Check ./plugins/ directory
    ├─→ Try local build (development)
    ├─→ Download from NuGet (users)
    └─→ Extract to ./plugins/
    ↓
Start-DevProxyServer
    ↓
    └─→ devproxy --config devproxyrc.json
        ↓
        └─→ Loads HttpRecorder.DevProxy.dll
            ↓
            └─→ Records traffic to .http-recorder/
```

## FAQs

**Q: Do I need to build the plugin manually?**
A: No! For end users, it downloads from NuGet automatically. For contributors, extension uses your local build.

**Q: Can I use a different version?**
A: Yes, edit the script to specify version: `Install-HttpRecorderPlugin -Version "0.2.0"`

**Q: Where is the plugin cached?**
A: NuGet cache: `%USERPROFILE%\.nuget\packages\httprecorder.devproxy\`

**Q: How do I update the plugin?**
A: Delete `./plugins/` directory and restart Dev Proxy. It will download the latest.

**Q: Can I use multiple versions?**
A: Each extension instance has its own `./plugins/` directory with one version.

## References

- [NuGet Package](https://www.nuget.org/packages/HttpRecorder.DevProxy/)
- [Plugin Source Code](../../../DevProxyExtension/HttpRecorder.DevProxy/)
- [Publishing Guide](../../../DevProxyExtension/PUBLISH-NUGET.md)
- [Dev Proxy Docs](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/)

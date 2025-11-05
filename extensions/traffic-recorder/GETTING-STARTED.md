# Getting Started with HttpRecorder

Complete guide to building, installing, and distributing the Traffic Recorder extension.

## Your Questions Answered

### 1. How do I build the extension?

**Automated (Recommended)**:
```bash
# Windows
pwsh extensions/traffic-recorder/scripts/build-and-install.ps1

# Linux/Mac
bash extensions/traffic-recorder/scripts/build-and-install.sh
```

This script:
1. ✅ Installs npm dependencies
2. ✅ Builds HttpRecorder.DevProxy plugin (.NET)
3. ✅ Builds TypeScript extension
4. ✅ Runs tests (skip with `-SkipTests` or `--skip-tests`)
5. ✅ Packages as .vsix file
6. ✅ Installs in VS Code

**Manual**:
```bash
cd extensions/traffic-recorder

# Install dependencies
npm install

# Build plugin
dotnet build ../../DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj

# Build extension
npm run build

# Run tests
npm test

# Package
npm run package

# Install
code --install-extension traffic-recorder-0.1.0.vsix
```

### 2. How do I install it?

**After building**:
```bash
# The build script auto-installs, or run:
npm run install-extension
```

**From VSIX file**:
```bash
code --install-extension traffic-recorder-0.1.0.vsix
```

**From Marketplace** (when published):
```bash
code --install-extension maxgolov.traffic-recorder
```

### 3. Can I copy scripts to my directory?

**Yes!** Run this command:
```bash
cd extensions/traffic-recorder
npm run copy-scripts
```

This copies everything to `~/.traffic-recorder/`:
- ✅ `scripts/start-devproxy.ps1` (Windows)
- ✅ `scripts/start-devproxy.sh` (Linux/Mac)
- ✅ `devproxyrc.json` (Dev Proxy config)
- ✅ `playwright.config.ts` (Playwright config)
- ✅ `README.md` (Instructions)

**Then you can run from anywhere**:
```bash
# Windows
cd ~/.traffic-recorder
pwsh scripts/start-devproxy.ps1

# Linux/Mac
cd ~/.traffic-recorder
bash scripts/start-devproxy.sh
```

### 4. How do we distribute the plugin?

**Multiple options**:

#### Option 1: VS Code Marketplace (Extension)

**Best for**: Public distribution to VS Code users

**Steps**:
1. Create publisher account: https://marketplace.visualstudio.com/
2. Install vsce: `npm install -g @vscode/vsce`
3. Login: `vsce login your-publisher-name`
4. Publish: `vsce publish`

**Users install**:
```bash
code --install-extension maxgolov.traffic-recorder
```

See: [DISTRIBUTION.md](docs/DISTRIBUTION.md#option-1-vs-code-marketplace-recommended)

#### Option 2: GitHub Releases (Extension + Plugin)

**Best for**: Open source, version control, free hosting

**Automated** via GitHub Actions (`.github/workflows/release.yml`):
1. Push git tag: `git tag v1.0.0 && git push --tags`
2. GitHub Actions automatically:
   - Builds extension → `traffic-recorder-1.0.0.vsix`
   - Builds plugin → `HttpRecorder.DevProxy.1.0.0.nupkg`
   - Creates GitHub Release
   - Uploads both files

**Users download**:
```bash
# Extension
curl -L -O https://github.com/maxgolov/HttpRecorder/releases/latest/download/traffic-recorder.vsix
code --install-extension traffic-recorder.vsix

# Plugin (NuGet package)
curl -L -O https://github.com/maxgolov/HttpRecorder/releases/latest/download/HttpRecorder.DevProxy.nupkg
```

See: [DISTRIBUTION.md](docs/DISTRIBUTION.md#option-3-github-releases)

#### Option 3: NuGet.org (Plugin Only)

**Best for**: .NET developers using Dev Proxy

**Steps**:
1. Create NuGet account: https://www.nuget.org/
2. Get API key
3. Pack: `dotnet pack --configuration Release`
4. Push: `dotnet nuget push bin/Release/HttpRecorder.DevProxy.1.0.0.nupkg --api-key YOUR_KEY --source https://api.nuget.org/v3/index.json`

**Users install**:
```bash
# Download package
dotnet add package HttpRecorder.DevProxy

# Reference in devproxyrc.json
{
  "plugins": [{
    "name": "HttpRecorderPlugin",
    "pluginPath": "./packages/HttpRecorder.DevProxy/lib/net9.0/HttpRecorder.DevProxy.dll"
  }]
}
```

See: [DISTRIBUTION.md](docs/DISTRIBUTION.md#option-1-nuget-package-recommended-for-net-ecosystem)

#### Option 4: Bundled in Extension (Current Approach)

**Best for**: Simplicity, development

**How it works**:
- Extension auto-builds plugin on first run
- No separate installation needed
- Plugin always up-to-date with extension

**Advantages**:
- ✅ No extra steps
- ✅ Always compatible versions

**Disadvantages**:
- ❌ Requires .NET SDK on user machine
- ❌ Slower first run

See: [DISTRIBUTION.md](docs/DISTRIBUTION.md#option-4-bundled-with-extension)

### 5. Can it be added as a dotnet tool?

**Not directly** - the plugin is a library, not a standalone executable.

**However**, you have these options:

#### Option A: Distribute as NuGet Package (Recommended)

The plugin is already configured for NuGet:
```xml
<!-- DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj -->
<PropertyGroup>
  <IsPackable>true</IsPackable>
  <PackageId>HttpRecorder.DevProxy</PackageId>
  <Version>0.1.0</Version>
</PropertyGroup>
```

**Create package**:
```bash
cd DevProxyExtension/HttpRecorder.DevProxy
dotnet pack --configuration Release
# Creates: bin/Release/HttpRecorder.DevProxy.0.1.0.nupkg
```

**Publish**:
```bash
dotnet nuget push bin/Release/HttpRecorder.DevProxy.0.1.0.nupkg \
  --api-key YOUR_KEY \
  --source https://api.nuget.org/v3/index.json
```

**Users install**:
```bash
dotnet add package HttpRecorder.DevProxy
```

#### Option B: Create Companion .NET Tool

You could create a **separate** CLI tool for managing the plugin:

**Create new project** (`HttpRecorder.CLI/HttpRecorder.CLI.csproj`):
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <PackAsTool>true</PackAsTool>
    <ToolCommandName>httprecorder</ToolCommandName>
    <PackageId>HttpRecorder.CLI</PackageId>
    <Version>0.1.0</Version>
  </PropertyGroup>
</Project>
```

**Add commands** (`Program.cs`):
```csharp
using System.CommandLine;

var rootCommand = new RootCommand("HttpRecorder Dev Proxy Plugin Manager");

var installCmd = new Command("install", "Install HttpRecorder plugin");
installCmd.SetHandler(() => {
    Console.WriteLine("Installing HttpRecorder plugin...");
    // Copy plugin DLL to Dev Proxy plugins directory
});

rootCommand.AddCommand(installCmd);
return rootCommand.Invoke(args);
```

**Pack and publish**:
```bash
dotnet pack --configuration Release
dotnet nuget push bin/Release/HttpRecorder.CLI.0.1.0.nupkg --api-key YOUR_KEY --source https://api.nuget.org/v3/index.json
```

**Users install globally**:
```bash
dotnet tool install -g HttpRecorder.CLI

# Then run:
httprecorder install
httprecorder start
httprecorder stop
```

**However**, this adds complexity. For most use cases, **NuGet package distribution** (Option A) is simpler and more aligned with .NET ecosystem conventions.

See: [DISTRIBUTION.md](docs/DISTRIBUTION.md#option-2-net-tool-globallocal-tool)

## What's Included

### Core Components

1. **VS Code Extension** (`extensions/traffic-recorder/`)
   - Commands: Start/Stop proxy, Run tests, Install Dev Proxy
   - Status bar integration
   - Configuration management
   - Cross-platform support

2. **HttpRecorder Plugin** (`DevProxyExtension/HttpRecorder.DevProxy/`)
   - Records HTTP traffic to HAR files
   - Integrates with Dev Proxy
   - Supports anonymization and replay

3. **Documentation** (15,000+ words)
   - `QUICKSTART.md` - 5-minute getting started
   - `README.md` - Full user guide
   - `SETUP.md` - Installation instructions
   - `AI-GUIDE.md` - Development guide
   - `QUICK-REFERENCE.md` - Command reference
   - `DISTRIBUTION.md` - Publishing guide
   - `BUILD-AND-RELEASE.md` - Build instructions

4. **Automated Tests**
   - Extension integration tests (Mocha + VS Code Test Electron)
   - Unit tests (Vitest)
   - Example Playwright tests

5. **Build Automation**
   - Cross-platform build scripts (PowerShell + Bash)
   - Version bump scripts
   - Script copying utility
   - GitHub Actions CI/CD

### File Structure

```
HttpRecorder/
├── extensions/traffic-recorder/          # VS Code Extension
│   ├── src/
│   │   ├── extension.ts                 # Main extension code
│   │   └── test/                        # Extension tests
│   ├── scripts/
│   │   ├── build-and-install.ps1        # Windows build
│   │   ├── build-and-install.sh         # Unix build
│   │   ├── bump-version.ps1             # Version management
│   │   ├── bump-version.sh
│   │   ├── copy-to-user-dir.js          # Copy scripts
│   │   ├── start-devproxy.ps1           # Start Dev Proxy
│   │   └── start-devproxy.sh
│   ├── tests/                           # Playwright tests
│   ├── package.json                     # Extension manifest
│   ├── tsconfig.json                    # TypeScript config
│   ├── playwright.config.ts             # Playwright config
│   ├── devproxyrc.json                  # Dev Proxy config
│   └── *.md                             # Documentation
├── DevProxyExtension/
│   └── HttpRecorder.DevProxy/           # Plugin code
│       ├── HttpRecorderPlugin.cs
│       ├── HttpRecorderPluginConfiguration.cs
│       └── HttpRecorder.DevProxy.csproj # NuGet package config
├── docs/
│   ├── DISTRIBUTION.md                  # Distribution guide
│   └── PLUGINS_OVERVIEW.md              # Plugin ecosystem
├── .github/workflows/
│   └── release.yml                      # CI/CD automation
└── GETTING-STARTED.md                   # This file
```

## Quick Start

### 1. Build and Install

```bash
# Clone repository (if not already)
cd c:\build\maxgolov\HttpRecorder

# Build and install (Windows)
pwsh extensions/traffic-recorder/scripts/build-and-install.ps1

# Build and install (Linux/Mac)
bash extensions/traffic-recorder/scripts/build-and-install.sh
```

**This takes ~2-3 minutes**:
- Installing dependencies
- Building .NET plugin
- Building TypeScript
- Running tests
- Packaging
- Installing

### 2. Copy Scripts to Your Directory

```bash
cd extensions/traffic-recorder
npm run copy-scripts
```

**Now you have standalone scripts**:
```
~/.traffic-recorder/
├── scripts/
│   ├── start-devproxy.ps1
│   └── start-devproxy.sh
├── devproxyrc.json
├── playwright.config.ts
└── README.md
```

### 3. Try It Out

**Start Dev Proxy**:
```bash
cd ~/.traffic-recorder
pwsh scripts/start-devproxy.ps1  # Windows
bash scripts/start-devproxy.sh   # Linux/Mac
```

**Run Example Test**:
```bash
cd extensions/traffic-recorder
npm run test:playwright
```

**View Recordings**:
```bash
ls recordings/*.har
```

### 4. Use in VS Code

Open VS Code:
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type: `Traffic Recorder: Start Dev Proxy`
3. Run your tests
4. Type: `Traffic Recorder: Stop Dev Proxy`

## Distribution Options Summary

| Option | Best For | User Experience | Setup Effort |
|--------|----------|----------------|--------------|
| **VS Code Marketplace** | Public distribution | ⭐⭐⭐⭐⭐ One-click install | Medium |
| **GitHub Releases** | Open source | ⭐⭐⭐⭐ Download + install | Low (automated) |
| **NuGet Package** | .NET developers | ⭐⭐⭐ dotnet add package | Low |
| **Bundled in Extension** | Development | ⭐⭐⭐⭐⭐ Automatic | None (current) |
| **.NET Tool** | CLI users | ⭐⭐⭐ dotnet tool install | Medium |

**Recommended Strategy**:
1. **Development**: Current bundled approach ✅
2. **Public Release**: Marketplace + GitHub Releases
3. **Plugin Only**: NuGet package

## Next Steps

### For Development

1. ✅ Build extension: `pwsh scripts/build-and-install.ps1`
2. ✅ Copy scripts: `npm run copy-scripts`
3. ✅ Test: `npm test`
4. Make changes to code
5. Rebuild and test

### For Release

1. Update version: `pwsh scripts/bump-version.ps1 1.0.0`
2. Update CHANGELOG.md
3. Commit: `git commit -m "chore: bump version to 1.0.0"`
4. Tag: `git tag v1.0.0`
5. Push: `git push && git push --tags`
6. GitHub Actions creates release automatically
7. (Optional) Publish to Marketplace: `vsce publish`
8. (Optional) Publish to NuGet: `dotnet nuget push`

See: [BUILD-AND-RELEASE.md](extensions/traffic-recorder/BUILD-AND-RELEASE.md)

### For Distribution

Choose your distribution channels:

**Extension**:
- [ ] GitHub Releases (automated via CI/CD)
- [ ] VS Code Marketplace (requires publisher account)
- [ ] Open VSX Registry (for VS Codium users)
- [ ] Internal network share (for enterprise)

**Plugin**:
- [ ] Bundled with extension (current, easiest)
- [ ] NuGet.org (for .NET ecosystem)
- [ ] GitHub Releases (alongside extension)
- [ ] Private NuGet feed (for enterprise)

See: [DISTRIBUTION.md](docs/DISTRIBUTION.md)

## Resources

### Documentation
- 📖 [QUICKSTART.md](extensions/traffic-recorder/QUICKSTART.md) - 5-minute start
- 📖 [README.md](extensions/traffic-recorder/README.md) - Full guide
- 📖 [SETUP.md](extensions/traffic-recorder/SETUP.md) - Setup instructions
- 📖 [AI-GUIDE.md](extensions/traffic-recorder/AI-GUIDE.md) - Development guide
- 📖 [DISTRIBUTION.md](docs/DISTRIBUTION.md) - Publishing guide
- 📖 [BUILD-AND-RELEASE.md](extensions/traffic-recorder/BUILD-AND-RELEASE.md) - Build guide

### External Resources
- [Dev Proxy Docs](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/)
- [Playwright Docs](https://playwright.dev/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## Support

- 🐛 [Report Issues](https://github.com/maxgolov/HttpRecorder/issues)
- 💬 [Discussions](https://github.com/maxgolov/HttpRecorder/discussions)
- 📧 Contact: maxgolov@github

---

**Ready to start? Run: `pwsh extensions/traffic-recorder/scripts/build-and-install.ps1`** 🚀

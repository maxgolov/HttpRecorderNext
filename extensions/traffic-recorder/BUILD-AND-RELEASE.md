# Build and Release Guide

Complete guide for building, testing, and releasing the Traffic Recorder extension.

## Quick Commands

```bash
# Build and install extension
pwsh scripts/build-and-install.ps1          # Windows
bash scripts/build-and-install.sh           # Linux/Mac

# Skip tests (faster)
pwsh scripts/build-and-install.ps1 -SkipTests
bash scripts/build-and-install.sh --skip-tests

# Copy scripts to user directory
npm run copy-scripts

# Bump version
pwsh scripts/bump-version.ps1 0.2.0
bash scripts/bump-version.sh 0.2.0
```

## Build Process

The automated build scripts perform these steps:

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build .NET Plugin
```bash
dotnet build ../../DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj --configuration Debug
```

### Step 3: Build TypeScript Extension
```bash
npm run build
# Compiles: src/**/*.ts → dist/**/*.js
```

### Step 4: Run Tests
```bash
npm test
# Runs: Extension integration tests (Mocha + VS Code Test Electron)

npm run test:unit
# Runs: Unit tests (Vitest)
```

### Step 5: Package Extension
```bash
npx @vscode/vsce package
# Creates: traffic-recorder-0.1.0.vsix
```

### Step 6: Install in VS Code
```bash
code --install-extension traffic-recorder-0.1.0.vsix
```

## Manual Build

If you prefer to build manually:

```bash
cd extensions/traffic-recorder

# 1. Install dependencies
npm install

# 2. Build plugin
cd ../../DevProxyExtension/HttpRecorder.DevProxy
dotnet build --configuration Release
cd ../../extensions/traffic-recorder

# 3. Build extension
npm run build

# 4. Run tests
npm test

# 5. Package
npm run package

# 6. Install
npm run install-extension
```

## Testing

### Extension Integration Tests

Tests run in VS Code Extension Host (Electron):

```bash
npm test
# Runs: src/test/runTest.ts
#   - Downloads VS Code
#   - Opens workspace
#   - Runs src/test/suite/**/*.test.ts
```

**Test Coverage**:
- ✅ Extension activation
- ✅ Command registration (4 commands)
- ✅ Configuration defaults
- ✅ Workspace structure
- ✅ File validation
- ✅ Plugin presence

### Unit Tests

Fast tests using Vitest:

```bash
npm run test:unit
# Runs: tests/**/*.test.ts (Vitest)
```

### Playwright Tests

Example browser tests:

```bash
npm run test:playwright
# Runs: tests/**/*.spec.ts
```

## Version Management

### Bump Version

Use the automated script:

```bash
# Windows
pwsh scripts/bump-version.ps1 0.2.0

# Linux/Mac
bash scripts/bump-version.sh 0.2.0
```

This updates:
- ✅ `package.json` - Extension version
- ✅ `HttpRecorder.DevProxy.csproj` - Plugin version
- ✅ `CHANGELOG.md` - Adds new version entry

### Manual Version Update

**package.json**:
```json
{
  "version": "0.2.0"
}
```

**HttpRecorder.DevProxy.csproj**:
```xml
<PropertyGroup>
  <Version>0.2.0</Version>
</PropertyGroup>
```

**CHANGELOG.md**:
```markdown
## [0.2.0] - 2024-01-15

### Added
- New feature X

### Changed
- Improved Y

### Fixed
- Bug Z
```

## Release Process

### 1. Prepare Release

```bash
# Update version
pwsh scripts/bump-version.ps1 1.0.0

# Update CHANGELOG.md with changes
code ../../CHANGELOG.md

# Commit changes
git add -A
git commit -m "chore: bump version to 1.0.0"
```

### 2. Create Git Tag

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main
git push origin v1.0.0
```

### 3. Automated Release (GitHub Actions)

The tag push triggers `.github/workflows/release.yml`:

**What it does**:
- ✅ Builds extension
- ✅ Runs all tests
- ✅ Creates .vsix package
- ✅ Creates NuGet package (.nupkg)
- ✅ Creates GitHub Release
- ✅ Uploads artifacts

**Release artifacts**:
- `traffic-recorder-1.0.0.vsix` - VS Code extension
- `HttpRecorder.DevProxy.1.0.0.nupkg` - Plugin NuGet package

### 4. Publish to Marketplace (Optional)

**Prerequisites**:
- Azure DevOps account
- Publisher account on [VS Code Marketplace](https://marketplace.visualstudio.com/)
- Personal Access Token (PAT)

**Steps**:

```bash
# Install vsce
npm install -g @vscode/vsce

# Login (first time)
vsce login maxgolov
# Enter PAT when prompted

# Publish
cd extensions/traffic-recorder
vsce publish
```

**Or enable in GitHub Actions**:

Uncomment in `.github/workflows/release.yml`:
```yaml
- name: Publish to VS Code Marketplace
  run: |
    cd extensions/traffic-recorder
    npx @vscode/vsce publish -p ${{ secrets.VSCE_PAT }}
```

Add secret `VSCE_PAT` to repository settings.

### 5. Publish to NuGet (Optional)

```bash
# Publish plugin
cd DevProxyExtension/HttpRecorder.DevProxy
dotnet nuget push bin/Release/HttpRecorder.DevProxy.1.0.0.nupkg \
  --api-key YOUR_API_KEY \
  --source https://api.nuget.org/v3/index.json
```

**Or enable in GitHub Actions**:

Uncomment in `.github/workflows/release.yml`:
```yaml
- name: Publish to NuGet.org
  run: |
    dotnet nuget push artifacts/*.nupkg \
      --api-key ${{ secrets.NUGET_API_KEY }} \
      --source https://api.nuget.org/v3/index.json
```

Add secret `NUGET_API_KEY` to repository settings.

## Distribution Options

See [DISTRIBUTION.md](../../docs/DISTRIBUTION.md) for complete distribution guide.

### Option 1: VS Code Marketplace (Recommended)

**User installation**:
```bash
code --install-extension maxgolov.traffic-recorder
```

Or search "Traffic Recorder" in VS Code Extensions.

### Option 2: VSIX File

**Download from GitHub Releases**:
```bash
curl -L -O https://github.com/maxgolov/HttpRecorder/releases/latest/download/traffic-recorder.vsix
code --install-extension traffic-recorder.vsix
```

### Option 3: Build from Source

**User instructions**:
```bash
git clone https://github.com/maxgolov/HttpRecorder
cd HttpRecorder/extensions/traffic-recorder
pwsh scripts/build-and-install.ps1  # Windows
bash scripts/build-and-install.sh   # Linux/Mac
```

### Option 4: Standalone Scripts

**Copy to user directory**:
```bash
npm run copy-scripts
# Copies to: ~/.traffic-recorder/
```

**User can then run**:
```bash
cd ~/.traffic-recorder
pwsh scripts/start-devproxy.ps1  # Windows
bash scripts/start-devproxy.sh   # Linux/Mac
```

## Plugin Distribution

### Option 1: Bundled with Extension (Current)

Plugin is built on-demand:
- ✅ Extension checks for plugin DLL
- ✅ If not found, runs `dotnet build`
- ✅ No separate installation

### Option 2: Pre-built in Extension

Bundle compiled plugin:
1. Build plugin Release configuration
2. Copy DLLs to `lib/HttpRecorder.DevProxy/`
3. Update `.vscodeignore` to include DLLs
4. Package extension

**Advantages**:
- No .NET SDK required for users
- Faster first run

**Implementation**:
```bash
# In build-and-install.ps1
$PluginBin = "..\..\DevProxyExtension\HttpRecorder.DevProxy\bin\Release\net9.0"
$ExtensionLib = "lib\HttpRecorder.DevProxy"
Copy-Item "$PluginBin\*" -Destination "$ExtensionLib" -Recurse
```

### Option 3: NuGet Package

**Create package**:
```bash
cd DevProxyExtension/HttpRecorder.DevProxy
dotnet pack --configuration Release
```

**Users install**:
```bash
# Download from NuGet.org
dotnet add package HttpRecorder.DevProxy

# Or manually download and reference in devproxyrc.json
```

### Option 4: GitHub Releases

**Download from release**:
```bash
curl -L -o plugin.zip https://github.com/maxgolov/HttpRecorder/releases/download/v1.0.0/HttpRecorder.DevProxy-v1.0.0.zip
unzip plugin.zip -d ~/.devproxy/plugins/HttpRecorder.DevProxy
```

## CI/CD Configuration

### GitHub Actions

**File**: `.github/workflows/release.yml`

**Triggers**:
- Push to tags: `v*` (e.g., `v1.0.0`)
- Manual dispatch

**Jobs**:
1. **build-and-release**: Builds, tests, packages, and creates release
2. **test-installation**: Tests installation on Windows, Linux, macOS

**Secrets Required** (for publishing):
- `VSCE_PAT` - VS Code Marketplace Personal Access Token
- `OVSX_PAT` - Open VSX Registry token
- `NUGET_API_KEY` - NuGet.org API key

### Adding Secrets

```bash
# GitHub repository → Settings → Secrets and variables → Actions
# Add new repository secret:
# - Name: VSCE_PAT
# - Value: <your PAT>
```

## Local Testing

### Test Extension in Clean VS Code

```bash
# Disable all other extensions
code --disable-extensions --extensionDevelopmentPath=c:\build\maxgolov\HttpRecorder\extensions\traffic-recorder
```

### Test Standalone Scripts

```bash
# Copy to user directory
npm run copy-scripts

# Test from user directory
cd ~/.traffic-recorder
pwsh scripts/start-devproxy.ps1

# In another terminal
cd ~/.traffic-recorder
npx playwright test
```

### Test VSIX Installation

```bash
# Package
npm run package

# Install in clean VS Code profile
code --user-data-dir=/tmp/vscode-test --install-extension traffic-recorder-0.1.0.vsix
```

## Troubleshooting Builds

### Build Fails: .NET SDK Not Found

```bash
# Check .NET version
dotnet --version

# Install .NET 9.0
# Windows: winget install Microsoft.DotNet.SDK.9
# Linux/Mac: https://dotnet.microsoft.com/download
```

### Build Fails: TypeScript Errors

```bash
# Clean and rebuild
rm -rf dist/ node_modules/
npm install
npm run build
```

### Tests Fail: Extension Not Found

```bash
# Ensure workspace is correct
cd extensions/traffic-recorder
npm test
```

### Package Fails: Missing Files

Check `.vscodeignore`:
```bash
# Ensure these are NOT ignored:
!dist/**/*.js
!lib/**/*.dll  # If bundling plugin
!scripts/**
!devproxyrc.json
!playwright.config.ts
```

### Installation Fails: Extension Already Installed

```bash
# Uninstall first
code --uninstall-extension maxgolov.traffic-recorder

# Then reinstall
npm run install-extension
```

## Performance Optimization

### Faster Builds

**Skip tests**:
```bash
pwsh scripts/build-and-install.ps1 -SkipTests
```

**Skip type checking**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

### Smaller VSIX

**Optimize bundle**:
```bash
# Use esbuild for smaller output
npm install --save-dev esbuild

# Update package.json
"scripts": {
  "build": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node"
}
```

**Result**: VSIX size ~50% smaller

### Faster CI/CD

**Cache dependencies**:
```yaml
# .github/workflows/release.yml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    cache: 'npm'
    cache-dependency-path: extensions/traffic-recorder/package-lock.json
```

## Maintenance

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update all
npm update

# Update specific package
npm install playwright@latest
```

### Update Dev Proxy Reference

If Dev Proxy API changes:

1. Update submodule:
   ```bash
   cd external/dev-proxy
   git pull origin main
   ```

2. Rebuild plugin:
   ```bash
   dotnet build DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj
   ```

3. Test compatibility:
   ```bash
   npm test
   ```

### Security Updates

```bash
# Check vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Fix breaking changes manually
npm audit fix --force
```

## Checklist: Before Release

- [ ] All tests pass (`npm test`)
- [ ] Version bumped (`scripts/bump-version.ps1`)
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] Example tests work
- [ ] Plugin builds successfully
- [ ] Extension installs cleanly
- [ ] Works in clean VS Code instance
- [ ] Tested on Windows/Linux/Mac (if possible)
- [ ] Git tag created
- [ ] GitHub Release created
- [ ] Artifacts uploaded

## Checklist: After Release

- [ ] Marketplace listing updated (if applicable)
- [ ] NuGet package published (if applicable)
- [ ] Documentation links verified
- [ ] Release announcement posted
- [ ] GitHub Issues labeled (closed in release)
- [ ] Discussions/Discord notified
- [ ] Monitor for issues

## Resources

- **Distribution Guide**: [DISTRIBUTION.md](../../docs/DISTRIBUTION.md)
- **Quick Start**: [QUICKSTART.md](./QUICKSTART.md)
- **Setup Guide**: [SETUP.md](./SETUP.md)
- **AI Guide**: [AI-GUIDE.md](./AI-GUIDE.md)
- **GitHub Actions Docs**: https://docs.github.com/actions
- **VSCE Publishing**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

---

**Ready to build? Run: `pwsh scripts/build-and-install.ps1`**

# HttpRecorder.DevProxy Plugin Installation - Quick Reference

## 🚀 For End Users (Default)

**No action needed!** The plugin automatically downloads from NuGet when you start Dev Proxy.

```bash
# Just run your tests
npm run test:playwright
```

The extension will:
1. Check if plugin exists in `./plugins/`
2. If not found, download from NuGet.org
3. Extract to `./plugins/`
4. Start Dev Proxy with the plugin

## 🔧 For Plugin Developers (Local Build)

### Step 1: Build the Plugin

```bash
cd DevProxyExtension
dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj -c Release
```

### Step 2: Enable Local Plugin Mode

**Option A: VS Code Settings** (Recommended)
1. Open Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "Traffic Recorder"
3. Enable `Traffic Recorder: Use Local Plugin`

**Option B: settings.json**
```json
{
  "trafficRecorder.useLocalPlugin": true
}
```

**Option C: Command Line**
```bash
cd extensions/traffic-recorder
pwsh scripts/start-devproxy.ps1 -UseLocal
```

### Step 3: Run Tests

```bash
npm run test:playwright
```

The extension will now use your local build from `../../DevProxyExtension/HttpRecorder.DevProxy/bin/Release/net9.0/`

## 📋 VS Code Tasks

### Using NuGet Package (Default)
```
Tasks: Run Task → Traffic Recorder: Start Dev Proxy (Windows)
```

### Using Local Build
```
Tasks: Run Task → Traffic Recorder: Start Dev Proxy (Windows - Local Plugin)
```

Or for full test run:
```
Tasks: Run Task → Traffic Recorder: Full Test Run (Local Plugin)
```

## 🔍 Verification

Check which source is being used by looking at the Dev Proxy output:

### NuGet Installation
```
[INFO] Installing HttpRecorder.DevProxy plugin from NuGet...
[INFO] Downloading HttpRecorder.DevProxy from NuGet...
[SUCCESS] HttpRecorder.DevProxy plugin installed from NuGet!
```

### Local Build
```
[INFO] Using local Release build...
[SUCCESS] HttpRecorder.DevProxy plugin installed from local Release build!
```

## 🐛 Troubleshooting

### Plugin Not Found

**NuGet Mode:**
```bash
# Verify package is published
https://www.nuget.org/packages/HttpRecorder.DevProxy

# Clear NuGet cache
dotnet nuget locals all --clear

# Force reinstall
Remove-Item -Recurse -Force ./plugins
```

**Local Mode:**
```bash
# Verify build exists
ls ../../DevProxyExtension/HttpRecorder.DevProxy/bin/Release/net9.0/HttpRecorder.DevProxy.dll

# Rebuild
cd ../../DevProxyExtension
dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj -c Release

# Clean plugins directory
Remove-Item -Recurse -Force ./plugins
```

### Switch Between Modes

**To NuGet (Default):**
1. Disable `trafficRecorder.useLocalPlugin` in settings
2. Delete `./plugins/` directory
3. Restart Dev Proxy

**To Local Build:**
1. Build plugin: `dotnet build -c Release`
2. Enable `trafficRecorder.useLocalPlugin` in settings
3. Delete `./plugins/` directory
4. Restart Dev Proxy

## 📦 Build Priority

When `useLocalPlugin` is enabled, the script checks in this order:

1. `../../DevProxyExtension/HttpRecorder.DevProxy/bin/Release/net9.0/` ✅ Preferred
2. `../../DevProxyExtension/HttpRecorder.DevProxy/bin/Debug/net9.0/` ⚠️ Fallback
3. Download from NuGet (if local builds not found)

## 🎯 Best Practices

### For End Users
- ✅ Keep `useLocalPlugin` disabled (default)
- ✅ Let the extension manage updates
- ✅ No manual plugin management needed

### For Plugin Developers
- ✅ Always build in Release mode for testing
- ✅ Enable `useLocalPlugin` in workspace settings, not user settings
- ✅ Use the "Local Plugin" VS Code tasks
- ✅ Test both modes before publishing

### For CI/CD
- ✅ Always use NuGet mode (default)
- ✅ Don't enable `useLocalPlugin` in CI
- ✅ Ensure plugin is published to NuGet before deploying extension

## 🔗 Related Documentation

- [Full Plugin Installation Guide](./PLUGIN-INSTALLATION.md)
- [NuGet Publishing Guide](../../DevProxyExtension/PUBLISH-NUGET.md)
- [Extension Setup](../SETUP.md)
- [Getting Started](../GETTING-STARTED.md)

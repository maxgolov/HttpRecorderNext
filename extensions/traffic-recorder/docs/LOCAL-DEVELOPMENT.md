# Local Development Setup

## Using Local Plugin Build

When developing the HttpRecorder.DevProxy plugin, you can use your local build instead of downloading from NuGet.

### Quick Setup

1. **Build the plugin locally:**
   ```powershell
   cd C:\build\maxgolov\HttpRecorder
   dotnet build DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj -c Release
   ```

2. **Enable local plugin in VS Code settings:**
   
   Add to `.vscode/settings.json`:
   ```json
   {
     "trafficRecorder.useLocalPlugin": true
   }
   ```

3. **Reload VS Code window** to pick up the new settings.

4. **Start Dev Proxy** - it will automatically use the local build from:
   - `../../DevProxyExtension/HttpRecorder.DevProxy/bin/Release/net9.0/`
   - Falls back to `Debug` if Release not found

### Manual Plugin Installation

If you need to manually install the plugin files:

```powershell
# Copy plugin DLLs to the plugins directory
$pluginDir = "C:\build\maxgolov\HttpRecorder\extensions\traffic-recorder\plugins"
$sourceDir = "C:\build\maxgolov\HttpRecorder\DevProxyExtension\HttpRecorder.DevProxy\bin\Release\net9.0"

New-Item -ItemType Directory -Force -Path $pluginDir
Copy-Item "$sourceDir\*.dll" -Destination $pluginDir -Force
```

### Plugin Files Required

Both DLLs must be present:
- ✅ `HttpRecorder.DevProxy.dll` (20 KB) - The Dev Proxy plugin
- ✅ `HttpRecorder.dll` (39 KB) - The HttpRecorder library dependency

### Troubleshooting

#### Error: "Unable to load one or more of the requested types"

**Cause:** Missing `HttpRecorder.dll` dependency

**Solution:** Ensure both DLLs are in the plugins directory:
```powershell
dir C:\build\maxgolov\HttpRecorder\extensions\traffic-recorder\plugins\
```

You should see:
- `HttpRecorder.DevProxy.dll`
- `HttpRecorder.dll`

#### Error: "Plugin HttpRecorderPlugin not found"

**Cause:** Plugin path in `devproxyrc.json` is incorrect

**Solution:** Verify the path points to `./plugins/HttpRecorder.DevProxy.dll`:
```json
{
  "plugins": [
    {
      "name": "HttpRecorderPlugin",
      "pluginPath": "./plugins/HttpRecorder.DevProxy.dll"
    }
  ]
}
```

#### Using NuGet Version Instead

To switch back to NuGet packages:

1. Set in VS Code settings:
   ```json
   {
     "trafficRecorder.useLocalPlugin": false
   }
   ```

2. Force reinstall:
   ```powershell
   cd C:\build\maxgolov\HttpRecorder\extensions\traffic-recorder\scripts
   .\start-devproxy.ps1 -Force
   ```

### Development Workflow

1. **Make changes** to HttpRecorder or HttpRecorder.DevProxy
2. **Rebuild:**
   ```powershell
   dotnet build -c Release
   ```
3. **Restart Dev Proxy** - the extension will detect and use the new build
4. **Test changes** with Playwright tests

### CI/CD Note

For production/distribution:
- Publish to NuGet: `.\DevProxyExtension\publish-nuget.ps1 -Version x.y.z`
- Users will download from NuGet automatically
- No local build needed for end users

## Settings Reference

### `trafficRecorder.useLocalPlugin`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Use locally built plugin instead of NuGet
- **When to use:** Development and testing

### `trafficRecorder.useBetaVersion`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Use Dev Proxy Beta for latest features
- **Options:** `true` (devproxy-beta) or `false` (devproxy stable)

### `trafficRecorder.devProxyPort`
- **Type:** `number`
- **Default:** `8000`
- **Description:** Port for Dev Proxy to listen on

### `trafficRecorder.outputDirectory`
- **Type:** `string`
- **Default:** `./.http-recorder`
- **Description:** Directory for HAR recordings

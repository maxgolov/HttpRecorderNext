# Manual Testing Guide for Traffic Cop Extension

## Prerequisites
- Extension installed and reloaded in VS Code
- Dev Proxy installed (via winget or manually)

## Test Steps

### 1. Start Dev Proxy
In VS Code, open Command Palette (`Ctrl+Shift+P`) and run:
```
Traffic Cop: Start Dev Proxy
```

**OR** in a terminal:
```powershell
cd extensions\traffic-recorder
pwsh -ExecutionPolicy Bypass -File scripts\start-devproxy.ps1
```

Wait for Dev Proxy to show "Recording started" message.

### 2. Run Playwright Tests
In a **NEW** terminal (keep Dev Proxy running):
```powershell
cd tests
npx playwright test google-navigation.spec.ts --headed
```

The tests will:
- Navigate to Google
- Perform searches
- Click images
- All HTTP traffic will be recorded via Dev Proxy

### 3. Check Recording
After tests complete, check the recordings directory:
```powershell
ls extensions\traffic-recorder\.http-recorder\*.har
```

You should see HAR files with timestamps.

### 4. Inspect HAR File
In VS Code:
1. Navigate to `extensions/traffic-recorder/.http-recorder/`
2. Click on a `.har` file
3. The HAR Viewer should open showing:
   - Network requests timeline
   - Request/response details
   - Performance metrics
   - Filtering options

### 5. Stop Dev Proxy
In Command Palette:
```
Traffic Cop: Stop Dev Proxy
```

**OR** press `Ctrl+C` in the Dev Proxy terminal.

## Expected Results
- ✅ Dev Proxy starts without errors
- ✅ Playwright tests run successfully through proxy
- ✅ HAR file created with recorded traffic
- ✅ HAR Viewer displays traffic correctly
- ✅ Dev Proxy stops cleanly

## Troubleshooting

### Dev Proxy won't start
```powershell
# Check if already running
Get-Process devproxy-beta -ErrorAction SilentlyContinue

# Kill if needed
Stop-Process -Name devproxy-beta -Force

# Check installation
devproxy-beta --version
```

### Tests fail with proxy errors
- Ensure Dev Proxy is running on port 8080
- Check `tests/playwright.config.ts` has correct proxy setting
- Verify `ignoreHTTPSErrors: true` is set

### No HAR file created
- Check Dev Proxy output for errors
- Verify output directory: `extensions/traffic-recorder/.http-recorder/`
- Check plugin is loaded: Look for "HttpRecorder" in Dev Proxy startup logs

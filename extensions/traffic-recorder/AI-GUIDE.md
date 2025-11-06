# AI Guide: Traffic Recorder Extension

## 🎯 Purpose

This VS Code extension enables automated HTTP traffic recording using:
- **Dev Proxy** - Microsoft's HTTP proxy for development
- **HttpRecorder Plugin** - Custom plugin to record traffic to HAR files
- **Playwright** - Browser automation for generating traffic
- **TypeScript + Vitest** - Modern testing stack

The extension **does NOT** require system-wide proxy configuration. It only configures Playwright browsers to route traffic through Dev Proxy.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  VS Code Extension (extension.ts)                            │
│  ├─ Start/Stop Dev Proxy commands                            │
│  ├─ Run Playwright tests command                             │
│  └─ Status bar integration                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Dev Proxy (localhost:8080)                                  │
│  ├─ HttpRecorder Plugin (records to HAR)                     │
│  ├─ No system proxy configuration                            │
│  └─ Self-signed certificate for HTTPS                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Playwright Tests (google-navigation.spec.ts)                │
│  ├─ Configured to use proxy via playwright.config.ts         │
│  ├─ Ignores HTTPS errors (Dev Proxy cert)                    │
│  └─ Generates HTTP traffic for recording                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  HAR Files (./recordings/)                                   │
│  ├─ Full HTTP request/response capture                       │
│  ├─ Sensitive headers anonymized                             │
│  └─ Standard HAR 1.2 format                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### For AI Agents

When a user asks you to record HTTP traffic or test web interactions:

1. **Setup** (first time only):
   ```bash
   cd extensions/traffic-recorder
   npm install
   npx playwright install
   ```

2. **Start Dev Proxy**:
   - Windows: Run task `Start Dev Proxy (Windows)` or execute:
     ```powershell
     pwsh -ExecutionPolicy Bypass -File scripts/start-devproxy.ps1
     ```
   - Linux/Mac: Run task `Start Dev Proxy (Linux/Mac)` or execute:
     ```bash
     bash scripts/start-devproxy.sh
     ```

3. **Run Tests**:
   ```bash
   npm run test:playwright
   ```

4. **View Recordings**:
   - HAR files saved to: `./recordings/`
   - View with: Chrome DevTools, HAR Viewer, or any HAR tool

5. **Stop Dev Proxy**:
   - Press `Ctrl+C` in the proxy terminal

---

## 📝 Example Sequences

### Sequence 1: Basic Google Navigation

```typescript
import { test, expect } from '@playwright/test';

test('record Google homepage', async ({ page }) => {
  // Navigate to Google
  await page.goto('https://www.google.com');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Verify we're on Google
  await expect(page).toHaveTitle(/Google/);
  
  // HAR file automatically saved to ./recordings/
});
```

**Expected HAR Output**: Captures all HTTP requests for loading Google homepage, including:
- HTML document
- CSS stylesheets
- JavaScript files
- Images and fonts
- API calls

### Sequence 2: Search with Multiple Requests

```typescript
test('record Google search', async ({ page }) => {
  // 1. Navigate to Google
  await page.goto('https://www.google.com');
  await page.waitForLoadState('networkidle');
  
  // 2. Perform search
  const searchBox = page.getByRole('combobox', { name: /search/i });
  await searchBox.fill('Playwright testing');
  await searchBox.press('Enter');
  
  // 3. Wait for results
  await page.waitForLoadState('networkidle');
  
  // 4. Verify results page
  await expect(page).toHaveURL(/google\.com\/search/);
  
  // HAR file captures:
  // - Initial page load
  // - Search suggestions API calls (if any)
  // - Search results page load
  // - All subsequent requests
});
```

### Sequence 3: Multi-page Navigation

```typescript
test('record multi-page journey', async ({ page }) => {
  // Navigate to multiple pages
  await page.goto('https://www.google.com');
  await page.waitForLoadState('networkidle');
  
  // Click Images
  const imagesLink = page.getByRole('link', { name: /images/i });
  if (await imagesLink.isVisible()) {
    await imagesLink.click();
    await page.waitForLoadState('networkidle');
  }
  
  // Go back
  await page.goBack();
  await page.waitForLoadState('networkidle');
  
  // HAR file captures entire navigation history
});
```

### Sequence 4: API-Heavy Application

```typescript
test('record API calls', async ({ page }) => {
  // Track API requests
  const apiCalls: string[] = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/')) {
      apiCalls.push(`${request.method()} ${url}`);
    }
  });
  
  // Navigate and interact
  await page.goto('https://example.com/dashboard');
  await page.waitForLoadState('networkidle');
  
  // Trigger API calls
  await page.click('[data-refresh]');
  await page.waitForLoadState('networkidle');
  
  // Log captured API calls
  console.log('Captured API calls:', apiCalls);
  
  // HAR file contains full API request/response data
});
```

---

## 🛠️ Configuration

### Dev Proxy Configuration (`devproxyrc.json`)

```json
{
  "plugins": [{
    "name": "HttpRecorderPlugin",
    "enabled": true,
    "pluginPath": "../../DevProxyExtension/HttpRecorder.DevProxy/bin/Debug/net9.0/HttpRecorder.DevProxy.dll",
    "configSection": "httpRecorder"
  }],
  "urlsToWatch": ["https://*", "http://*"],
  "port": 8080,
  "httpRecorder": {
    "outputDirectory": "./recordings",
    "mode": "Record",
    "includeBodies": true,
    "anonymizeSensitiveData": true,
    "sensitiveHeaders": [
      "Authorization",
      "Cookie",
      "Set-Cookie",
      "X-API-Key"
    ]
  }
}
```

**Key Settings**:
- `port`: Proxy port (default 8080)
- `outputDirectory`: Where HAR files are saved
- `includeBodies`: Include request/response bodies in HAR
- `anonymizeSensitiveData`: Redact sensitive headers
- `sensitiveHeaders`: Headers to anonymize

### Playwright Configuration (`playwright.config.ts`)

```typescript
export default defineConfig({
  use: {
    // Route traffic through Dev Proxy
    proxy: {
      server: 'http://localhost:8080',
      bypass: 'localhost,127.0.0.1'
    },
    
    // Accept Dev Proxy's self-signed certificate
    ignoreHTTPSErrors: true,
  }
});
```

**Important**: `ignoreHTTPSErrors: true` is required because Dev Proxy uses a self-signed certificate for HTTPS interception.

---

## 🎬 Running Tests

### Via VS Code Tasks

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type `Tasks: Run Task`
3. Select:
   - `Setup Traffic Recorder` - Initial setup (first time)
   - `Start Dev Proxy (Windows)` or `Start Dev Proxy (Linux/Mac)` - Start proxy
   - `Run Playwright Tests` - Run tests with recording

### Via Command Line

```bash
# Setup (first time)
cd extensions/traffic-recorder
npm install
npx playwright install

# Build plugin
dotnet build ../../DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj

# Terminal 1: Start Dev Proxy
pwsh -ExecutionPolicy Bypass -File scripts/start-devproxy.ps1

# Terminal 2: Run tests
npm run test:playwright
```

### Via VS Code Extension Commands

1. Press `Ctrl+Shift+P`
2. Type `Traffic Recorder`
3. Available commands:
   - `Traffic Recorder: Start Dev Proxy`
   - `Traffic Recorder: Stop Dev Proxy`
   - `Traffic Recorder: Run Playwright Tests with Recording`
   - `Traffic Recorder: Install Dev Proxy`

---

## 📊 Understanding HAR Files

### HAR File Structure

```json
{
  "log": {
    "version": "1.2",
    "creator": { "name": "DevProxy", "version": "0.22.0" },
    "entries": [
      {
        "startedDateTime": "2024-11-04T10:30:00.000Z",
        "time": 150,
        "request": {
          "method": "GET",
          "url": "https://www.google.com/",
          "headers": [...],
          "cookies": [...],
          "queryString": [...]
        },
        "response": {
          "status": 200,
          "statusText": "OK",
          "headers": [...],
          "content": { "mimeType": "text/html", "text": "..." }
        },
        "timings": { "send": 5, "wait": 100, "receive": 45 }
      }
    ]
  }
}
```

### Viewing HAR Files

1. **Chrome DevTools**:
   - Open DevTools → Network tab
   - Right-click → "Import HAR file"
   - Select your HAR file from `./recordings/`

2. **Online HAR Viewer**:
   - Visit: http://www.softwareishard.com/har/viewer/
   - Drag & drop HAR file

3. **VS Code Extensions**:
   - Install "HAR Viewer" extension
   - Open HAR file directly in VS Code

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Dev Proxy Not Starting

**Symptoms**: Proxy fails to start, error about missing .NET
**Solution**:
```bash
# Check .NET installation
dotnet --version

# Install .NET 9.0 SDK if missing
winget install Microsoft.DotNet.SDK.9
```

#### 2. Plugin Not Found

**Symptoms**: "Plugin DLL not found" error
**Solution**:
```bash
# Build the plugin
cd DevProxyExtension/HttpRecorder.DevProxy
dotnet build --configuration Debug
```

#### 3. Playwright Can't Connect to Proxy

**Symptoms**: Tests timeout or fail to load pages
**Solution**:
- Verify Dev Proxy is running: Check terminal output
- Check proxy port: `netstat -ano | findstr :8080` (Windows)
- Ensure `playwright.config.ts` has correct proxy settings

#### 4. HTTPS Certificate Errors

**Symptoms**: "Certificate invalid" or SSL errors
**Solution**:
- Ensure `ignoreHTTPSErrors: true` in `playwright.config.ts`
- Dev Proxy uses self-signed certs for HTTPS interception

#### 5. No HAR Files Generated

**Symptoms**: Tests pass but no HAR files in `./recordings/`
**Solution**:
- Check Dev Proxy logs for errors
- Verify `outputDirectory` in `devproxyrc.json`
- Ensure tests actually generate HTTP traffic (check `page.goto()` calls)

---

## 🤖 AI Agent Instructions

### When User Says: "Record traffic for website X"

1. **Create Test File**:
   ```typescript
   // tests/website-x.spec.ts
   import { test, expect } from '@playwright/test';
   
   test('record traffic for X', async ({ page }) => {
     await page.goto('https://website-x.com');
     await page.waitForLoadState('networkidle');
     // Add interactions as needed
   });
   ```

2. **Start Recording**:
   ```bash
   # Terminal 1
   cd extensions/traffic-recorder
   pwsh scripts/start-devproxy.ps1
   
   # Terminal 2
   npm run test:playwright
   ```

3. **Provide Results**:
   - HAR file location: `extensions/traffic-recorder/recordings/`
   - Summarize captured traffic
   - Suggest viewing options

### When User Says: "Test login flow and record API calls"

1. **Create Login Test**:
   ```typescript
   test('record login flow', async ({ page }) => {
     // Track API calls
     const apiCalls: string[] = [];
     page.on('request', req => {
       if (req.url().includes('/api/')) {
         apiCalls.push(`${req.method()} ${req.url()}`);
       }
     });
     
     // Navigate to login
     await page.goto('https://example.com/login');
     
     // Fill form
     await page.fill('[name="username"]', 'testuser');
     await page.fill('[name="password"]', 'testpass');
     await page.click('[type="submit"]');
     
     // Wait for redirect
     await page.waitForURL(/\/dashboard/);
     
     // Log API calls
     console.log('API calls:', apiCalls);
   });
   ```

2. **Run with Recording**: Same as above

3. **Analyze HAR**: Point out authentication endpoints, tokens, session management

### When User Says: "I need to debug why my app is slow"

1. **Create Performance Test**:
   ```typescript
   test('record performance metrics', async ({ page }) => {
     const startTime = Date.now();
     
     await page.goto('https://slow-app.com');
     await page.waitForLoadState('networkidle');
     
     const loadTime = Date.now() - startTime;
     console.log(`Page loaded in ${loadTime}ms`);
     
     // HAR file will show:
     // - Request timings
     // - Large resources
     // - Slow endpoints
   });
   ```

2. **Analyze HAR Timings**:
   - Open HAR in Chrome DevTools Network tab
   - Sort by duration
   - Identify bottlenecks

---

## 📚 Advanced Usage

### Custom HAR Processing

```typescript
import * as fs from 'fs';

// Read HAR file
const harPath = './recordings/latest.har';
const har = JSON.parse(fs.readFileSync(harPath, 'utf-8'));

// Extract all API calls
const apiCalls = har.log.entries.filter((entry: any) => 
  entry.request.url.includes('/api/')
);

// Analyze response times
const avgTime = apiCalls.reduce((sum: number, entry: any) => 
  sum + entry.time, 0
) / apiCalls.length;

console.log(`Average API response time: ${avgTime}ms`);
```

### Filtering Traffic

```typescript
// devproxyrc.json
{
  "urlsToWatch": [
    "https://api.example.com/*",
    "https://*.googleapis.com/*"
  ]
}
```

### Custom Sensitive Headers

```typescript
// devproxyrc.json
{
  "httpRecorder": {
    "anonymizeSensitiveData": true,
    "sensitiveHeaders": [
      "Authorization",
      "X-Custom-Token",
      "X-Session-Id",
      "Cookie"
    ]
  }
}
```

---

## 🎓 Learning Resources

- **Dev Proxy Docs**: https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/
- **Playwright Docs**: https://playwright.dev/
- **HAR Spec**: http://www.softwareishard.com/blog/har-12-spec/
- **HttpRecorder Library**: ../../README.md
- **Plugin Development**: ../../docs/PLUGINS_OVERVIEW.md

---

## 💡 Tips for AI Agents

1. **Always start Dev Proxy before tests**: Tests will fail if proxy isn't running
2. **Use `waitForLoadState('networkidle')`**: Ensures all requests complete before moving on
3. **Check HAR file size**: Large HAR files (>50MB) may be slow to process
4. **Anonymize sensitive data**: Always enable `anonymizeSensitiveData` for production traffic
5. **One test per HAR**: Each test run creates a new HAR file
6. **Clean up recordings**: Old HAR files accumulate in `./recordings/`

---

## 🚦 Status Indicators

| Indicator | Meaning |
|-----------|---------|
| ✅ Dev Proxy running | Green status bar, port 8080 listening |
| ❌ Dev Proxy stopped | Red status bar, no process |
| 🔄 Tests running | Terminal shows Playwright output |
| 💾 HAR saved | New file in `./recordings/` |
| ⚠️ Certificate warning | Expected with Dev Proxy (ignored by config) |

---

## 📞 Support

For issues or questions:
1. Check this AI-GUIDE.md first
2. Review [Troubleshooting](#troubleshooting) section
3. Check Dev Proxy logs in terminal
4. Review Playwright test output
5. Inspect HAR files for unexpected data

---

**Last Updated**: November 2025  
**Version**: 0.7.0  
**Maintainer**: Max Golovanov <max.golovanov+github@gmail.com>

# Traffic Recorder Extension - Setup Guide

## 📦 What Was Created

This extension provides a complete traffic recording solution with:

### Core Components
- ✅ **VS Code Extension** (`src/extension.ts`) - Commands for proxy control
- ✅ **Playwright Configuration** - Browser automation with proxy support
- ✅ **Dev Proxy Scripts** - Cross-platform startup automation
- ✅ **TypeScript Tests** - Example test suite for Google navigation
- ✅ **VS Code Tasks** - One-click workflow automation

### Project Structure
```
extensions/traffic-recorder/
├── src/
│   └── extension.ts              # VS Code extension entry point
├── tests/
│   └── google-navigation.spec.ts # Example Playwright tests
├── scripts/
│   ├── start-devproxy.ps1        # Windows: Install & start Dev Proxy
│   └── start-devproxy.sh         # Linux/Mac: Install & start Dev Proxy
├── .vscode/
│   └── tasks.json                # Local VS Code tasks
├── playwright.config.ts          # Playwright with proxy configuration
├── devproxyrc.json              # Dev Proxy + HttpRecorder config
├── vitest.config.ts             # Vitest test runner config
├── tsconfig.json                # TypeScript compiler config
├── package.json                 # Dependencies and scripts
├── .gitignore                   # Git ignore (includes recordings/)
├── .vscodeignore               # VS Code packaging ignore
├── .eslintrc.json              # ESLint configuration
├── AI-GUIDE.md                 # Comprehensive AI agent guide
├── README.md                   # User documentation
└── SETUP.md                    # This file
```

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies (2 min)
```bash
cd extensions/traffic-recorder
npm install
npx playwright install
```

### Step 2: Build HttpRecorder Plugin (1 min)
```bash
# From workspace root
dotnet build DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj
```

### Step 3: Install Dev Proxy (2 min)

**Windows**:
```powershell
winget install Microsoft.DevProxy
```

**macOS**:
```bash
brew install dev-proxy
```

**Linux**:
```bash
curl -L https://aka.ms/devproxy/setup.sh | bash
```

### Step 4: Test It! (30 sec)

**Option A: Via VS Code Tasks** (Easiest)
1. Press `Ctrl+Shift+P`
2. Type `Tasks: Run Task`
3. Select `Traffic Recorder: Start Dev Proxy (Windows)` (or Linux/Mac)
4. Open new terminal
5. Run `Traffic Recorder: Run Playwright Tests`

**Option B: Via Command Line**
```bash
# Terminal 1: Start Dev Proxy
cd extensions/traffic-recorder
pwsh scripts/start-devproxy.ps1  # Windows
# OR
bash scripts/start-devproxy.sh   # Linux/Mac

# Terminal 2: Run tests
npm run test:playwright
```

### Step 5: View Results
- HAR files saved to: `extensions/traffic-recorder/recordings/`
- Open in Chrome DevTools → Network → Import HAR

## 🎯 What This Extension Does

### 1. Proxy Management
- **Auto-installs Dev Proxy** if not present (Windows: winget, Mac: brew, Linux: script)
- **Builds HttpRecorder plugin** automatically
- **Starts/stops proxy** from VS Code commands or tasks
- **No system proxy config** - only Playwright uses the proxy

### 2. Traffic Recording
- **Records all HTTP/HTTPS** traffic to HAR files
- **Anonymizes sensitive data** (Authorization headers, cookies, API keys)
- **Filters by URL patterns** (configurable in `devproxyrc.json`)
- **Includes request/response bodies** (configurable)

### 3. Browser Automation
- **Playwright integration** - Modern, reliable browser automation
- **TypeScript tests** - Type-safe test development
- **Example tests** - Google navigation, search, multi-page flows
- **Cross-browser** - Chromium, Firefox, WebKit support

### 4. Developer Experience
- **VS Code commands** - Start proxy, run tests, stop proxy
- **VS Code tasks** - Integrated workflow automation
- **Status bar indicator** - See proxy state at a glance
- **Output channels** - View Dev Proxy logs in VS Code

## 📝 Usage Examples

### Record Traffic for Any Website

```typescript
// tests/my-site.spec.ts
import { test, expect } from '@playwright/test';

test('record my website', async ({ page }) => {
  await page.goto('https://mywebsite.com');
  await page.waitForLoadState('networkidle');
  
  // Interact with site
  await page.click('[data-menu]');
  await page.fill('[name="search"]', 'test');
  
  // HAR saved automatically to recordings/
});
```

### Track API Calls

```typescript
test('track API interactions', async ({ page }) => {
  const apiCalls: string[] = [];
  
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      apiCalls.push(`${req.method()} ${req.url()}`);
    }
  });
  
  await page.goto('https://api-app.com');
  
  console.log('Captured API calls:', apiCalls);
});
```

### Test Login Flow

```typescript
test('record login flow', async ({ page }) => {
  await page.goto('https://app.com/login');
  
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'testpass123');
  await page.click('[type="submit"]');
  
  await page.waitForURL(/\/dashboard/);
  
  // HAR captures:
  // - Login POST request
  // - Authentication response
  // - Redirect to dashboard
  // - Dashboard API calls
});
```

## ⚙️ Configuration

### Dev Proxy Settings (`devproxyrc.json`)

```json
{
  "port": 8000,                    // Proxy port
  "urlsToWatch": [
    "https://*",                   // Watch all HTTPS
    "http://*"                     // Watch all HTTP
  ],
  "httpRecorder": {
    "outputDirectory": "./recordings",
    "mode": "Record",
    "includeBodies": true,         // Include request/response bodies
    "anonymizeSensitiveData": true,
    "sensitiveHeaders": [
      "Authorization",             // Redact these headers
      "Cookie",
      "X-API-Key"
    ]
  }
}
```

### Playwright Settings (`playwright.config.ts`)

```typescript
export default defineConfig({
  use: {
    proxy: {
      server: 'http://localhost:8000',  // Dev Proxy address
      bypass: 'localhost,127.0.0.1'     // Don't proxy localhost
    },
    ignoreHTTPSErrors: true,            // Accept Dev Proxy cert
  }
});
```

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "trafficRecorder.devProxyPort": 8000,
  "trafficRecorder.outputDirectory": "./recordings",
  "trafficRecorder.autoStart": false
}
```

## 🛠️ Troubleshooting

### Issue: "Dev Proxy not found"
**Solution**: 
- Windows: `winget install Microsoft.DevProxy`
- Mac: `brew install dev-proxy`
- Linux: `curl -L https://aka.ms/devproxy/setup.sh | bash`

### Issue: "Plugin DLL not found"
**Solution**: Build the plugin:
```bash
dotnet build DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj
```

### Issue: Tests timeout
**Solution**: 
1. Check Dev Proxy is running (look for terminal output)
2. Verify port 8000 is available: `netstat -ano | findstr :8000`
3. Check `playwright.config.ts` has correct proxy settings

### Issue: No HAR files generated
**Solution**:
1. Check Dev Proxy logs for errors
2. Verify `recordings/` directory exists
3. Ensure tests navigate to URLs (`page.goto()`)
4. Review `devproxyrc.json` output directory

## 📚 Documentation

- **[AI-GUIDE.md](./AI-GUIDE.md)** - Comprehensive guide for AI agents with examples
- **[README.md](./README.md)** - User documentation and reference
- **[Workspace .vscode/tasks.json](../../.vscode/tasks.json)** - Workspace-level tasks

## 🔗 Related Resources

- **Dev Proxy**: https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/
- **Playwright**: https://playwright.dev/
- **HttpRecorder**: ../../README.md
- **Plugin Overview**: ../../docs/PLUGINS_OVERVIEW.md

## 💡 Key Features

### 1. No System Proxy Required
Unlike traditional proxy setups, this extension:
- ✅ Only configures Playwright browsers to use the proxy
- ✅ Your system network settings remain unchanged
- ✅ Other applications are not affected
- ✅ No admin privileges required

### 2. Automated Setup
Scripts handle:
- ✅ Dev Proxy installation detection
- ✅ Automatic installation if missing
- ✅ Plugin building
- ✅ Dependency management

### 3. Cross-Platform
Works on:
- ✅ Windows (PowerShell script)
- ✅ Linux (Bash script)
- ✅ macOS (Bash script)

### 4. Developer-Friendly
- ✅ TypeScript for type safety
- ✅ Vitest for fast testing
- ✅ Playwright for reliable automation
- ✅ VS Code integration

## 🎓 Next Steps

1. **Read AI-GUIDE.md** - Detailed usage guide for AI agents
2. **Explore tests/** - Check example tests
3. **Modify devproxyrc.json** - Customize recording settings
4. **Write your tests** - Create tests for your applications
5. **Review HAR files** - Analyze recorded traffic

## 🤝 Contributing

See [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## 📄 License

MIT - See [../../LICENSE](../../LICENSE)

---

**Version**: 0.1.0  
**Created**: November 2024  
**Maintainer**: maxgolov

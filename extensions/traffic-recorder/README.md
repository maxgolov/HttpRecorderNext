# Traffic Recorder Extension for VS Code

> Record HTTP traffic to HAR files using Dev Proxy, Playwright, and HttpRecorder

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.48-green.svg)](https://playwright.dev/)
[![Dev Proxy](https://img.shields.io/badge/Dev%20Proxy-0.22-orange.svg)](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/)

## 🎯 Overview

The Traffic Recorder extension enables automated HTTP traffic recording directly within VS Code. It integrates:

- **Dev Proxy** - Microsoft's HTTP proxy for development
- **HttpRecorder Plugin** - Custom plugin to record traffic to HAR (HTTP Archive) files
- **Playwright** - Modern browser automation framework
- **TypeScript + Vitest** - Type-safe testing with fast test runner

**Key Feature**: Does NOT require system-wide proxy configuration. Playwright browsers route traffic through Dev Proxy while your system remains unaffected.

## 🚀 Features

- ✅ **One-Click Recording**: Start Dev Proxy and run tests from VS Code
- ✅ **HAR File Output**: Standard HTTP Archive format compatible with all tools
- ✅ **Sensitive Data Anonymization**: Automatically redacts auth tokens, cookies, API keys
- ✅ **Cross-Platform**: Works on Windows, Linux, and macOS
- ✅ **TypeScript Tests**: Write type-safe Playwright tests
- ✅ **No System Proxy**: Only Playwright uses the proxy, not your entire system
- ✅ **Real-Time Logging**: See Dev Proxy activity in VS Code Output panel

## 📋 Prerequisites

### Required
- **VS Code** 1.95.0 or higher
- **Node.js** 20.0.0 or higher
- **.NET SDK** 9.0 or higher (for HttpRecorder plugin)

### Auto-Installed by Extension
- **Dev Proxy** (via winget on Windows, Homebrew on macOS, script on Linux)
- **Playwright Browsers** (via npm)

## 🔧 Installation

### 1. Clone Repository
```bash
git clone https://github.com/maxgolov/HttpRecorder
cd HttpRecorder/extensions/traffic-recorder
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Install Playwright Browsers
```bash
npx playwright install
```

### 4. HttpRecorder Plugin

The extension will automatically download the HttpRecorder.DevProxy plugin from NuGet when you start Dev Proxy.

**For Plugin Development** (optional):
If you're working on the plugin itself, you can build it locally:
```bash
cd ../../DevProxyExtension/HttpRecorder.DevProxy
dotnet build --configuration Release
```

Then enable the `trafficRecorder.useLocalPlugin` setting in VS Code to use your local build instead of the NuGet package.

### 5. Install Dev Proxy

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

## 🎮 Usage

### Method 1: VS Code Commands (Recommended)

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run commands:
   - `Traffic Recorder: Start Dev Proxy` - Start recording proxy
   - `Traffic Recorder: Run Playwright Tests with Recording` - Run tests
   - `Traffic Recorder: Stop Dev Proxy` - Stop proxy

### Method 2: VS Code Tasks

1. Open Command Palette
2. Select `Tasks: Run Task`
3. Choose:
   - `Setup Traffic Recorder` - First-time setup
   - `Start Dev Proxy (Windows)` or `Start Dev Proxy (Linux/Mac)`
   - `Run Playwright Tests`

### Method 3: Command Line

**Terminal 1** (Start Dev Proxy):
```bash
# Windows
pwsh -ExecutionPolicy Bypass -File scripts/start-devproxy.ps1

# Linux/Mac
bash scripts/start-devproxy.sh
```

**Terminal 2** (Run Tests):
```bash
npm run test:playwright
```

## 📝 Writing Tests

Create tests in the `tests/` directory:

```typescript
// tests/my-site.spec.ts
import { test, expect } from '@playwright/test';

test('record homepage traffic', async ({ page }) => {
  // Navigate to site
  await page.goto('https://example.com');
  await page.waitForLoadState('networkidle');
  
  // Verify page loaded
  await expect(page).toHaveTitle(/Example/);
  
  // HAR file automatically saved to ./recordings/
});
```

Run your test:
```bash
npm run test:playwright -- tests/my-site.spec.ts
```

## 📊 Viewing HAR Files

HAR files are saved to `.http-recorder` directory.

**Option 1: Chrome DevTools**
1. Open Chrome DevTools → Network tab
2. Right-click → "Import HAR file"
3. Select HAR file from `.http-recorder`

**Option 2: Online Viewer**
- Visit: http://www.softwareishard.com/har/viewer/
- Drag & drop HAR file

**Option 3: VS Code Extension**
- Install "HAR Viewer" extension from marketplace
- Open HAR files directly in VS Code

## ⚙️ Configuration

### VS Code Settings

Access via `File > Preferences > Settings` → Search "Traffic Recorder"

| Setting | Default | Description |
|---------|---------|-------------|
| `trafficRecorder.devProxyPort` | `8000` | Port for Dev Proxy |
| `trafficRecorder.outputDirectory` | `./.http-recorder` | HAR output directory |
| `trafficRecorder.autoStart` | `false` | Auto-start proxy with tests |
| `trafficRecorder.useBetaVersion` | `true` | Use Dev Proxy Beta version |
| `trafficRecorder.useLocalPlugin` | `false` | Use local plugin build (for development) |

### Dev Proxy Configuration

Edit `devproxyrc.json`:

```json
{
  "port": 8000,
  "httpRecorder": {
    "outputDirectory": "./.http-recorder",
    "mode": "Record",
    "includeBodies": true,
    "anonymizeSensitiveData": true,
    "sensitiveHeaders": [
      "Authorization",
      "Cookie",
      "X-API-Key"
    ]
  }
}
```

### Playwright Configuration

Edit `playwright.config.ts`:

```typescript
export default defineConfig({
  use: {
    proxy: {
      server: 'http://localhost:8000',
      bypass: 'localhost,127.0.0.1'
    },
    ignoreHTTPSErrors: true
  }
});
```

## 🛠️ Troubleshooting

### Dev Proxy Won't Start

**Issue**: "Dev Proxy not found" or fails to start

**Solutions**:
1. Check .NET installation: `dotnet --version` (need 9.0+)
2. Install Dev Proxy: See [Installation](#installation)
3. Verify plugin build: Check `DevProxyExtension/HttpRecorder.DevProxy/bin/Debug/net9.0/`

### Tests Timeout

**Issue**: Playwright tests timeout or fail to load pages

**Solutions**:
1. Verify Dev Proxy is running: Check terminal output
2. Check port availability: `netstat -ano | findstr :8000` (Windows) or `lsof -i :8000` (Unix)
3. Ensure proxy config in `playwright.config.ts` matches Dev Proxy port

### Certificate Errors

**Issue**: "Certificate invalid" or SSL/TLS errors

**Solution**: Dev Proxy uses self-signed certificates. Ensure `ignoreHTTPSErrors: true` in `playwright.config.ts`

### No HAR Files Generated

**Issue**: Tests pass but no HAR files appear

**Solutions**:
1. Check Dev Proxy logs for errors
2. Verify `outputDirectory` exists and is writable
3. Ensure tests generate HTTP traffic (check `page.goto()` calls)
4. Review Dev Proxy terminal for recording confirmation

## 📚 Project Structure

```
extensions/traffic-recorder/
├── src/
│   └── extension.ts          # VS Code extension entry point
├── tests/
│   └── google-navigation.spec.ts  # Example Playwright tests
├── scripts/
│   ├── start-devproxy.ps1    # Windows startup script
│   └── start-devproxy.sh     # Linux/Mac startup script
├── .vscode/
│   └── tasks.json            # VS Code tasks configuration
├── playwright.config.ts      # Playwright configuration
├── devproxyrc.json          # Dev Proxy configuration
├── vitest.config.ts         # Vitest configuration
├── tsconfig.json            # TypeScript configuration
├── package.json             # Node.js dependencies
├── AI-GUIDE.md              # Comprehensive AI agent guide
└── README.md                # This file
```

## 🧪 Example Tests

### Basic Navigation
```typescript
test('navigate to Google', async ({ page }) => {
  await page.goto('https://www.google.com');
  await expect(page).toHaveTitle(/Google/);
});
```

### Form Interaction
```typescript
test('search on Google', async ({ page }) => {
  await page.goto('https://www.google.com');
  await page.fill('[name="q"]', 'Playwright');
  await page.press('[name="q"]', 'Enter');
  await page.waitForURL(/search/);
});
```

### API Tracking
```typescript
test('track API calls', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      apiCalls.push(`${req.method()} ${req.url()}`);
    }
  });
  
  await page.goto('https://api-heavy-site.com');
  console.log('API calls:', apiCalls);
});
```

## 🔒 Security & Privacy

### Sensitive Data Anonymization

The HttpRecorder plugin automatically redacts sensitive headers:

- `Authorization`
- `Cookie`
- `Set-Cookie`
- `X-API-Key`
- `X-Auth-Token`

Configure additional headers in `devproxyrc.json`:

```json
{
  "httpRecorder": {
    "anonymizeSensitiveData": true,
    "sensitiveHeaders": [
      "Authorization",
      "X-Custom-Secret"
    ]
  }
}
```

### Best Practices

1. ✅ **Never commit HAR files with real credentials** to source control
2. ✅ Add `recordings/` to `.gitignore`
3. ✅ Review HAR files before sharing
4. ✅ Use test accounts, not production credentials
5. ✅ Enable `anonymizeSensitiveData` for all recordings

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT License - See [LICENSE](../../LICENSE)

## 🔗 Related Documentation

- [AI Guide for Agents](./AI-GUIDE.md) - Comprehensive guide for AI assistants
- [Dev Proxy Documentation](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/)
- [Playwright Documentation](https://playwright.dev/)
- [HttpRecorder Library](../../README.md)
- [Plugin Development Guide](../../docs/PLUGINS_OVERVIEW.md)

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/maxgolov/HttpRecorder/issues)
- **Discussions**: [GitHub Discussions](https://github.com/maxgolov/HttpRecorder/discussions)
- **Dev Proxy**: [Microsoft Learn Q&A](https://learn.microsoft.com/answers/)

## 🎓 Learning Resources

- **Getting Started**: See [AI-GUIDE.md](./AI-GUIDE.md)
- **Example Tests**: Check `tests/google-navigation.spec.ts`
- **HAR Format**: [HTTP Archive Spec](http://www.softwareishard.com/blog/har-12-spec/)
- **Playwright Guides**: [playwright.dev/docs](https://playwright.dev/docs/intro)

---

**Version**: 0.1.0  
**Last Updated**: November 2024  
**Maintainer**: maxgolov

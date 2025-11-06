# Traffic Cop: HTTP Traffic Recorder for Test Automation

> Comprehensive HTTP traffic recorder with automatic detection of 20+ test frameworks across 9 programming languages

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.56-green.svg)](https://playwright.dev/)
[![Dev Proxy](https://img.shields.io/badge/Dev%20Proxy-0.22-orange.svg)](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/)
[![Test Frameworks](https://img.shields.io/badge/Frameworks-20%2B-purple.svg)](#supported-frameworks)

## 🎯 Overview

Traffic Cop is a powerful VS Code extension that automatically detects your test framework and records ALL HTTP traffic—from browser interactions to backend API calls—into standard HAR (HTTP Archive) files. Unlike Playwright's built-in HAR capture which only sees browser-side traffic, Traffic Cop captures the complete picture: frontend, backend, and external API calls in a unified recording.

### Key Capabilities

- **🔍 Auto-Detection**: Automatically discovers 20+ test frameworks in your workspace
- **🌐 Full-Stack Capture**: Records browser + backend + external API traffic
- **🎭 Multi-Framework**: JavaScript/TypeScript, Python, Java, C#, Go, Ruby, PHP, Swift, Kotlin
- **📊 HAR Output**: Standard HTTP Archive format compatible with all analysis tools
- **🔒 Privacy-First**: Automatically anonymizes sensitive headers (auth tokens, cookies, API keys)
- **⚡ Zero Config**: Start recording with one click—no manual proxy setup required

## 🚀 What Makes Traffic Cop Unique?

### Complete Traffic Visibility

```
User (Browser) → ✅ Captured by Traffic Cop
    ↓
Frontend App → ✅ Captured by Traffic Cop  
    ↓
Backend Server → ✅ Captured by Traffic Cop (Python, Node, .NET, Java, etc.)
    ↓
External APIs → ✅ Captured by Traffic Cop (OpenAI, Azure, AWS, etc.)
    ↓
Microservices → ✅ Captured by Traffic Cop
```

**Playwright's HAR** only sees: Browser → Frontend  
**Traffic Cop** sees: Browser → Frontend → Backend → External APIs (complete flow!)

### Use Cases

- **🐛 E2E Debugging**: See the entire request chain from UI click to backend API call
- **💰 Cost Analysis**: Track API usage and costs during testing (OpenAI, Azure, etc.)
- **🔍 Performance**: Identify slow backend calls, retries, and bottlenecks
- **📝 Documentation**: Auto-generate API documentation from actual test runs
- **🎯 Mocking**: Create realistic mock data from production-like test scenarios

## 📦 Supported Frameworks

Traffic Cop automatically detects and supports 20+ test frameworks across 9 languages:

### JavaScript/TypeScript (7 frameworks)
| Framework | Icon | Detection Method | Proxy Support |
|-----------|------|-----------------|---------------|
| **Playwright** | 🎭 | `playwright.config.{ts,js,mjs}` | ✅ Full (browser + network) |
| **Jest** | 🃏 | `jest.config.{js,ts}` + `package.json` | ✅ Full (via `HTTP_PROXY`) |
| **Vitest** | ⚡ | `vitest.config.{ts,js}` or `vite.config.{ts,js}` | ✅ Full (via `nodeEnv`) |
| **Cypress** | 🌲 | `cypress.config.{ts,js}` | ✅ Full (built-in proxy) |
| **Mocha** | ☕ | `package.json` with mocha dependency | ✅ Full (via `HTTP_PROXY`) |
| **Jasmine** | 🌸 | `jasmine.json` | ✅ Full (via `HTTP_PROXY`) |
| **TestCafe** | 🧪 | `.testcaferc.{json,js}` | ✅ Full (built-in proxy) |

### Python (3 frameworks)
| Framework | Icon | Detection Method | Proxy Support |
|-----------|------|-----------------|---------------|
| **pytest** | 🐍 | `pytest.ini`, `pyproject.toml`, `setup.cfg` | ✅ Full (`requests` lib respects proxy) |
| **unittest** | 🐍 | Python files with `import unittest` | ✅ Full (via `HTTP_PROXY`) |
| **Robot Framework** | 🤖 | `*.robot` files | ✅ Full (via `HTTP_PROXY`) |

### Java (3 frameworks)
| Framework | Icon | Detection Method | Proxy Support |
|-----------|------|-----------------|---------------|
| **JUnit** | ☕ | `pom.xml` or `build.gradle` with JUnit | ✅ Full (via JVM proxy settings) |
| **TestNG** | 🧪 | `testng.xml` | ✅ Full (via JVM proxy settings) |
| **Kotest** | 🔧 | `build.gradle.kts` with Kotest | ✅ Full (Kotlin respects proxy) |

### C#/.NET (2 frameworks)
| Framework | Icon | Detection Method | Proxy Support |
|-----------|------|-----------------|---------------|
| **NUnit** | 🔷 | `*.csproj` with NUnit packages | ✅ Full (via system proxy) |
| **xUnit** | ❎ | `*.csproj` with xUnit packages | ✅ Full (via system proxy) |

### Other Languages (5 frameworks)
| Framework | Icon | Language | Detection Method | Proxy Support |
|-----------|------|----------|-----------------|---------------|
| **Go test** | 🔵 | Go | `go.mod` + `*_test.go` | ✅ Full (via `HTTP_PROXY`) |
| **RSpec** | 💎 | Ruby | `.rspec` or `spec_helper.rb` | ✅ Full (via `HTTP_PROXY`) |
| **PHPUnit** | 🐘 | PHP | `phpunit.xml` | ✅ Full (via `HTTP_PROXY`) |
| **XCTest** | 🍎 | Swift | `*.xcodeproj` or `Package.swift` | ✅ Full (URLSession respects proxy) |

### How Auto-Detection Works

1. **Workspace Scan**: Extension scans for configuration files (e.g., `playwright.config.ts`, `pytest.ini`, `pom.xml`)
2. **Dependency Check**: Verifies framework is actually installed (checks `package.json`, `pyproject.toml`, etc.)
3. **Smart Display**: Only shows "Record [Framework] Tests" buttons for detected frameworks
4. **Auto-Refresh**: Re-scans when you add/modify config files (file watcher)

**Configuration**: Disable auto-detection via `trafficRecorder.autoDetectFrameworks` setting (enabled by default).

## 📋 Prerequisites

### Required
- **VS Code** 1.105.0 or higher
- **Node.js** 20.0.0 or higher
- **.NET SDK** 9.0 or higher (for HttpRecorder plugin)

### Auto-Installed by Extension
- **Dev Proxy** (via winget on Windows, Homebrew on macOS, script on Linux)
- **Playwright Browsers** (via npm)

## 🔧 Installation

### 1. Clone Repository
```bash
git clone https://github.com/maxgolov/HttpRecorderNext
cd HttpRecorderNext/extensions/traffic-recorder
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
| `trafficRecorder.devProxyPort` | `8080` | Port for Dev Proxy |
| `trafficRecorder.outputDirectory` | `./.http-recorder` | HAR output directory |
| `trafficRecorder.autoStart` | `false` | Auto-start proxy with tests |
| `trafficRecorder.useBetaVersion` | `true` | Use Dev Proxy Beta version |
| `trafficRecorder.useLocalPlugin` | `false` | Use local plugin build (for development) |

### Dev Proxy Configuration

Edit `devproxyrc.json`:

```json
{
  "port": 8080,
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
      server: 'http://localhost:8080',
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
2. Check port availability: `netstat -ano | findstr :8080` (Windows) or `lsof -i :8080` (Unix)
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

- **Issues**: [GitHub Issues](https://github.com/maxgolov/HttpRecorderNext/issues)
- **Discussions**: [GitHub Discussions](https://github.com/maxgolov/HttpRecorderNext/discussions)
- **Dev Proxy**: [Microsoft Learn Q&A](https://learn.microsoft.com/answers/)

## 🎓 Learning Resources

- **Getting Started**: See [AI-GUIDE.md](./AI-GUIDE.md)
- **Example Tests**: Check `tests/google-navigation.spec.ts`
- **HAR Format**: [HTTP Archive Spec](http://www.softwareishard.com/blog/har-12-spec/)
- **Playwright Guides**: [playwright.dev/docs](https://playwright.dev/docs/intro)

---

**Version**: 0.7.0  
**Last Updated**: November 2025  
**Maintainer**: Max Golovanov <max.golovanov+github@gmail.com>

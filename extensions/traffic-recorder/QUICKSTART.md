# Traffic Recorder - Quick Start Guide

Get started with Traffic Recorder in 5 minutes!

## Prerequisites

- ✅ **VS Code**: Version 1.95.0 or higher
- ✅ **.NET SDK**: Version 9.0 or higher ([Download](https://dotnet.microsoft.com/download))
- ✅ **Node.js**: Version 20+ ([Download](https://nodejs.org/))
- ✅ **Dev Proxy**: Microsoft Dev Proxy 0.22+ ([Install Guide](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/get-started))

## 1. Install Extension

### Option A: From Source (Recommended for Development)

```bash
# Clone repository
git clone https://github.com/maxgolov/HttpRecorder
cd HttpRecorder/extensions/traffic-recorder

# Build and install (Windows)
pwsh scripts/build-and-install.ps1

# OR Build and install (Linux/Mac)
bash scripts/build-and-install.sh
```

### Option B: From VSIX

```bash
# Download latest release
curl -L -O https://github.com/maxgolov/HttpRecorder/releases/latest/download/traffic-recorder.vsix

# Install
code --install-extension traffic-recorder.vsix
```

### Option C: From Marketplace (Coming Soon)

```bash
code --install-extension maxgolov.traffic-recorder
```

## 2. Install Dev Proxy

If you don't have Dev Proxy installed:

**Windows (PowerShell)**:
```powershell
winget install Microsoft.DevProxy
```

**Linux/Mac**:
```bash
bash -c "$(curl -sL https://aka.ms/devproxy/setup.sh)"
```

**Or use the extension command**:
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
- Run: `Traffic Recorder: Install Dev Proxy`

## 3. Configure Your Workspace

Create a workspace for your project:

```bash
mkdir my-test-project
cd my-test-project
code .
```

The extension will automatically create:
- `devproxyrc.json` - Dev Proxy configuration
- `playwright.config.ts` - Playwright test configuration
- `tests/` - Example test directory

## 4. Write Your First Test

Create `tests/example.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('record API calls', async ({ page }) => {
  await page.goto('https://jsonplaceholder.typicode.com');
  await page.click('a[href="/posts"]');
  await expect(page).toHaveURL(/.*posts/);
});
```

## 5. Start Recording

**Method 1: Command Palette**
- Press `Ctrl+Shift+P` / `Cmd+Shift+P`
- Run: `Traffic Recorder: Start Dev Proxy`

**Method 2: Status Bar**
- Click the "▶ Start Dev Proxy" button in the status bar

**Method 3: Task**
- Terminal → Run Task → "Traffic Recorder: Start Dev Proxy"

## 6. Run Your Tests

**Method 1: Command Palette**
- Press `Ctrl+Shift+P` / `Cmd+Shift+P`
- Run: `Traffic Recorder: Run Playwright Tests`

**Method 2: Terminal**
```bash
npm run test:playwright
```

## 7. View Recorded Traffic

After running tests, find your recordings in:

```
recordings/
├── 2024-01-15_10-30-45_example.har
└── 2024-01-15_10-31-20_another-test.har
```

Open HAR files with:
- **Chrome DevTools**: Press F12 → Network → Right-click → Import HAR
- **Firefox DevTools**: Press F12 → Network → Gear icon → Import HAR
- **Online Viewers**: [HTTP Archive Viewer](https://toolbox.googleapps.com/apps/har_analyzer/)
- **VS Code**: Install HAR Viewer extension

## 8. Stop Recording

**Method 1: Command Palette**
- Press `Ctrl+Shift+P` / `Cmd+Shift+P`
- Run: `Traffic Recorder: Stop Dev Proxy`

**Method 2: Status Bar**
- Click the "⏹ Stop Dev Proxy" button

## Configuration

Edit `devproxyrc.json` to customize:

```json
{
  "plugins": [{
    "name": "HttpRecorderPlugin",
    "enabled": true,
    "pluginPath": "../../DevProxyExtension/HttpRecorder.DevProxy/bin/Debug/net9.0/HttpRecorder.DevProxy.dll",
    "configSection": "httpRecorderPlugin"
  }],
  "httpRecorderPlugin": {
    "outputDirectory": "./recordings",
    "autoStart": false
  }
}
```

### Common Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `outputDirectory` | Where to save HAR files | `./recordings` |
| `autoStart` | Start recording automatically | `false` |
| `port` | Dev Proxy port | `8000` |

## Troubleshooting

### Extension Not Found

```bash
# Reinstall extension
code --uninstall-extension maxgolov.traffic-recorder
code --install-extension traffic-recorder.vsix
```

### Dev Proxy Not Starting

1. Check if Dev Proxy is installed:
   ```bash
   devproxy --version
   ```

2. Verify port 8000 is available:
   ```bash
   # Windows
   netstat -ano | findstr :8000
   
   # Linux/Mac
   lsof -i :8000
   ```

3. Check extension output:
   - View → Output → Select "Traffic Recorder"

### No HAR Files Generated

1. Verify Playwright is configured with proxy:
   ```typescript
   // playwright.config.ts
   export default defineConfig({
     use: {
       proxy: {
         server: 'http://localhost:8000'
       }
     }
   });
   ```

2. Check Dev Proxy is running:
   - Look for "▶ Running" in status bar

3. Check output directory exists:
   ```bash
   mkdir recordings
   ```

### Tests Failing to Connect

If tests can't connect through proxy:

1. **Check SSL certificates**:
   ```bash
   # Install Dev Proxy certificates
   devproxy --install-cert
   ```

2. **Disable SSL verification** (dev only):
   ```typescript
   // playwright.config.ts
   use: {
     ignoreHTTPSErrors: true
   }
   ```

3. **Check firewall**:
   - Allow Dev Proxy through Windows Firewall
   - Allow Node.js through firewall

### Plugin Not Loading

1. Check plugin path in `devproxyrc.json`
2. Rebuild plugin:
   ```bash
   dotnet build DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj
   ```
3. Check Dev Proxy logs in Output panel

## Next Steps

- **Read Full Documentation**: [README.md](./README.md)
- **Setup Guide**: [SETUP.md](./SETUP.md)
- **AI Development Guide**: [AI-GUIDE.md](./AI-GUIDE.md)
- **Quick Reference**: [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)
- **Distribution**: [DISTRIBUTION.md](../../docs/DISTRIBUTION.md)

## Common Workflows

### Workflow 1: Record and Replay

```bash
# 1. Start recording
# Click "Start Dev Proxy" in status bar

# 2. Run tests
npm run test:playwright

# 3. Stop recording
# Click "Stop Dev Proxy"

# 4. Review HAR files
code recordings/*.har
```

### Workflow 2: Continuous Recording

```json
// devproxyrc.json
{
  "httpRecorderPlugin": {
    "autoStart": true  // Auto-record all proxy traffic
  }
}
```

### Workflow 3: Selective Recording

```typescript
// Only record specific tests
test.describe('API Tests', () => {
  test.beforeAll(async () => {
    // Start recording via API or command
  });
  
  test('records this test', async ({ page }) => {
    // ... test code
  });
  
  test.afterAll(async () => {
    // Stop recording
  });
});
```

## Examples

### Example 1: REST API Testing

```typescript
import { test, expect } from '@playwright/test';

test('CRUD operations', async ({ page }) => {
  // GET
  await page.goto('https://api.example.com/users');
  
  // POST
  await page.evaluate(() => {
    fetch('https://api.example.com/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'John' })
    });
  });
  
  // All HTTP traffic is recorded to HAR
});
```

### Example 2: GraphQL Testing

```typescript
test('GraphQL queries', async ({ page }) => {
  await page.goto('https://graphql.example.com');
  
  await page.evaluate(() => {
    fetch('https://graphql.example.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ users { id name } }'
      })
    });
  });
});
```

### Example 3: Authentication Flows

```typescript
test('login flow', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.fill('#username', 'user');
  await page.fill('#password', 'pass');
  await page.click('button[type=submit]');
  
  // Records authentication headers, tokens, cookies
});
```

## Performance Tips

1. **Use specific output directories per test suite**:
   ```json
   {
     "httpRecorderPlugin": {
       "outputDirectory": "./recordings/${SUITE_NAME}"
     }
   }
   ```

2. **Filter recorded traffic**:
   - Configure URL patterns in Dev Proxy
   - Only proxy API calls, not static assets

3. **Clean up old recordings**:
   ```bash
   # Delete recordings older than 7 days
   find recordings -name "*.har" -mtime +7 -delete
   ```

## Resources

- **Dev Proxy Documentation**: https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/
- **Playwright Documentation**: https://playwright.dev/
- **HAR Spec**: http://www.softwareishard.com/blog/har-12-spec/
- **GitHub Issues**: https://github.com/maxgolov/HttpRecorder/issues

## Getting Help

1. **Check Documentation**: [README.md](./README.md)
2. **Search Issues**: [GitHub Issues](https://github.com/maxgolov/HttpRecorder/issues)
3. **Ask Questions**: [GitHub Discussions](https://github.com/maxgolov/HttpRecorder/discussions)
4. **Report Bugs**: [New Issue](https://github.com/maxgolov/HttpRecorder/issues/new)

---

**Happy Recording! 🎬**

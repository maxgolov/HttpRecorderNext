# Traffic Recorder - Quick Reference Card

> **TL;DR**: Record HTTP traffic to HAR files using Dev Proxy + Playwright, no system proxy required

## ⚡ 30-Second Start

```bash
cd extensions/traffic-recorder

# Terminal 1: Start proxy
pwsh scripts/start-devproxy.ps1    # Windows
bash scripts/start-devproxy.sh     # Linux/Mac

# Terminal 2: Run tests
npm run test:playwright

# Results: ./recordings/*.har
```

## 🎯 Core Commands

| Action | VS Code Command | CLI |
|--------|----------------|-----|
| Start Proxy | `Traffic Recorder: Start Dev Proxy` | `pwsh scripts/start-devproxy.ps1` |
| Stop Proxy | `Traffic Recorder: Stop Dev Proxy` | `Ctrl+C` in proxy terminal |
| Run Tests | `Traffic Recorder: Run Tests` | `npm run test:playwright` |
| Install Dev Proxy | `Traffic Recorder: Install Dev Proxy` | `winget install Microsoft.DevProxy` |

## 📝 Write a Test (30 seconds)

```typescript
// tests/my-test.spec.ts
import { test } from '@playwright/test';

test('record traffic', async ({ page }) => {
  await page.goto('https://example.com');
  await page.waitForLoadState('networkidle');
  // HAR saved to ./recordings/
});
```

Run: `npm run test:playwright -- tests/my-test.spec.ts`

## ⚙️ Key Config Files

| File | Purpose | Key Setting |
|------|---------|-------------|
| `devproxyrc.json` | Proxy config | `port: 8000`, `outputDirectory: ./recordings` |
| `playwright.config.ts` | Playwright config | `proxy.server: http://localhost:8000` |
| `package.json` | Dependencies | Scripts: `test:playwright` |

## 🔧 Common Patterns

### Pattern 1: Track API Calls
```typescript
const apiCalls: string[] = [];
page.on('request', req => {
  if (req.url().includes('/api/')) {
    apiCalls.push(`${req.method()} ${req.url()}`);
  }
});
```

### Pattern 2: Test Login
```typescript
await page.goto('https://app.com/login');
await page.fill('[name="email"]', 'test@example.com');
await page.fill('[name="password"]', 'testpass');
await page.click('[type="submit"]');
await page.waitForURL(/dashboard/);
```

### Pattern 3: Multi-page Navigation
```typescript
await page.goto('https://site.com');
await page.click('a[href="/page2"]');
await page.waitForLoadState('networkidle');
await page.goBack();
```

## 🛠️ Troubleshooting (1-Minute Fixes)

| Problem | Solution |
|---------|----------|
| "Dev Proxy not found" | `winget install Microsoft.DevProxy` (Windows) |
| Tests timeout | 1. Check proxy running<br>2. Verify port 8000 free |
| No HAR files | 1. Check proxy logs<br>2. Ensure tests call `page.goto()` |
| Certificate errors | Already handled: `ignoreHTTPSErrors: true` |

## 📊 View HAR Files

**Chrome DevTools**:
1. Open DevTools → Network
2. Right-click → "Import HAR file"
3. Select from `./recordings/`

**Online**: http://www.softwareishard.com/har/viewer/

## 🔒 Security Checklist

- ✅ `anonymizeSensitiveData: true` in `devproxyrc.json`
- ✅ `recordings/*.har` in `.gitignore`
- ✅ Review HAR before sharing
- ✅ Use test accounts only

## 📚 Full Docs

- **AI Guide**: [AI-GUIDE.md](./AI-GUIDE.md) - Complete guide
- **Setup**: [SETUP.md](./SETUP.md) - 5-minute setup
- **README**: [README.md](./README.md) - Full documentation
- **Architecture**: [../docs/TRAFFIC_RECORDER_EXTENSION.md](../../docs/TRAFFIC_RECORDER_EXTENSION.md)

## 💡 Pro Tips

1. **Always start proxy first** → then run tests
2. **Use `waitForLoadState('networkidle')`** → ensures all requests complete
3. **One test per HAR file** → easier to find specific recordings
4. **Filter URLs** → only record what you need (`urlsToWatch`)
5. **Clean recordings/** → delete old HAR files periodically

## 🎓 Example Workflow

```bash
# Day 1: Setup (5 min)
npm install
npx playwright install
dotnet build ../../DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj

# Day 2+: Daily workflow
# Terminal 1
pwsh scripts/start-devproxy.ps1

# Terminal 2
npm run test:playwright

# View results
code recordings/*.har
```

## 🚀 VS Code Tasks (Easiest!)

`Ctrl+Shift+P` → `Tasks: Run Task` →
- `Traffic Recorder: Setup` (first time)
- `Traffic Recorder: Start Dev Proxy (Windows)`
- `Traffic Recorder: Run Playwright Tests`

---

**Need More?** See [AI-GUIDE.md](./AI-GUIDE.md) for examples and troubleshooting.

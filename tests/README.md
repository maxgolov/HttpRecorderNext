# Traffic Recorder Examples

This directory contains example Playwright tests that demonstrate how to use Dev Proxy for HTTP traffic recording.

## Prerequisites

1. **Dev Proxy** must be installed
2. **Playwright** must be installed in your project
3. Dev Proxy should be running before executing tests

## Quick Start

### 1. Start Dev Proxy

From VS Code:
- Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- Run "Traffic Recorder: Start Dev Proxy"

Or from terminal:
```bash
npm run start:proxy
```

### 2. Run Examples

```bash
# Run all examples
npx playwright test examples/

# Run specific example
npx playwright test examples/search-images.spec.ts

# Run with UI mode (see browser)
npx playwright test examples/search-images.spec.ts --ui

# Run headed (visible browser)
npx playwright test examples/search-images.spec.ts --headed
```

### 3. View Recorded Traffic

1. Check `.http-recorder/` directory for HAR files
2. Right-click any `.har` file in VS Code Explorer
3. Select "Traffic Recorder: Preview HAR File"
4. View requests, responses, images, and timings!

## Examples

### search-images.spec.ts

Demonstrates:
- ✅ Basic proxy configuration
- ✅ Navigation to Google Images
- ✅ Search interaction
- ✅ Waiting for network activity
- ✅ Taking screenshots
- ✅ Clicking on search results

Key features shown:
```typescript
// Proxy configuration
test.use({
  proxy: {
    server: 'http://localhost:8000',
    bypass: '<-loopback>' // Critical for localhost
  },
  ignoreHTTPSErrors: true,
});

// Navigate with network idle
await page.goto('https://images.google.com', {
  waitUntil: 'networkidle'
});

// Wait for traffic capture
await page.waitForTimeout(20000);
```

## Proxy Configuration

### Essential Settings

```typescript
test.use({
  proxy: {
    server: 'http://localhost:8000',  // Dev Proxy address
    bypass: '<-loopback>'              // REQUIRED for localhost interception
  },
  ignoreHTTPSErrors: true              // Dev Proxy uses self-signed certs
});
```

### Why `bypass: '<-loopback>'`?

By default, Chromium bypasses proxy for localhost. This special value tells it to use the proxy even for localhost connections, which is necessary for Dev Proxy to intercept traffic.

## Environment Variables

You can also configure proxy via environment variables:

```bash
# Windows PowerShell
$env:HTTP_PROXY="http://localhost:8000"
$env:HTTPS_PROXY="http://localhost:8000"
npx playwright test examples/

# Linux/Mac
HTTP_PROXY=http://localhost:8000 HTTPS_PROXY=http://localhost:8000 npx playwright test examples/
```

## Troubleshooting

### No traffic recorded?

1. ✅ Check Dev Proxy is running (status bar should show "Running")
2. ✅ Verify proxy port matches (default: 8000)
3. ✅ Ensure `bypass: '<-loopback>'` is set
4. ✅ Check `.http-recorder/` directory exists

### Certificate errors?

- Use `ignoreHTTPSErrors: true` in test configuration
- Dev Proxy uses self-signed certificates for HTTPS interception

### Test fails with timeout?

- Increase timeout: `{ timeout: 60000 }`
- Check internet connection
- Some sites may block automated browsers

## Advanced Usage

### Custom HAR File Names

Dev Proxy automatically names files with timestamps. To customize:

1. Edit `devproxyrc.json`
2. Modify the `outputDirectory` setting
3. Restart Dev Proxy

### Filter Specific Domains

Edit `devproxyrc.json`:

```json
{
  "plugins": [
    {
      "name": "HttpRecorderPlugin",
      "enabled": true,
      "pluginPath": "path/to/plugin",
      "configSection": "httpRecorder",
      "urlsToWatch": [
        "https://images.google.com/*",
        "https://*.gstatic.com/*"
      ]
    }
  ]
}
```

### Multiple Browser Contexts

```typescript
test('Multiple contexts', async ({ browser }) => {
  const context1 = await browser.newContext({
    proxy: { server: 'http://localhost:8000', bypass: '<-loopback>' },
    ignoreHTTPSErrors: true
  });
  
  const context2 = await browser.newContext({
    proxy: { server: 'http://localhost:8000', bypass: '<-loopback>' },
    ignoreHTTPSErrors: true
  });
  
  // Each context will generate separate HAR files
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  // ... your test code
  
  await context1.close();
  await context2.close();
});
```

## Tips & Best Practices

1. **Always start Dev Proxy first** before running tests
2. **Use `waitForLoadState('networkidle')`** to ensure all requests are captured
3. **Add delays** after interactions to capture lazy-loaded content
4. **Check HAR files** immediately after test to verify recording
5. **Use descriptive test names** to easily identify HAR files
6. **Stop Dev Proxy** after tests to save new HAR file

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Dev Proxy Documentation](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/)
- [HAR Format Specification](http://www.softwareishard.com/blog/har-12-spec/)
- [Traffic Recorder Extension Docs](../README.md)

# DevTools Integration Guide

This guide explains how to integrate browser DevTools with the Traffic Recorder extension for real-time HTTP traffic monitoring.

## Overview

The Traffic Recorder extension can work alongside Microsoft Edge DevTools to provide both real-time interactive traffic viewing and persistent HAR file recording.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VS Code                                 │
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Traffic        │  │ Edge DevTools│  │ HAR File        │ │
│  │ Recorder       │  │ Extension    │  │ Viewer Panel    │ │
│  │ Tree View      │  │ (Network)    │  │ (WebView)       │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
│         │                    │                   │          │
│         └────────────────────┼───────────────────┘          │
│                              │                              │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Dev Proxy (Beta)   │
                    │   localhost:8000     │
                    │                      │
                    │  - Intercepts HTTP   │
                    │  - Records HAR       │
                    │  - Simulates errors  │
                    └──────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Browser/App        │
                    │   (with proxy)       │
                    └──────────────────────┘
```

## Option 1: Microsoft Edge DevTools Extension (Recommended)

### Installation

1. **Install Edge DevTools Extension**:
   ```
   code --install-extension ms-edgedevtools.vscode-edge-devtools
   ```

2. **Install Traffic Recorder** (if not already installed):
   ```
   code --install-extension traffic-recorder-0.1.0.vsix
   ```

### Configuration

Create or update `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "msedge",
      "request": "launch",
      "name": "Launch Edge with Dev Proxy",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}",
      "runtimeArgs": [
        "--proxy-server=127.0.0.1:8000",
        "--proxy-bypass-list=<-loopback>"
      ],
      "preLaunchTask": "Start Dev Proxy",
      "postDebugTask": "Stop Dev Proxy",
      "env": {
        "http_proxy": "http://127.0.0.1:8000",
        "https_proxy": "http://127.0.0.1:8000"
      }
    }
  ]
}
```

### Usage

1. **Start Dev Proxy**:
   - Click "Start Proxy" in Traffic Recorder sidebar panel
   - Or press `F5` (preLaunchTask will start it)

2. **Launch Edge with DevTools**:
   - Press `F5` or click "Launch Edge with Dev Proxy"
   - Edge opens with DevTools panel in VS Code

3. **View Traffic**:
   - **Real-time**: Edge DevTools → Network tab
   - **Recorded**: `.http-recorder/*.har` files

4. **Stop Debugging**:
   - Stop debugging session (DevTools closes)
   - Dev Proxy stops automatically (postDebugTask)

### Features

✅ **Real-time Network Panel**:
- View all requests/responses as they happen
- Inspect headers, payloads, timing
- Filter by type, status, URL
- Replay XHR requests

✅ **Persistent HAR Files**:
- All traffic saved to `.http-recorder/`
- Timestamped files
- Share with team members
- Analyze later with HAR viewers

✅ **Interactive Debugging**:
- Set breakpoints in JavaScript
- Inspect DOM elements
- View console logs
- Modify network conditions

## Option 2: Open DevTools Extension

### Installation

```
code --install-extension fabiospampinato.vscode-open-devtools
```

### Usage

This extension allows opening DevTools for any Chrome/Edge instance running with remote debugging enabled.

1. **Start browser with remote debugging**:
   ```powershell
   msedge --remote-debugging-port=9222 --proxy-server=127.0.0.1:8000 --proxy-bypass-list="<-loopback>"
   ```

2. **Open DevTools in VS Code**:
   - Press `Ctrl+Shift+P`
   - Run: "Open DevTools"
   - Select target from `chrome://inspect`

3. **View traffic** in Network tab

## Option 3: Custom HAR File Viewer (Built-in)

The Traffic Recorder extension includes a built-in HAR file viewer.

### Usage

1. **Start Dev Proxy** (records to `.http-recorder/`)

2. **Run your app/tests**

3. **View HAR files**:
   - Open `.http-recorder/` folder from Tree View
   - Click any `.har` file
   - VS Code opens HAR viewer WebView panel

### Features

- **Timeline view** of all requests
- **Request/Response details**
- **Timing breakdown**
- **Filter and search**
- **Export to various formats**

## Configuration Details

### Browser Launch Flags

**Critical flags for localhost interception**:

```
--proxy-server=127.0.0.1:8000           # Use Dev Proxy
--proxy-bypass-list=<-loopback>         # Include localhost in proxy
```

Without `--proxy-bypass-list=<-loopback>`, Chromium browsers bypass proxy for localhost URLs.

### Environment Variables

```json
"env": {
  "http_proxy": "http://127.0.0.1:8000",
  "https_proxy": "http://127.0.0.1:8000",
  "NODE_TLS_REJECT_UNAUTHORIZED": "0"   // Only for dev!
}
```

### Dev Proxy Settings

**devproxyrc.json**:

```json
{
  "port": 8000,
  "record": true,
  "httpRecorder": {
    "outputDirectory": "./.http-recorder",
    "mode": "Record",
    "includeBodies": true
  }
}
```

## Troubleshooting

### Problem: DevTools doesn't show localhost traffic

**Solution**: Add browser launch flag:
```
--proxy-bypass-list=<-loopback>
```

### Problem: Certificate errors in DevTools

**Solution**: Install Dev Proxy certificate:
1. Run Dev Proxy once to generate certificate
2. Accept certificate installation prompt
3. Restart browser

### Problem: HAR files empty

**Solution**: Verify Dev Proxy is running:
1. Check Traffic Recorder sidebar (should show "🟢 Running")
2. Check Dev Proxy output for errors
3. Verify `devproxyrc.json` has `"record": true`

### Problem: Edge DevTools extension not connecting

**Solution**:
1. Ensure Edge is installed
2. Update Edge DevTools extension
3. Check launch.json configuration
4. View Output → Edge DevTools for errors

## Comparison of Options

| Feature | Edge DevTools Ext | Open DevTools | Custom Viewer |
|---------|-------------------|---------------|---------------|
| **Ease of Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Real-time View** | ✅ Full | ✅ Full | ❌ HAR only |
| **Network Panel** | ✅ Yes | ✅ Yes | ⚠️ Custom |
| **JS Debugging** | ✅ Yes | ✅ Yes | ❌ No |
| **HAR Recording** | ✅ Parallel | ✅ Parallel | ✅ Only |
| **Integrated** | ✅ VS Code | ⚠️ External | ✅ VS Code |
| **Auto Launch** | ✅ Yes | ❌ Manual | ✅ Auto |

## Best Practices

### 1. Use Edge DevTools for Active Debugging

When actively debugging:
- Use Edge DevTools extension
- View traffic in real-time
- Interact with DOM, breakpoints
- HAR files saved automatically

### 2. Use HAR Files for Analysis

When analyzing past sessions:
- Open `.http-recorder/*.har` files
- Use custom viewer or external tools
- Compare multiple sessions
- Share with team

### 3. Filter Traffic Early

Configure Dev Proxy to only capture relevant traffic:

```json
{
  "urlsToWatch": [
    "https://api.example.com/*",
    "http://localhost:3000/*"
  ]
}
```

### 4. Organize HAR Files

Structure by feature or test:

```
.http-recorder/
├── auth/
│   ├── 2025-11-04T12-30-45-login.har
│   └── 2025-11-04T12-31-20-logout.har
├── api/
│   ├── 2025-11-04T13-00-00-users.har
│   └── 2025-11-04T13-05-30-posts.har
```

## Advanced: CDP Proxy for Protocol Debugging

If you need to debug the Chrome DevTools Protocol itself:

### Setup CDP Proxy

```powershell
# Install chromedp-proxy
go install github.com/chromedp/chromedp-proxy@latest

# Run CDP proxy
chromedp-proxy -l :9223 -r :9222 -log stdout

# Start browser with remote debugging
msedge --remote-debugging-port=9222

# Connect DevTools through proxy
# chrome://inspect → Configure → localhost:9223
```

This logs all CDP protocol messages between DevTools and browser.

## Resources

### Extensions

- **Edge DevTools**: https://marketplace.visualstudio.com/items?itemName=ms-edgedevtools.vscode-edge-devtools
- **Open DevTools**: https://marketplace.visualstudio.com/items?itemName=fabiospampinato.vscode-open-devtools
- **HAR Viewer**: Built into Traffic Recorder

### Documentation

- **Dev Proxy**: https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/
- **Chrome DevTools Protocol**: https://chromedevtools.github.io/devtools-protocol/
- **HAR Specification**: http://www.softwareishard.com/blog/har-12-spec/
- **VS Code Debugging**: https://code.visualstudio.com/docs/editor/debugging

### Tools

- **Jam.dev HAR Viewer**: https://jam.dev/utilities/har-file-viewer
- **HTTP Toolkit**: https://httptoolkit.com
- **Fiddler**: https://www.telerik.com/fiddler

## Summary

**Recommended Setup**:
1. Install Edge DevTools extension
2. Configure launch.json with proxy flags
3. Use Traffic Recorder to start/stop Dev Proxy
4. Debug with real-time DevTools + automatic HAR recording

This gives you the best of both worlds:
- ✅ Interactive debugging (DevTools)
- ✅ Persistent recording (HAR files)
- ✅ All integrated in VS Code
- ✅ No manual proxy management

**Next Steps**:
1. Install Edge DevTools extension
2. Try the example launch configuration
3. Start debugging with `F5`
4. View traffic in both DevTools and HAR files!

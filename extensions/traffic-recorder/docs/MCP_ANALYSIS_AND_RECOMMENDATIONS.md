# Dev Proxy MCP Integration - Analysis and Recommendations

## Executive Summary

After analyzing the Dev Proxy codebase and existing MCP implementations, here are the key findings and recommendations for the Traffic Cop MCP server.

---

## Key Findings

### 1. Dev Proxy Recording vs Proxy Lifecycle

**Two Separate Concepts:**

1. **Proxy Lifecycle** - Starting/stopping the Dev Proxy process itself
   - Endpoint: `POST /proxy/stopProxy` 
   - Action: Stops the entire Dev Proxy process
   - Use case: Complete proxy shutdown

2. **Recording State** - Controlling what the proxy does with traffic
   - Endpoint: `POST /proxy` with `{recording: true/false}`
   - Action: Toggles the `IsRecording` flag in proxy state
   - Use case: Control when plugins process/save traffic

**Critical Understanding:**

The `recording` flag in Dev Proxy controls whether plugins should process and save data during the `AfterRecordingStopAsync` event. It does NOT control whether HttpRecorder plugin captures traffic.

### 2. HttpRecorder Plugin Behavior

Your HttpRecorder plugin operates **independently** of the Dev Proxy recording flag:

- **Always captures** - HttpRecorder DLL captures ALL HTTP traffic regardless of `IsRecording` state
- **Continuous HAR writing** - Writes to HAR files in real-time as traffic flows
- **No recording flag dependency** - Does not check `ProxyState.IsRecording`

This is **different** from built-in Dev Proxy plugins which:
- Check `if (_proxyState.IsRecording)` before logging
- Only process data during recording sessions
- Implement `AfterRecordingStopAsync` to save data when recording stops

### 3. Confusion Point

The `start_capture` / `stop_capture` tools you implemented toggle Dev Proxy's `IsRecording` flag, but this has **no effect** on your HttpRecorder plugin since it always records.

---

## Recommendations

### Option A: Align with Dev Proxy Paradigm (Recommended)

**Modify HttpRecorder plugin to respect `IsRecording` flag:**

1. **Check recording state** before writing to HAR files
2. **Buffer traffic** when not recording
3. **Write HAR on stop** - Implement `AfterRecordingStopAsync` to save buffered data
4. **Keep start_capture/stop_capture** - They would now control HttpRecorder behavior

**Benefits:**
- Consistent with Dev Proxy plugin architecture
- Users control when HAR files are created
- Reduces disk I/O when not actively testing
- Enables "prepare, record, stop" workflow

**Implementation:**
```csharp
// In HttpRecorderPlugin
public override async Task AfterRecordingStopAsync(RecordingArgs args, CancellationToken cancellationToken)
{
    // Save buffered entries to HAR file
    var har = CreateHARFromBuffer(args.RequestLogs);
    await SaveHARAsync(har, cancellationToken);
}
```

### Option B: Keep Current Behavior (Immediate)

**Keep HttpRecorder always recording, add proxy lifecycle control:**

1. **Comment out start_capture/stop_capture** (as you suggested)
2. **Add start_proxy/stop_proxy** - Control the Dev Proxy process itself
3. **Document the difference** - Clear explanation that HttpRecorder always captures

**Benefits:**
- No plugin changes required
- Simpler model: proxy on = capturing
- Immediate availability
- Users get continuous HAR capture

**Trade-offs:**
- Less control over when HAR files are created
- Continuous disk I/O
- Cannot pause/resume capture without stopping proxy

---

## Proposed MCP Tool Changes

### Immediate Implementation (Option B)

#### 1. Comment Out Confusing Tools

```typescript
// TEMPORARILY DISABLED - These control Dev Proxy's recording flag,
// which does NOT affect HttpRecorder plugin (always records).
// Use start_proxy/stop_proxy to control the proxy process instead.
/*
case 'start_capture':
  return await this.startCapture(args);
case 'stop_capture':
  return await this.stopCapture(args);
*/
```

#### 2. Add Proxy Lifecycle Control

**New Tools:**

##### `start_proxy`
- **Purpose:** Start the Dev Proxy process (same as UX button)
- **Action:** Launches devproxy.exe via extension command
- **Effect:** Proxy starts, HttpRecorder begins capturing
- **API:** Uses VS Code extension `startProxy()` command

##### `stop_proxy`
- **Purpose:** Stop the Dev Proxy process gracefully
- **Action:** Calls `POST /proxy/stopProxy` endpoint
- **Effect:** Proxy stops, HttpRecorder stops capturing, HAR file saved
- **API:** REST API endpoint

**Implementation:**
```typescript
{
  name: 'start_proxy',
  description: 'Start Dev Proxy process. HttpRecorder will begin capturing all HTTP traffic to HAR files.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
},
{
  name: 'stop_proxy',
  description: 'Stop Dev Proxy process gracefully via REST API. Current HAR recording will be saved.',
  inputSchema: {
    type: 'object',
    properties: {
      host: {
        type: 'string',
        description: 'Dev Proxy API host (default: 127.0.0.1)',
      },
      apiPort: {
        type: 'number',
        description: 'Dev Proxy API port (default: 8897)',
      },
    },
    required: [],
  },
}
```

---

## Additional MCP Tools to Consider

Based on analysis of official Dev Proxy MCP and proxy capabilities:

### 1. Documentation Tools (High Priority)

From `@devproxy/mcp` - very useful for AI assistants:

#### `get_devproxy_best_practices`
- Returns best practices markdown for Dev Proxy configuration
- Helps AI generate proper devproxyrc.json configurations
- One-time call per session (cached)

#### `find_devproxy_docs`
- Searches Dev Proxy documentation by query
- Parameters: query (string), version (optional)
- Returns relevant documentation snippets

#### `get_devproxy_version`
- Returns installed Dev Proxy version
- Useful for compatibility checks

**Why Add These:**
- Help users configure Dev Proxy correctly
- Assist with troubleshooting
- Enable AI to provide contextual help
- Complement your HttpRecorder functionality

### 2. JWT Token Generation (Medium Priority)

From Dev Proxy API:

#### `create_jwt_token`
- Endpoint: `POST /proxy/jwtToken`
- Purpose: Generate JWT tokens for testing
- Parameters: JWT options (issuer, audience, claims, signing key)
- Use case: Testing auth flows without external identity provider

**Why Add:**
- Common testing scenario
- Complements HTTP traffic capture
- Users can generate test tokens via MCP

### 3. Certificate Management (Low Priority)

#### `get_root_certificate`
- Endpoint: `GET /proxy/rootCertificate?format=crt`
- Purpose: Download Dev Proxy root certificate
- Use case: Installing cert programmatically

**Why Maybe Skip:**
- Certificate trust is typically one-time setup
- OS-specific installation steps
- Less common use case

### 4. Mock Request Testing (Medium Priority)

#### `mock_request`
- Endpoint: `POST /proxy/mockRequest`
- Purpose: Trigger a mock HTTP request
- Use case: Testing proxy plugins and configuration
- Returns: 202 Accepted

**Why Add:**
- Useful for testing Dev Proxy configuration
- Quick validation without running actual apps
- Helps verify proxy is working

---

## Recommended Priority Implementation

### Phase 1: Immediate (Today)

1. ✅ Comment out `start_capture` / `stop_capture` with clear explanation
2. ✅ Add `start_proxy` tool (launches proxy via extension command)
3. ✅ Add `stop_proxy` tool (REST API to stop proxy)
4. ✅ Update documentation explaining the difference

### Phase 2: High Value (This Week)

5. Add `get_devproxy_best_practices` - Returns best practices markdown
6. Add `find_devproxy_docs` - Search Dev Proxy documentation
7. Add `get_devproxy_version` - Get installed version
8. Update `proxy_status` to include version info

### Phase 3: Complete Integration (Next Week)

9. Add `create_jwt_token` - Generate test JWT tokens
10. Add `mock_request` - Trigger mock requests
11. Consider: Plugin configuration tools
12. Consider: Rate limit configuration tools

### Phase 4: Long-term Enhancement

13. Consider modifying HttpRecorder plugin to respect `IsRecording` flag
14. Re-enable `start_capture` / `stop_capture` with proper behavior
15. Add buffer management and session-based HAR creation

---

## Architecture Insights

### Current State

```
MCP Client (AI Assistant)
    ↓
Traffic Cop MCP Server
    ↓
├─→ Dev Proxy REST API (port 8897)
│   ├─ GET /proxy (status)
│   ├─ POST /proxy (recording toggle) ← Currently no effect on HttpRecorder
│   ├─ POST /proxy/stopProxy (stop proxy)
│   ├─ POST /proxy/jwtToken (JWT generation)
│   └─ GET /proxy/rootCertificate (cert download)
│
├─→ HAR Files (.http-recorder/*.har)
│   └─ Direct file access for analysis
│
└─→ devproxyrc.json (configuration)
    └─ Direct file R/W for config management
```

### Missing Connection

The MCP server currently **cannot start** the Dev Proxy process because:
- MCP server runs standalone (stdio transport)
- No IPC mechanism with VS Code extension
- Cannot execute VS Code commands directly

**Solution Options:**

1. **File-based Command Queue** (Simple)
   - Write command to `.http-recorder/commands.json`
   - Extension watches file and executes commands
   - MCP polls for result

2. **HTTP Endpoint in Extension** (Complex)
   - Extension exposes local HTTP server
   - MCP calls extension APIs
   - Requires port management and security

3. **Child Process Spawn** (Direct)
   - MCP spawns devproxy.exe directly
   - Requires knowing devproxy installation path
   - Platform-specific (Windows/Mac/Linux)

**Recommended: Option 3 (Direct Spawn)**

```typescript
private async startProxy(_args: any) {
  try {
    // Platform-specific devproxy path detection
    const devProxyPath = await this.findDevProxyPath();
    
    const child = spawn(devProxyPath, [
      '--config-file', join(this.config.recordingsDir, 'devproxyrc.json')
    ], {
      detached: true,
      stdio: 'ignore'
    });
    
    child.unref(); // Allow parent to exit
    
    // Wait for proxy to be ready
    await this.waitForProxyReady();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'success',
          message: 'Dev Proxy started',
          pid: child.pid
        }, null, 2)
      }]
    };
  } catch (error) {
    return { /* error response */ };
  }
}

private async findDevProxyPath(): Promise<string> {
  // Check common installation paths
  const paths = process.platform === 'win32'
    ? [
        join(process.env.USERPROFILE!, '.devproxy', 'devproxy.exe'),
        'C:\\Program Files\\DevProxy\\devproxy.exe'
      ]
    : [
        '/usr/local/bin/devproxy',
        join(process.env.HOME!, '.devproxy', 'devproxy')
      ];
  
  for (const path of paths) {
    if (await this.fileExists(path)) {
      return path;
    }
  }
  
  // Fallback: assume in PATH
  return 'devproxy';
}
```

---

## Summary of Changes Needed

### Files to Modify

1. **`src/mcp/server.ts`**
   - Comment out `start_capture` / `stop_capture` cases in switch
   - Add `start_proxy` / `stop_proxy` cases
   - Add tool definitions for start_proxy / stop_proxy
   - Implement `startProxy()` method with process spawning
   - Implement `stopProxy()` method (already done, just rename)
   - Add `findDevProxyPath()` helper
   - Add `waitForProxyReady()` helper

2. **`docs/MCP_NEW_FEATURES.md`**
   - Update to clarify recording vs proxy lifecycle
   - Document start_proxy / stop_proxy
   - Explain why start_capture/stop_capture are disabled
   - Add troubleshooting section

3. **`docs/MCP_QUICK_REFERENCE.md`**
   - Replace start_capture/stop_capture with start_proxy/stop_proxy
   - Update workflows
   - Clarify recording behavior

### New Features to Add (Phase 2)

4. **Documentation Integration**
   - Fetch best practices from Dev Proxy docs
   - Search Dev Proxy documentation
   - Get version information

---

## Testing Strategy

1. **Unit Tests**
   - Test process spawning on Windows/Mac/Linux
   - Test path detection logic
   - Mock child_process.spawn

2. **Integration Tests**
   - Start proxy via MCP → Verify process running
   - Stop proxy via MCP → Verify clean shutdown
   - Status check → Verify correct state

3. **E2E Tests**
   - Full workflow: start → capture → stop → analyze
   - Error cases: proxy already running, not installed
   - Platform-specific behavior

---

## Conclusion

**Immediate Action Items:**

1. ✅ Comment out `start_capture` / `stop_capture` (confusing, no effect)
2. ✅ Implement `start_proxy` with process spawning
3. ✅ Rename existing `stopCapture()` to `stopProxy()`
4. ✅ Update documentation with clear explanations
5. ⏭️ Consider adding Dev Proxy documentation tools (Phase 2)

**Long-term Consideration:**

Modify HttpRecorder plugin to respect `IsRecording` flag for a more consistent Dev Proxy plugin experience. This would:
- Enable true start/stop recording control
- Reduce disk I/O when not testing
- Align with Dev Proxy plugin architecture
- Re-enable `start_capture` / `stop_capture` with proper semantics

**Question for You:**

Do you want to proceed with:
- **Option A:** Comment out confusing tools, add start_proxy/stop_proxy now (quick fix)
- **Option B:** Also modify HttpRecorder plugin to respect recording flag (proper fix)

Let me know and I'll implement accordingly!
